"""
Operational Analytics — Blueprint II §A4, §A5, §A6, §A7, §A8

Consolidates:
  A4 — Operational Independence Score
  A5 — Customer Risk Score
  A6 — Management & Team Score
  A7 — Growth Drivers Score
  A8 — Financial Integrity Score
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.analytics.financial_analytics import effective_total_headcount
from app.ontology.models import (
    Company, Employee, EmployeeStatus, Expense, ExpenseCategory,
    RevenueStream, Customer, Contract,
)


# ============================================================================
# A4 — Operational Independence Score
# ============================================================================

_PAYROLL_OPEX = re.compile(
    r"\b(salary|salaries|wage|wages|payroll|compensation|gusto|adp|paychex|pay\s*roll|"
    r"payroll\s+tax|employee\s+benefit|workers?\s+comp|wc\s+insurance)\b",
    re.I,
)


def _expense_text(e: Expense) -> str:
    return " ".join([e.description or "", e.vendor or ""])


def _looks_like_payroll_opex(e: Expense) -> bool:
    if e.category != ExpenseCategory.OPEX:
        return False
    return bool(_PAYROLL_OPEX.search(_expense_text(e)))


def _ttm_expenses_and_ref_date(company_id: int, db: Session) -> tuple[list[Expense], date]:
    exp_all = db.query(Expense).filter(Expense.company_id == company_id).all()
    rev_dates = [r.revenue_period for r in db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all() if r.revenue_period]
    exp_dates = [e.period for e in exp_all if e.period]
    candidates = rev_dates + exp_dates
    ref = max(candidates) if candidates else date.today()
    if ref > date.today():
        ref = date.today()
    ttm_start = ref - timedelta(days=365)
    exp_ttm = [e for e in exp_all if e.period and e.period >= ttm_start]
    return exp_ttm, ref


@dataclass
class OperationalIndependenceScore:
    company_id: int
    composite: float
    owner_comp_score: float
    key_person_score: float
    management_depth_score: float
    staff_stability_score: float
    owner_comp_pct: float
    key_person_count: int
    total_employees: int
    management_layer_count: int
    active_employee_pct: float
    data_confidence: str
    owner_comp_label: str

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "owner_comp":       {"score": self.owner_comp_score,       "value": self.owner_comp_pct,         "label": self.owner_comp_label},
                "key_person":       {"score": self.key_person_score,       "value": self.key_person_count,       "label": f"{self.key_person_count} key persons identified"},
                "management_depth": {"score": self.management_depth_score, "value": self.management_layer_count, "label": f"{self.management_layer_count} management layer(s)"},
                "staff_stability":  {"score": self.staff_stability_score,  "value": self.active_employee_pct,   "label": f"{self.active_employee_pct:.0f}% active workforce"},
            },
            "data_confidence": self.data_confidence,
        }


_A4_WEIGHTS = {"owner_comp": 0.35, "key_person": 0.25, "management_depth": 0.25, "staff_stability": 0.15}


def compute_operational_independence(company_id: int, db: Session) -> OperationalIndependenceScore:
    employees = db.query(Employee).filter(Employee.company_id == company_id).all()

    if not employees:
        return OperationalIndependenceScore(
            company_id=company_id, composite=50.0,
            owner_comp_score=50.0, key_person_score=50.0,
            management_depth_score=50.0, staff_stability_score=50.0,
            owner_comp_pct=0.0, key_person_count=0, total_employees=0,
            management_layer_count=0, active_employee_pct=100.0,
            data_confidence="LOW", owner_comp_label="No payroll records",
        )

    company_row = db.query(Company).filter(Company.id == company_id).first()
    total = len(employees)
    active = [e for e in employees if e.status == EmployeeStatus.ACTIVE]
    key_persons = [e for e in employees if e.is_key_person or e.is_owner]

    owners_active = [e for e in active if e.is_owner]
    total_comp = sum(float(e.comp_annual or 0) for e in active)
    owner_comp = sum(float(e.comp_annual or 0) for e in owners_active)

    exp_ttm, _ref = _ttm_expenses_and_ref_date(company_id, db)
    pl_payroll_opex = sum(float(e.amount or 0) for e in exp_ttm if _looks_like_payroll_opex(e))
    pl_owner_draws = sum(float(e.amount or 0) for e in exp_ttm if e.category in (ExpenseCategory.OWNER, ExpenseCategory.PERSONAL))
    pl_wages_total = pl_payroll_opex + pl_owner_draws

    total_wages = max(total_comp, pl_wages_total)
    owner_wages = max(owner_comp, pl_owner_draws)

    eff_headcount = effective_total_headcount(company_row, len(active))
    payroll_incomplete = len(active) < eff_headcount and eff_headcount > 1
    used_pl = pl_wages_total > total_comp + 1e-6

    if payroll_incomplete and not used_pl and len(active) == 1 and eff_headcount > 1 and total_comp > 0:
        implied_company_payroll = total_comp * eff_headcount
        total_wages_for_pct = max(total_wages, implied_company_payroll)
    else:
        total_wages_for_pct = total_wages

    if total_wages_for_pct > 0:
        owner_comp_pct = min(100.0, (owner_wages / total_wages_for_pct) * 100.0)
    else:
        owner_comp_pct = 0.0

    if total_wages <= 0:
        owner_comp_label = "No wage data (roster or P&L)"
    elif used_pl and payroll_incomplete:
        owner_comp_label = f"~{owner_comp_pct:.0f}% owner share · P&L + {len(active)}/{eff_headcount} roster"
    elif used_pl:
        owner_comp_label = f"~{owner_comp_pct:.0f}% owner share · P&L vs roster"
    elif payroll_incomplete:
        owner_comp_label = f"~{owner_comp_pct:.0f}% owner share · roster {len(active)}/{eff_headcount}"
    else:
        owner_comp_label = f"~{owner_comp_pct:.0f}% owner share (roster)"

    if owner_comp_pct >= 70:
        s_owner = 10
    elif owner_comp_pct >= 50:
        s_owner = 10 + (70 - owner_comp_pct) / 20 * 30
    elif owner_comp_pct >= 30:
        s_owner = 40 + (50 - owner_comp_pct) / 20 * 30
    elif owner_comp_pct >= 15:
        s_owner = 70 + (30 - owner_comp_pct) / 15 * 20
    else:
        s_owner = 90 + (15 - owner_comp_pct) / 15 * 10

    key_ratio = len(key_persons) / max(total, 1)
    if key_ratio >= 0.50:
        s_key = 10
    elif key_ratio >= 0.30:
        s_key = 10 + (0.50 - key_ratio) / 0.20 * 30
    elif key_ratio >= 0.15:
        s_key = 40 + (0.30 - key_ratio) / 0.15 * 30
    elif key_ratio >= 0.05:
        s_key = 70 + (0.15 - key_ratio) / 0.10 * 20
    else:
        s_key = 90 + (0.05 - key_ratio) / 0.05 * 10

    mgmt_levels = set(e.management_level for e in employees if e.management_level is not None and e.management_level > 0)
    depth = len(mgmt_levels)
    if depth == 0:
        s_depth = 20
    elif depth == 1:
        s_depth = 50
    elif depth == 2:
        s_depth = 75
    else:
        s_depth = 90

    active_pct = len(active) / total * 100
    s_stability = min(100, active_pct)

    composite = (
        s_owner * _A4_WEIGHTS["owner_comp"]
        + s_key * _A4_WEIGHTS["key_person"]
        + s_depth * _A4_WEIGHTS["management_depth"]
        + s_stability * _A4_WEIGHTS["staff_stability"]
    )
    confidence = "HIGH" if total >= 10 else "MEDIUM" if total >= 3 else "LOW"

    return OperationalIndependenceScore(
        company_id=company_id,
        composite=round(composite, 1),
        owner_comp_score=round(s_owner, 1),
        key_person_score=round(s_key, 1),
        management_depth_score=round(s_depth, 1),
        staff_stability_score=round(s_stability, 1),
        owner_comp_pct=round(owner_comp_pct, 1),
        key_person_count=len(key_persons),
        total_employees=total,
        management_layer_count=depth,
        active_employee_pct=round(active_pct, 1),
        data_confidence=confidence,
        owner_comp_label=owner_comp_label,
    )


# ============================================================================
# A5 — Customer Risk Score
# ============================================================================

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
    top_customers_detail: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "top_customer_name": self.top_customer_name,
            "top_customer_pct":  self.top_customer_pct,
            "sub_scores": {
                "concentration":   {"score": self.concentration_score,   "value": self.top_customer_pct,       "label": f"Top customer {self.top_customer_pct:.0f}% of revenue", "source_rows": self.top_customers_detail},
                "diversification": {"score": self.diversification_score, "value": self.active_customer_count,  "label": f"{self.active_customer_count} active customers, {self.industry_count} industries"},
                "churn":           {"score": self.churn_score,           "value": self.inactive_pct,           "label": f"{self.inactive_pct:.0f}% inactive"},
                "tenure":          {"score": self.tenure_score,          "value": self.avg_tenure_years,       "label": f"Avg tenure {self.avg_tenure_years:.1f} yrs"},
            },
            "data_confidence": self.data_confidence,
        }


_A5_WEIGHTS = {"concentration": 0.35, "diversification": 0.25, "churn": 0.25, "tenure": 0.15}


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
            data_confidence="LOW", top_customers_detail=[],
        )

    active = [c for c in customers if c.is_active]
    inactive_pct = (1 - len(active) / len(customers)) * 100 if customers else 0.0

    max_date = max((r.revenue_period for r in revenue if r.revenue_period), default=None)
    if max_date:
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

    top_cust_name = "Unknown"
    if top_cust_id:
        cust_obj = next((c for c in customers if c.id == top_cust_id), None)
        if cust_obj:
            top_cust_name = cust_obj.name

    if top_pct >= 50:
        s_conc = max(0, 10 - (top_pct - 50) / 50 * 10)
    elif top_pct >= 30:
        s_conc = 40 + (50 - top_pct) / 20 * 30
    elif top_pct >= 20:
        s_conc = 70 + (30 - top_pct) / 10 * 20
    elif top_pct >= 10:
        s_conc = 85 + (20 - top_pct) / 10 * 15
    else:
        s_conc = 100

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
    s_div = min(100, s_div + min(n_industries * 2, 10))

    if inactive_pct <= 5:
        s_churn = 95
    elif inactive_pct <= 15:
        s_churn = 70 + (15 - inactive_pct) / 10 * 25
    elif inactive_pct <= 30:
        s_churn = 40 + (30 - inactive_pct) / 15 * 30
    else:
        s_churn = max(0, 40 - (inactive_pct - 30) / 70 * 40)

    today = date.today()
    tenures = [(today - c.tenure_start).days / 365.25 for c in active if c.tenure_start]
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
        s_conc  * _A5_WEIGHTS["concentration"]
        + s_div * _A5_WEIGHTS["diversification"]
        + s_churn * _A5_WEIGHTS["churn"]
        + s_tenure * _A5_WEIGHTS["tenure"]
    )
    confidence = "HIGH" if len(customers) >= 20 else "MEDIUM" if len(customers) >= 5 else "LOW"

    cust_id_to_name = {c.id: c.name for c in customers}
    sorted_custs = sorted(cust_rev.items(), key=lambda kv: kv[1], reverse=True)
    top_customers_detail = [
        {"name": cust_id_to_name.get(cid, f"Customer #{cid}"), "revenue": round(rev_amt, 0), "pct": round(rev_amt / total_rev * 100, 1) if total_rev > 0 else 0.0}
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


# ============================================================================
# A6 — Management & Team Score
# ============================================================================

_C_SUITE = re.compile(r"\b(ceo|cfo|coo|cto|president|founder|owner|principal|managing partner)\b", re.I)
_VP_LEVEL = re.compile(r"\b(vp|vice president|director|head of)\b", re.I)
_FINANCE  = re.compile(r"\b(cfo|controller|accountant|bookkeeper|finance|accounting)\b", re.I)
_SALES    = re.compile(r"\b(sales|account exec|business dev|bd|revenue|commercial)\b", re.I)
_OPS      = re.compile(r"\b(operations|ops|manager|supervisor|delivery|project manager|pm)\b", re.I)


@dataclass
class ManagementTeamScore:
    company_id: int
    composite: float
    completeness_score: float
    size_score: float
    ownership_score: float
    role_coverage_score: float
    mgmt_count: int
    total_headcount: int
    revenue_per_employee: float
    owner_count: int
    has_finance_role: bool
    has_sales_role: bool
    has_ops_role: bool
    data_confidence: str
    data_gaps: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "completeness":  {"score": self.completeness_score,  "value": self.mgmt_count,           "label": f"{self.mgmt_count} management roles"},
                "size":          {"score": self.size_score,          "value": self.revenue_per_employee, "label": f"${self.revenue_per_employee:,.0f} revenue per employee · {self.total_headcount} FTE"},
                "ownership":     {"score": self.ownership_score,     "value": self.owner_count,          "label": f"{self.owner_count} owner(s)"},
                "role_coverage": {"score": self.role_coverage_score, "value": None,                      "label": f"Finance:{self.has_finance_role} Sales:{self.has_sales_role} Ops:{self.has_ops_role}"},
            },
            "data_confidence": self.data_confidence,
            "data_gaps": self.data_gaps,
        }


_A6_WEIGHTS = {"completeness": 0.30, "size": 0.25, "ownership": 0.25, "role_coverage": 0.20}


def compute_management_team(company_id: int, db: Session) -> ManagementTeamScore:
    employees = db.query(Employee).filter(Employee.company_id == company_id).all()
    revenue   = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()
    company_row = db.query(Company).filter(Company.id == company_id).first()

    if not employees:
        total_hc = effective_total_headcount(company_row, 0)
        return ManagementTeamScore(
            company_id=company_id, composite=50.0,
            completeness_score=50.0, size_score=50.0,
            ownership_score=50.0, role_coverage_score=50.0,
            mgmt_count=0, total_headcount=total_hc, revenue_per_employee=0.0,
            owner_count=0, has_finance_role=False, has_sales_role=False, has_ops_role=False,
            data_confidence="LOW", data_gaps=["management_classification", "role_classification"],
        )

    active = [e for e in employees if e.status == EmployeeStatus.ACTIVE]
    total  = effective_total_headcount(company_row, len(active))
    owners = [e for e in active if e.is_owner]

    mgmt_count = sum(1 for e in active if _C_SUITE.search(str(e.role or "")) or _VP_LEVEL.search(str(e.role or "")) or (e.management_level is not None and e.management_level == 1))
    has_finance = any(_FINANCE.search(str(e.role or "")) for e in active)
    has_sales   = any(_SALES.search(str(e.role or "")) for e in active)
    has_ops     = any(_OPS.search(str(e.role or "")) for e in active)
    data_gaps: list[str] = []

    if mgmt_count == 0 and total >= 3:
        s_comp = 50
        data_gaps.append("management_classification")
    elif mgmt_count == 0:
        s_comp = 20
    elif mgmt_count == 1:
        s_comp = 45
    elif mgmt_count == 2:
        s_comp = 65
    elif mgmt_count >= 3:
        s_comp = min(90, 65 + (mgmt_count - 2) * 8)
    else:
        s_comp = 20

    data_dates = [r.revenue_period for r in revenue if r.revenue_period]
    rev_ref = max(data_dates) if data_dates else date.today()
    if rev_ref > date.today():
        rev_ref = date.today()
    ttm_rev_start = rev_ref - timedelta(days=365)
    total_rev = sum(float(r.revenue_gross or 0) for r in revenue if r.revenue_period and r.revenue_period >= ttm_rev_start)
    rev_per_emp = total_rev / total if total > 0 else 0.0

    if rev_per_emp >= 300_000:
        s_size = 90
    elif rev_per_emp >= 150_000:
        s_size = 70 + (rev_per_emp - 150_000) / 150_000 * 20
    elif rev_per_emp >= 75_000:
        s_size = 45 + (rev_per_emp - 75_000) / 75_000 * 25
    elif rev_per_emp > 0:
        s_size = rev_per_emp / 75_000 * 45
    else:
        s_size = 50

    n_owners = len(owners)
    if n_owners == 0:
        s_own = 80
    elif n_owners == 1:
        s_own = 40
    elif n_owners == 2:
        s_own = 65
    elif n_owners >= 3:
        s_own = 85

    coverage_hits = sum([has_finance, has_sales, has_ops])
    if coverage_hits == 0 and total >= 3:
        s_roles = 50
        data_gaps.append("role_classification")
    else:
        s_roles = {0: 20, 1: 50, 2: 75, 3: 95}.get(coverage_hits, 20)

    composite = (
        s_comp  * _A6_WEIGHTS["completeness"]
        + s_size * _A6_WEIGHTS["size"]
        + s_own  * _A6_WEIGHTS["ownership"]
        + s_roles * _A6_WEIGHTS["role_coverage"]
    )

    if mgmt_count == 0 and coverage_hits == 0 and total > 0:
        confidence = "LOW"
    else:
        confidence = "HIGH" if total >= 5 else "MEDIUM" if total >= 2 else "LOW"

    return ManagementTeamScore(
        company_id=company_id,
        composite=round(composite, 1),
        completeness_score=round(s_comp, 1),
        size_score=round(s_size, 1),
        ownership_score=round(s_own, 1),
        role_coverage_score=round(float(s_roles), 1),
        mgmt_count=mgmt_count,
        total_headcount=total,
        revenue_per_employee=round(rev_per_emp, 0),
        owner_count=n_owners,
        has_finance_role=has_finance,
        has_sales_role=has_sales,
        has_ops_role=has_ops,
        data_confidence=confidence,
        data_gaps=data_gaps,
    )


# ============================================================================
# A7 — Growth Drivers Score
# ============================================================================

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
                "revenue_cagr":      {"score": self.cagr_score,         "value": self.revenue_cagr_pct,        "label": f"CAGR {self.revenue_cagr_pct:+.1f}%"},
                "new_customers":     {"score": self.new_customer_score,  "value": self.new_customer_pct,        "label": f"{self.new_customer_pct:.0f}% new in last 12mo"},
                "contract_pipeline": {"score": self.pipeline_score,      "value": self.pipeline_coverage_ratio, "label": f"{self.pipeline_coverage_ratio:.1f}x pipeline coverage"},
            },
            "data_confidence": self.data_confidence,
        }


_A7_WEIGHTS = {"cagr": 0.40, "new_customers": 0.30, "pipeline": 0.30}


def compute_growth_drivers(company_id: int, db: Session) -> GrowthDriversScore:
    revenue       = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()
    customers     = db.query(Customer).filter(Customer.company_id == company_id).all()
    contracts_all = db.query(Contract).filter(Contract.company_id == company_id, Contract.is_active == True).all()

    data_dates = [r.revenue_period for r in revenue if r.revenue_period]
    ref_date = max(data_dates) if data_dates else date.today()
    twelve_months_ago = ref_date - timedelta(days=365)
    contracts = [c for c in contracts_all if c.end_date and c.end_date > ref_date]

    by_year: dict[int, float] = {}
    for r in revenue:
        if r.revenue_period:
            by_year[r.revenue_period.year] = by_year.get(r.revenue_period.year, 0) + float(r.revenue_gross or 0)

    years = sorted(by_year.keys())
    cagr_pct = 0.0
    if len(years) >= 2:
        base_year = years[-2]
        n = years[-1] - base_year
        if n > 0 and by_year[base_year] > 0:
            cagr_pct = ((by_year[years[-1]] / by_year[base_year]) ** (1 / n) - 1) * 100

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

    first_rev_by_customer: dict[int, date] = {}
    for r in revenue:
        if r.customer_id and r.revenue_period:
            cid = r.customer_id
            prev = first_rev_by_customer.get(cid)
            if prev is None or r.revenue_period < prev:
                first_rev_by_customer[cid] = r.revenue_period

    def _customer_acquisition_start(c: Customer) -> date | None:
        if c.tenure_start is not None:
            return c.tenure_start
        return first_rev_by_customer.get(c.id)

    new_customers = sum(1 for c in customers if (s := _customer_acquisition_start(c)) is not None and s >= twelve_months_ago)
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

    pipeline_value = sum(float(c.annual_value or 0) for c in contracts)
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
        s_pipeline = 30

    composite = s_cagr * _A7_WEIGHTS["cagr"] + s_new * _A7_WEIGHTS["new_customers"] + s_pipeline * _A7_WEIGHTS["pipeline"]
    has_years = len(years) >= 2
    has_custs = len(customers) >= 5
    confidence = "HIGH" if (has_years and has_custs) else "MEDIUM" if (has_years or has_custs) else "LOW"

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


# ============================================================================
# A8 — Financial Integrity Score
# ============================================================================

@dataclass
class FinancialIntegrityScore:
    company_id: int
    composite: float
    addback_score: float
    expense_completeness_score: float
    revenue_completeness_score: float
    data_coverage_score: float
    owner_expense_pct: float
    total_addbacks: float
    expense_completeness_pct: float
    revenue_completeness_pct: float
    months_of_data: int
    data_confidence: str
    addback_rows: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "addback_exposure":      {"score": self.addback_score,                "value": self.owner_expense_pct,         "label": f"Owner/personal {self.owner_expense_pct:.0f}% of expenses (${self.total_addbacks:,.0f} addbacks)", "source_rows": self.addback_rows},
                "expense_completeness":  {"score": self.expense_completeness_score,  "value": self.expense_completeness_pct,  "label": f"{self.expense_completeness_pct:.0f}% categorized"},
                "revenue_completeness":  {"score": self.revenue_completeness_score,  "value": self.revenue_completeness_pct,  "label": f"{self.revenue_completeness_pct:.0f}% with period + type"},
                "data_coverage":         {"score": self.data_coverage_score,         "value": self.months_of_data,            "label": f"{self.months_of_data} months of data"},
            },
            "data_confidence": self.data_confidence,
        }


_A8_WEIGHTS = {"addback": 0.35, "expense_completeness": 0.25, "revenue_completeness": 0.20, "data_coverage": 0.20}
_ADDBACK_CATEGORIES = {ExpenseCategory.OWNER, ExpenseCategory.PERSONAL, ExpenseCategory.RELATED_PARTY}


def compute_financial_integrity(company_id: int, db: Session) -> FinancialIntegrityScore:
    expenses = db.query(Expense).filter(Expense.company_id == company_id).all()
    revenue  = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()

    total_exp = sum(float(e.amount or 0) for e in expenses)
    addback_exp = sum(float(e.amount or 0) for e in expenses if e.category in _ADDBACK_CATEGORIES)
    owner_pct = (addback_exp / total_exp * 100) if total_exp > 0 else 0.0

    if owner_pct <= 5:
        s_addback = 95
    elif owner_pct <= 15:
        s_addback = 70 + (15 - owner_pct) / 10 * 25
    elif owner_pct <= 30:
        s_addback = 40 + (30 - owner_pct) / 15 * 30
    elif owner_pct <= 50:
        s_addback = 15 + (50 - owner_pct) / 20 * 25
    else:
        s_addback = max(0, 15 - (owner_pct - 50) / 50 * 15)

    exp_categorized = sum(1 for e in expenses if e.category)
    exp_completeness = (exp_categorized / len(expenses) * 100) if expenses else 100.0
    s_exp = min(100, exp_completeness)

    rev_complete = sum(1 for r in revenue if r.revenue_period and r.revenue_type)
    rev_completeness = (rev_complete / len(revenue) * 100) if revenue else 100.0
    s_rev = min(100, rev_completeness)

    months: set[str] = set()
    for r in revenue:
        if r.revenue_period:
            months.add(r.revenue_period.strftime("%Y-%m"))
    for e in expenses:
        if e.period:
            months.add(e.period.strftime("%Y-%m"))
    n_months = len(months)

    if n_months >= 36:
        s_coverage = 100
    elif n_months >= 24:
        s_coverage = 80 + (n_months - 24) / 12 * 20
    elif n_months >= 12:
        s_coverage = 55 + (n_months - 12) / 12 * 25
    elif n_months >= 6:
        s_coverage = 30 + (n_months - 6) / 6 * 25
    else:
        s_coverage = max(0, n_months / 6 * 30)

    composite = (
        s_addback * _A8_WEIGHTS["addback"]
        + s_exp   * _A8_WEIGHTS["expense_completeness"]
        + s_rev   * _A8_WEIGHTS["revenue_completeness"]
        + s_coverage * _A8_WEIGHTS["data_coverage"]
    )

    total_records = len(expenses) + len(revenue)
    confidence = "HIGH" if total_records >= 100 else "MEDIUM" if total_records >= 24 else "LOW"

    addback_expense_lines = sorted([e for e in expenses if e.category in _ADDBACK_CATEGORIES], key=lambda e: float(e.amount or 0), reverse=True)
    addback_rows = [
        {"description": e.description or e.vendor or "Unnamed expense", "category": e.category.value if hasattr(e.category, "value") else str(e.category), "amount": round(float(e.amount or 0), 0), "period": e.period.isoformat() if e.period else None}
        for e in addback_expense_lines[:8]
    ]

    return FinancialIntegrityScore(
        company_id=company_id,
        composite=round(composite, 1),
        addback_score=round(s_addback, 1),
        expense_completeness_score=round(s_exp, 1),
        revenue_completeness_score=round(s_rev, 1),
        data_coverage_score=round(s_coverage, 1),
        owner_expense_pct=round(owner_pct, 1),
        total_addbacks=round(addback_exp, 2),
        expense_completeness_pct=round(exp_completeness, 1),
        revenue_completeness_pct=round(rev_completeness, 1),
        months_of_data=n_months,
        data_confidence=confidence,
        addback_rows=addback_rows,
    )
