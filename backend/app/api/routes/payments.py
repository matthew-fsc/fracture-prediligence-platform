"""
Stripe checkout session creation.
POST /api/create-checkout  (requires Clerk auth)
GET  /api/user/subscription (requires Clerk auth)
POST /api/add-engagement    (requires Clerk auth) — overage seat add-on
"""

from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.analytics_events import track
from app.core.database import get_db
from app.core.db_functions import get_spots_remaining, get_user_subscription
from app.core.config import settings
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import ChannelPartner, CompanyEngagementBilling, UserSubscription

router = APIRouter()

# ---------------------------------------------------------------------------
# Stripe config
# ---------------------------------------------------------------------------

stripe.api_key = settings.STRIPE_SECRET_KEY

FRONTEND_URL = settings.FRONTEND_URL

# Two-dimension price map keyed by (tier, interval).
# Annual price IDs must be configured in env; monthly IDs are always required.
def _price_ids() -> dict[tuple[str, str], Optional[str]]:
    return {
        ("founding", "monthly"): settings.STRIPE_FOUNDING_PRICE_ID or None,
        ("founding", "annual"):  settings.STRIPE_FOUNDING_ANNUAL_PRICE_ID or None,
        ("pro",      "monthly"): settings.STRIPE_PRO_PRICE_ID or None,
        ("pro",      "annual"):  settings.STRIPE_PRO_ANNUAL_PRICE_ID or None,
        ("team",     "monthly"): settings.STRIPE_TEAM_PRICE_ID or None,
        ("team",     "annual"):  settings.STRIPE_TEAM_ANNUAL_PRICE_ID or None,
    }


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    tier: str                          # "founding" | "pro" | "team"
    email: Optional[str] = None
    billing_interval: str = "monthly"  # "monthly" | "annual"
    ref_code: Optional[str] = None     # referral code (3B)
    partner_slug: Optional[str] = None # channel partner slug (3D)


class AddEngagementRequest(BaseModel):
    company_id: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/create-checkout")
async def create_checkout(
    body: CheckoutRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for the requested tier and billing interval."""
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured — add STRIPE_SECRET_KEY to .env")

    tier = body.tier.lower()
    interval = body.billing_interval.lower()
    if interval not in ("monthly", "annual"):
        raise HTTPException(status_code=400, detail="billing_interval must be 'monthly' or 'annual'")

    if tier == "founding" and get_spots_remaining(db) <= 0:
        raise HTTPException(
            status_code=409,
            detail="Founding tier is sold out — no spots remaining.",
        )

    price_id = _price_ids().get((tier, interval))
    if not price_id:
        # Fall back to monthly if annual price not yet configured
        if interval == "annual":
            price_id = _price_ids().get((tier, "monthly"))
            interval = "monthly"
        if not price_id:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown tier '{tier}'. Must be one of: founding, pro, team",
            )

    try:
        session_kwargs: dict = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{FRONTEND_URL}/dashboard/onboarding?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{FRONTEND_URL}/pricing",
            "metadata": {
                "user_id": user.user_id,
                "tier": tier,
                "billing_interval": interval,
                "ref_code": body.ref_code or "",
            },
            "allow_promotion_codes": True,
        }

        if body.email:
            session_kwargs["customer_email"] = body.email

        # Apply channel partner discount coupon (3D)
        if body.partner_slug:
            partner = (
                db.query(ChannelPartner)
                .filter(ChannelPartner.slug == body.partner_slug, ChannelPartner.is_active == True)
                .first()
            )
            if partner and partner.stripe_coupon_id:
                session_kwargs["discounts"] = [{"coupon": partner.stripe_coupon_id}]
                session_kwargs["metadata"]["partner_slug"] = body.partner_slug

        session = stripe.checkout.Session.create(**session_kwargs)

        track("checkout_initiated", user_id=user.user_id, properties={
            "tier": tier,
            "billing_interval": interval,
            "has_ref_code": bool(body.ref_code),
            "partner_slug": body.partner_slug,
        })

        return {"checkout_url": session.url}

    except stripe.StripeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/add-engagement")
async def add_engagement(
    body: AddEngagementRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a per-engagement overage line item to the user's existing Stripe subscription.
    Called when an advisor creates a company that exceeds their plan's max_companies limit.
    """
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    overage_price_id = settings.STRIPE_ENGAGEMENT_OVERAGE_PRICE_ID
    if not overage_price_id:
        raise HTTPException(status_code=503, detail="Engagement overage billing not configured")

    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    if not sub or sub.status != "active":
        raise HTTPException(status_code=402, detail="Active subscription required")
    if not sub.stripe_subscription_id:
        raise HTTPException(status_code=402, detail="No Stripe subscription found")

    existing = (
        db.query(CompanyEngagementBilling)
        .filter(
            CompanyEngagementBilling.company_id == body.company_id,
            CompanyEngagementBilling.user_id == user.user_id,
        )
        .first()
    )
    if existing:
        return {"status": "already_billed", "billing_status": existing.billing_status}

    try:
        item = stripe.SubscriptionItem.create(
            subscription=sub.stripe_subscription_id,
            price=overage_price_id,
            quantity=1,
        )
        billing = CompanyEngagementBilling(
            company_id=body.company_id,
            user_id=user.user_id,
            billing_status="add_on",
            stripe_subscription_item_id=item.id,
        )
        db.add(billing)
        db.commit()
        return {"status": "added", "stripe_item_id": item.id}
    except stripe.StripeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/me")
def get_me(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current user id plus subscription summary for the dashboard header."""
    sub = get_user_subscription(db, user.user_id)
    return {"user_id": user.user_id, "subscription": sub}


@router.get("/user/subscription")
def get_subscription(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's current subscription tier and status."""
    sub = get_user_subscription(db, user.user_id)
    if sub is None:
        return {"tier": None, "status": "inactive"}
    return sub
