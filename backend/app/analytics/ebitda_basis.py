"""Shared EBITDA basis: ontology proxy + advisor D&A and market-rate inputs."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.analytics.a1_metric_computation import compute_metrics
from app.ontology.models import Company

DEFAULT_MARKET_RATE = Decimal("120000")


def ebitda_basis_for_company(company_id: int, db: Session) -> dict:
    m = compute_metrics(company_id, db)
    co = db.query(Company).filter(Company.id == company_id).first()
    proxy = float(m.ebitda_ttm)
    da = float(co.depreciation_amortization_ttm or 0) if co else 0.0
    interest = float(co.interest_expense_ttm or 0) if co else 0.0
    tax = float(co.income_tax_expense_ttm or 0) if co else 0.0
    if co and co.market_rate_replacement_annual is not None:
        mr = float(co.market_rate_replacement_annual)
    else:
        mr = float(DEFAULT_MARKET_RATE)
    normalized = proxy + da
    return {
        "ebitda_proxy_ttm": proxy,
        "ebitda_normalized_ttm": normalized,
        "depreciation_amortization_ttm": da,
        "interest_expense_ttm": interest,
        "income_tax_expense_ttm": tax,
        "market_rate_replacement_annual": mr,
    }
