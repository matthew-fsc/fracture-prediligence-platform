"""
Stripe webhook handler.
POST /api/webhooks/stripe  (no auth — verified by Stripe signature)

Handles:
  checkout.session.completed       → activate subscription; consume founding spot; record referral
  customer.subscription.updated    → sync tier + status + billing_interval (plan changes)
  customer.subscription.deleted    → cancel subscription
  invoice.payment_failed           → mark past_due
"""

import json
import logging
import secrets

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.db_functions import try_decrement_founding_spot, update_user_subscription
from app.core.analytics_events import identify, track
from app.ontology.models import ReferralCode, ReferralConversion, UserSubscription

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
# Helpers — map Stripe price ID → (tier, interval)
# ---------------------------------------------------------------------------

def _price_to_tier_and_interval(price_id: str) -> tuple[str, str]:
    """Return (tier_name, billing_interval) for a Stripe price ID."""
    mapping = {
        settings.STRIPE_FOUNDING_PRICE_ID:        ("founding", "monthly"),
        settings.STRIPE_FOUNDING_ANNUAL_PRICE_ID:  ("founding", "annual"),
        settings.STRIPE_PRO_PRICE_ID:             ("pro",      "monthly"),
        settings.STRIPE_PRO_ANNUAL_PRICE_ID:       ("pro",      "annual"),
        settings.STRIPE_TEAM_PRICE_ID:            ("team",     "monthly"),
        settings.STRIPE_TEAM_ANNUAL_PRICE_ID:      ("team",     "annual"),
    }
    return mapping.get(price_id, ("pro", "monthly"))


def _subscription_to_tier_and_interval(sub_obj: dict) -> tuple[str, str]:
    items = sub_obj.get("items", {}).get("data", [])
    if not items:
        return "pro", "monthly"
    price_obj = items[0].get("price") or {}
    price_id = price_obj.get("id") or ""
    return _price_to_tier_and_interval(price_id)


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
# Referral attribution helper
# ---------------------------------------------------------------------------

def _handle_referral_conversion(db: Session, ref_code: str, converted_user_id: str) -> None:
    """Apply referral credit when a referred user's checkout completes."""
    if not ref_code:
        return
    try:
        code_row = db.query(ReferralCode).filter(ReferralCode.code == ref_code).first()
        if not code_row:
            return

        # Prevent double-crediting the same user
        already = (
            db.query(ReferralConversion)
            .filter(ReferralConversion.converted_user_id == converted_user_id)
            .first()
        )
        if already:
            return

        credit_cents = settings.REFERRAL_CREDIT_CENTS
        stripe_applied = False

        # Apply Stripe customer balance credit to referrer
        referrer_sub = (
            db.query(UserSubscription)
            .filter(UserSubscription.user_id == code_row.owner_user_id)
            .first()
        )
        if referrer_sub and referrer_sub.stripe_customer_id and stripe.api_key:
            try:
                stripe.Customer.create_balance_transaction(
                    referrer_sub.stripe_customer_id,
                    amount=-credit_cents,   # negative = credit
                    currency="usd",
                    description=f"Referral credit for converting {converted_user_id}",
                )
                stripe_applied = True
            except stripe.StripeError as exc:
                logger.warning("Stripe referral credit failed: %s", exc)

        conversion = ReferralConversion(
            referral_code=ref_code,
            converted_user_id=converted_user_id,
            credited_amount_cents=credit_cents,
            stripe_credit_applied=stripe_applied,
        )
        db.add(conversion)
        code_row.total_conversions += 1
        code_row.credit_balance_cents += credit_cents
        db.commit()
    except Exception as exc:
        logger.warning("Referral conversion handling failed: %s", exc)


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
        metadata = data_obj.get("metadata", {}) or {}
        user_id: str = metadata.get("user_id", "")
        tier: str = metadata.get("tier", "pro")
        billing_interval: str = metadata.get("billing_interval", "monthly")
        ref_code: str = metadata.get("ref_code", "")
        stripe_customer_id: str = data_obj.get("customer", "") or ""
        stripe_subscription_id: str = data_obj.get("subscription", "") or ""

        if user_id:
            try:
                update_user_subscription(
                    db=db,
                    user_id=user_id,
                    stripe_customer_id=stripe_customer_id,
                    stripe_subscription_id=stripe_subscription_id,
                    tier=tier,
                    status="active",
                    billing_interval=billing_interval,
                )
            except Exception as exc:
                logger.error("Failed to activate subscription for user_id=%s: %s", user_id, exc)

            if tier == "founding":
                try:
                    consumed = try_decrement_founding_spot(db)
                    if not consumed:
                        logger.error(
                            "Founding checkout completed for user_id=%s but no founding spot was available. "
                            "Reconcile spots and subscription manually.",
                            user_id,
                        )
                except Exception as exc:
                    logger.error("Founding spot decrement failed for user_id=%s: %s", user_id, exc)

            try:
                _handle_referral_conversion(db, ref_code, user_id)
            except Exception as exc:
                logger.warning("Referral handling failed (non-fatal): %s", exc)

            try:
                identify(user_id, {"tier": tier, "billing_interval": billing_interval, "status": "active"})
                track("subscription_activated", user_id=user_id, properties={
                    "tier": tier,
                    "billing_interval": billing_interval,
                    "has_ref_code": bool(ref_code),
                })
            except Exception:
                pass

    # -----------------------------------------------------------------------
    # customer.subscription.updated → plan / status / interval changes
    # -----------------------------------------------------------------------
    elif event_type == "customer.subscription.updated":
        stripe_subscription_id: str = data_obj.get("id", "") or ""
        stripe_customer_id: str = data_obj.get("customer", "") or ""
        stripe_status: str = data_obj.get("status", "") or ""
        app_status = _stripe_subscription_status_to_app(stripe_status)

        sub = (
            db.query(UserSubscription)
            .filter(UserSubscription.stripe_subscription_id == stripe_subscription_id)
            .first()
        )
        if sub:
            new_tier, new_interval = _subscription_to_tier_and_interval(data_obj)

            # Protect Founding rate-lock: never change tier away from "founding"
            # when updating — only allow interval changes.
            if sub.tier == "founding":
                new_tier = "founding"

            try:
                update_user_subscription(
                    db=db,
                    user_id=sub.user_id,
                    stripe_customer_id=stripe_customer_id or (sub.stripe_customer_id or ""),
                    stripe_subscription_id=stripe_subscription_id,
                    tier=new_tier,
                    status=app_status,
                    billing_interval=new_interval,
                )
            except Exception as exc:
                logger.error("subscription.updated failed for sub_id=%s: %s", stripe_subscription_id, exc)

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
            try:
                update_user_subscription(
                    db=db,
                    user_id=sub.user_id,
                    stripe_customer_id=stripe_customer_id,
                    stripe_subscription_id=stripe_subscription_id,
                    tier=sub.tier,
                    status="cancelled",
                    billing_interval=sub.billing_interval,
                )
                track("subscription_cancelled", user_id=sub.user_id, properties={"tier": sub.tier})
            except Exception as exc:
                logger.error("subscription.deleted handling failed: %s", exc)

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
                try:
                    update_user_subscription(
                        db=db,
                        user_id=sub.user_id,
                        stripe_customer_id=sub.stripe_customer_id or "",
                        stripe_subscription_id=stripe_subscription_id,
                        tier=sub.tier,
                        status="past_due",
                        billing_interval=sub.billing_interval,
                    )
                except Exception as exc:
                    logger.error("invoice.payment_failed handling failed: %s", exc)

    return {"status": "ok"}
