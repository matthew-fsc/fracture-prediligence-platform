"""
Referral program routes (3B).

GET  /api/referrals/my-code   — get or create the advisor's referral code
GET  /api/referrals/stats     — conversion count and credit balance
POST /api/referrals/click     — record a referral link click (public, no auth)
"""

import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import ReferralCode, ReferralConversion

router = APIRouter()


def _generate_code(user_id: str) -> str:
    """Generate a short memorable referral code."""
    suffix = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    return f"FRAC-{suffix}"


@router.get("/my-code")
def get_or_create_referral_code(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the advisor's referral code, creating one if it doesn't exist yet."""
    code_row = db.query(ReferralCode).filter(ReferralCode.owner_user_id == user.user_id).first()
    if not code_row:
        for _ in range(10):
            code = _generate_code(user.user_id)
            if not db.query(ReferralCode).filter(ReferralCode.code == code).first():
                break
        code_row = ReferralCode(code=code, owner_user_id=user.user_id)
        db.add(code_row)
        db.commit()
        db.refresh(code_row)

    from app.core.config import settings
    referral_url = f"{settings.FRONTEND_URL}/pricing?ref={code_row.code}"
    return {
        "code": code_row.code,
        "referral_url": referral_url,
        "total_clicks": code_row.total_clicks,
        "total_conversions": code_row.total_conversions,
        "credit_balance_cents": code_row.credit_balance_cents,
        "credit_balance_display": f"${code_row.credit_balance_cents / 100:.2f}",
    }


@router.get("/stats")
def get_referral_stats(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return conversion history for the advisor's referral code."""
    code_row = db.query(ReferralCode).filter(ReferralCode.owner_user_id == user.user_id).first()
    if not code_row:
        return {"code": None, "conversions": [], "total_conversions": 0, "credit_balance_cents": 0}

    conversions = (
        db.query(ReferralConversion)
        .filter(ReferralConversion.referral_code == code_row.code)
        .order_by(ReferralConversion.converted_at.desc())
        .all()
    )
    return {
        "code": code_row.code,
        "total_conversions": code_row.total_conversions,
        "credit_balance_cents": code_row.credit_balance_cents,
        "credit_balance_display": f"${code_row.credit_balance_cents / 100:.2f}",
        "conversions": [
            {
                "converted_at": c.converted_at.isoformat(),
                "credited_amount_cents": c.credited_amount_cents,
                "stripe_credit_applied": c.stripe_credit_applied,
            }
            for c in conversions
        ],
    }


class ClickRequest(BaseModel):
    code: str


@router.post("/click")
def record_referral_click(body: ClickRequest, db: Session = Depends(get_db)):
    """Record a referral link click. Public endpoint — no auth required."""
    code_row = db.query(ReferralCode).filter(ReferralCode.code == body.code).first()
    if code_row:
        code_row.total_clicks += 1
        db.commit()
    return {"status": "ok"}
