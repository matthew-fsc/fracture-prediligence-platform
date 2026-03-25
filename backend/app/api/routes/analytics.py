"""Blueprint II analytics engine — API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.a2_ebitda_recast import compute_ebitda_recast, ChallengeLikelihood
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
        ebitda_raw = metrics.ebitda_ttm
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
        ebitda = float(metrics.ebitda_ttm)

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


@router.get("/ebitda-recast/{company_id}")
def get_ebitda_recast(company_id: int, db: Session = Depends(get_db)):
    """
    A2: Defensible EBITDA recast — conservative / base / aggressive scenarios.

    Pulls all inputs from the ontology automatically:
      - reported_ebitda = ebitda_ttm from A1 (gross_profit - opex, or revenue - payroll proxy)
      - owner addbacks = OWNER + PERSONAL expense categories vs $150K market rate
      - one-time addbacks = ONE_TIME expense category
      - related-party addbacks = RELATED_PARTY expense category

    D&A, interest, and taxes are not yet extractable from plain CSV ingestion,
    so we assume the proxy ebitda_ttm already represents pre-tax operating income
    and set those addbacks to 0 with a confidence flag.
    """
    try:
        from decimal import Decimal as _D
        from app.ontology.models import Expense, ExpenseCategory

        metrics = compute_metrics(company_id, db)

        # Build addback_items from ontology expense rows
        # OWNER / PERSONAL expenses are normalization candidates
        expenses = db.query(Expense).filter(Expense.company_id == company_id).all()

        addback_items = []

        # Sum OWNER + PERSONAL vs standard market rate replacement ($150K default)
        market_rate = _D("150000")   # advisors should override this for client-specific rate

        # One-time / non-recurring expenses
        one_time_total = sum(float(e.amount or 0) for e in expenses if e.category == ExpenseCategory.ONE_TIME)
        if one_time_total > 0:
            addback_items.append({
                "description": "One-Time Non-Recurring Expenses",
                "amount": one_time_total,
                "challenge": ChallengeLikelihood.MEDIUM.value,
                "category": "non_recurring",
                "documented": False,
                "notes": f"Aggregated from {sum(1 for e in expenses if e.category == ExpenseCategory.ONE_TIME)} ONE_TIME expense records"
            })

        # Related-party transactions
        rp_total = sum(float(e.amount or 0) for e in expenses if e.category == ExpenseCategory.RELATED_PARTY)
        if rp_total > 0:
            addback_items.append({
                "description": "Related-Party Transaction Normalization",
                "amount": rp_total,
                "challenge": ChallengeLikelihood.HIGH.value,
                "category": "related_party",
                "documented": False,
                "notes": f"Aggregated from {sum(1 for e in expenses if e.category == ExpenseCategory.RELATED_PARTY)} RELATED_PARTY expense records"
            })

        # Personal expenses running through business P&L
        personal_total = sum(float(e.amount or 0) for e in expenses if e.category == ExpenseCategory.PERSONAL)
        if personal_total > 0:
            addback_items.append({
                "description": "Personal Expenses Through Business P&L",
                "amount": personal_total,
                "challenge": ChallengeLikelihood.MEDIUM.value,
                "category": "personal",
                "documented": False,
                "notes": f"Aggregated from {sum(1 for e in expenses if e.category == ExpenseCategory.PERSONAL)} PERSONAL expense records"
            })

        # For the EBITDA recast, net_income = ebitda_ttm (proxy — no separate D&A/interest/tax data)
        # We assume ebitda_ttm ≈ operating income (taxes and interest not separately tracked in CSV ingestion)
        raw_inputs = {
            "net_income": float(metrics.ebitda_ttm),  # proxy: treat proxy EBITDA as "reported" base
            "da": 0,           # D&A not extractable from plain CSV; marked as 0
            "interest": 0,     # Interest not extractable
            "taxes": 0,        # Pass-through entity assumption
            "market_rate_replacement_cost": float(market_rate),
            "addback_items": addback_items,
        }

        recast = compute_ebitda_recast(metrics, raw_inputs)

        return {
            "company_id": company_id,
            "reported_ebitda": float(recast.reported_ebitda),
            "conservative_ebitda": float(recast.conservative_ebitda),
            "base_ebitda": float(recast.base_ebitda),
            "aggressive_ebitda": float(recast.aggressive_ebitda),
            "defensible_ebitda": float(recast.defensible_ebitda),
            "total_addbacks": float(recast.total_addbacks),
            "addback_schedule": [
                {
                    "description": ab.description,
                    "amount": float(ab.amount),
                    "challenge": ab.challenge.value,
                    "category": ab.category,
                    "documented": ab.documented,
                    "notes": ab.notes,
                    # Challenge rating in plain English for advisor use
                    "challenge_label": {
                        "LOW": "Fully defensible — include in all scenarios",
                        "MEDIUM": "Partially defensible — 50% in conservative, 100% in aggressive",
                        "HIGH": "Challenged — excluded from conservative, flagged in aggressive",
                        "NOT_DEFENSIBLE": "Remove — buyer will not accept",
                    }.get(ab.challenge.value, ab.challenge.value),
                }
                for ab in recast.addbacks
            ],
            "data_notes": [
                "D&A, interest, and income tax lines not extractable from CSV format. Add manually if QuickBooks P&L is available.",
                f"Owner market-rate replacement set to ${float(market_rate):,.0f}/yr. Override for this client's role complexity.",
                "Reported EBITDA = ebitda_ttm proxy (revenue minus COGS and OPEX from ontology).",
            ],
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
