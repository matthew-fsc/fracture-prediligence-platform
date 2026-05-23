"""
A4 — Operational Independence Score (Blueprint II §A4)

Measures how dependent the business is on the owner/founder for operations.
Key risk: key-person dependency → business value collapses without founder.

Sub-dimensions:
  1. Owner Compensation Concentration (35%) — owner comp as % of total payroll
  2. Key Person Count (25%)                  — # of identified key persons / total employees
  3. Management Depth (25%)                  — management layer coverage
  4. Staff Stability (15%)                   — % active employees (vs terminated)

DRS weight: Operational Independence = 20% of composite score.
"""

from __future__ import annotations
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.analytics.a1_metric_computation import effective_total_headcount
from app.ontology.models import Company, Employee, EmployeeStatus, Expense, ExpenseCategory, RevenueStream

# OPEX lines that represent staff wages (P&L) — roster may only have the owner row from Gusto.
_PAYROLL_OPEX = re.compile(
    r"\b(salary|salaries|wage|wages|payroll|compensation|gusto|adp|paychex|pay\s*roll|"
    r"payroll\s+tax|employee\s+benefit|workers?\s+comp|wc\s+insurance)\b",
    re.I,
)


def _expense_text(e: Expense) -> str:
    parts = [e.description or "", e.vendor or ""]
    return " ".join(parts)


def _looks_like_payroll_opex(e: Expense) -> bool:
    if e.category != ExpenseCategory.OPEX:
        return False
    return bool(_PAYROLL_OPEX.search(_expense_text(e)))


def _ttm_expenses_and_ref_date(company_id: int, db: Session) -> tuple[list[Expense], date]:
    exp_all = db.query(Expense).filter(Expense.company_id == company_id).all()
    rev_dates = [
        r.revenue_period
        for r in db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()
        if r.revenue_period
    ]
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
                "owner_comp":       {"score": self.owner_comp_score,      "value": self.owner_comp_pct,        "label": self.owner_comp_label},
                "key_person":       {"score": self.key_person_score,      "value": self.key_person_count,      "label": f"{self.key_person_count} key persons identified"},
                "management_depth": {"score": self.management_depth_score, "value": self.management_layer_count, "label": f"{self.management_layer_count} management layer(s)"},
                "staff_stability":  {"score": self.staff_stability_score,  "value": self.active_employee_pct,  "label": f"{self.active_employee_pct:.0f}% active workforce"},
            },
            "data_confidence": self.data_confidence,
        }


WEIGHTS = {
    "owner_comp":       0.35,
    "key_person":       0.25,
    "management_depth": 0.25,
    "staff_stability":  0.15,
}


def compute_operational_independence(company_id: int, db: Session) -> OperationalIndependenceScore:
    employees = db.query(Employee).filter(Employee.company_id == company_id).all()

    if not employees:
        return OperationalIndependenceScore(
            company_id=company_id, composite=50.0,
            owner_comp_score=50.0, key_person_score=50.0,
            management_depth_score=50.0, staff_stability_score=50.0,
            owner_comp_pct=0.0, key_person_count=0, total_employees=0,
            management_layer_count=0, active_employee_pct=100.0,
            data_confidence="LOW",
            owner_comp_label="No payroll records",
        )

    company_row = db.query(Company).filter(Company.id == company_id).first()
    total = len(employees)
    active = [e for e in employees if e.status == EmployeeStatus.ACTIVE]
    owners = [e for e in employees if e.is_owner]
    key_persons = [e for e in employees if e.is_key_person or e.is_owner]

    # 1. Owner comp concentration — blend roster comp with P&L wage lines.
    # Many books map staff salaries to OPEX ("Salaries", "Payroll") while the Employee table
    # only has the owner from Gusto — without P&L, owner looks like 100% of payroll.
    owners_active = [e for e in active if e.is_owner]
    total_comp = sum(float(e.comp_annual or 0) for e in active)
    owner_comp = sum(float(e.comp_annual or 0) for e in owners_active)

    exp_ttm, _ref = _ttm_expenses_and_ref_date(company_id, db)
    pl_payroll_opex = sum(float(e.amount or 0) for e in exp_ttm if _looks_like_payroll_opex(e))
    pl_owner_draws = sum(
        float(e.amount or 0)
        for e in exp_ttm
        if e.category in (ExpenseCategory.OWNER, ExpenseCategory.PERSONAL)
    )
    pl_wages_total = pl_payroll_opex + pl_owner_draws

    # Denominator: full wage pool (use the larger of roster TTM comp or P&L wage signals).
    total_wages = max(total_comp, pl_wages_total)
    # Owner $: roster owner comp vs explicit owner/personal lines (do not double-count — take max of parallel measures).
    owner_wages = max(owner_comp, pl_owner_draws)

    eff_headcount = effective_total_headcount(company_row, len(active))
    payroll_incomplete = len(active) < eff_headcount and eff_headcount > 1
    used_pl = pl_wages_total > total_comp + 1e-6

    # Single roster row + full headcount on profile: raw math is 100% owner — scale implied
    # wage pool so % is not misleading when payroll feed is partial.
    if (
        payroll_incomplete
        and not used_pl
        and len(active) == 1
        and eff_headcount > 1
        and total_comp > 0
    ):
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

    # 2. Key person ratio
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

    # 3. Management depth — distinct management levels present
    mgmt_levels = set(
        e.management_level for e in employees
        if e.management_level is not None and e.management_level > 0
    )
    depth = len(mgmt_levels)
    if depth == 0:
        s_depth = 20
    elif depth == 1:
        s_depth = 50
    elif depth == 2:
        s_depth = 75
    else:
        s_depth = 90

    # 4. Staff stability
    active_pct = len(active) / total * 100
    s_stability = min(100, active_pct)

    composite = (
        s_owner    * WEIGHTS["owner_comp"]
        + s_key    * WEIGHTS["key_person"]
        + s_depth  * WEIGHTS["management_depth"]
        + s_stability * WEIGHTS["staff_stability"]
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
