"""
Stripe checkout session creation.
POST /api/create-checkout  (requires Clerk auth)
GET  /api/user/subscription (requires Clerk auth)
"""

from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.db_functions import get_spots_remaining, get_user_subscription
from app.core.config import settings
from app.middleware.auth import CurrentUser, get_current_user

router = APIRouter()

# ---------------------------------------------------------------------------
# Stripe config
# ---------------------------------------------------------------------------

stripe.api_key = settings.STRIPE_SECRET_KEY

FRONTEND_URL = settings.FRONTEND_URL

PRICE_IDS: dict[str, Optional[str]] = {
    "founding": settings.STRIPE_FOUNDING_PRICE_ID,
    "pro": settings.STRIPE_PRO_PRICE_ID,
    "team": settings.STRIPE_TEAM_PRICE_ID,
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    tier: str          # "founding" | "pro" | "team"
    email: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/create-checkout")
async def create_checkout(
    body: CheckoutRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for the requested tier."""
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured — add STRIPE_SECRET_KEY to .env")

    tier = body.tier.lower()
    if tier == "founding" and get_spots_remaining(db) <= 0:
        raise HTTPException(
            status_code=409,
            detail="Founding tier is sold out — no spots remaining.",
        )
    price_id = PRICE_IDS.get(tier)
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tier '{tier}'. Must be one of: {list(PRICE_IDS.keys())}",
        )

    try:
        session_kwargs: dict = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{FRONTEND_URL}/dashboard/onboarding?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{FRONTEND_URL}/pricing",
            "metadata": {"user_id": user.user_id, "tier": tier},
            "allow_promotion_codes": True,
        }

        if body.email:
            session_kwargs["customer_email"] = body.email

        session = stripe.checkout.Session.create(**session_kwargs)
        return {"checkout_url": session.url}

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
