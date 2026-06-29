"""
Financial Analytics — Blueprint II §A1, §A2, §A3

Consolidates:
  A1 — Metric Computation   (compute_metrics, MetricRegistry, effective_total_headcount)
  A2 — EBITDA Recast        (compute_ebitda_recast, EBITDARecast, ChallengeLikelihood, AddbackItem)
  A3 — Revenue Quality Score (compute_revenue_quality, RevenueQualityScore)
"""

# ============================================================================
# A1 — Metric Computation
# ============================================================================

from __future__ import annotations
from dataclasses import dataclass, field
import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
import statistics

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.ontology.models import Company, RevenueStream, Customer, Employee, Expense, Contract, RevenueType, ExpenseCategory, EmployeeStatus


def effective_total_headcount(company_row: Optional[Company], ingested_count: int) -> int:
    if company_row is not None:
        th = company_row.total_headcount
        if th is not None and th > 0:
            return int(th)
    return ingested_count


def _add_months(d: date, months: int) -> date:
    m_idx = d.year * 12 + d.month - 1 + months
    y = m_idx // 12
    mo = m_idx % 12 + 1
    last = calendar.monthrange(y, mo)[1]
    return date(y, mo, min(d.day, last))


@dataclass
class MetricRegistry:
    """All computed metrics for a single company. Inputs to A2–A14."""

    total_revenue_ttm: Decimal = Decimal(0)
    total_revenue_by_year: dict[int, Decimal] = field(default_factory=dict)
    yoy_growth_by_year: dict[int, float] = field(default_factory=dict)
    cagr_3yr: Optional[float] = None
    recurring_revenue_ttm: Decimal = Decimal(0)
    recurring_revenue_pct: float = 0.0
    project_revenue_pct: float = 0.0
    revenue_by_customer: dict[int, Decimal] = field(default_factory=dict)
    top_customer_revenue_pct: float = 0.0
    top5_customer_revenue_pct: float = 0.0
    hhi: float = 0.0
    monthly_revenue_24m: dict[str, Decimal] = field(default_factory=dict)
    revenue_consistency_score: float = 0.0
    avg_monthly_revenue_ttm: Decimal = Decimal(0)

    active_customer_count_ttm: int = 0
    total_customer_count: int = 0
    customer_churn_rate: float = 0.0
    net_revenue_retention: float = 0.0
    avg_customer_revenue_ttm: Decimal = Decimal(0)
    avg_customer_tenure_years: float = 0.0
    pct_customers_with_active_contracts: float = 0.0
    pct_customers_with_multiyear_contracts: float = 0.0
    revenue_at_risk_6mo: Decimal = Decimal(0)

    gross_profit: Decimal = Decimal(0)
    gross_margin_pct: float = 0.0
    total_opex_ttm: Decimal = Decimal(0)
    ebitda_ttm: Decimal = Decimal(0)
    owner_compensation_total: Decimal = Decimal(0)
    market_rate_replacement_cost: Decimal = Decimal(0)
    owner_comp_delta: Decimal = Decimal(0)
    total_headcount: int = 0
    revenue_per_employee: Decimal = Decimal(0)
    avg_employee_tenure_years: float = 0.0
    management_layer_count: int = 0


def compute_metrics(company_id: int, db: Session) -> MetricRegistry:
    m = MetricRegistry()
    today = date.today()

    latest_rev_date = db.query(func.max(RevenueStream.revenue_period)).filter(
        RevenueStream.company_id == company_id
    ).scalar()
    ref_date = latest_rev_date if latest_rev_date and latest_rev_date < today else today
    ttm_start = ref_date - timedelta(days=365)

    ttm_revenue_rows = (
        db.query(RevenueStream)
        .filter(RevenueStream.company_id == company_id, RevenueStream.revenue_period >= ttm_start)
        .all()
    )
    m.total_revenue_ttm = sum(r.revenue_gross for r in ttm_revenue_rows) or Decimal(0)
    m.avg_monthly_revenue_ttm = m.total_revenue_ttm / 12

    recurring = [r for r in ttm_revenue_rows if r.recurring_flag or r.revenue_type in (RevenueType.RECURRING, RevenueType.SUBSCRIPTION)]
    m.recurring_revenue_ttm = sum(r.revenue_gross for r in recurring) or Decimal(0)
    if m.total_revenue_ttm:
        m.recurring_revenue_pct = float(m.recurring_revenue_ttm / m.total_revenue_ttm) * 100
        m.project_revenue_pct = 100 - m.recurring_revenue_pct

    for row in ttm_revenue_rows:
        if row.customer_id:
            m.revenue_by_customer[row.customer_id] = m.revenue_by_customer.get(row.customer_id, Decimal(0)) + row.revenue_gross

    if m.revenue_by_customer and m.total_revenue_ttm:
        sorted_customers = sorted(m.revenue_by_customer.values(), reverse=True)
        m.top_customer_revenue_pct = float(sorted_customers[0] / m.total_revenue_ttm) * 100
        top5 = sum(sorted_customers[:5])
        m.top5_customer_revenue_pct = float(top5 / m.total_revenue_ttm) * 100
        m.hhi = sum((float(v / m.total_revenue_ttm) * 100) ** 2 for v in m.revenue_by_customer.values())

    for yr in range(ref_date.year - 2, ref_date.year + 1):
        yr_start = date(yr, 1, 1)
        yr_end = date(yr, 12, 31)
        total = db.query(func.sum(RevenueStream.revenue_gross)).filter(
            RevenueStream.company_id == company_id,
            RevenueStream.revenue_period >= yr_start,
            RevenueStream.revenue_period <= yr_end,
        ).scalar() or Decimal(0)
        m.total_revenue_by_year[yr] = total

    years = sorted(m.total_revenue_by_year.keys())
    if len(years) >= 2 and m.total_revenue_by_year[years[0]]:
        n = len(years) - 1
        m.cagr_3yr = (float(m.total_revenue_by_year[years[-1]] / m.total_revenue_by_year[years[0]]) ** (1 / n) - 1) * 100

    revenue_24m_start = ref_date - timedelta(days=730)
    revenue_24m_rows = (
        db.query(RevenueStream)
        .filter(RevenueStream.company_id == company_id, RevenueStream.revenue_period >= revenue_24m_start)
        .all()
    )
    monthly_vals = []
    ref_month_first = ref_date.replace(day=1)
    for i in range(24):
        month_anchor = _add_months(ref_month_first, -i)
        y, mo = month_anchor.year, month_anchor.month
        period_start = date(y, mo, 1)
        period_end = date(y, mo, calendar.monthrange(y, mo)[1])
        mo_rev = sum(r.revenue_gross for r in revenue_24m_rows if period_start <= r.revenue_period <= period_end)
        key = f"{y:04d}-{mo:02d}"
        m.monthly_revenue_24m[key] = mo_rev
        monthly_vals.append(float(mo_rev))
    if monthly_vals and statistics.mean(monthly_vals):
        m.revenue_consistency_score = statistics.stdev(monthly_vals) / statistics.mean(monthly_vals)

    active_customer_ids = set(m.revenue_by_customer.keys())
    m.active_customer_count_ttm = len(active_customer_ids)
    m.total_customer_count = db.query(func.count(Customer.id)).filter(Customer.company_id == company_id).scalar() or 0
    if m.active_customer_count_ttm and m.total_revenue_ttm:
        m.avg_customer_revenue_ttm = m.total_revenue_ttm / m.active_customer_count_ttm

    inactive_count = db.query(func.count(Customer.id)).filter(
        Customer.company_id == company_id, Customer.is_active == False
    ).scalar() or 0
    if m.total_customer_count > 0:
        m.customer_churn_rate = inactive_count / m.total_customer_count * 100

    customers = db.query(Customer).filter(Customer.company_id == company_id, Customer.is_active == True).all()
    tenures = [(today - c.tenure_start).days / 365 for c in customers if c.tenure_start]
    if tenures:
        m.avg_customer_tenure_years = statistics.mean(tenures)

    contracts = db.query(Contract).filter(Contract.company_id == company_id, Contract.is_active == True).all()
    active_contracts = [c for c in contracts if c.end_date and c.end_date > today]
    contracted_ids = {c.customer_id for c in active_contracts if c.customer_id}
    if m.active_customer_count_ttm:
        m.pct_customers_with_active_contracts = len(contracted_ids & active_customer_ids) / m.active_customer_count_ttm * 100
        multiyear = {c.customer_id for c in active_contracts if c.end_date and c.end_date > today + timedelta(days=365)}
        m.pct_customers_with_multiyear_contracts = len(multiyear & active_customer_ids) / m.active_customer_count_ttm * 100

    expiring_soon = [c for c in contracts if c.end_date and today < c.end_date <= today + timedelta(days=180) and not c.renewal_confirmed]
    for c in expiring_soon:
        if c.customer_id and c.customer_id in m.revenue_by_customer:
            m.revenue_at_risk_6mo += m.revenue_by_customer[c.customer_id]

    expenses = db.query(Expense).filter(Expense.company_id == company_id, Expense.period >= ttm_start).all()
    cogs = sum(e.amount for e in expenses if e.category == ExpenseCategory.COGS)
    opex = sum(e.amount for e in expenses if e.category == ExpenseCategory.OPEX)
    m.gross_profit = m.total_revenue_ttm - cogs
    if m.total_revenue_ttm:
        m.gross_margin_pct = float(m.gross_profit / m.total_revenue_ttm) * 100
    m.total_opex_ttm = opex
    if opex > 0 or cogs > 0:
        m.ebitda_ttm = m.gross_profit - opex
    else:
        active_emps_all = db.query(Employee).filter(Employee.company_id == company_id, Employee.status == EmployeeStatus.ACTIVE).all()
        labor_est = Decimal(str(sum(float(e.comp_annual or 0) for e in active_emps_all)))
        m.ebitda_ttm = m.total_revenue_ttm - labor_est

    owner_comp = sum(e.amount for e in expenses if e.category in (ExpenseCategory.OWNER, ExpenseCategory.PERSONAL))
    employees_q = db.query(Employee).filter(Employee.company_id == company_id, Employee.is_owner == True, Employee.status == EmployeeStatus.ACTIVE).all()
    owner_salary = Decimal(0) if owner_comp > 0 else sum(e.comp_annual or 0 for e in employees_q)
    m.owner_compensation_total = owner_comp + Decimal(str(owner_salary))

    active_emps = db.query(Employee).filter(Employee.company_id == company_id, Employee.status == EmployeeStatus.ACTIVE).all()
    ingested_headcount = len(active_emps)
    company_row = db.query(Company).filter(Company.id == company_id).first()
    m.total_headcount = effective_total_headcount(company_row, ingested_headcount)
    if m.total_headcount and m.total_revenue_ttm:
        m.revenue_per_employee = m.total_revenue_ttm / m.total_headcount
    emp_tenures = [(today - e.hire_date).days / 365 for e in active_emps if e.hire_date]
    if emp_tenures:
        m.avg_employee_tenure_years = statistics.mean(emp_tenures)
    mgmt_levels = {e.management_level for e in active_emps if e.management_level is not None and e.management_level > 0}
    m.management_layer_count = len(mgmt_levels)

    return m


# ============================================================================
# A2 — EBITDA Recast
# ============================================================================

from enum import Enum


class ChallengeLikelihood(str, Enum):
    LOW          = "LOW"
    MEDIUM       = "MEDIUM"
    HIGH         = "HIGH"
    NOT_DEFENSIBLE = "NOT_DEFENSIBLE"


@dataclass
class AddbackItem:
    description: str
    amount: Decimal
    challenge: ChallengeLikelihood
    category: str
    documented: bool = False
    notes: str = ""


@dataclass
class EBITDARecast:
    reported_net_income: Decimal = Decimal(0)
    addback_da: Decimal = Decimal(0)
    addback_interest: Decimal = Decimal(0)
    addback_taxes: Decimal = Decimal(0)
    reported_ebitda: Decimal = Decimal(0)
    addbacks: list[AddbackItem] = field(default_factory=list)
    conservative_ebitda: Decimal = Decimal(0)
    base_ebitda: Decimal = Decimal(0)
    aggressive_ebitda: Decimal = Decimal(0)
    total_addbacks: Decimal = Decimal(0)
    defensible_ebitda: Decimal = Decimal(0)


def compute_ebitda_recast(metrics: MetricRegistry, raw_inputs: dict) -> EBITDARecast:
    r = EBITDARecast()

    r.reported_net_income = Decimal(str(raw_inputs.get("net_income", 0)))
    r.addback_da          = Decimal(str(raw_inputs.get("da", 0)))
    r.addback_interest    = Decimal(str(raw_inputs.get("interest", 0)))
    r.addback_taxes       = Decimal(str(raw_inputs.get("taxes", 0)))
    r.reported_ebitda     = r.reported_net_income + r.addback_da + r.addback_interest + r.addback_taxes

    market_rate = Decimal(str(raw_inputs.get("market_rate_replacement_cost", 0)))
    owner_comp_delta = metrics.owner_compensation_total - market_rate
    if owner_comp_delta > 0:
        r.addbacks.append(AddbackItem(
            description="Owner Compensation Normalization",
            amount=owner_comp_delta,
            challenge=ChallengeLikelihood.MEDIUM,
            category="owner_comp",
            documented=True,
            notes=f"Owner total comp ${metrics.owner_compensation_total:,.0f} vs market ${market_rate:,.0f}",
        ))

    for item in raw_inputs.get("addback_items", []):
        r.addbacks.append(AddbackItem(
            description=item["description"],
            amount=Decimal(str(item["amount"])),
            challenge=ChallengeLikelihood(item["challenge"]),
            category=item["category"],
            documented=item.get("documented", False),
            notes=item.get("notes", ""),
        ))

    r.conservative_ebitda = r.reported_ebitda
    r.base_ebitda         = r.reported_ebitda
    r.aggressive_ebitda   = r.reported_ebitda

    for ab in r.addbacks:
        if ab.challenge == ChallengeLikelihood.NOT_DEFENSIBLE:
            continue
        if ab.challenge == ChallengeLikelihood.LOW:
            r.conservative_ebitda += ab.amount
            r.base_ebitda         += ab.amount
            r.aggressive_ebitda   += ab.amount
        elif ab.challenge == ChallengeLikelihood.MEDIUM:
            r.base_ebitda         += ab.amount * Decimal("0.5")
            r.aggressive_ebitda   += ab.amount
        elif ab.challenge == ChallengeLikelihood.HIGH:
            r.aggressive_ebitda += ab.amount

    r.total_addbacks    = sum(ab.amount for ab in r.addbacks if ab.challenge != ChallengeLikelihood.NOT_DEFENSIBLE)
    r.defensible_ebitda = r.base_ebitda

    return r


# ============================================================================
# A3 — Revenue Quality Score
# ============================================================================

from math import sqrt


def _recurring_rate_score(revenue_rows: list) -> tuple[float, float]:
    if not revenue_rows:
        return 50.0, 0.0
    total = sum(float(r.revenue_gross or 0) for r in revenue_rows)
    if total == 0:
        return 50.0, 0.0
    explicit_recurring = sum(float(r.revenue_gross or 0) for r in revenue_rows if r.recurring_flag or r.revenue_type in ("RECURRING", "SUBSCRIPTION"))
    explicit_pct = explicit_recurring / total
    if explicit_pct >= 0.05:
        pct = explicit_pct
    else:
        cust_months: dict = {}
        cust_revenue: dict = {}
        for r in revenue_rows:
            if r.customer_id and r.revenue_period:
                month = r.revenue_period.strftime("%Y-%m")
                cust_months.setdefault(r.customer_id, set()).add(month)
                cust_revenue[r.customer_id] = cust_revenue.get(r.customer_id, 0.0) + float(r.revenue_gross or 0)
        behavioral_recurring = sum(v for k, v in cust_revenue.items() if len(cust_months[k]) >= 3)
        pct = behavioral_recurring / total
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
    if not revenue_rows:
        return 50.0, 10000.0
    buckets: dict[str, float] = {}
    for r in revenue_rows:
        key = str(r.customer_id) if r.customer_id else (r.description or "unknown")
        buckets[key] = buckets.get(key, 0) + float(r.revenue_gross or 0)
    total = sum(buckets.values())
    if total == 0:
        return 50.0, 10000.0
    hhi = sum((v / total * 100) ** 2 for v in buckets.values())
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
    score = min(100, pct * 100 * 1.1)
    return round(score, 1), round(pct * 100, 1)


def _cagr_consistency_score(revenue_rows: list) -> tuple[float, float]:
    if not revenue_rows:
        return 50.0, 0.0
    monthly: dict[str, float] = {}
    for r in revenue_rows:
        if r.revenue_period:
            key = r.revenue_period.strftime("%Y-%m")
            monthly[key] = monthly.get(key, 0) + float(r.revenue_gross or 0)
    if len(monthly) < 3:
        return 50.0, 0.0
    values_raw = [monthly[k] for k in sorted(monthly.keys())]
    sorted_vals = sorted(values_raw)
    median = sorted_vals[len(sorted_vals) // 2]
    threshold = median * 3 if median > 0 else float("inf")
    values = [v / 12.0 if v > threshold else v for v in values_raw]
    mean = sum(values) / len(values)
    if mean == 0:
        return 50.0, 0.0
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std_dev = sqrt(variance)
    cv = (std_dev / mean) * 100
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
    if not revenue_rows:
        return 60.0, 100.0
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


@dataclass
class RevenueQualityScore:
    company_id: int
    composite: float
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
    data_confidence: str
    revenue_type_breakdown: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "recurring_rate":  {"score": self.recurring_rate_score, "value": self.recurring_pct, "label": f"{self.recurring_pct:.0f}% recurring", "source_rows": self.revenue_type_breakdown},
                "concentration":   {"score": self.concentration_score,  "value": self.hhi,                     "label": "HHI"},
                "durability":      {"score": self.durability_score,     "value": self.contract_durability_pct, "label": f"{self.contract_durability_pct:.0f}% under durable contract"},
                "consistency":     {"score": self.consistency_score,    "value": self.revenue_cv_pct,          "label": f"CV {self.revenue_cv_pct:.1f}%"},
                "nrr":             {"score": self.nrr_score,            "value": self.estimated_nrr,           "label": f"NRR ~{self.estimated_nrr:.0f}%"},
            },
            "data_confidence": self.data_confidence,
        }


_A3_WEIGHTS = {"recurring": 0.30, "concentration": 0.25, "durability": 0.20, "consistency": 0.15, "nrr": 0.10}


def compute_revenue_quality(company_id: int, db: Session) -> RevenueQualityScore:
    all_revenue_rows = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()
    contracts        = db.query(Contract).filter(Contract.company_id == company_id).all()

    data_dates = [r.revenue_period for r in all_revenue_rows if r.revenue_period]
    ref_date = max(data_dates) if data_dates else date.today()
    if ref_date > date.today():
        ref_date = date.today()
    ttm_start = ref_date - timedelta(days=365)
    ttm_rows = [r for r in all_revenue_rows if r.revenue_period and r.revenue_period >= ttm_start]

    s_rec,  recurring_pct  = _recurring_rate_score(ttm_rows)
    s_hhi,  hhi            = _hhi_score(ttm_rows)
    s_dur,  dur_pct        = _contract_durability_score(ttm_rows, contracts)
    s_cv,   cv_pct         = _cagr_consistency_score(all_revenue_rows)
    s_nrr,  nrr            = _nrr_score(all_revenue_rows)

    composite = (
        s_rec  * _A3_WEIGHTS["recurring"]
        + s_hhi  * _A3_WEIGHTS["concentration"]
        + s_dur  * _A3_WEIGHTS["durability"]
        + s_cv   * _A3_WEIGHTS["consistency"]
        + s_nrr  * _A3_WEIGHTS["nrr"]
    )

    row_count = len(ttm_rows)
    confidence = "HIGH" if row_count >= 50 else "MEDIUM" if row_count >= 12 else "LOW"

    type_totals: dict[str, float] = {}
    ttm_total = sum(float(r.revenue_gross or 0) for r in ttm_rows)
    for r in ttm_rows:
        rtype = (r.revenue_type.value if hasattr(r.revenue_type, "value") else str(r.revenue_type)) or "OTHER"
        type_totals[rtype] = type_totals.get(rtype, 0.0) + float(r.revenue_gross or 0)
    revenue_type_breakdown = sorted(
        [{"type": rtype, "revenue": round(amt, 0), "pct": round(amt / ttm_total * 100, 1) if ttm_total > 0 else 0.0, "recurring": rtype in ("RECURRING", "SUBSCRIPTION")} for rtype, amt in type_totals.items()],
        key=lambda x: x["revenue"], reverse=True,
    )

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
        revenue_type_breakdown=revenue_type_breakdown,
    )
