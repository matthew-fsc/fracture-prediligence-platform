"""
Client portal routes (2D) — read-only views for SMB owners.
These endpoints return a simplified, advisor-curated view of engagement data.

POST /api/portal/invite              — advisor grants client access
GET  /api/portal/{company_id}/summary — client-facing engagement summary
"""

import secrets
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import ensure_company_access, get_company_scope
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import Company, CompanyAccessGrant, EngagementProfile, EngagementSnapshot

router = APIRouter()

CompanyScoped = Annotated[Company, Depends(get_company_scope)]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InviteClientRequest(BaseModel):
    company_id: int
    client_user_id: str   # Clerk sub of the SMB owner being granted access


# ---------------------------------------------------------------------------
# Invite endpoint — advisor only
# ---------------------------------------------------------------------------

@router.post("/invite")
def invite_client(
    body: InviteClientRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Grant a client (SMB owner) read-only access to their engagement.
    The advisor must own the company to issue an invite.
    """
    company = ensure_company_access(body.company_id, user, db, require_owner=True)

    # Idempotent — update existing grant if present
    existing = (
        db.query(CompanyAccessGrant)
        .filter(
            CompanyAccessGrant.company_id == body.company_id,
            CompanyAccessGrant.user_id == body.client_user_id,
        )
        .first()
    )
    if existing:
        existing.is_active = True
        existing.role = "client"
        db.commit()
        return {"status": "updated", "grant_id": existing.id}

    grant = CompanyAccessGrant(
        company_id=body.company_id,
        user_id=body.client_user_id,
        role="client",
        granted_by=user.user_id,
        is_active=True,
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return {"status": "created", "grant_id": grant.id}


@router.delete("/invite/{company_id}/{client_user_id}")
def revoke_client_access(
    company_id: int,
    client_user_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a client's portal access. Advisor-only."""
    ensure_company_access(company_id, user, db, require_owner=True)
    grant = (
        db.query(CompanyAccessGrant)
        .filter(
            CompanyAccessGrant.company_id == company_id,
            CompanyAccessGrant.user_id == client_user_id,
        )
        .first()
    )
    if grant:
        grant.is_active = False
        db.commit()
    return {"status": "revoked"}


# ---------------------------------------------------------------------------
# Client-facing summary endpoint
# ---------------------------------------------------------------------------

@router.get("/{company_id}/summary")
def get_portal_summary(
    company: CompanyScoped,
    db: Session = Depends(get_db),
):
    """
    Read-only engagement summary for the SMB owner.
    Accessible by both the owner's advisor and the client (via CompanyAccessGrant).
    Returns DRS tier, EV range, engagement milestones, and top initiatives.
    """
    try:
        from app.services.analytics_service import compute_category_modules
        from app.analytics.a9_drs_composite import CategoryScores, compute_drs
        from app.analytics.a10_enterprise_value import compute_enterprise_value
        from app.analytics.ebitda_basis import ebitda_basis_for_company
        from app.analytics.market_benchmarks import get_market_multiple_context
        from app.ontology.models import CompanyInitiative
        from decimal import Decimal

        modules = compute_category_modules(company.id, db)
        cat = CategoryScores(
            revenue_quality=modules["revenue_quality"].composite,
            financial_integrity=modules["financial_integrity"].composite,
            operational_independence=modules["operational_independence"].composite,
            customer_risk=modules["customer_risk"].composite,
            management_team=modules["management_team"].composite,
            growth_drivers=modules["growth_drivers"].composite,
        )
        drs = compute_drs(cat)

        basis = ebitda_basis_for_company(company.id, db)
        ebitda = float(basis.get("ebitda_normalized_ttm") or 0)
        ebitda_dec = Decimal(str(round(ebitda, 2)))
        mctx = get_market_multiple_context(db, company.id, ebitda)
        ev = compute_enterprise_value(ebitda_dec, drs.tier, market_context=mctx) if ebitda > 0 else None

        # Engagement timeline
        snapshots = (
            db.query(EngagementSnapshot)
            .filter(EngagementSnapshot.company_id == company.id)
            .order_by(EngagementSnapshot.sort_order)
            .all()
        )

        # Top 3 initiatives by EV impact
        initiatives = (
            db.query(CompanyInitiative)
            .filter(CompanyInitiative.company_id == company.id)
            .order_by(CompanyInitiative.ev_impact_estimate.desc().nullslast())
            .limit(3)
            .all()
        )

        # Engagement profile (non-confidential fields only)
        ep = db.query(EngagementProfile).filter(EngagementProfile.company_id == company.id).first()

        return {
            "company_id": company.id,
            "company_name": company.name,
            "drs": {
                "score": round(float(drs.base_drs), 1),
                "tier": drs.tier.value,
                "conservative": round(float(drs.conservative_drs), 1),
                "optimistic": round(float(drs.optimistic_drs), 1),
            },
            "enterprise_value": {
                "floor": float(ev.ev_floor) if ev else None,
                "midpoint": float(ev.ev_midpoint) if ev else None,
                "ceiling": float(ev.ev_ceiling) if ev else None,
                "ebitda": ebitda,
            } if ev else None,
            "engagement_timeline": [
                {
                    "milestone": s.milestone,
                    "date": s.date,
                    "stage": s.stage,
                    "status": s.status,
                    "drs": float(s.drs) if s.drs is not None else None,
                }
                for s in snapshots
            ],
            "top_initiatives": [
                {
                    "title": i.title,
                    "category": i.category,
                    "timeline": i.timeline,
                    "ev_impact_estimate": float(i.ev_impact_estimate) if i.ev_impact_estimate else None,
                }
                for i in initiatives
            ],
            "exit_timeline": ep.exit_timeline if ep else None,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
