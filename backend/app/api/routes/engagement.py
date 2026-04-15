"""
Exit Planning Engagement Layer — API routes (Task 3).

Endpoints:
  GET  /plan/{company_id}                    — get or create engagement plan
  PATCH /plan/{company_id}                   — update plan (target date, DRS, phase)
  GET  /initiatives/{company_id}             — list initiatives with phase metadata
  POST /initiatives/{company_id}             — create a single initiative
  PATCH /initiatives/{company_id}/{init_id}  — update initiative (status, phase, dates)
  POST /initiatives/{company_id}/populate    — auto-populate from value gap
  POST /initiatives/{company_id}/{init_id}/complete — mark complete + partial re-score
  DELETE /initiatives/{company_id}/{init_id}        — remove initiative
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope, get_company_write_scope
from app.core.database import get_db
from app.ontology.models import Company, CompanyInitiative, EngagementPlan
from app.analytics.a9_drs_composite import CategoryScores, compute_drs
from app.analytics.a11_value_gap import compute_value_gap, CATEGORY_META
from app.analytics.ebitda_basis import ebitda_basis_for_company
from app.services.analytics_service import compute_category_modules

router = APIRouter()

CompanyScoped = Annotated[Company, Depends(get_company_scope)]
CompanyWriteScoped = Annotated[Company, Depends(get_company_write_scope)]

# ---------------------------------------------------------------------------
# Phase definitions — used by both backend logic and serialization
# ---------------------------------------------------------------------------

PHASES = {
    1: "Risk Elimination",
    2: "Structural",
    3: "Value Optimization",
}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class PlanPatch(BaseModel):
    target_exit_date: Optional[date] = None
    target_drs: Optional[float] = None
    current_phase: Optional[int] = None


class InitiativeCreate(BaseModel):
    title: str
    category: Optional[str] = None
    phase: Optional[int] = None
    estimated_drs_impact: Optional[float] = None
    target_completion_date: Optional[date] = None
    drs_category_key: Optional[str] = None
    cost_estimate: Optional[float] = None
    ev_impact_estimate: Optional[float] = None
    timeline: Optional[str] = None
    source: str = "custom"


class InitiativePatch(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None          # "planned" | "in_progress" | "complete"
    phase: Optional[int] = None
    estimated_drs_impact: Optional[float] = None
    target_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None
    drs_category_key: Optional[str] = None
    cost_estimate: Optional[float] = None
    ev_impact_estimate: Optional[float] = None
    timeline: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _initiative_to_dict(i: CompanyInitiative) -> dict:
    return {
        "id": i.id,
        "company_id": i.company_id,
        "title": i.title,
        "category": i.category,
        "status": i.status,
        "phase": i.phase,
        "phase_label": PHASES.get(i.phase) if i.phase else None,
        "estimated_drs_impact": float(i.estimated_drs_impact) if i.estimated_drs_impact is not None else None,
        "target_completion_date": i.target_completion_date.isoformat() if i.target_completion_date else None,
        "actual_completion_date": i.actual_completion_date.isoformat() if i.actual_completion_date else None,
        "drs_category_key": i.drs_category_key,
        "cost_estimate": float(i.cost_estimate) if i.cost_estimate is not None else None,
        "ev_impact_estimate": float(i.ev_impact_estimate) if i.ev_impact_estimate is not None else None,
        "advisor_ev_override": float(i.advisor_ev_override) if i.advisor_ev_override is not None else None,
        "timeline": i.timeline,
        "source": i.source,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


def _plan_to_dict(p: EngagementPlan) -> dict:
    return {
        "id": p.id,
        "company_id": p.company_id,
        "target_exit_date": p.target_exit_date.isoformat() if p.target_exit_date else None,
        "target_drs": float(p.target_drs) if p.target_drs is not None else None,
        "current_phase": p.current_phase,
        "current_phase_label": PHASES.get(p.current_phase) if p.current_phase else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _get_or_create_plan(company_id: int, db: Session) -> EngagementPlan:
    plan = db.query(EngagementPlan).filter(EngagementPlan.company_id == company_id).first()
    if plan is None:
        plan = EngagementPlan(company_id=company_id, current_phase=1)
        db.add(plan)
        db.commit()
        db.refresh(plan)
    return plan


# ---------------------------------------------------------------------------
# Plan endpoints
# ---------------------------------------------------------------------------

@router.get("/plan/{company_id}")
def get_plan(company: CompanyScoped, db: Session = Depends(get_db)):
    """Return the engagement plan for this company, creating one if it doesn't exist."""
    plan = _get_or_create_plan(company.id, db)
    return _plan_to_dict(plan)


@router.patch("/plan/{company_id}")
def patch_plan(
    company: CompanyWriteScoped,
    body: PlanPatch,
    db: Session = Depends(get_db),
):
    """Update target exit date, target DRS, or current phase."""
    plan = _get_or_create_plan(company.id, db)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(plan, k, v)
    db.commit()
    db.refresh(plan)
    return _plan_to_dict(plan)


# ---------------------------------------------------------------------------
# Initiative endpoints
# ---------------------------------------------------------------------------

@router.get("/initiatives/{company_id}")
def list_initiatives(company: CompanyScoped, db: Session = Depends(get_db)):
    """Return all initiatives grouped by phase."""
    initiatives = (
        db.query(CompanyInitiative)
        .filter(CompanyInitiative.company_id == company.id)
        .order_by(CompanyInitiative.phase.asc().nulls_last(), CompanyInitiative.id.asc())
        .all()
    )
    by_phase: dict[str, list] = {
        "phase_1": [],
        "phase_2": [],
        "phase_3": [],
        "unphased": [],
    }
    for init in initiatives:
        key = f"phase_{init.phase}" if init.phase in (1, 2, 3) else "unphased"
        by_phase[key].append(_initiative_to_dict(init))
    return {
        "company_id": company.id,
        "phases": PHASES,
        "initiatives": by_phase,
        "total": len(initiatives),
    }


@router.post("/initiatives/{company_id}")
def create_initiative(
    company: CompanyWriteScoped,
    body: InitiativeCreate,
    db: Session = Depends(get_db),
):
    """Create a new initiative for this company."""
    init = CompanyInitiative(
        company_id=company.id,
        title=body.title,
        category=body.category,
        phase=body.phase,
        estimated_drs_impact=Decimal(str(body.estimated_drs_impact)) if body.estimated_drs_impact is not None else None,
        target_completion_date=body.target_completion_date,
        drs_category_key=body.drs_category_key,
        cost_estimate=Decimal(str(body.cost_estimate)) if body.cost_estimate is not None else None,
        ev_impact_estimate=Decimal(str(body.ev_impact_estimate)) if body.ev_impact_estimate is not None else None,
        timeline=body.timeline,
        source=body.source,
        status="planned",
    )
    db.add(init)
    db.commit()
    db.refresh(init)
    return _initiative_to_dict(init)


@router.patch("/initiatives/{company_id}/{initiative_id}")
def patch_initiative(
    company: CompanyWriteScoped,
    initiative_id: int,
    body: InitiativePatch,
    db: Session = Depends(get_db),
):
    """Update any field on an initiative."""
    init = (
        db.query(CompanyInitiative)
        .filter(CompanyInitiative.company_id == company.id)
        .filter(CompanyInitiative.id == initiative_id)
        .first()
    )
    if init is None:
        raise HTTPException(status_code=404, detail="Initiative not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k in ("estimated_drs_impact", "cost_estimate", "ev_impact_estimate") and v is not None:
            v = Decimal(str(v))
        setattr(init, k, v)
    db.commit()
    db.refresh(init)
    return _initiative_to_dict(init)


@router.delete("/initiatives/{company_id}/{initiative_id}")
def delete_initiative(
    company: CompanyWriteScoped,
    initiative_id: int,
    db: Session = Depends(get_db),
):
    """Remove an initiative."""
    init = (
        db.query(CompanyInitiative)
        .filter(CompanyInitiative.company_id == company.id)
        .filter(CompanyInitiative.id == initiative_id)
        .first()
    )
    if init is None:
        raise HTTPException(status_code=404, detail="Initiative not found")
    db.delete(init)
    db.commit()
    return {"ok": True}


@router.post("/initiatives/{company_id}/populate")
def populate_from_value_gap(
    company: CompanyWriteScoped,
    db: Session = Depends(get_db),
):
    """
    Auto-populate phase-tagged initiatives from the value gap analysis.

    Rules:
      - Only creates initiatives that don't already exist (source='value_gap', same drs_category_key).
      - Phase assignment: low-score categories (< 40) → Phase 1, moderate (40–65) → Phase 2, higher gaps → Phase 3.
      - Returns the list of created initiative dicts.
    """
    modules = compute_category_modules(company.id, db)
    current_scores = {k: m.composite for k, m in modules.items()}
    basis = ebitda_basis_for_company(company.id, db)
    ebitda = basis.get("ebitda_normalized_ttm") or 0.0

    gap_result = compute_value_gap(company.id, current_scores, ebitda)

    existing = {
        i.drs_category_key
        for i in db.query(CompanyInitiative)
        .filter(CompanyInitiative.company_id == company.id)
        .filter(CompanyInitiative.source == "value_gap")
        .all()
    }

    created = []
    for gap in gap_result.gaps:
        if gap.category in existing:
            continue
        score = gap.current_score
        phase = 1 if score < 40 else (2 if score < 65 else 3)
        meta = CATEGORY_META.get(gap.category, {})
        init = CompanyInitiative(
            company_id=company.id,
            title=f"Improve {meta.get('label', gap.category)}",
            category=meta.get("label"),
            phase=phase,
            drs_category_key=gap.category,
            estimated_drs_impact=Decimal(str(round(gap.drs_uplift, 2))),
            ev_impact_estimate=Decimal(str(round(gap.ev_uplift, 2))),
            source="value_gap",
            status="planned",
        )
        db.add(init)
        db.flush()  # get id without full commit yet
        created.append(init)

    db.commit()
    for init in created:
        db.refresh(init)
    return {
        "created": len(created),
        "initiatives": [_initiative_to_dict(i) for i in created],
    }


@router.post("/initiatives/{company_id}/{initiative_id}/complete")
def mark_initiative_complete(
    company: CompanyWriteScoped,
    initiative_id: int,
    db: Session = Depends(get_db),
):
    """
    Mark an initiative as complete and trigger a partial re-score.

    Sets status='complete', actual_completion_date=today.
    Then re-runs the analytics scores module and returns the updated
    DRS + category scores so the frontend can refresh the scorecard.
    """
    init = (
        db.query(CompanyInitiative)
        .filter(CompanyInitiative.company_id == company.id)
        .filter(CompanyInitiative.id == initiative_id)
        .first()
    )
    if init is None:
        raise HTTPException(status_code=404, detail="Initiative not found")

    init.status = "complete"
    init.actual_completion_date = date.today()
    db.commit()
    db.refresh(init)

    # Partial re-score: recompute all category modules + DRS
    modules = compute_category_modules(company.id, db)
    cat = CategoryScores(
        revenue_quality=modules["revenue_quality"].composite,
        financial_integrity=modules["financial_integrity"].composite,
        operational_independence=modules["operational_independence"].composite,
        customer_risk=modules["customer_risk"].composite,
        management_team=modules["management_team"].composite,
        growth_drivers=modules["growth_drivers"].composite,
    )
    drs_result = compute_drs(cat)

    return {
        "initiative": _initiative_to_dict(init),
        "drs": {
            "base": drs_result.base,
            "conservative": drs_result.conservative,
            "optimistic": drs_result.optimistic,
            "tier": drs_result.tier.value if hasattr(drs_result.tier, "value") else str(drs_result.tier),
        },
        "category_scores": {k: round(m.composite, 1) for k, m in modules.items()},
    }
