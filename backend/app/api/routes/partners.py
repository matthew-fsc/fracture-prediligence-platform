"""
Channel partner routes (3D) — association / whitelabel distribution.

GET  /api/partners/{slug}           — public: co-branded pricing data for landing page
GET  /api/admin/partners            — admin: list all partners
POST /api/admin/partners            — admin: create a channel partner
PATCH /api/admin/partners/{slug}    — admin: update a channel partner
GET  /api/admin/partners/{slug}/stats — admin: attribution metrics
"""

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.ontology.models import ChannelPartner, UserSubscription

router = APIRouter()


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
