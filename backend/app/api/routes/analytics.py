"""Blueprint II analytics engine — API routes."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
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
from app.core.config import settings
from app.core.scoring_rules import SCORING_RULES, SCORING_RULES_VERSION
from app.ontology.models import AdvisorOverride, QualitativeInputs, AddbackOverride
from app.services.analytics_service import compute_category_modules

router = APIRouter()

VALID_CATEGORIES = {
    "revenue_quality", "financial_integrity", "operational_independence",
    "customer_risk", "management_team", "growth_drivers",
}


# ---------------------------------------------------------------------------
# Qualitative scoring helpers (Blueprint II §A4 / A7)
# ---------------------------------------------------------------------------

def _qual_owner_hours_score(hours: float) -> float:
    for threshold, score in SCORING_RULES.qual_owner_hours_thresholds:
        if hours <= threshold:
            return score
    return SCORING_RULES.qual_owner_hours_thresholds[-1][1]

def _qual_sop_score(pct: float) -> float:
    if pct >= 80: return 90.0
    if pct >= 60: return 70.0
    if pct >= 40: return 50.0
    if pct >= 20: return 30.0
    return 10.0

def _qual_automation_score(pct: float) -> float:
    if pct >= 60: return 90.0
    if pct >= 40: return 70.0
    if pct >= 20: return 50.0
    if pct >= 10: return 30.0
    return 10.0

def _qual_mgmt_depth_score(qualified: int, total: int) -> float:
    if total == 0: return 15.0
    ratio = qualified / total
    if ratio >= 0.75: return 90.0
    if ratio >= 0.50: return 70.0
    if ratio >= 0.25: return 45.0
    return 15.0

def _qual_pipeline_score(pipeline_value: float, ttm_revenue: float) -> float:
    if ttm_revenue <= 0: return 40.0
    ratio = pipeline_value / ttm_revenue
    for threshold, score in SCORING_RULES.qual_pipeline_ratio_thresholds:
        if ratio >= threshold:
            return score
    return SCORING_RULES.qual_pipeline_ratio_thresholds[-1][1]

def _qual_market_pos_score(positioning: str) -> float:
    return {"defined": 80.0, "moderate": 45.0, "undifferentiated": 10.0}.get(positioning, 45.0)

def _qual_repeatability_score(pct: float) -> float:
    if pct >= 75: return 90.0
    if pct >= 50: return 70.0
    if pct >= 25: return 50.0
    return 25.0


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class OverrideRequest(BaseModel):
    adjustment: float  # -20 to +20
    rationale: str
    advisor_id: Optional[str] = None

class QualitativeRequest(BaseModel):
    owner_hours_per_week: Optional[float] = None
    sop_pct: Optional[float] = None
    automation_pct: Optional[float] = None
    mgmt_qualified: Optional[int] = None
    mgmt_total_functions: Optional[int] = None
    pipeline_value: Optional[float] = None
    market_positioning: Optional[str] = None
    repeatability_pct: Optional[float] = None


@router.get("/metrics/{company_id}")
def get_metrics(company_id: int, db: Session = Depends(get_db)):
    """A1: Raw metric registry — totals, counts, and computed ratios."""
    metrics = compute_metrics(company_id, db)
    return metrics


@router.get("/scores/{company_id}")
def get_all_scores(company_id: int, db: Session = Depends(get_db)):
    """
    A3–A8: Compute all six DRS category scores from the ontology.
    Applies advisor overrides (P1) and qualitative inputs (P2) when present.
    Returns raw scores, adjusted scores, DRS composite (A9), and enterprise value (A10).
    """
    try:
        modules = compute_category_modules(company_id, db)
        rev = modules["revenue_quality"]
        ops = modules["operational_independence"]
        cust = modules["customer_risk"]
        mgmt = modules["management_team"]
        growth = modules["growth_drivers"]
        fin = modules["financial_integrity"]

        # --- P2: Apply qualitative inputs to ops and growth where available ---
        qual = db.query(QualitativeInputs).filter(
            QualitativeInputs.company_id == company_id
        ).first()

        ops_raw = ops.composite
        growth_raw = growth.composite
        ops_qual_complete = False
        growth_qual_complete = False
        qual_sub_scores_ops = {}
        qual_sub_scores_growth = {}

        if qual:
            a4_fields = [qual.owner_hours_per_week, qual.sop_pct, qual.automation_pct,
                         qual.mgmt_qualified, qual.mgmt_total_functions]
            if all(v is not None for v in a4_fields):
                s_hours  = _qual_owner_hours_score(float(qual.owner_hours_per_week))
                s_sop    = _qual_sop_score(float(qual.sop_pct))
                s_auto   = _qual_automation_score(float(qual.automation_pct))
                s_mgmt   = _qual_mgmt_depth_score(int(qual.mgmt_qualified), int(qual.mgmt_total_functions))
                ops_qual_composite = round(s_hours*0.35 + s_sop*0.30 + s_auto*0.15 + s_mgmt*0.20, 1)
                ops_raw = ops_qual_composite
                ops_qual_complete = True
                qual_sub_scores_ops = {
                    "owner_hours":      {"score": s_hours, "value": float(qual.owner_hours_per_week), "label": f"{qual.owner_hours_per_week:.0f} hrs/week in operations", "source": "advisor_input"},
                    "sop_documentation":{"score": s_sop,   "value": float(qual.sop_pct),             "label": f"{qual.sop_pct:.0f}% SOPs documented",                  "source": "advisor_input"},
                    "process_automation":{"score": s_auto,  "value": float(qual.automation_pct),      "label": f"{qual.automation_pct:.0f}% tasks automated",            "source": "advisor_input"},
                    "management_depth": {"score": s_mgmt,  "value": f"{qual.mgmt_qualified}/{qual.mgmt_total_functions}", "label": f"{qual.mgmt_qualified} of {qual.mgmt_total_functions} functions covered", "source": "advisor_input"},
                }

            a7_fields = [qual.pipeline_value, qual.market_positioning, qual.repeatability_pct]
            if all(v is not None for v in a7_fields):
                metrics_for_qual = compute_metrics(company_id, db)
                ttm_rev = float(metrics_for_qual.total_revenue_ttm)
                s_pipe  = _qual_pipeline_score(float(qual.pipeline_value), ttm_rev)
                s_mkt   = _qual_market_pos_score(qual.market_positioning)
                s_rep   = _qual_repeatability_score(float(qual.repeatability_pct))
                growth_qual_composite = round(growth.cagr_score*0.35 + s_pipe*0.30 + s_mkt*0.20 + s_rep*0.15, 1)
                growth_raw = growth_qual_composite
                growth_qual_complete = True
                pipe_ratio = float(qual.pipeline_value) / ttm_rev if ttm_rev > 0 else 0
                qual_sub_scores_growth = {
                    "pipeline_coverage":    {"score": s_pipe, "value": round(pipe_ratio, 2),        "label": f"{pipe_ratio:.2f}x pipeline coverage",      "source": "advisor_input"},
                    "market_positioning":   {"score": s_mkt,  "value": qual.market_positioning,     "label": qual.market_positioning.replace("_", " "),   "source": "advisor_input"},
                    "product_repeatability":{"score": s_rep,  "value": float(qual.repeatability_pct),"label": f"{qual.repeatability_pct:.0f}% standardized", "source": "advisor_input"},
                }

        # --- P1: Load advisor overrides ---
        overrides_rows = db.query(AdvisorOverride).filter(
            AdvisorOverride.company_id == company_id
        ).all()
        override_map = {o.category: o for o in overrides_rows}

        raw_scores = {
            "revenue_quality":          round(rev.composite, 1),
            "financial_integrity":      round(fin.composite, 1),
            "operational_independence": round(ops_raw, 1),
            "customer_risk":            round(cust.composite, 1),
            "management_team":          round(mgmt.composite, 1),
            "growth_drivers":           round(growth_raw, 1),
        }

        def apply_override(key, raw):
            if key in override_map:
                return max(0.0, min(100.0, raw + float(override_map[key].adjustment)))
            return raw

        adj_scores = {k: round(apply_override(k, v), 1) for k, v in raw_scores.items()}

        # --- Build category score dicts with override metadata ---
        def enrich(key, base_dict, raw_composite, adj_composite):
            d = dict(base_dict)
            d["composite"] = adj_composite
            d["raw_composite"] = raw_composite
            if key in override_map:
                o = override_map[key]
                d["adjustment"] = float(o.adjustment)
                d["rationale"] = o.rationale
                d["advisor_id"] = o.advisor_id
                d["adjusted_at"] = o.updated_at.isoformat()
            else:
                d["adjustment"] = 0
                d["rationale"] = None
                d["advisor_id"] = None
                d["adjusted_at"] = None
            return d

        rev_d  = enrich("revenue_quality",          rev.to_dict(),    raw_scores["revenue_quality"],          adj_scores["revenue_quality"])
        fin_d  = enrich("financial_integrity",       fin.to_dict(),    raw_scores["financial_integrity"],       adj_scores["financial_integrity"])
        cust_d = enrich("customer_risk",             cust.to_dict(),   raw_scores["customer_risk"],             adj_scores["customer_risk"])
        mgmt_d = enrich("management_team",           mgmt.to_dict(),   raw_scores["management_team"],           adj_scores["management_team"])

        ops_base = ops.to_dict()
        if ops_qual_complete:
            ops_base["sub_scores"] = qual_sub_scores_ops
            ops_base["qualitative_complete"] = True
        else:
            ops_base["qualitative_complete"] = False
            for k in ops_base.get("sub_scores", {}):
                ops_base["sub_scores"][k]["source"] = "financial_data"
        ops_d = enrich("operational_independence", ops_base, raw_scores["operational_independence"], adj_scores["operational_independence"])

        growth_base = growth.to_dict()
        if growth_qual_complete:
            growth_base["sub_scores"].update(qual_sub_scores_growth)
            growth_base["qualitative_complete"] = True
        else:
            growth_base["qualitative_complete"] = False
            for k in growth_base.get("sub_scores", {}):
                growth_base["sub_scores"][k]["source"] = "financial_data"
        growth_d = enrich("growth_drivers", growth_base, raw_scores["growth_drivers"], adj_scores["growth_drivers"])

        # --- A9: DRS composite from adjusted scores ---
        cat = CategoryScores(
            revenue_quality=adj_scores["revenue_quality"],
            financial_integrity=adj_scores["financial_integrity"],
            operational_independence=adj_scores["operational_independence"],
            customer_risk=adj_scores["customer_risk"],
            management_team=adj_scores["management_team"],
            growth_drivers=adj_scores["growth_drivers"],
            revenue_quality_conservative=adj_scores["revenue_quality"] * (settings.DRS_CONFIDENCE_LOW_MULTIPLIER if rev.data_confidence == "LOW" else 1.0),
            financial_integrity_conservative=adj_scores["financial_integrity"] * (settings.DRS_CONFIDENCE_LOW_MULTIPLIER if fin.data_confidence == "LOW" else 1.0),
            operational_independence_conservative=adj_scores["operational_independence"] * (settings.DRS_CONFIDENCE_LOW_MULTIPLIER if ops.data_confidence == "LOW" else 1.0),
            customer_risk_conservative=adj_scores["customer_risk"] * (settings.DRS_CONFIDENCE_LOW_MULTIPLIER if cust.data_confidence == "LOW" else 1.0),
            management_team_conservative=adj_scores["management_team"] * (settings.DRS_CONFIDENCE_LOW_MULTIPLIER if mgmt.data_confidence == "LOW" else 1.0),
            growth_drivers_conservative=adj_scores["growth_drivers"] * (settings.DRS_CONFIDENCE_LOW_MULTIPLIER if growth.data_confidence == "LOW" else 1.0),
            revenue_quality_optimistic=min(100, adj_scores["revenue_quality"] * (settings.DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER if rev.data_confidence == "LOW" else 1.0)),
            financial_integrity_optimistic=min(100, adj_scores["financial_integrity"] * (settings.DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER if fin.data_confidence == "LOW" else 1.0)),
            operational_independence_optimistic=min(100, adj_scores["operational_independence"] * (settings.DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER if ops.data_confidence == "LOW" else 1.0)),
            customer_risk_optimistic=min(100, adj_scores["customer_risk"] * (settings.DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER if cust.data_confidence == "LOW" else 1.0)),
            management_team_optimistic=min(100, adj_scores["management_team"] * (settings.DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER if mgmt.data_confidence == "LOW" else 1.0)),
            growth_drivers_optimistic=min(100, adj_scores["growth_drivers"] * (settings.DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER if growth.data_confidence == "LOW" else 1.0)),
        )
        drs = compute_drs(cat)

        from decimal import Decimal as _Decimal
        metrics = compute_metrics(company_id, db)
        ebitda_dec = _Decimal(str(round(float(metrics.ebitda_ttm), 2)))
        ev = compute_enterprise_value(ebitda_dec, drs.tier)

        qual_complete = ops_qual_complete and growth_qual_complete
        has_overrides = bool(override_map)

        return {
            "company_id": company_id,
            "drs": {
                "base":           drs.base_drs,
                "conservative":   drs.conservative_drs,
                "optimistic":     drs.optimistic_drs,
                "tier":           drs.tier.value,
                "contributions":  drs.category_contributions,
                "has_overrides":  has_overrides,
                "qualitative_complete": qual_complete,
            },
            "category_scores": {
                "revenue_quality":          rev_d,
                "operational_independence": ops_d,
                "customer_risk":            cust_d,
                "management_team":          mgmt_d,
                "growth_drivers":           growth_d,
                "financial_integrity":      fin_d,
            },
            "enterprise_value": {
                "floor":         float(ev.ev_floor),
                "midpoint":      float(ev.ev_midpoint),
                "ceiling":       float(ev.ev_ceiling),
                "multiple_used": f"{ev.multiple_floor}–{ev.multiple_ceiling}",
                "ebitda_base":   float(ebitda_dec),
                "source_citation": f"IBBA Market Pulse Q1 2025, Business Services, $1M–$5M EBITDA — Tier: {drs.tier.value}",
            },
            "rules": {"version": SCORING_RULES_VERSION, "category_weights": SCORING_RULES.category_weights},
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
        modules = compute_category_modules(company_id, db)
        rev = modules["revenue_quality"]
        ops = modules["operational_independence"]
        cust = modules["customer_risk"]
        mgmt = modules["management_team"]
        growth = modules["growth_drivers"]
        fin = modules["financial_integrity"]
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
        modules = compute_category_modules(company_id, db)
        rev = modules["revenue_quality"]
        ops = modules["operational_independence"]
        cust = modules["customer_risk"]
        mgmt = modules["management_team"]
        growth = modules["growth_drivers"]
        fin = modules["financial_integrity"]

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


def _build_recast_payload(company_id: int, db: Session) -> dict:
    """
    Shared logic for GET /ebitda-recast and the addback override endpoints.
    Returns the full recast dict after merging stored advisor overrides.
    """
    from decimal import Decimal as _D
    from app.ontology.models import Expense, ExpenseCategory

    metrics = compute_metrics(company_id, db)
    market_rate = _D("120000")

    CHALLENGE_LABELS = {
        "LOW":             "Fully defensible — include in all scenarios",
        "MEDIUM":          "Partially defensible — 50% in conservative, 100% in aggressive",
        "HIGH":            "Challenged — excluded from conservative, included in aggressive",
        "NOT_DEFENSIBLE":  "Remove — buyer will not accept",
    }

    # --- Build system addbacks from ontology ---
    expenses = db.query(Expense).filter(Expense.company_id == company_id).all()
    system_addbacks: dict[str, dict] = {}

    owner_comp_delta = float(metrics.owner_compensation_total) - float(market_rate)
    if owner_comp_delta > 0:
        system_addbacks["owner_comp"] = {
            "addback_key":  "owner_comp",
            "description":  "Owner Compensation Normalization",
            "amount":       owner_comp_delta,
            "challenge":    "MEDIUM",
            "category":     "owner_comp",
            "documented":   True,
            "notes":        f"Owner total comp ${float(metrics.owner_compensation_total):,.0f} vs market ${float(market_rate):,.0f}/yr",
            "is_custom":    False,
        }

    one_time_total = sum(float(e.amount or 0) for e in expenses if e.category == ExpenseCategory.ONE_TIME)
    if one_time_total > 0:
        n = sum(1 for e in expenses if e.category == ExpenseCategory.ONE_TIME)
        system_addbacks["one_time"] = {
            "addback_key": "one_time",
            "description": "One-Time Non-Recurring Expenses",
            "amount":      one_time_total,
            "challenge":   "MEDIUM",
            "category":    "non_recurring",
            "documented":  False,
            "notes":       f"Aggregated from {n} ONE_TIME expense records",
            "is_custom":   False,
        }

    rp_total = sum(float(e.amount or 0) for e in expenses if e.category == ExpenseCategory.RELATED_PARTY)
    if rp_total > 0:
        n = sum(1 for e in expenses if e.category == ExpenseCategory.RELATED_PARTY)
        system_addbacks["related_party"] = {
            "addback_key": "related_party",
            "description": "Related-Party Transaction Normalization",
            "amount":      rp_total,
            "challenge":   "HIGH",
            "category":    "related_party",
            "documented":  False,
            "notes":       f"Aggregated from {n} RELATED_PARTY expense records",
            "is_custom":   False,
        }

    personal_total = sum(float(e.amount or 0) for e in expenses if e.category == ExpenseCategory.PERSONAL)
    if personal_total > 0:
        n = sum(1 for e in expenses if e.category == ExpenseCategory.PERSONAL)
        system_addbacks["personal_expenses"] = {
            "addback_key": "personal_expenses",
            "description": "Personal Expenses Through Business P&L",
            "amount":      personal_total,
            "challenge":   "MEDIUM",
            "category":    "personal",
            "documented":  False,
            "notes":       f"Aggregated from {n} PERSONAL expense records",
            "is_custom":   False,
        }

    # --- Merge stored advisor overrides ---
    stored = db.query(AddbackOverride).filter(AddbackOverride.company_id == company_id).all()
    override_map = {o.addback_key: o for o in stored}

    # Apply overrides to system addbacks + collect custom lines
    final_addbacks: list[dict] = []
    for key, ab in system_addbacks.items():
        if key in override_map:
            ov = override_map[key]
            ab = dict(ab)
            ab["challenge"]  = ov.challenge
            ab["amount"]     = float(ov.amount)
            ab["notes"]      = ov.notes or ab["notes"]
            ab["documented"] = ov.documented
            ab["override_rationale"] = ov.rationale
            ab["advisor_id"]         = ov.advisor_id
            ab["overridden"]         = True
        else:
            ab = dict(ab)
            ab["override_rationale"] = None
            ab["advisor_id"]         = None
            ab["overridden"]         = False
        ab["challenge_label"] = CHALLENGE_LABELS.get(ab["challenge"], ab["challenge"])
        final_addbacks.append(ab)

    # Custom advisor-added lines
    for ov in stored:
        if ov.is_custom:
            final_addbacks.append({
                "addback_key":        ov.addback_key,
                "description":        ov.description,
                "amount":             float(ov.amount),
                "challenge":          ov.challenge,
                "category":           ov.category,
                "documented":         ov.documented,
                "notes":              ov.notes or "",
                "is_custom":          True,
                "override_rationale": ov.rationale,
                "advisor_id":         ov.advisor_id,
                "overridden":         False,
                "challenge_label":    CHALLENGE_LABELS.get(ov.challenge, ov.challenge),
            })

    # --- Compute three scenarios ---
    reported = float(metrics.ebitda_ttm)
    conservative = reported
    base         = reported
    aggressive   = reported

    for ab in final_addbacks:
        amt = ab["amount"]
        ch  = ab["challenge"]
        if ch == "NOT_DEFENSIBLE":
            continue
        if ch == "LOW":
            conservative += amt; base += amt; aggressive += amt
        elif ch == "MEDIUM":
            conservative += amt * 0.5; base += amt * 0.5; aggressive += amt
        elif ch == "HIGH":
            aggressive += amt

    total_addbacks = sum(ab["amount"] for ab in final_addbacks if ab["challenge"] != "NOT_DEFENSIBLE")

    return {
        "company_id":         company_id,
        "reported_ebitda":    round(reported, 2),
        "conservative_ebitda": round(conservative, 2),
        "base_ebitda":        round(base, 2),
        "aggressive_ebitda":  round(aggressive, 2),
        "defensible_ebitda":  round(base, 2),
        "total_addbacks":     round(total_addbacks, 2),
        "owner_comp_total":   float(metrics.owner_compensation_total),
        "market_rate":        float(market_rate),
        "addback_schedule":   final_addbacks,
        "has_overrides":      bool(override_map),
        "data_notes": [
            "D&A, interest, and income tax lines not extractable from CSV format. Add manually if QuickBooks P&L is available.",
            f"Owner market-rate replacement set to ${float(market_rate):,.0f}/yr. Override for this client's role complexity.",
            "Reported EBITDA = proxy (revenue − COGS − OpEx from ontology).",
        ],
    }


@router.get("/ebitda-recast/{company_id}")
def get_ebitda_recast(company_id: int, db: Session = Depends(get_db)):
    """A2: Defensible EBITDA recast — conservative / base / aggressive with advisor override support."""
    try:
        return _build_recast_payload(company_id, db)
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


# ---------------------------------------------------------------------------
# P1: Advisor Override Layer
# ---------------------------------------------------------------------------

@router.get("/overrides/{company_id}")
def get_overrides(company_id: int, db: Session = Depends(get_db)):
    rows = db.query(AdvisorOverride).filter(AdvisorOverride.company_id == company_id).all()
    return {
        "company_id": company_id,
        "overrides": [
            {
                "category":   o.category,
                "adjustment": float(o.adjustment),
                "rationale":  o.rationale,
                "advisor_id": o.advisor_id,
                "updated_at": o.updated_at.isoformat(),
            }
            for o in rows
        ],
    }


@router.post("/overrides/{company_id}/{category}")
def upsert_override(
    company_id: int, category: str,
    body: OverrideRequest,
    db: Session = Depends(get_db),
):
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, f"Unknown category '{category}'")
    if not body.rationale.strip():
        raise HTTPException(400, "Rationale is required")
    adj = max(-20.0, min(20.0, body.adjustment))

    existing = db.query(AdvisorOverride).filter(
        AdvisorOverride.company_id == company_id,
        AdvisorOverride.category == category,
    ).first()

    if existing:
        existing.adjustment = adj
        existing.rationale  = body.rationale.strip()
        existing.advisor_id = body.advisor_id
        existing.updated_at = datetime.utcnow()
    else:
        db.add(AdvisorOverride(
            company_id=company_id, category=category,
            adjustment=adj, rationale=body.rationale.strip(),
            advisor_id=body.advisor_id,
        ))
    db.commit()
    return {"status": "saved", "category": category, "adjustment": adj}


@router.delete("/overrides/{company_id}/{category}")
def delete_override(company_id: int, category: str, db: Session = Depends(get_db)):
    deleted = db.query(AdvisorOverride).filter(
        AdvisorOverride.company_id == company_id,
        AdvisorOverride.category == category,
    ).delete()
    db.commit()
    return {"status": "deleted", "count": deleted}


# ---------------------------------------------------------------------------
# Addback overrides — challenge-rate edits + custom addback lines
# ---------------------------------------------------------------------------

class AddbackOverrideRequest(BaseModel):
    description:  str
    amount:       float
    challenge:    str    # LOW | MEDIUM | HIGH | NOT_DEFENSIBLE
    category:     str    # owner_comp | non_recurring | related_party | personal | other
    documented:   bool   = False
    notes:        Optional[str] = None
    rationale:    Optional[str] = None
    advisor_id:   Optional[str] = None
    is_custom:    bool          = False

VALID_CHALLENGES = {"LOW", "MEDIUM", "HIGH", "NOT_DEFENSIBLE"}

@router.post("/addbacks/{company_id}/{addback_key}")
def upsert_addback_override(
    company_id: int, addback_key: str,
    body: AddbackOverrideRequest,
    db: Session = Depends(get_db),
):
    """Save or update an advisor override for a specific addback line (or add a custom line)."""
    if body.challenge not in VALID_CHALLENGES:
        raise HTTPException(400, f"challenge must be one of {VALID_CHALLENGES}")

    existing = db.query(AddbackOverride).filter(
        AddbackOverride.company_id == company_id,
        AddbackOverride.addback_key == addback_key,
    ).first()

    if existing:
        existing.description = body.description
        existing.amount      = body.amount
        existing.challenge   = body.challenge
        existing.category    = body.category
        existing.documented  = body.documented
        existing.notes       = body.notes
        existing.rationale   = body.rationale
        existing.advisor_id  = body.advisor_id
        existing.is_custom   = body.is_custom
        existing.updated_at  = datetime.utcnow()
    else:
        db.add(AddbackOverride(
            company_id=company_id, addback_key=addback_key,
            description=body.description, amount=body.amount,
            challenge=body.challenge, category=body.category,
            documented=body.documented, notes=body.notes,
            rationale=body.rationale, advisor_id=body.advisor_id,
            is_custom=body.is_custom,
        ))
    db.commit()
    return _build_recast_payload(company_id, db)


@router.delete("/addbacks/{company_id}/{addback_key}")
def delete_addback_override(company_id: int, addback_key: str, db: Session = Depends(get_db)):
    """Remove an advisor override for an addback line (reverts to system default)."""
    deleted = db.query(AddbackOverride).filter(
        AddbackOverride.company_id == company_id,
        AddbackOverride.addback_key == addback_key,
    ).delete()
    db.commit()
    return _build_recast_payload(company_id, db)


# ---------------------------------------------------------------------------
# P2: Qualitative Inputs
# ---------------------------------------------------------------------------

@router.get("/qualitative/{company_id}")
def get_qualitative(company_id: int, db: Session = Depends(get_db)):
    row = db.query(QualitativeInputs).filter(
        QualitativeInputs.company_id == company_id
    ).first()
    if not row:
        return {"company_id": company_id, "inputs": None}
    return {
        "company_id": company_id,
        "inputs": {
            "owner_hours_per_week":  float(row.owner_hours_per_week) if row.owner_hours_per_week is not None else None,
            "sop_pct":               float(row.sop_pct)               if row.sop_pct               is not None else None,
            "automation_pct":        float(row.automation_pct)        if row.automation_pct        is not None else None,
            "mgmt_qualified":        row.mgmt_qualified,
            "mgmt_total_functions":  row.mgmt_total_functions,
            "pipeline_value":        float(row.pipeline_value)        if row.pipeline_value        is not None else None,
            "market_positioning":    row.market_positioning,
            "repeatability_pct":     float(row.repeatability_pct)     if row.repeatability_pct     is not None else None,
            "updated_at":            row.updated_at.isoformat(),
        },
    }


@router.post("/qualitative/{company_id}")
def save_qualitative(company_id: int, body: QualitativeRequest, db: Session = Depends(get_db)):
    row = db.query(QualitativeInputs).filter(
        QualitativeInputs.company_id == company_id
    ).first()
    data = body.model_dump(exclude_unset=False)
    if row:
        for k, v in data.items():
            setattr(row, k, v)
        row.updated_at = datetime.utcnow()
    else:
        db.add(QualitativeInputs(company_id=company_id, **data))
    db.commit()
    return {"status": "saved", "company_id": company_id}
