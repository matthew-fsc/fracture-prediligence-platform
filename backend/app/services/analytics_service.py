from sqlalchemy.orm import Session

from app.analytics.financial_analytics import compute_metrics, compute_revenue_quality
from app.analytics.operational_analytics import compute_operational_independence, compute_customer_risk, compute_management_team, compute_growth_drivers, compute_financial_integrity


def compute_category_modules(company_id: int, db: Session) -> dict:
    rev = compute_revenue_quality(company_id, db)
    ops = compute_operational_independence(company_id, db)
    cust = compute_customer_risk(company_id, db)
    mgmt = compute_management_team(company_id, db)
    growth = compute_growth_drivers(company_id, db)
    fin = compute_financial_integrity(company_id, db)
    return {
        "revenue_quality": rev,
        "operational_independence": ops,
        "customer_risk": cust,
        "management_team": mgmt,
        "growth_drivers": growth,
        "financial_integrity": fin,
    }


def compute_category_scores(company_id: int, db: Session) -> dict[str, float]:
    modules = compute_category_modules(company_id, db)
    return {k: v.composite for k, v in modules.items()}


def compute_metrics_and_scores(company_id: int, db: Session) -> tuple[dict[str, float], object]:
    return compute_category_scores(company_id, db), compute_metrics(company_id, db)
