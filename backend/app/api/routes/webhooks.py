"""
Stripe webhook handler.
POST /api/webhooks/stripe  (no auth — verified by Stripe signature)

Handles:
  checkout.session.completed       → activate subscription; consume founding spot if applicable
  customer.subscription.updated    → sync tier + status (plan changes)
  customer.subscription.deleted    → cancel subscription
  invoice.payment_failed         → mark past_due
"""

import json
import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.db_functions import try_decrement_founding_spot, update_user_subscription
from app.ontology.models import UserSubscription

router = APIRouter()
logger = logging.getLogger(__name__)

STRIPE_WEBHOOK_SECRET = settings.STRIPE_WEBHOOK_SECRET
stripe.api_key = settings.STRIPE_SECRET_KEY


def _allow_unsigned_webhook() -> bool:
    return (
        settings.APP_ENV.lower() == "development"
        and getattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", False)
    )


# ---------------------------------------------------------------------------
# Helpers — map Stripe price ID → tier name
# ---------------------------------------------------------------------------

def _price_to_tier(price_id: str) -> str:
    founding_id = settings.STRIPE_FOUNDING_PRICE_ID
    pro_id = settings.STRIPE_PRO_PRICE_ID
    team_id = settings.STRIPE_TEAM_PRICE_ID

    if price_id == founding_id:
        return "founding"
    if price_id == pro_id:
        return "pro"
    if price_id == team_id:
        return "team"
    return "pro"


def _subscription_to_tier(sub_obj: dict) -> str:
    items = sub_obj.get("items", {}).get("data", [])
    if not items:
        return "pro"
    price_obj = items[0].get("price") or {}
    price_id = price_obj.get("id") or ""
    return _price_to_tier(price_id)


def _stripe_subscription_status_to_app(stripe_status: str) -> str:
    if stripe_status in ("active", "trialing"):
        return "active"
    if stripe_status == "canceled":
        return "cancelled"
    if stripe_status in ("past_due", "unpaid"):
        return "past_due"
    if stripe_status == "paused":
        return "paused"
    if stripe_status in ("incomplete", "incomplete_expired"):
        return "inactive"
    return "inactive"


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except stripe.SignatureVerificationError as exc:
            raise HTTPException(status_code=400, detail="Invalid Stripe signature") from exc
    elif _allow_unsigned_webhook():
        logger.warning(
            "Stripe webhook accepted WITHOUT signature verification "
            "(APP_ENV=development and ALLOW_UNSIGNED_STRIPE_WEBHOOKS=true). Do not use in production."
        )
        try:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid payload: {exc}") from exc
    else:
        raise HTTPException(
            status_code=503,
            detail=(
                "Stripe webhook signing not configured. Set STRIPE_WEBHOOK_SECRET. "
                "For local unsigned testing only: APP_ENV=development and ALLOW_UNSIGNED_STRIPE_WEBHOOKS=true."
            ),
        )

    event_type: str = event["type"]
    data_obj = event["data"]["object"]

    # -----------------------------------------------------------------------
    # checkout.session.completed → provision access
    # -----------------------------------------------------------------------
    if event_type == "checkout.session.completed":
        user_id: str = data_obj.get("metadata", {}).get("user_id", "")
        tier: str = (data_obj.get("metadata", {}) or {}).get("tier", "pro")
        stripe_customer_id: str = data_obj.get("customer", "") or ""
        stripe_subscription_id: str = data_obj.get("subscription", "") or ""

        if user_id:
            update_user_subscription(
                db=db,
                user_id=user_id,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id,
                tier=tier,
                status="active",
            )
            if tier == "founding":
                consumed = try_decrement_founding_spot(db)
                if not consumed:
                    logger.error(
                        "Founding checkout completed for user_id=%s but no founding spot was available. "
                        "Reconcile spots and subscription manually.",
                        user_id,
                    )

    # -----------------------------------------------------------------------
    # customer.subscription.updated → plan / status changes
    # -----------------------------------------------------------------------
    elif event_type == "customer.subscription.updated":
        stripe_subscription_id: str = data_obj.get("id", "") or ""
        stripe_customer_id: str = data_obj.get("customer", "") or ""
        stripe_status: str = data_obj.get("status", "") or ""
        tier = _subscription_to_tier(data_obj)
        app_status = _stripe_subscription_status_to_app(stripe_status)

        sub = (
            db.query(UserSubscription)
            .filter(UserSubscription.stripe_subscription_id == stripe_subscription_id)
            .first()
        )
        if sub:
            update_user_subscription(
                db=db,
                user_id=sub.user_id,
                stripe_customer_id=stripe_customer_id or (sub.stripe_customer_id or ""),
                stripe_subscription_id=stripe_subscription_id,
                tier=tier,
                status=app_status,
            )

    # -----------------------------------------------------------------------
    # customer.subscription.deleted → cancel access
    # -----------------------------------------------------------------------
    elif event_type == "customer.subscription.deleted":
        stripe_subscription_id: str = data_obj.get("id", "") or ""
        stripe_customer_id: str = data_obj.get("customer", "") or ""

        sub = (
            db.query(UserSubscription)
            .filter(UserSubscription.stripe_subscription_id == stripe_subscription_id)
            .first()
        )
        if sub:
            update_user_subscription(
                db=db,
                user_id=sub.user_id,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id,
                tier=sub.tier,
                status="cancelled",
            )

    # -----------------------------------------------------------------------
    # invoice.payment_failed → restrict access until payment succeeds
    # -----------------------------------------------------------------------
    elif event_type == "invoice.payment_failed":
        inv = data_obj
        stripe_subscription_id = inv.get("subscription")
        if stripe_subscription_id:
            sub = (
                db.query(UserSubscription)
                .filter(UserSubscription.stripe_subscription_id == stripe_subscription_id)
                .first()
            )
            if sub:
                update_user_subscription(
                    db=db,
                    user_id=sub.user_id,
                    stripe_customer_id=sub.stripe_customer_id or "",
                    stripe_subscription_id=stripe_subscription_id,
                    tier=sub.tier,
                    status="past_due",
                )

    return {"status": "ok"}
