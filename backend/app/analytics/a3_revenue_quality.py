"""
A3 — Revenue Quality Score (Blueprint II §A3)

Five sub-dimensions weighted to produce a 0–100 score:
  1. Recurring Revenue Rate (30%)      — % of TTM revenue from recurring/subscription streams
  2. Customer Concentration (25%)      — Herfindahl-Hirschman Index on TTM revenue; lower HHI = better
  3. Contract Durability (20%)         — durable contract value as % of TTM revenue
  4. Revenue Consistency (15%)         — coefficient of variation of monthly revenue (lower = better)
  5. Recurring Revenue Growth (10%)    — year-over-year growth in recurring revenue
                                         (approximation of NRR; not true cohort-based NRR)

DRS weight: Revenue Quality = 25% of composite score.

Note on sub-dimension 5: labeled 'nrr_score' for backward compatibility but measures
YoY growth in total recurring revenue, not cohort-based Net Revenue Retention.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from math import sqrt
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ontology.models import RevenueStream, Contract


# ── Sub-score helpers ─────────────────────────────────────────────────────────

def _recurring_rate_score(revenue_rows: list) -> tuple[float, float]:
    """Returns (score_0_100, recurring_pct).

    Explicit tagging (recurring_flag / RECURRING / SUBSCRIPTION) is used when
    meaningful coverage exists (>=5% of revenue is explicitly tagged).
    Otherwise, behavioral detection kicks in: revenue from customers who appear
    in 3+ distinct calendar months is treated as recurring.  This handles
    QuickBooks imports where recurring project/retainer lines land as PROJECT or
    TRANSACTIONAL types despite being de-facto recurring.
    """
    if not revenue_rows:
        return 50.0, 0.0

    total = sum(float(r.revenue_gross or 0) for r in revenue_rows)
    if total == 0:
        return 50.0, 0.0

    # --- Explicit tagging ---
    explicit_recurring = sum(
        float(r.revenue_gross or 0) for r in revenue_rows
        if r.recurring_flag or r.revenue_type in ("RECURRING", "SUBSCRIPTION")
    )
    explicit_pct = explicit_recurring / total

    if explicit_pct >= 0.05:
        # Sufficient explicit tagging — use it directly
        pct = explicit_pct
    else:
        # Sparse tagging — fall back to behavioral detection:
        # customers with revenue in >=3 distinct months are recurring
        cust_months: dict = {}
        cust_revenue: dict = {}
        for r in revenue_rows:
            if r.customer_id and r.revenue_period:
                month = r.revenue_period.strftime("%Y-%m")
                cust_months.setdefault(r.customer_id, set()).add(month)
                cust_revenue[r.customer_id] = (
                    cust_revenue.get(r.customer_id, 0.0) + float(r.revenue_gross or 0)
                )
        behavioral_recurring = sum(
            v for k, v in cust_revenue.items() if len(cust_months[k]) >= 3
        )
        pct = behavioral_recurring / total

    # Scoring bands: 0%→0, 50%→60, 75%→80, 90%→95, 100%→100
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
    """Returns (score_0_100, pct_of_revenue_under_durable_contract).

    Durable = contract with >12 months remaining end_date.
    Denominator is total TTM revenue (not just contracted value) so the score
    reflects what fraction of the full revenue base is durably contracted.
    """
    today = date.today()
    total_rev = sum(float(r.revenue_gross or 0) for r in revenue_rows)

    if total_rev == 0:
        return 40.0, 0.0

    durable_value = 0.0
    for c in contracts:
        if not c.annual_value:
            continue
        if c.end_date and (c.end_date - today).days > 365:
            durable_value += float(c.annual_value)

    pct = durable_value / total_rev
    score = min(100, pct * 100 * 1.1)  # slight bonus for any durability
    return round(score, 1), round(pct * 100, 1)


def _cagr_consistency_score(revenue_rows: list) -> tuple[float, float]:
    """Returns (score_0_100, coefficient_of_variation_pct).

    Handles the common QuickBooks export pattern where annual summary rows are
    dumped into Jan-1 of each year alongside true monthly transaction rows.
    Detection: if any month exceeds 3× the median of all months in the series,
    treat it as an annual aggregate and normalize it to 1/12 of its value before
    computing CV.  This prevents a small number of lump-sum rows from
    artificially inflating variance.
    """
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

    values_raw = [monthly[k] for k in sorted(monthly.keys())]

    # Detect annual-dump outliers: months > 3× median — normalize to monthly avg
    sorted_vals = sorted(values_raw)
    median = sorted_vals[len(sorted_vals) // 2]
    threshold = median * 3 if median > 0 else float("inf")

    values = []
    for v in values_raw:
        values.append(v / 12.0 if v > threshold else v)

    mean = sum(values) / len(values)
    if mean == 0:
        return 50.0, 0.0

    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std_dev = sqrt(variance)
    cv = (std_dev / mean) * 100

    # If monthly CV is still very high (>80%), the monthly series is too noisy
    # (mixed annual-dump and transactional data) — fall back to annual granularity.
    if cv > 80:
        annual: dict[int, float] = {}
        for r in revenue_rows:
            if r.revenue_period:
                yr = r.revenue_period.year
                annual[yr] = annual.get(yr, 0.0) + float(r.revenue_gross or 0)
        if len(annual) >= 2:
            ann_vals = [annual[k] for k in sorted(annual.keys())]
            ann_mean = sum(ann_vals) / len(ann_vals)
            if ann_mean > 0:
                ann_var = sum((v - ann_mean) ** 2 for v in ann_vals) / len(ann_vals)
                cv = (sqrt(ann_var) / ann_mean) * 100

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
    Year-over-year growth in total recurring revenue (not true cohort-based NRR).
    True NRR requires per-customer cohort tracking; this is an aggregate proxy.
    Returns (score_0_100, yoy_recurring_growth_pct).
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
                "concentration":    {"score": self.concentration_score,   "value": self.hhi,                     "label": "HHI"},
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
    all_revenue_rows = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()
    contracts        = db.query(Contract).filter(Contract.company_id == company_id).all()

    # Use TTM window for point-in-time metrics (concentration, recurring rate, durability)
    # to match A1's approach and reflect current business state.
    data_dates = [r.revenue_period for r in all_revenue_rows if r.revenue_period]
    ref_date = max(data_dates) if data_dates else date.today()
    if ref_date > date.today():
        ref_date = date.today()
    ttm_start = ref_date - timedelta(days=365)
    ttm_rows = [r for r in all_revenue_rows if r.revenue_period and r.revenue_period >= ttm_start]

    # TTM data for current-state concentration and recurring metrics
    s_rec,  recurring_pct  = _recurring_rate_score(ttm_rows)
    s_hhi,  hhi            = _hhi_score(ttm_rows)
    s_dur,  dur_pct        = _contract_durability_score(ttm_rows, contracts)
    # Full history for multi-period metrics
    s_cv,   cv_pct         = _cagr_consistency_score(all_revenue_rows)
    s_nrr,  nrr            = _nrr_score(all_revenue_rows)

    revenue_rows = ttm_rows  # use TTM for row_count confidence assessment

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
