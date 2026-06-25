"""
Deal Outcomes API — capture actual business sale results for DRS calibration.

Endpoints:
  GET  /api/deal-outcomes/{company_id}        — fetch outcome record (404 if none yet)
  POST /api/deal-outcomes/{company_id}        — create or upsert outcome
  PATCH /api/deal-outcomes/{company_id}       — update specific fields
  GET  /api/deal-outcomes/aggregate           — cross-company calibration stats for the advisor
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope, get_company_write_scope
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.ontology.models import Company, DealOutcome, EngagementProfile

router = APIRouter()

CompanyScoped = Annotated[Company, Depends(get_company_scope)]
CompanyWriteScoped = Annotated[Company, Depends(get_company_write_scope)]

VALID_STATUSES = {"in_process", "closed", "fallen_through", "on_hold"}
VALID_BUYER_TYPES = {"pe", "strategic", "financial", "family_office", "mbo", "esop"}
VALID_STRUCTURES = {"asset_sale", "stock_sale", "merger", "recapitalization", "partial_sale"}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class DealOutcomeCreate(BaseModel):
    deal_status: str = "in_process"
    close_date: Optional[date] = None
    sale_price: Optional[float] = None
    actual_ev: Optional[float] = None
    ebitda_at_close: Optional[float] = None
    ev_multiple: Optional[float] = None
    buyer_type: Optional[str] = None
    buyer_name: Optional[str] = None
    deal_structure: Optional[str] = None
    drs_at_close: Optional[float] = None
    predicted_ev_floor: Optional[float] = None
    predicted_ev_ceiling: Optional[float] = None
    days_to_close: Optional[int] = None
    advisor_notes: Optional[str] = None
    is_benchmark_eligible: bool = True


class DealOutcomePatch(BaseModel):
    deal_status: Optional[str] = None
    close_date: Optional[date] = None
    sale_price: Optional[float] = None
    actual_ev: Optional[float] = None
    ebitda_at_close: Optional[float] = None
    ev_multiple: Optional[float] = None
    buyer_type: Optional[str] = None
    buyer_name: Optional[str] = None
    deal_structure: Optional[str] = None
    drs_at_close: Optional[float] = None
    predicted_ev_floor: Optional[float] = None
    predicted_ev_ceiling: Optional[float] = None
    days_to_close: Optional[int] = None
    advisor_notes: Optional[str] = None
    is_benchmark_eligible: Optional[bool] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_enum(value: Optional[str], valid: set, field: str) -> None:
    if value is not None and value not in valid:
        raise HTTPException(status_code=422, detail=f"Invalid {field}: '{value}'. Valid values: {sorted(valid)}")


def _serialize(outcome: DealOutcome) -> dict:
    def _f(v):
        return float(v) if v is not None else None

    return {
        "id":                    outcome.id,
        "company_id":            outcome.company_id,
        "deal_status":           outcome.deal_status,
        "close_date":            outcome.close_date.isoformat() if outcome.close_date else None,
        "sale_price":            _f(outcome.sale_price),
        "actual_ev":             _f(outcome.actual_ev),
        "ebitda_at_close":       _f(outcome.ebitda_at_close),
        "ev_multiple":           _f(outcome.ev_multiple),
        "buyer_type":            outcome.buyer_type,
        "buyer_name":            outcome.buyer_name,
        "deal_structure":        outcome.deal_structure,
        "drs_at_close":          _f(outcome.drs_at_close),
        "predicted_ev_floor":    _f(outcome.predicted_ev_floor),
        "predicted_ev_ceiling":  _f(outcome.predicted_ev_ceiling),
        "days_to_close":         outcome.days_to_close,
        "advisor_notes":         outcome.advisor_notes,
        "is_benchmark_eligible": outcome.is_benchmark_eligible,
        "created_at":            outcome.created_at.isoformat() if outcome.created_at else None,
        "updated_at":            outcome.updated_at.isoformat() if outcome.updated_at else None,
    }


def _compute_ev_multiple(outcome: DealOutcome) -> Optional[float]:
    """Auto-compute EV multiple if actual_ev and ebitda_at_close are known."""
    if outcome.actual_ev and outcome.ebitda_at_close and float(outcome.ebitda_at_close) > 0:
        return round(float(outcome.actual_ev) / float(outcome.ebitda_at_close), 2)
    return None


def _compute_days_to_close(company_id: int, close_date: Optional[date], db: Session) -> Optional[int]:
    """Compute days_to_close from EngagementProfile.engagement_start_date if not provided."""
    if not close_date:
        return None
    profile = db.query(EngagementProfile).filter(EngagementProfile.company_id == company_id).first()
    if not profile or not profile.engagement_start_date:
        return None
    try:
        start = date.fromisoformat(profile.engagement_start_date)
        return max(0, (close_date - start).days)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/{company_id}")
def get_deal_outcome(
    company: CompanyScoped,
    db: Session = Depends(get_db),
):
    outcome = db.query(DealOutcome).filter(DealOutcome.company_id == company.id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="No deal outcome recorded yet")
    return _serialize(outcome)


@router.post("/{company_id}", status_code=201)
def create_or_upsert_deal_outcome(
    body: DealOutcomeCreate,
    company: CompanyWriteScoped,
    db: Session = Depends(get_db),
):
    _validate_enum(body.deal_status, VALID_STATUSES, "deal_status")
    _validate_enum(body.buyer_type, VALID_BUYER_TYPES, "buyer_type")
    _validate_enum(body.deal_structure, VALID_STRUCTURES, "deal_structure")

    existing = db.query(DealOutcome).filter(DealOutcome.company_id == company.id).first()
    if existing:
        # Upsert — treat POST idempotently if record already exists
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        # Auto-derive ev_multiple and days_to_close if not explicitly provided
        if body.ev_multiple is None:
            derived = _compute_ev_multiple(existing)
            if derived:
                existing.ev_multiple = Decimal(str(derived))
        if body.days_to_close is None:
            derived_days = _compute_days_to_close(company.id, existing.close_date, db)
            if derived_days is not None:
                existing.days_to_close = derived_days
        db.commit()
        db.refresh(existing)
        return _serialize(existing)

    outcome = DealOutcome(
        company_id=company.id,
        deal_status=body.deal_status,
        close_date=body.close_date,
        sale_price=body.sale_price,
        actual_ev=body.actual_ev,
        ebitda_at_close=body.ebitda_at_close,
        ev_multiple=body.ev_multiple,
        buyer_type=body.buyer_type,
        buyer_name=body.buyer_name,
        deal_structure=body.deal_structure,
        drs_at_close=body.drs_at_close,
        predicted_ev_floor=body.predicted_ev_floor,
        predicted_ev_ceiling=body.predicted_ev_ceiling,
        days_to_close=body.days_to_close,
        advisor_notes=body.advisor_notes,
        is_benchmark_eligible=body.is_benchmark_eligible,
    )
    # Auto-derive if not provided
    if outcome.ev_multiple is None:
        derived = _compute_ev_multiple(outcome)
        if derived:
            outcome.ev_multiple = Decimal(str(derived))
    if outcome.days_to_close is None:
        derived_days = _compute_days_to_close(company.id, outcome.close_date, db)
        if derived_days is not None:
            outcome.days_to_close = derived_days

    db.add(outcome)
    db.commit()
    db.refresh(outcome)
    return _serialize(outcome)


@router.patch("/{company_id}")
def update_deal_outcome(
    body: DealOutcomePatch,
    company: CompanyWriteScoped,
    db: Session = Depends(get_db),
):
    _validate_enum(body.deal_status, VALID_STATUSES, "deal_status")
    _validate_enum(body.buyer_type, VALID_BUYER_TYPES, "buyer_type")
    _validate_enum(body.deal_structure, VALID_STRUCTURES, "deal_structure")

    outcome = db.query(DealOutcome).filter(DealOutcome.company_id == company.id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="No deal outcome found — create one first")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(outcome, field, value)

    # Re-derive ev_multiple after any update if not explicitly set in this patch
    if body.ev_multiple is None:
        derived = _compute_ev_multiple(outcome)
        if derived:
            outcome.ev_multiple = Decimal(str(derived))

    if body.days_to_close is None:
        derived_days = _compute_days_to_close(company.id, outcome.close_date, db)
        if derived_days is not None:
            outcome.days_to_close = derived_days

    db.commit()
    db.refresh(outcome)
    return _serialize(outcome)


@router.get("/aggregate/summary")
def get_aggregate_summary(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Aggregate calibration stats across all closed deals belonging to the advisor.
    Returns prediction accuracy metrics and deal distribution data.
    """
    # Fetch all closed, benchmark-eligible outcomes for companies owned by this advisor
    advisor_company_ids = [
        row[0]
        for row in db.query(Company.id).filter(Company.owner_user_id == user["sub"]).all()
    ]
    if not advisor_company_ids:
        return {"total_deals": 0, "closed_deals": 0, "outcomes": [], "calibration": None}

    outcomes = (
        db.query(DealOutcome)
        .filter(
            DealOutcome.company_id.in_(advisor_company_ids),
        )
        .all()
    )

    closed = [o for o in outcomes if o.deal_status == "closed"]
    benchmark_closed = [o for o in closed if o.is_benchmark_eligible]

    # Prediction accuracy: only where actual_ev and predicted range both exist
    calibration_rows = [
        o for o in benchmark_closed
        if o.actual_ev and o.predicted_ev_floor and o.predicted_ev_ceiling
    ]

    def _in_range(o: DealOutcome) -> bool:
        return float(o.predicted_ev_floor) <= float(o.actual_ev) <= float(o.predicted_ev_ceiling)

    calibration = None
    if calibration_rows:
        in_range = sum(1 for o in calibration_rows if _in_range(o))
        avg_actual = sum(float(o.actual_ev) for o in calibration_rows) / len(calibration_rows)
        avg_floor  = sum(float(o.predicted_ev_floor) for o in calibration_rows) / len(calibration_rows)
        avg_ceil   = sum(float(o.predicted_ev_ceiling) for o in calibration_rows) / len(calibration_rows)
        avg_mid    = (avg_floor + avg_ceil) / 2
        calibration = {
            "sample_size":          len(calibration_rows),
            "pct_in_range":         round(in_range / len(calibration_rows) * 100, 1),
            "avg_actual_ev":        round(avg_actual, 0),
            "avg_predicted_mid_ev": round(avg_mid, 0),
            "avg_error_pct":        round(abs(avg_actual - avg_mid) / avg_mid * 100, 1) if avg_mid else None,
        }

    # EV multiple distribution across closed deals
    multiples = [float(o.ev_multiple) for o in closed if o.ev_multiple is not None]
    avg_multiple = round(sum(multiples) / len(multiples), 2) if multiples else None

    # Buyer type distribution
    buyer_dist: dict[str, int] = {}
    for o in closed:
        if o.buyer_type:
            buyer_dist[o.buyer_type] = buyer_dist.get(o.buyer_type, 0) + 1

    # DRS vs multiple correlation data points
    drs_multiple_data = [
        {"drs": float(o.drs_at_close), "multiple": float(o.ev_multiple), "company_id": o.company_id}
        for o in closed
        if o.drs_at_close is not None and o.ev_multiple is not None
    ]

    return {
        "total_deals":      len(outcomes),
        "closed_deals":     len(closed),
        "in_process":       sum(1 for o in outcomes if o.deal_status == "in_process"),
        "fallen_through":   sum(1 for o in outcomes if o.deal_status == "fallen_through"),
        "avg_ev_multiple":  avg_multiple,
        "avg_days_to_close": (
            round(sum(o.days_to_close for o in closed if o.days_to_close) / max(1, sum(1 for o in closed if o.days_to_close)))
            if any(o.days_to_close for o in closed) else None
        ),
        "buyer_distribution":  buyer_dist,
        "drs_multiple_data":   drs_multiple_data,
        "calibration":         calibration,
        "outcomes": [_serialize(o) for o in outcomes],
    }
