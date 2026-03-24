"""
Stripe webhook handler.
POST /api/webhooks/stripe  (no auth — verified by Stripe signature)

Handles:
  checkout.session.completed       → activate subscription
  customer.subscription.deleted    → cancel subscription
"""

import os

import stripe
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.db_functions import update_user_subscription
from fastapi import Depends

router = APIRouter()

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


# ---------------------------------------------------------------------------
# Helper — map Stripe price ID → tier name
# ---------------------------------------------------------------------------

def _price_to_tier(price_id: str) -> str:
    founding_id = os.getenv("STRIPE_FOUNDING_PRICE_ID", "")
    pro_id      = os.getenv("STRIPE_PRO_PRICE_ID", "")
    team_id     = os.getenv("STRIPE_TEAM_PRICE_ID", "")

    if price_id == founding_id:
        return "founding"
    if price_id == pro_id:
        return "pro"
    if price_id == team_id:
        return "team"
    return "pro"  # safe default


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # Verify signature
    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except stripe.SignatureVerificationError as exc:
            raise HTTPException(status_code=400, detail="Invalid Stripe signature") from exc
    else:
        # Dev fallback — skip signature verification when secret not set
        import json
        try:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid payload: {exc}") from exc

    event_type: str = event["type"]
    data_obj = event["data"]["object"]

    # -----------------------------------------------------------------------
    # checkout.session.completed → provision access
    # -----------------------------------------------------------------------
    if event_type == "checkout.session.completed":
        user_id: str = data_obj.get("metadata", {}).get("user_id", "")
        tier: str = data_obj.get("metadata", {}).get("tier", "pro")
        stripe_customer_id: str = data_obj.get("customer", "")
        stripe_subscription_id: str = data_obj.get("subscription", "")

        if user_id:
            update_user_subscription(
                db=db,
                user_id=user_id,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id,
                tier=tier,
                status="active",
            )

    # -----------------------------------------------------------------------
    # customer.subscription.deleted → cancel access
    # -----------------------------------------------------------------------
    elif event_type == "customer.subscription.deleted":
        stripe_subscription_id: str = data_obj.get("id", "")
        stripe_customer_id: str = data_obj.get("customer", "")

        # Find the user by stripe_subscription_id
        from app.ontology.models import UserSubscription
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

    return {"status": "ok"}
