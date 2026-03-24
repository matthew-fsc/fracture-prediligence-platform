"""
Stripe checkout session creation.
POST /api/create-checkout  (requires Clerk auth)
GET  /api/user/subscription (requires Clerk auth)
"""

import os
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.db_functions import get_user_subscription
from app.middleware.auth import CurrentUser, get_current_user

router = APIRouter()

# ---------------------------------------------------------------------------
# Stripe config
# ---------------------------------------------------------------------------

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

PRICE_IDS: dict[str, Optional[str]] = {
    "founding": os.getenv("STRIPE_FOUNDING_PRICE_ID"),
    "pro":      os.getenv("STRIPE_PRO_PRICE_ID"),
    "team":     os.getenv("STRIPE_TEAM_PRICE_ID"),
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
):
    """Create a Stripe Checkout session for the requested tier."""
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured — add STRIPE_SECRET_KEY to .env")

    tier = body.tier.lower()
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
