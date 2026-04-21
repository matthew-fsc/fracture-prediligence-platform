"""
A8 — Financial Integrity Score (Blueprint II §A8)

Assesses the reliability and cleanliness of the financial data itself.
High financial integrity = buyer can trust the numbers.

Sub-dimensions:
  1. Owner Add-Back Exposure (35%)    — owner/personal expenses as % of total OPEX
  2. Expense Category Completeness (25%) — % of expenses with a category assigned
  3. Revenue Completeness (20%)       — % of revenue rows with period + type
  4. Data Coverage (20%)              — months of data present vs expected 36 months

DRS weight: Financial Integrity = 20% of composite score.
"""

from __future__ import annotations
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.ontology.models import RevenueStream, Expense, ExpenseCategory


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
    # Top addback expense lines for drill-down
    addback_rows: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "composite":  self.composite,
            "sub_scores": {
                "addback_exposure": {
                    "score": self.addback_score,
                    "value": self.owner_expense_pct,
                    "label": f"Owner/personal {self.owner_expense_pct:.0f}% of expenses (${self.total_addbacks:,.0f} addbacks)",
                    "source_rows": self.addback_rows,
                },
                "expense_completeness":  {"score": self.expense_completeness_score,  "value": self.expense_completeness_pct,   "label": f"{self.expense_completeness_pct:.0f}% categorized"},
                "revenue_completeness":  {"score": self.revenue_completeness_score,  "value": self.revenue_completeness_pct,   "label": f"{self.revenue_completeness_pct:.0f}% with period + type"},
                "data_coverage":         {"score": self.data_coverage_score,         "value": self.months_of_data,             "label": f"{self.months_of_data} months of data"},
            },
            "data_confidence": self.data_confidence,
        }


WEIGHTS = {
    "addback":              0.35,
    "expense_completeness": 0.25,
    "revenue_completeness": 0.20,
    "data_coverage":        0.20,
}

_ADDBACK_CATEGORIES = {ExpenseCategory.OWNER, ExpenseCategory.PERSONAL, ExpenseCategory.RELATED_PARTY}


def compute_financial_integrity(company_id: int, db: Session) -> FinancialIntegrityScore:
    expenses = db.query(Expense).filter(Expense.company_id == company_id).all()
    revenue  = db.query(RevenueStream).filter(RevenueStream.company_id == company_id).all()

    # 1. Owner/personal add-back exposure
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

    # 2. Expense category completeness
    exp_categorized = sum(1 for e in expenses if e.category)
    exp_completeness = (exp_categorized / len(expenses) * 100) if expenses else 100.0
    s_exp = min(100, exp_completeness)

    # 3. Revenue completeness (period + type both present)
    rev_complete = sum(1 for r in revenue if r.revenue_period and r.revenue_type)
    rev_completeness = (rev_complete / len(revenue) * 100) if revenue else 100.0
    s_rev = min(100, rev_completeness)

    # 4. Data coverage — months present
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
        s_addback * WEIGHTS["addback"]
        + s_exp   * WEIGHTS["expense_completeness"]
        + s_rev   * WEIGHTS["revenue_completeness"]
        + s_coverage * WEIGHTS["data_coverage"]
    )

    total_records = len(expenses) + len(revenue)
    confidence = "HIGH" if total_records >= 100 else "MEDIUM" if total_records >= 24 else "LOW"

    # Build top addback rows for drill-down (largest owner/personal expense lines)
    addback_expense_lines = [
        e for e in expenses if e.category in _ADDBACK_CATEGORIES
    ]
    addback_expense_lines.sort(key=lambda e: float(e.amount or 0), reverse=True)
    addback_rows = [
        {
            "description": e.description or e.vendor or "Unnamed expense",
            "category": e.category.value if hasattr(e.category, "value") else str(e.category),
            "amount": round(float(e.amount or 0), 0),
            "period": e.period.isoformat() if e.period else None,
        }
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
