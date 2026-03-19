"""
A3 — Revenue Quality Score (Blueprint II §A3)

Five sub-dimensions weighted to produce a 0–100 score:
  1. Recurring Revenue Rate (30%)   — % of total revenue from recurring/subscription streams
  2. Customer Concentration (25%)   — Herfindahl-Hirschman Index; lower HHI = better
  3. Contract Durability (20%)      — % of revenue under contracts with >12 months remaining
  4. Revenue CAGR Consistency (15%) — std-dev of monthly/annual growth rate
  5. Churn / NRR (10%)              — estimated net revenue retention if calculable

DRS weight: Revenue Quality = 25% of composite score.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from math import sqrt
from typing import Optional

from sqlalchemy.orm import Session

from app.ontology.models import RevenueStream, Contract


# ── Sub-score helpers ─────────────────────────────────────────────────────────

def _recurring_rate_score(revenue_rows: list) -> tuple[float, float]:
    """Returns (score_0_100, recurring_pct)."""
    if not revenue_rows:
        return 50.0, 0.0
    total = sum(float(r.revenue_gross) for r in revenue_rows if r.revenue_gross)
    recurring = sum(
        float(r.revenue_gross) for r in revenue_rows
        if r.recurring_flag or r.revenue_type in ("RECURRING", "SUBSCRIPTION")
    )
    if total == 0:
        return 50.0, 0.0
    pct = recurring / total
    # Linear: 0%→0, 50%→60, 75%→80, 90%→95, 100%→100
    if pct >= 0.90:
        score = 95 + (pct - 0.90) / 0.10 * 5
    elif pct >= 0.75:
        score = 80 + (pct - 0.75) / 0.15 * 15
    elif pct >= 0.50:
        score = 60 + (pct - 0.50) / 0.25 * 20
    else:
        score = pct / 0.50 * 60
    return round(min(score, 100), 1), round(pct * 100, 1)


def _hhi_score(revenue_rows: list) -> tuple[float, float]:
    """Returns (score_0_100, hhi_0_10000). Lower HHI = better."""
    if not revenue_rows:
        return 50.0, 10000.0

    # Group by customer_id (or description as fallback)
    buckets: dict[str, float] = {}
    for r in revenue_rows:
        key = str(r.customer_id) if r.customer_id else (r.description or "unknown")
        buckets[key] = buckets.get(key, 0) + float(r.revenue_gross or 0)

    total = sum(buckets.values())
    if total == 0:
        return 50.0, 10000.0

    hhi = sum((v / total * 100) ** 2 for v in buckets.values())
    # HHI 0–1250 = competitive, 1250–2500 = moderate, 2500–10000 = concentrated
    if hhi <= 1250:
        score = 90 + (1250 - hhi) / 1250 * 10
    elif hhi <= 2500:
        score = 70 + (2500 - hhi) / 1250 * 20
    elif hhi <= 5000:
        score = 40 + (5000 - hhi) / 2500 * 30
    else:
        score = max(0, 40 - (hhi - 5000) / 5000 * 40)
    return round(min(score, 100), 1), round(hhi, 0)


def _contract_durability_score(revenue_rows: list, contracts: list) -> tuple[float, float]:
    """Returns (score_0_100, pct_under_durable_contract)."""
    if not contracts:
        return 40.0, 0.0

    today = date.today()
    total_contract_value = 0.0
    durable_value = 0.0

    for c in contracts:
        if not c.annual_value:
            continue
        val = float(c.annual_value)
        total_contract_value += val
        if c.end_date and (c.end_date - today).days > 365:
            durable_value += val

    if total_contract_value == 0:
        return 40.0, 0.0

    pct = durable_value / total_contract_value
    score = min(100, pct * 100 * 1.1)  # slight bonus for any durability
    return round(score, 1), round(pct * 100, 1)


def _cagr_consistency_score(revenue_rows: list) -> tuple[float, float]:
    """Returns (score_0_100, coefficient_of_variation_pct)."""
    if not revenue_rows:
        return 50.0, 0.0

    # Aggregate by month
    monthly: dict[str, float] = {}
    for r in revenue_rows:
        if r.revenue_period:
            key = r.revenue_period.strftime("%Y-%m")
            monthly[key] = monthly.get(key, 0) + float(r.revenue_gross or 0)

    if len(monthly) < 3:
        return 50.0, 0.0

    values = [monthly[k] for k in sorted(monthly.keys())]
    mean = sum(values) / len(values)
    if mean == 0:
        return 50.0, 0.0

    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std_dev = sqrt(variance)
    cv = (std_dev / mean) * 100  # coefficient of variation %

    # Low CV = consistent = high score
    if cv <= 10:
        score = 95
    elif cv <= 20:
        score = 80 + (20 - cv) / 10 * 15
    elif cv <= 40:
        score = 55 + (40 - cv) / 20 * 25
    elif cv <= 60:
        score = 35 + (60 - cv) / 20 * 20
    else:
        score = max(0, 35 - (cv - 60) / 40 * 35)

    return round(score, 1), round(cv, 1)


def _nrr_score(revenue_rows: list) -> tuple[float, float]:
    """
    Approximate NRR from year-over-year recurring revenue change.
    Returns (score_0_100, estimated_nrr_pct).
    """
    if not revenue_rows:
        return 60.0, 100.0

    # Filter recurring only
    recurring = [r for r in revenue_rows if r.recurring_flag or r.revenue_type in ("RECURRING", "SUBSCRIPTION")]
    if not recurring:
        return 60.0, 100.0

    by_year: dict[int, float] = {}
    for r in recurring:
        if r.revenue_period:
            yr = r.revenue_period.year
            by_year[yr] = by_year.get(yr, 0) + float(r.revenue_gross or 0)

    years = sorted(by_year.keys())
    if len(years) < 2:
        return 65.0, 100.0

    prior, current = by_year[years[-2]], by_year[years[-1]]
    if prior == 0:
        return 65.0, 100.0

    nrr = (current / prior) * 100

    # NRR scoring: <80%=bad, 80–100%=adequate, 100–120%=good, >120%=excellent
    if nrr >= 120:
        score = 95
    elif nrr >= 100:
        score = 75 + (nrr - 100) / 20 * 20
    elif nrr >= 90:
        score = 55 + (nrr - 90) / 10 * 20
    elif nrr >= 80:
        score = 35 + (nrr - 80) / 10 * 20
    else:
        score = max(0, nrr / 80 * 35)

    return round(score, 1), round(nrr, 1)


# ── Result model ──────────────────────────────────────────────────────────────

@dataclass
class RevenueQualityScore:
    company_id: int
    composite: float                      # 0–100 weighted composite
    recurring_rate_score: float
    concentration_score: float
    durability_score: float
    consistency_score: float
    nrr_score: float
    recurring_pct: float
    hhi: float
    contract_durability_pct: float
    revenue_cv_pct: float
    estimated_nrr: float
    data_confidence: str                  # HIGH / MEDIUM / LOW

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "recurring_rate":   {"score": self.recurring_rate_score,  "value": self.recurring_pct,           "label": f"{self.recurring_pct:.0f}% recurring"},
                "concentration":    {"score": self.concentration_score,   "value": self.hhi,                     "label": f"HHI {self.hhi:.0f}"},
                "durability":       {"score": self.durability_score,      "value": self.contract_durability_pct, "label": f"{self.contract_durability_pct:.0f}% under durable contract"},
                "consistency":      {"score": self.consistency_score,     "value": self.revenue_cv_pct,          "label": f"CV {self.revenue_cv_pct:.1f}%"},
                "nrr":              {"score": self.nrr_score,             "value": self.estimated_nrr,           "label": f"NRR ~{self.estimated_nrr:.0f}%"},
            },
            "data_confidence": self.data_confidence,
        }


# ── Public API ────────────────────────────────────────────────────────────────

WEIGHTS = {
    "recurring":    0.30,
    "concentration": 0.25,
    "durability":   0.20,
    "consistency":  0.15,
    "nrr":          0.10,
}


def compute_revenue_quality(company_id: int, db: Session) -> RevenueQualityScore:
    revenue_rows = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()
    contracts    = db.query(Contract).filter(Contract.company_id == company_id).all()

    s_rec,  recurring_pct  = _recurring_rate_score(revenue_rows)
    s_hhi,  hhi            = _hhi_score(revenue_rows)
    s_dur,  dur_pct        = _contract_durability_score(revenue_rows, contracts)
    s_cv,   cv_pct         = _cagr_consistency_score(revenue_rows)
    s_nrr,  nrr            = _nrr_score(revenue_rows)

    composite = (
        s_rec  * WEIGHTS["recurring"]
        + s_hhi  * WEIGHTS["concentration"]
        + s_dur  * WEIGHTS["durability"]
        + s_cv   * WEIGHTS["consistency"]
        + s_nrr  * WEIGHTS["nrr"]
    )

    row_count = len(revenue_rows)
    confidence = "HIGH" if row_count >= 50 else "MEDIUM" if row_count >= 12 else "LOW"

    return RevenueQualityScore(
        company_id=company_id,
        composite=round(composite, 1),
        recurring_rate_score=s_rec,
        concentration_score=s_hhi,
        durability_score=s_dur,
        consistency_score=s_cv,
        nrr_score=s_nrr,
        recurring_pct=recurring_pct,
        hhi=hhi,
        contract_durability_pct=dur_pct,
        revenue_cv_pct=cv_pct,
        estimated_nrr=nrr,
        data_confidence=confidence,
    )
