"""Blueprint II analytics engine — API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.a2_ebitda_recast import compute_ebitda_recast
from app.analytics.a3_revenue_quality import compute_revenue_quality
from app.analytics.a4_operational_independence import compute_operational_independence
from app.analytics.a5_customer_risk import compute_customer_risk
from app.analytics.a6_management_team import compute_management_team
from app.analytics.a7_growth_drivers import compute_growth_drivers
from app.analytics.a8_financial_integrity import compute_financial_integrity
from app.analytics.a9_drs_composite import CategoryScores, compute_drs
from app.analytics.a10_enterprise_value import compute_enterprise_value
from app.analytics.a11_value_gap import compute_value_gap
from app.analytics.a13_buyer_questions import generate_buyer_questions

router = APIRouter()


@router.get("/metrics/{company_id}")
def get_metrics(company_id: int, db: Session = Depends(get_db)):
    """A1: Raw metric registry — totals, counts, and computed ratios."""
    metrics = compute_metrics(company_id, db)
    return metrics


@router.get("/scores/{company_id}")
def get_all_scores(company_id: int, db: Session = Depends(get_db)):
    """
    A3–A8: Compute all six DRS category scores from the ontology.
    Returns individual scores + the full DRS composite (A9) + enterprise value (A10).
    """
    try:
        rev    = compute_revenue_quality(company_id, db)
        ops    = compute_operational_independence(company_id, db)
        cust   = compute_customer_risk(company_id, db)
        mgmt   = compute_management_team(company_id, db)
        growth = compute_growth_drivers(company_id, db)
        fin    = compute_financial_integrity(company_id, db)

        cat = CategoryScores(
            revenue_quality=rev.composite,
            financial_integrity=fin.composite,
            operational_independence=ops.composite,
            customer_risk=cust.composite,
            management_team=mgmt.composite,
            growth_drivers=growth.composite,
            # Conservative: LOW-confidence scores derated by 10%
            revenue_quality_conservative=rev.composite * (0.9 if rev.data_confidence == "LOW" else 1.0),
            financial_integrity_conservative=fin.composite * (0.9 if fin.data_confidence == "LOW" else 1.0),
            operational_independence_conservative=ops.composite * (0.9 if ops.data_confidence == "LOW" else 1.0),
            customer_risk_conservative=cust.composite * (0.9 if cust.data_confidence == "LOW" else 1.0),
            management_team_conservative=mgmt.composite * (0.9 if mgmt.data_confidence == "LOW" else 1.0),
            growth_drivers_conservative=growth.composite * (0.9 if growth.data_confidence == "LOW" else 1.0),
            # Optimistic: LOW-confidence scores boosted by 5%
            revenue_quality_optimistic=min(100, rev.composite * (1.05 if rev.data_confidence == "LOW" else 1.0)),
            financial_integrity_optimistic=min(100, fin.composite * (1.05 if fin.data_confidence == "LOW" else 1.0)),
            operational_independence_optimistic=min(100, ops.composite * (1.05 if ops.data_confidence == "LOW" else 1.0)),
            customer_risk_optimistic=min(100, cust.composite * (1.05 if cust.data_confidence == "LOW" else 1.0)),
            management_team_optimistic=min(100, mgmt.composite * (1.05 if mgmt.data_confidence == "LOW" else 1.0)),
            growth_drivers_optimistic=min(100, growth.composite * (1.05 if growth.data_confidence == "LOW" else 1.0)),
        )
        drs = compute_drs(cat)

        # A10: Enterprise value based on DRS tier
        from decimal import Decimal as _Decimal
        metrics = compute_metrics(company_id, db)
        ebitda_raw = getattr(metrics, "ebitda", None) or 0
        ebitda_dec = _Decimal(str(round(float(ebitda_raw), 2)))
        ev = compute_enterprise_value(ebitda_dec, drs.tier)

        return {
            "company_id": company_id,
            "drs": {
                "base":         drs.base_drs,
                "conservative": drs.conservative_drs,
                "optimistic":   drs.optimistic_drs,
                "tier":         drs.tier.value,
                "contributions": drs.category_contributions,
            },
            "category_scores": {
                "revenue_quality":          rev.to_dict(),
                "operational_independence": ops.to_dict(),
                "customer_risk":            cust.to_dict(),
                "management_team":          mgmt.to_dict(),
                "growth_drivers":           growth.to_dict(),
                "financial_integrity":      fin.to_dict(),
            },
            "enterprise_value": {
                "floor":         float(ev.ev_floor),
                "midpoint":      float(ev.ev_midpoint),
                "ceiling":       float(ev.ev_ceiling),
                "multiple_used": f"{ev.multiple_floor}–{ev.multiple_ceiling}",
                "ebitda_base":   float(ebitda_dec),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue-quality/{company_id}")
def get_revenue_quality(company_id: int, db: Session = Depends(get_db)):
    """A3: Revenue quality sub-scores and composite."""
    return compute_revenue_quality(company_id, db).to_dict()


@router.get("/operational-independence/{company_id}")
def get_operational_independence(company_id: int, db: Session = Depends(get_db)):
    """A4: Operational independence sub-scores."""
    return compute_operational_independence(company_id, db).to_dict()


@router.get("/customer-risk/{company_id}")
def get_customer_risk(company_id: int, db: Session = Depends(get_db)):
    """A5: Customer risk sub-scores."""
    return compute_customer_risk(company_id, db).to_dict()


@router.get("/management-team/{company_id}")
def get_management_team(company_id: int, db: Session = Depends(get_db)):
    """A6: Management and team sub-scores."""
    return compute_management_team(company_id, db).to_dict()


@router.get("/growth-drivers/{company_id}")
def get_growth_drivers(company_id: int, db: Session = Depends(get_db)):
    """A7: Growth drivers sub-scores."""
    return compute_growth_drivers(company_id, db).to_dict()


@router.get("/financial-integrity/{company_id}")
def get_financial_integrity(company_id: int, db: Session = Depends(get_db)):
    """A8: Financial integrity sub-scores."""
    return compute_financial_integrity(company_id, db).to_dict()


@router.get("/value-gap/{company_id}")
def get_value_gap(company_id: int, db: Session = Depends(get_db)):
    """A11: Value gap analysis — current EV vs potential EV if gaps resolved."""
    try:
        rev    = compute_revenue_quality(company_id, db)
        ops    = compute_operational_independence(company_id, db)
        cust   = compute_customer_risk(company_id, db)
        mgmt   = compute_management_team(company_id, db)
        growth = compute_growth_drivers(company_id, db)
        fin    = compute_financial_integrity(company_id, db)
        metrics = compute_metrics(company_id, db)

        cat_scores = {
            "revenue_quality":          rev.composite,
            "financial_integrity":      fin.composite,
            "operational_independence": ops.composite,
            "customer_risk":            cust.composite,
            "management_team":          mgmt.composite,
            "growth_drivers":           growth.composite,
        }
        from decimal import Decimal as _D
        ebitda = float(getattr(metrics, "ebitda", None) or 0)

        result = compute_value_gap(company_id, cat_scores, ebitda)
        return result.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/buyer-questions/{company_id}")
def get_buyer_questions(company_id: int, db: Session = Depends(get_db)):
    """A13: Generate prioritized buyer due diligence questions from DRS weaknesses."""
    try:
        rev    = compute_revenue_quality(company_id, db)
        ops    = compute_operational_independence(company_id, db)
        cust   = compute_customer_risk(company_id, db)
        mgmt   = compute_management_team(company_id, db)
        growth = compute_growth_drivers(company_id, db)
        fin    = compute_financial_integrity(company_id, db)

        cat_scores = {
            "revenue_quality":          rev.composite,
            "financial_integrity":      fin.composite,
            "operational_independence": ops.composite,
            "customer_risk":            cust.composite,
            "management_team":          mgmt.composite,
            "growth_drivers":           growth.composite,
        }
        questions = generate_buyer_questions(cat_scores)
        return {
            "company_id": company_id,
            "total":      len(questions),
            "questions":  [q.to_dict() for q in questions],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/drs/{company_id}")
def compute_drs_score(company_id: int, scores: dict, db: Session = Depends(get_db)):
    """A9: Compute DRS from manually submitted category scores."""
    try:
        cat = CategoryScores(**scores)
        result = compute_drs(cat)
        return {
            "base":          result.base_drs,
            "conservative":  result.conservative_drs,
            "optimistic":    result.optimistic_drs,
            "tier":          result.tier.value,
            "contributions": result.category_contributions,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
