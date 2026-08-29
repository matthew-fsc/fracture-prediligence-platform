"""
Channel partner + referral program routes.

Partner routes (3D — /api/partners/*):
  GET  /{slug}                     — public: co-branded pricing data for landing page
  GET  /admin/partners             — admin: list all partners
  POST /admin/partners             — admin: create a channel partner
  PATCH /admin/partners/{slug}     — admin: update a channel partner
  GET  /admin/partners/{slug}/stats — admin: attribution metrics

Referral routes (3B — /api/referrals/*):
  GET  /my-code   — get or create the advisor's referral code
  GET  /stats     — conversion count and credit balance
  POST /click     — record a referral link click (public, no auth)
"""

import secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import ChannelPartner, UserSubscription, ReferralCode, ReferralConversion

router = APIRouter()
referrals_router = APIRouter()


def _verify_admin(x_admin_key: Optional[str] = Header(default=None)) -> None:
    if not settings.ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


# ---------------------------------------------------------------------------
# Public endpoint — used by PartnerLandingPage
# ---------------------------------------------------------------------------

@router.get("/{slug}")
def get_partner_public(slug: str, db: Session = Depends(get_db)):
    """Return co-branding data for a channel partner landing page. Public."""
    partner = (
        db.query(ChannelPartner)
        .filter(ChannelPartner.slug == slug, ChannelPartner.is_active == True)
        .first()
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {
        "slug": partner.slug,
        "name": partner.name,
        "logo_url": partner.logo_url,
        "discount_pct": partner.discount_pct,
        "has_discount": partner.discount_pct > 0,
    }


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

class PartnerCreate(BaseModel):
    slug: str
    name: str
    logo_url: Optional[str] = None
    discount_pct: int = 0
    stripe_coupon_id: Optional[str] = None


class PartnerPatch(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    discount_pct: Optional[int] = None
    stripe_coupon_id: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/admin/partners")
def list_partners(
    db: Session = Depends(get_db),
    _: None = Depends(_verify_admin),
):
    partners = db.query(ChannelPartner).order_by(ChannelPartner.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "slug": p.slug,
            "name": p.name,
            "logo_url": p.logo_url,
            "discount_pct": p.discount_pct,
            "stripe_coupon_id": p.stripe_coupon_id,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in partners
    ]


@router.post("/admin/partners")
def create_partner(
    body: PartnerCreate,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_admin),
):
    existing = db.query(ChannelPartner).filter(ChannelPartner.slug == body.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Partner with slug '{body.slug}' already exists")
    partner = ChannelPartner(
        slug=body.slug,
        name=body.name,
        logo_url=body.logo_url,
        discount_pct=body.discount_pct,
        stripe_coupon_id=body.stripe_coupon_id,
        is_active=True,
    )
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return {"status": "created", "slug": partner.slug, "id": partner.id}


@router.patch("/admin/partners/{slug}")
def update_partner(
    slug: str,
    body: PartnerPatch,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_admin),
):
    partner = db.query(ChannelPartner).filter(ChannelPartner.slug == slug).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(partner, field, value)
    db.commit()
    return {"status": "updated", "slug": partner.slug}


@router.get("/admin/partners/{slug}/stats")
def get_partner_stats(
    slug: str,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_admin),
):
    """Return conversion attribution metrics for a channel partner."""
    partner = db.query(ChannelPartner).filter(ChannelPartner.slug == slug).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    # Count subscriptions attributed to this partner via checkout metadata
    # (stored in UserSubscription when webhook fires — currently we'd need a partner_slug column;
    #  this is a forward-looking stub that can be wired once the column is added)
    return {
        "slug": partner.slug,
        "name": partner.name,
        "discount_pct": partner.discount_pct,
        "note": "Full attribution metrics require partner_slug column on UserSubscription (planned Phase 3D extension).",
    }


# ---------------------------------------------------------------------------
# Referral program routes (merged from referrals.py)
# ---------------------------------------------------------------------------

def _generate_referral_code(user_id: str) -> str:
    """Generate a short memorable referral code."""
    suffix = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    return f"FRAC-{suffix}"


@referrals_router.get("/my-code")
def get_or_create_referral_code(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the advisor's referral code, creating one if it doesn't exist yet."""
    code_row = db.query(ReferralCode).filter(ReferralCode.owner_user_id == user.user_id).first()
    if not code_row:
        for _ in range(10):
            code = _generate_referral_code(user.user_id)
            if not db.query(ReferralCode).filter(ReferralCode.code == code).first():
                break
        code_row = ReferralCode(code=code, owner_user_id=user.user_id)
        db.add(code_row)
        db.commit()
        db.refresh(code_row)

    referral_url = f"{settings.FRONTEND_URL}/pricing?ref={code_row.code}"
    return {
        "code": code_row.code,
        "referral_url": referral_url,
        "total_clicks": code_row.total_clicks,
        "total_conversions": code_row.total_conversions,
        "credit_balance_cents": code_row.credit_balance_cents,
        "credit_balance_display": f"${code_row.credit_balance_cents / 100:.2f}",
    }


@referrals_router.get("/stats")
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


@referrals_router.post("/click")
def record_referral_click(body: ClickRequest, db: Session = Depends(get_db)):
    """Record a referral link click. Public endpoint — no auth required."""
    code_row = db.query(ReferralCode).filter(ReferralCode.code == body.code).first()
    if code_row:
        code_row.total_clicks += 1
        db.commit()
    return {"status": "ok"}
