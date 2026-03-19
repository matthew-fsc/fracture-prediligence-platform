"""
A7 — Growth Drivers Score (Blueprint II §A7)

Quantifies the growth trajectory and scalability signals.

Sub-dimensions:
  1. Revenue CAGR (40%)          — compound annual growth rate over available history
  2. New Customer Acquisition (30%) — % customers acquired in last 12 months
  3. Contract Pipeline (30%)     — forward contract value vs trailing revenue

DRS weight: Growth Drivers = 10% of composite score.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.ontology.models import RevenueStream, Customer, Contract


@dataclass
class GrowthDriversScore:
    company_id: int
    composite: float
    cagr_score: float
    new_customer_score: float
    pipeline_score: float
    revenue_cagr_pct: float
    new_customer_pct: float
    pipeline_coverage_ratio: float
    data_confidence: str

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "revenue_cagr":   {"score": self.cagr_score,         "value": self.revenue_cagr_pct,         "label": f"CAGR {self.revenue_cagr_pct:+.1f}%"},
                "new_customers":  {"score": self.new_customer_score,  "value": self.new_customer_pct,         "label": f"{self.new_customer_pct:.0f}% new in last 12mo"},
                "contract_pipeline": {"score": self.pipeline_score,   "value": self.pipeline_coverage_ratio,  "label": f"{self.pipeline_coverage_ratio:.1f}x pipeline coverage"},
            },
            "data_confidence": self.data_confidence,
        }


WEIGHTS = {"cagr": 0.40, "new_customers": 0.30, "pipeline": 0.30}


def compute_growth_drivers(company_id: int, db: Session) -> GrowthDriversScore:
    revenue   = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()
    customers = db.query(Customer).filter(Customer.company_id == company_id).all()
    contracts = db.query(Contract).filter(Contract.company_id == company_id, Contract.is_active == True).all()

    today = date.today()
    twelve_months_ago = today - timedelta(days=365)

    # 1. Revenue CAGR
    by_year: dict[int, float] = {}
    for r in revenue:
        if r.revenue_period:
            by_year[r.revenue_period.year] = by_year.get(r.revenue_period.year, 0) + float(r.revenue_gross or 0)

    years = sorted(by_year.keys())
    cagr_pct = 0.0
    if len(years) >= 2:
        n = years[-1] - years[0]
        if n > 0 and by_year[years[0]] > 0:
            cagr_pct = ((by_year[years[-1]] / by_year[years[0]]) ** (1 / n) - 1) * 100

    if cagr_pct >= 30:
        s_cagr = 95
    elif cagr_pct >= 20:
        s_cagr = 80 + (cagr_pct - 20) / 10 * 15
    elif cagr_pct >= 10:
        s_cagr = 60 + (cagr_pct - 10) / 10 * 20
    elif cagr_pct >= 0:
        s_cagr = 45 + cagr_pct / 10 * 15
    elif cagr_pct >= -10:
        s_cagr = 20 + (10 + cagr_pct) / 10 * 25
    else:
        s_cagr = max(0, 20 + (cagr_pct + 10) / 20 * 20)

    # 2. New customer acquisition rate
    new_customers = sum(
        1 for c in customers
        if c.tenure_start and c.tenure_start >= twelve_months_ago
    )
    total_customers = len(customers)
    new_pct = (new_customers / total_customers * 100) if total_customers > 0 else 0.0

    if new_pct >= 30:
        s_new = 90
    elif new_pct >= 20:
        s_new = 75 + (new_pct - 20) / 10 * 15
    elif new_pct >= 10:
        s_new = 55 + (new_pct - 10) / 10 * 20
    elif new_pct >= 5:
        s_new = 35 + (new_pct - 5) / 5 * 20
    else:
        s_new = new_pct / 5 * 35

    # 3. Contract pipeline vs trailing revenue
    pipeline_value = sum(float(c.annual_value or 0) for c in contracts if c.end_date and c.end_date > today)
    trailing_rev = sum(float(r.revenue_gross or 0) for r in revenue if r.revenue_period and r.revenue_period >= twelve_months_ago)

    pipeline_ratio = pipeline_value / trailing_rev if trailing_rev > 0 else 0.0
    if pipeline_ratio >= 1.5:
        s_pipeline = 95
    elif pipeline_ratio >= 1.0:
        s_pipeline = 75 + (pipeline_ratio - 1.0) / 0.5 * 20
    elif pipeline_ratio >= 0.5:
        s_pipeline = 50 + (pipeline_ratio - 0.5) / 0.5 * 25
    elif pipeline_ratio > 0:
        s_pipeline = pipeline_ratio / 0.5 * 50
    else:
        s_pipeline = 30  # no contracts — neutral-negative

    composite = (
        s_cagr     * WEIGHTS["cagr"]
        + s_new    * WEIGHTS["new_customers"]
        + s_pipeline * WEIGHTS["pipeline"]
    )

    has_years   = len(years) >= 2
    has_custs   = len(customers) >= 5
    confidence  = "HIGH" if (has_years and has_custs) else "MEDIUM" if (has_years or has_custs) else "LOW"

    return GrowthDriversScore(
        company_id=company_id,
        composite=round(composite, 1),
        cagr_score=round(s_cagr, 1),
        new_customer_score=round(s_new, 1),
        pipeline_score=round(s_pipeline, 1),
        revenue_cagr_pct=round(cagr_pct, 1),
        new_customer_pct=round(new_pct, 1),
        pipeline_coverage_ratio=round(pipeline_ratio, 2),
        data_confidence=confidence,
    )
