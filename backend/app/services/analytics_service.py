from sqlalchemy.orm import Session

from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.a3_revenue_quality import compute_revenue_quality
from app.analytics.a4_operational_independence import compute_operational_independence
from app.analytics.a5_customer_risk import compute_customer_risk
from app.analytics.a6_management_team import compute_management_team
from app.analytics.a7_growth_drivers import compute_growth_drivers
from app.analytics.a8_financial_integrity import compute_financial_integrity


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
