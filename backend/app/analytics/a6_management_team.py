"""
A6 — Management & Team Score (Blueprint II §A6)

Evaluates team strength, depth, and transferability.

Sub-dimensions:
  1. Management Completeness (30%)  — coverage of C-suite/VP roles
  2. Team Size Adequacy (25%)        — headcount vs revenue (revenue per employee benchmark)
  3. Ownership Concentration (25%)   — sole founder vs. distributed team
  4. Key Role Coverage (20%)         — finance, sales, operations roles present

DRS weight: Management & Team = 10% of composite score.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.ontology.models import Company
from app.ontology.models import Employee, RevenueStream, EmployeeStatus


# ── Role detection patterns ───────────────────────────────────────────────────

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
                "completeness":  {"score": self.completeness_score,  "value": self.mgmt_count,             "label": f"{self.mgmt_count} management roles"},
                "size":          {"score": self.size_score,          "value": self.revenue_per_employee,   "label": f"${self.revenue_per_employee:,.0f} revenue per employee"},
                "ownership":     {"score": self.ownership_score,     "value": self.owner_count,            "label": f"{self.owner_count} owner(s)"},
                "role_coverage": {"score": self.role_coverage_score, "value": None,                        "label": f"Finance:{self.has_finance_role} Sales:{self.has_sales_role} Ops:{self.has_ops_role}"},
            },
            "data_confidence": self.data_confidence,
            "data_gaps": self.data_gaps,
        }


WEIGHTS = {
    "completeness":  0.30,
    "size":          0.25,
    "ownership":     0.25,
    "role_coverage": 0.20,
}


def compute_management_team(company_id: int, db: Session) -> ManagementTeamScore:
    employees = db.query(Employee).filter(Employee.company_id == company_id).all()
    revenue   = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()

    # Fall back to manual headcount if no employee records were ingested
    company_row = db.query(Company).filter(Company.id == company_id).first()
    manual_headcount = company_row.total_headcount if company_row and company_row.total_headcount else 0

    if not employees:
        return ManagementTeamScore(
            company_id=company_id, composite=50.0,
            completeness_score=50.0, size_score=50.0,
            ownership_score=50.0, role_coverage_score=50.0,
            mgmt_count=0, total_headcount=manual_headcount, revenue_per_employee=0.0,
            owner_count=0, has_finance_role=False, has_sales_role=False, has_ops_role=False,
            data_confidence="LOW",
            data_gaps=["management_classification", "role_classification"],
        )

    active = [e for e in employees if e.status == EmployeeStatus.ACTIVE]
    total  = manual_headcount if manual_headcount > 0 else len(active)
    owners = [e for e in active if e.is_owner]

    # Classify roles
    mgmt_count = sum(
        1 for e in active
        if _C_SUITE.search(str(e.role or "")) or _VP_LEVEL.search(str(e.role or ""))
        or (e.management_level is not None and e.management_level <= 1)
    )

    has_finance = any(_FINANCE.search(str(e.role or "")) for e in active)
    has_sales   = any(_SALES.search(str(e.role or "")) for e in active)
    has_ops     = any(_OPS.search(str(e.role or "")) for e in active)

    data_gaps: list[str] = []

    # 1. Management completeness
    if mgmt_count == 0 and total >= 3:
        s_comp = 50   # data gap — can't classify roles from payroll data
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

    # 2. Revenue per employee (benchmark: $150k–$300k is typical for SMB)
    total_rev = sum(float(r.revenue_gross or 0) for r in revenue)
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
        s_size = 50  # no revenue data — neutral

    # 3. Ownership concentration risk
    n_owners = len(owners)
    if n_owners == 0:
        s_own = 80   # no data → slight positive assumption
    elif n_owners == 1:
        s_own = 40   # sole founder risk
    elif n_owners == 2:
        s_own = 65
    elif n_owners >= 3:
        s_own = 85

    # 4. Key role coverage
    coverage_hits = sum([has_finance, has_sales, has_ops])
    if coverage_hits == 0 and total >= 3:
        s_roles = 50  # data gap — role labels not present in payroll data
        data_gaps.append("role_classification")
    else:
        s_roles = {0: 20, 1: 50, 2: 75, 3: 95}.get(coverage_hits, 20)

    composite = (
        s_comp  * WEIGHTS["completeness"]
        + s_size * WEIGHTS["size"]
        + s_own  * WEIGHTS["ownership"]
        + s_roles * WEIGHTS["role_coverage"]
    )

    # LOW confidence when both management classification and role data are missing
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
