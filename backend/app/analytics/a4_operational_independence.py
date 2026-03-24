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
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.ontology.models import Employee, EmployeeStatus


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

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "owner_comp":       {"score": self.owner_comp_score,      "value": self.owner_comp_pct,        "label": f"Owner comp {self.owner_comp_pct:.0f}% of payroll"},
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
        )

    total = len(employees)
    active = [e for e in employees if e.status == EmployeeStatus.ACTIVE]
    owners = [e for e in employees if e.is_owner]
    key_persons = [e for e in employees if e.is_key_person or e.is_owner]

    # 1. Owner comp concentration
    total_comp = sum(float(e.comp_annual or 0) for e in employees)
    owner_comp = sum(float(e.comp_annual or 0) for e in owners)
    owner_comp_pct = (owner_comp / total_comp * 100) if total_comp > 0 else 0.0

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
    )
