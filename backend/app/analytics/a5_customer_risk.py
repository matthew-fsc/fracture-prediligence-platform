"""
A5 — Customer Risk Score (Blueprint II §A5)

Assesses the risk profile of the customer base.

Sub-dimensions:
  1. Top-Customer Concentration (35%) — revenue share of single largest customer
  2. Customer Count & Diversification (25%) — total active customers, diversity of industries
  3. Churn / Inactive Rate (25%)         — % of customers marked inactive
  4. Average Tenure (15%)                 — avg customer tenure in years

DRS weight: Customer Risk = 15% of composite score.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.ontology.models import Customer, RevenueStream


@dataclass
class CustomerRiskScore:
    company_id: int
    composite: float
    concentration_score: float
    diversification_score: float
    churn_score: float
    tenure_score: float
    top_customer_pct: float
    top_customer_name: str
    active_customer_count: int
    inactive_pct: float
    avg_tenure_years: float
    industry_count: int
    data_confidence: str
    # Top-5 customers by TTM revenue — source rows for drill-down
    top_customers_detail: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "top_customer_name": self.top_customer_name,
            "top_customer_pct":  self.top_customer_pct,
            "sub_scores": {
                "concentration": {
                    "score": self.concentration_score,
                    "value": self.top_customer_pct,
                    "label": f"Top customer {self.top_customer_pct:.0f}% of revenue",
                    "source_rows": self.top_customers_detail,
                },
                "diversification": {
                    "score": self.diversification_score,
                    "value": self.active_customer_count,
                    "label": f"{self.active_customer_count} active customers, {self.industry_count} industries",
                },
                "churn": {
                    "score": self.churn_score,
                    "value": self.inactive_pct,
                    "label": f"{self.inactive_pct:.0f}% inactive",
                },
                "tenure": {
                    "score": self.tenure_score,
                    "value": self.avg_tenure_years,
                    "label": f"Avg tenure {self.avg_tenure_years:.1f} yrs",
                },
            },
            "data_confidence": self.data_confidence,
        }


WEIGHTS = {
    "concentration":   0.35,
    "diversification": 0.25,
    "churn":           0.25,
    "tenure":          0.15,
}


def compute_customer_risk(company_id: int, db: Session) -> CustomerRiskScore:
    customers = db.query(Customer).filter(Customer.company_id == company_id).all()
    revenue   = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()

    if not customers:
        return CustomerRiskScore(
            company_id=company_id, composite=50.0,
            concentration_score=50.0, diversification_score=50.0,
            churn_score=50.0, tenure_score=50.0,
            top_customer_pct=0.0, top_customer_name="Unknown",
            active_customer_count=0, inactive_pct=0.0,
            avg_tenure_years=0.0, industry_count=0,
            data_confidence="LOW",
            top_customers_detail=[],
        )

    active = [c for c in customers if c.is_active]
    inactive_pct = (1 - len(active) / len(customers)) * 100 if customers else 0.0

    # 1. Top-customer revenue concentration — use TTM window for current-state accuracy
    max_date = max((r.revenue_period for r in revenue if r.revenue_period), default=None)
    if max_date:
        from datetime import timedelta
        ttm_start = max_date - timedelta(days=365)
        ttm_revenue = [r for r in revenue if r.revenue_period and r.revenue_period >= ttm_start]
    else:
        ttm_revenue = revenue

    cust_rev: dict[int, float] = {}
    total_rev = 0.0
    for r in ttm_revenue:
        if r.customer_id:
            cust_rev[r.customer_id] = cust_rev.get(r.customer_id, 0) + float(r.revenue_gross or 0)
        total_rev += float(r.revenue_gross or 0)

    top_pct = 0.0
    top_cust_id = None
    if cust_rev and total_rev > 0:
        top_cust_id = max(cust_rev, key=cust_rev.get)
        top_pct = cust_rev[top_cust_id] / total_rev * 100

    # Resolve top customer name
    top_cust_name = "Unknown"
    if top_cust_id:
        cust_obj = next((c for c in customers if c.id == top_cust_id), None)
        if cust_obj:
            top_cust_name = cust_obj.name

    if top_pct >= 50:
        # Gradient from 10 (at 50%) down to 0 (at 100%) — no flat floor above 50%
        s_conc = max(0, 10 - (top_pct - 50) / 50 * 10)
    elif top_pct >= 30:
        s_conc = 40 + (50 - top_pct) / 20 * 30
    elif top_pct >= 20:
        s_conc = 70 + (30 - top_pct) / 10 * 20
    elif top_pct >= 10:
        s_conc = 85 + (20 - top_pct) / 10 * 15
    else:
        s_conc = 100

    # 2. Customer count & industry diversification
    n_active = len(active)
    industries = set(c.industry for c in customers if c.industry)
    n_industries = len(industries)

    if n_active >= 50:
        s_div = 95
    elif n_active >= 20:
        s_div = 75 + (n_active - 20) / 30 * 20
    elif n_active >= 10:
        s_div = 55 + (n_active - 10) / 10 * 20
    elif n_active >= 5:
        s_div = 35 + (n_active - 5) / 5 * 20
    else:
        s_div = max(0, n_active / 5 * 35)

    # Bonus for industry diversity (up to +10)
    s_div = min(100, s_div + min(n_industries * 2, 10))

    # 3. Churn / inactive rate
    if inactive_pct <= 5:
        s_churn = 95
    elif inactive_pct <= 15:
        s_churn = 70 + (15 - inactive_pct) / 10 * 25
    elif inactive_pct <= 30:
        s_churn = 40 + (30 - inactive_pct) / 15 * 30
    else:
        s_churn = max(0, 40 - (inactive_pct - 30) / 70 * 40)

    # 4. Average tenure
    today = date.today()
    tenures = []
    for c in active:
        if c.tenure_start:
            years = (today - c.tenure_start).days / 365.25
            tenures.append(years)
    avg_tenure = sum(tenures) / len(tenures) if tenures else 0.0

    if avg_tenure >= 5:
        s_tenure = 95
    elif avg_tenure >= 3:
        s_tenure = 75 + (avg_tenure - 3) / 2 * 20
    elif avg_tenure >= 1:
        s_tenure = 45 + (avg_tenure - 1) / 2 * 30
    else:
        s_tenure = avg_tenure / 1 * 45

    composite = (
        s_conc  * WEIGHTS["concentration"]
        + s_div * WEIGHTS["diversification"]
        + s_churn * WEIGHTS["churn"]
        + s_tenure * WEIGHTS["tenure"]
    )

    confidence = "HIGH" if len(customers) >= 20 else "MEDIUM" if len(customers) >= 5 else "LOW"

    # Build top-5 customer drill-down rows for source_rows disclosure
    cust_id_to_name = {c.id: c.name for c in customers}
    sorted_custs = sorted(cust_rev.items(), key=lambda kv: kv[1], reverse=True)
    top_customers_detail = [
        {
            "name": cust_id_to_name.get(cid, f"Customer #{cid}"),
            "revenue": round(rev_amt, 0),
            "pct": round(rev_amt / total_rev * 100, 1) if total_rev > 0 else 0.0,
        }
        for cid, rev_amt in sorted_custs[:5]
    ]

    return CustomerRiskScore(
        company_id=company_id,
        composite=round(composite, 1),
        concentration_score=round(s_conc, 1),
        diversification_score=round(s_div, 1),
        churn_score=round(s_churn, 1),
        tenure_score=round(s_tenure, 1),
        top_customer_pct=round(top_pct, 1),
        top_customer_name=top_cust_name,
        active_customer_count=n_active,
        inactive_pct=round(inactive_pct, 1),
        avg_tenure_years=round(avg_tenure, 2),
        industry_count=n_industries,
        data_confidence=confidence,
        top_customers_detail=top_customers_detail,
    )
