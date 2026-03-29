"""Blueprint II analytics engine — API routes."""

import json
import mimetypes
from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Annotated, Optional
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope
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
from app.analytics.a10_enterprise_value import compute_enterprise_value, format_ev_valuation_summary
from app.analytics.market_benchmarks import build_benchmarks_payload, get_market_multiple_context
from app.analytics.a11_value_gap import compute_value_gap
from app.analytics.ebitda_basis import ebitda_basis_for_company
from app.analytics.a13_buyer_questions import generate_buyer_questions
from app.analytics.owner_readiness import compute_owner_readiness
from app.core.config import settings
from app.core.scoring_rules import SCORING_RULES, SCORING_RULES_VERSION
from app.ontology.models import (
    AdvisorOverride,
    QualitativeInputs,
    QualitativeInputAudit,
    AddbackOverride,
    BuyerQuestionState,
    Company,
    CompanyInitiative,
    EngagementProfile,
    EngagementSnapshot,
    ScoreSnapshot,
)
from app.services.advisory_workflow import build_advisory_workflow
from app.services.analytics_service import compute_category_modules
from app.services.company_logo_storage import (
    delete_company_logo_files,
    has_uploaded_company_logo,
    resolve_company_logo_path,
    save_company_logo_upload,
)

router = APIRouter()

CompanyScoped = Annotated[Company, Depends(get_company_scope)]

VALID_CATEGORIES = {
    "revenue_quality", "financial_integrity", "operational_independence",
    "customer_risk", "management_team", "growth_drivers",
}


def _ebitda_basis(company_id: int, db: Session) -> dict:
    return ebitda_basis_for_company(company_id, db)


def _expense_category_code(cat) -> str:
    """Normalize expense.category for P&L line items (may be Enum or plain str from DB)."""
    if cat is None:
        return "OPEX"
    if isinstance(cat, str):
        return cat.strip().upper() or "OPEX"
    v = getattr(cat, "value", None)
    return str(v).strip().upper() if v is not None else str(cat).strip().upper() or "OPEX"


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

def _qual_contract_score(contract_pct: float, contract_type: str) -> float:
    """Score 0–100 from % customers contracted + contract type quality."""
    if contract_pct >= 90: base = 90.0
    elif contract_pct >= 70: base = 70.0 + (contract_pct - 70) / 20 * 20
    elif contract_pct >= 50: base = 50.0 + (contract_pct - 50) / 20 * 20
    elif contract_pct >= 20: base = 25.0 + (contract_pct - 20) / 30 * 25
    else: base = contract_pct / 20 * 25
    type_adj = {"msa": 10.0, "retainer": 5.0, "mix": 0.0, "project": -10.0}.get(contract_type, 0.0)
    return round(min(100.0, max(0.0, base + type_adj)), 1)

def _qual_key_person_score(key_person_pct: float) -> float:
    """Score 0–100 — lower dependency = higher score."""
    if key_person_pct <= 10: return 90.0
    if key_person_pct <= 25: return 75.0
    if key_person_pct <= 50: return 50.0
    if key_person_pct <= 75: return 25.0
    return 10.0


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
    mgmt_covered_functions: Optional[str] = None
    pipeline_value: Optional[float] = None
    market_positioning: Optional[str] = None
    repeatability_pct: Optional[float] = None
    contract_pct: Optional[float] = None
    customer_contract_type: Optional[str] = None
    key_person_revenue_pct: Optional[float] = None


@router.get("/metrics/{company_id}")
def get_metrics(company: CompanyScoped, db: Session = Depends(get_db)):
    """A1: Raw metric registry — totals, counts, and computed ratios."""
    metrics = compute_metrics(company.id, db)
    basis = _ebitda_basis(company.id, db)
    d = jsonable_encoder(metrics)
    d["ebitda_ttm"] = basis["ebitda_normalized_ttm"]
    d["ebitda_proxy_ttm"] = basis["ebitda_proxy_ttm"]
    d["ebitda_basis_note"] = (
        "Primary EBITDA = ontology proxy (revenue − COGS − OpEx) plus advisor-entered D&A. "
        "Interest and tax below are for disclosure only and are not added here."
    )
    d["depreciation_amortization_ttm"] = basis["depreciation_amortization_ttm"]
    d["interest_expense_ttm"] = basis["interest_expense_ttm"]
    d["income_tax_expense_ttm"] = basis["income_tax_expense_ttm"]
    d["market_rate_replacement_annual"] = basis["market_rate_replacement_annual"]
    return d


class CompanyFinancialPatch(BaseModel):
    """Advisor inputs for EBITDA normalization and optional PDF branding."""

    market_rate_replacement_annual: Optional[float] = None
    depreciation_amortization_ttm: Optional[float] = None
    interest_expense_ttm: Optional[float] = None
    income_tax_expense_ttm: Optional[float] = None
    report_firm_name: Optional[str] = None
    report_cover_blurb: Optional[str] = None
    report_logo_url: Optional[str] = None


@router.get("/company-financial/{company_id}")
def get_company_financial(company: CompanyScoped, db: Session = Depends(get_db)):
    """Advisor-editable company fields for EBITDA basis and PDF branding."""
    db.refresh(company)
    return {
        "ebitda_basis": _ebitda_basis(company.id, db),
        "report_firm_name": company.report_firm_name,
        "report_cover_blurb": company.report_cover_blurb,
        "report_logo_url": company.report_logo_url,
        "has_uploaded_logo": has_uploaded_company_logo(company.id),
    }


@router.patch("/company-financial/{company_id}")
def patch_company_financial(
    company: CompanyScoped,
    body: CompanyFinancialPatch,
    db: Session = Depends(get_db),
):
    """Update per-company EBITDA basis fields (scoped like other analytics routes)."""
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return {
        "ebitda_basis": _ebitda_basis(company.id, db),
        "report_firm_name": company.report_firm_name,
        "report_cover_blurb": company.report_cover_blurb,
        "report_logo_url": company.report_logo_url,
        "has_uploaded_logo": has_uploaded_company_logo(company.id),
    }


@router.post("/company-financial/{company_id}/logo")
async def upload_company_logo(
    company: CompanyScoped,
    file: UploadFile = File(...),
):
    """Upload a logo image for PDF reports (PNG, JPEG, WebP, or GIF; max size from settings)."""
    raw = await file.read()
    try:
        save_company_logo_upload(company.id, raw, file.content_type or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "has_uploaded_logo": True}


@router.delete("/company-financial/{company_id}/logo")
def delete_company_logo(company: CompanyScoped):
    """Remove the uploaded logo file for this company."""
    delete_company_logo_files(company.id)
    return {"ok": True, "has_uploaded_logo": False}


@router.get("/company-financial/{company_id}/logo")
def download_company_logo(company: CompanyScoped):
    """Serve the uploaded logo for preview (same auth as other company-scoped routes)."""
    path = resolve_company_logo_path(company.id)
    if not path:
        raise HTTPException(status_code=404, detail="No logo uploaded")
    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(path, media_type=media_type or "application/octet-stream")


@router.get("/market-benchmarks/{company_id}")
def get_market_benchmarks(company: CompanyScoped, db: Session = Depends(get_db)):
    """Peer medians and segment label for the company's industry × EBITDA band (curated + provenance)."""
    try:
        return build_benchmarks_payload(db, company.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scores/{company_id}")
def get_all_scores(company: CompanyScoped, db: Session = Depends(get_db)):
    """
    A3–A8: Compute all six DRS category scores from the ontology.
    Applies advisor overrides (P1) and qualitative inputs (P2) when present.
    Returns raw scores, adjusted scores, DRS composite (A9), and enterprise value (A10).
    """
    try:
        modules = compute_category_modules(company.id, db)
        rev = modules["revenue_quality"]
        ops = modules["operational_independence"]
        cust = modules["customer_risk"]
        mgmt = modules["management_team"]
        growth = modules["growth_drivers"]
        fin = modules["financial_integrity"]

        # --- P2: Apply qualitative inputs to ops and growth where available ---
        qual = db.query(QualitativeInputs).filter(
            QualitativeInputs.company_id == company.id
        ).first()

        ops_raw = ops.composite
        rev_raw = rev.composite
        growth_raw = growth.composite
        ops_qual_complete = False
        rev_qual_complete = False
        growth_qual_complete = False
        qual_sub_scores_ops = {}
        qual_sub_scores_rev = {}
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
                metrics_for_qual = compute_metrics(company.id, db)
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

            # --- P2c: Revenue quality qualitative override (contract + key person) ---
            a3_contract_fields = [qual.contract_pct, qual.customer_contract_type]
            if all(v is not None for v in a3_contract_fields):
                s_contract = _qual_contract_score(float(qual.contract_pct), qual.customer_contract_type)
                qual_sub_scores_rev["durability"] = {
                    "score": s_contract,
                    "value": float(qual.contract_pct),
                    "label": f"{qual.contract_pct:.0f}% contracted ({qual.customer_contract_type})",
                    "source": "advisor_input",
                }
                # Recompute revenue_quality composite: replace financial durability with qualitative
                rev_qual_composite = round(
                    rev.recurring_rate_score * 0.30
                    + rev.concentration_score * 0.25
                    + s_contract             * 0.20
                    + rev.consistency_score  * 0.15
                    + rev.nrr_score          * 0.10,
                    1,
                )
                # Key person risk blends into the composite when provided
                if qual.key_person_revenue_pct is not None:
                    s_kp = _qual_key_person_score(float(qual.key_person_revenue_pct))
                    # Blend: 85% existing composite + 15% key-person score
                    rev_qual_composite = round(rev_qual_composite * 0.85 + s_kp * 0.15, 1)
                    qual_sub_scores_rev["key_person_risk"] = {
                        "score": s_kp,
                        "value": float(qual.key_person_revenue_pct),
                        "label": f"{qual.key_person_revenue_pct:.0f}% revenue owner-dependent",
                        "source": "advisor_input",
                    }
                rev_raw = rev_qual_composite
                rev_qual_complete = True

        # --- P1: Load advisor overrides ---
        overrides_rows = db.query(AdvisorOverride).filter(
            AdvisorOverride.company_id == company.id
        ).all()
        override_map = {o.category: o for o in overrides_rows}

        raw_scores = {
            "revenue_quality":          round(rev_raw, 1),
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

        rev_base = rev.to_dict()
        if rev_qual_complete:
            rev_base["sub_scores"].update(qual_sub_scores_rev)
            rev_base["qualitative_complete"] = True
        else:
            rev_base["qualitative_complete"] = False
        rev_d  = enrich("revenue_quality", rev_base, raw_scores["revenue_quality"], adj_scores["revenue_quality"])
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
        basis = _ebitda_basis(company.id, db)
        ebitda_dec = _Decimal(str(round(basis["ebitda_normalized_ttm"], 2)))
        mctx = get_market_multiple_context(db, company.id, float(ebitda_dec))
        ev = compute_enterprise_value(ebitda_dec, drs.tier, market_context=mctx)
        valuation_summary = format_ev_valuation_summary(ev)

        qual_complete = ops_qual_complete and growth_qual_complete and rev_qual_complete
        has_overrides = bool(override_map)

        # --- PRE: Owner Personal Readiness Score ---
        pre_result = None
        try:
            ep = db.query(EngagementProfile).filter(
                EngagementProfile.company_id == company.id
            ).first()
            import json as _json
            pre_result = compute_owner_readiness(
                exit_timeline=ep.exit_timeline if ep else None,
                target_valuation=float(ep.target_valuation) if ep and ep.target_valuation else None,
                personal_financial_gap=float(ep.personal_financial_gap) if ep and ep.personal_financial_gap else None,
                transaction_type=ep.transaction_type if ep else None,
                post_exit_plans=ep.post_exit_plans if ep else None,
                owner_motivations=(_json.loads(ep.owner_motivations_json) if ep and ep.owner_motivations_json else None),
                ev_midpoint=float(ev.ev_midpoint),
                owner_hours_per_week=float(qual.owner_hours_per_week) if qual and qual.owner_hours_per_week is not None else None,
                key_person_revenue_pct=float(qual.key_person_revenue_pct) if qual and qual.key_person_revenue_pct is not None else None,
                sop_pct=float(qual.sop_pct) if qual and qual.sop_pct is not None else None,
                automation_pct=float(qual.automation_pct) if qual and qual.automation_pct is not None else None,
            )
        except Exception:
            pass

        return {
            "company_id": company.id,
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
                "multiple_floor": ev.multiple_floor,
                "multiple_ceiling": ev.multiple_ceiling,
                "ebitda_base":   float(ebitda_dec),
                "multiple_basis": ev.multiple_basis,
                "drs_multiple_floor": ev.drs_multiple_floor,
                "drs_multiple_ceiling": ev.drs_multiple_ceiling,
                "market_reference": ev.market_reference,
                "valuation_summary": valuation_summary,
                "source_citation": valuation_summary,
            },
            "owner_readiness": {
                "pre_score": pre_result.pre_score,
                "tier": pre_result.tier,
                "summary": pre_result.summary,
                "dimensions": [
                    {
                        "name": d.name,
                        "score": d.score,
                        "weight": d.weight,
                        "label": d.label,
                        "detail": d.detail,
                    }
                    for d in pre_result.dimensions
                ],
            } if pre_result else None,
            "rules": {"version": SCORING_RULES_VERSION, "category_weights": SCORING_RULES.category_weights},
            "methodology": {
                "version": SCORING_RULES_VERSION,
                "summary": (
                    "DRS is a 0–100 weighted composite of six category scores. "
                    "Each category is computed from financial ontology data and optional qualitative inputs."
                ),
                "category_weights_percent": {
                    k: round(v * 100, 1) for k, v in SCORING_RULES.category_weights.items()
                },
                "tiers": [{"min_drs": lo, "tier": name} for lo, name in SCORING_RULES.drs_tier_thresholds],
                "value_gap_target_score": SCORING_RULES.value_gap_target_score,
                "low_confidence_category_multiplier": settings.DRS_CONFIDENCE_LOW_MULTIPLIER,
                "low_confidence_optimistic_multiplier": settings.DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scores/{company_id}/history")
def get_score_history(company: CompanyScoped, db: Session = Depends(get_db)):
    """Return the last 90 DRS snapshots for sparkline/timeline rendering."""
    from sqlalchemy import desc as _desc
    rows = (
        db.query(ScoreSnapshot)
        .filter(ScoreSnapshot.company_id == company.id)
        .order_by(_desc(ScoreSnapshot.created_at))
        .limit(90)
        .all()
    )
    return {
        "company_id": company.id,
        "snapshots": [
            {
                "id": r.id,
                "drs_score": float(r.drs_score),
                "ev_estimate": float(r.ev_estimate) if r.ev_estimate is not None else None,
                "trigger": r.trigger,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reversed(rows)  # oldest first for chart rendering
        ],
    }


@router.post("/scores/{company_id}/snapshot")
def capture_score_snapshot(company: CompanyScoped, db: Session = Depends(get_db)):
    """Manually trigger a DRS + EV snapshot."""
    from app.analytics.ebitda_basis import ebitda_basis_for_company
    from app.services.analytics_service import compute_category_scores
    from app.analytics.a9_drs_composite import CategoryScores as _CS, compute_drs as _drs
    try:
        cat = compute_category_scores(company.id, db)
        cs = _CS(**{k: cat[k] for k in cat})
        drs_val = round(float(_drs(cs).base_drs), 2)
        basis = ebitda_basis_for_company(company.id, db)
        ebitda = float(basis.get("ebitda_normalized_ttm") or basis.get("ebitda_proxy_ttm") or 0)
        ev_val = round(ebitda * 4.5, 2) if ebitda > 0 else None
        db.add(ScoreSnapshot(company_id=company.id, drs_score=drs_val, ev_estimate=ev_val, trigger="manual"))
        db.commit()
        return {"company_id": company.id, "drs_score": drs_val, "ev_estimate": ev_val}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue-quality/{company_id}")
def get_revenue_quality(company: CompanyScoped, db: Session = Depends(get_db)):
    """A3: Revenue quality sub-scores and composite."""
    return compute_revenue_quality(company.id, db).to_dict()


@router.get("/operational-independence/{company_id}")
def get_operational_independence(company: CompanyScoped, db: Session = Depends(get_db)):
    """A4: Operational independence sub-scores."""
    return compute_operational_independence(company.id, db).to_dict()


@router.get("/customer-risk/{company_id}")
def get_customer_risk(company: CompanyScoped, db: Session = Depends(get_db)):
    """A5: Customer risk sub-scores."""
    return compute_customer_risk(company.id, db).to_dict()


@router.get("/management-team/{company_id}")
def get_management_team(company: CompanyScoped, db: Session = Depends(get_db)):
    """A6: Management and team sub-scores."""
    return compute_management_team(company.id, db).to_dict()


@router.get("/growth-drivers/{company_id}")
def get_growth_drivers(company: CompanyScoped, db: Session = Depends(get_db)):
    """A7: Growth drivers sub-scores."""
    return compute_growth_drivers(company.id, db).to_dict()


@router.get("/financial-integrity/{company_id}")
def get_financial_integrity(company: CompanyScoped, db: Session = Depends(get_db)):
    """A8: Financial integrity sub-scores."""
    return compute_financial_integrity(company.id, db).to_dict()


@router.get("/value-gap/{company_id}")
def get_value_gap(company: CompanyScoped, db: Session = Depends(get_db)):
    """A11: Value gap analysis — current EV vs potential EV if gaps resolved."""
    try:
        modules = compute_category_modules(company.id, db)
        rev = modules["revenue_quality"]
        ops = modules["operational_independence"]
        cust = modules["customer_risk"]
        mgmt = modules["management_team"]
        growth = modules["growth_drivers"]
        fin = modules["financial_integrity"]
        basis = _ebitda_basis(company.id, db)

        ops_raw = ops.composite
        rev_raw = rev.composite
        growth_raw = growth.composite
        qual_sub_overrides: dict[str, dict] = {}

        # --- P2: Apply qualitative inputs (must mirror get_all_scores logic) ---
        qual = db.query(QualitativeInputs).filter(
            QualitativeInputs.company_id == company.id
        ).first()
        if qual:
            a4_fields = [qual.owner_hours_per_week, qual.sop_pct, qual.automation_pct,
                         qual.mgmt_qualified, qual.mgmt_total_functions]
            if all(v is not None for v in a4_fields):
                s_hours = _qual_owner_hours_score(float(qual.owner_hours_per_week))
                s_sop   = _qual_sop_score(float(qual.sop_pct))
                s_auto  = _qual_automation_score(float(qual.automation_pct))
                s_mgmt  = _qual_mgmt_depth_score(int(qual.mgmt_qualified), int(qual.mgmt_total_functions))
                ops_raw = round(s_hours * 0.35 + s_sop * 0.30 + s_auto * 0.15 + s_mgmt * 0.20, 1)
                qual_sub_overrides["operational_independence"] = {
                    "owner_hours":       {"score": s_hours, "label": f"{qual.owner_hours_per_week:.0f} hrs/week in operations"},
                    "sop_documentation": {"score": s_sop,   "label": f"{qual.sop_pct:.0f}% SOPs documented"},
                    "process_automation":{"score": s_auto,  "label": f"{qual.automation_pct:.0f}% tasks automated"},
                    "management_depth":  {"score": s_mgmt,  "label": f"{qual.mgmt_qualified} of {qual.mgmt_total_functions} functions covered"},
                }

            a7_fields = [qual.pipeline_value, qual.market_positioning, qual.repeatability_pct]
            if all(v is not None for v in a7_fields):
                metrics_for_qual = compute_metrics(company.id, db)
                ttm_rev = float(metrics_for_qual.total_revenue_ttm)
                s_pipe = _qual_pipeline_score(float(qual.pipeline_value), ttm_rev)
                s_mkt  = _qual_market_pos_score(qual.market_positioning)
                s_rep  = _qual_repeatability_score(float(qual.repeatability_pct))
                growth_raw = round(growth.cagr_score * 0.35 + s_pipe * 0.30 + s_mkt * 0.20 + s_rep * 0.15, 1)
                pipe_ratio = float(qual.pipeline_value) / ttm_rev if ttm_rev > 0 else 0
                qual_sub_overrides.setdefault("growth_drivers", {}).update({
                    "pipeline_coverage":    {"score": s_pipe, "label": f"{pipe_ratio:.2f}x pipeline coverage"},
                    "market_positioning":   {"score": s_mkt,  "label": qual.market_positioning.replace("_", " ")},
                    "product_repeatability":{"score": s_rep,  "label": f"{qual.repeatability_pct:.0f}% standardized"},
                })

            a3_contract_fields = [qual.contract_pct, qual.customer_contract_type]
            if all(v is not None for v in a3_contract_fields):
                s_contract = _qual_contract_score(float(qual.contract_pct), qual.customer_contract_type)
                rev_qual_composite = round(
                    rev.recurring_rate_score * 0.30
                    + rev.concentration_score * 0.25
                    + s_contract * 0.20
                    + rev.consistency_score * 0.15
                    + rev.nrr_score * 0.10,
                    1,
                )
                qual_sub_overrides.setdefault("revenue_quality", {})["durability"] = {
                    "score": s_contract,
                    "label": f"{qual.contract_pct:.0f}% contracted ({qual.customer_contract_type})",
                }
                if qual.key_person_revenue_pct is not None:
                    s_kp = _qual_key_person_score(float(qual.key_person_revenue_pct))
                    rev_qual_composite = round(rev_qual_composite * 0.85 + s_kp * 0.15, 1)
                    qual_sub_overrides["revenue_quality"]["key_person_risk"] = {
                        "score": s_kp,
                        "label": f"{qual.key_person_revenue_pct:.0f}% revenue owner-dependent",
                    }
                rev_raw = rev_qual_composite

        raw_scores = {
            "revenue_quality":          round(rev_raw, 1),
            "financial_integrity":      round(fin.composite, 1),
            "operational_independence": round(ops_raw, 1),
            "customer_risk":            round(cust.composite, 1),
            "management_team":          round(mgmt.composite, 1),
            "growth_drivers":           round(growth_raw, 1),
        }

        # --- P1: Apply advisor overrides (same pattern as get_all_scores) ---
        overrides_rows = db.query(AdvisorOverride).filter(
            AdvisorOverride.company_id == company.id
        ).all()
        override_map = {o.category: o for o in overrides_rows}

        def apply_override(key, raw):
            if key in override_map:
                return max(0.0, min(100.0, raw + float(override_map[key].adjustment)))
            return raw

        cat_scores = {k: round(apply_override(k, v), 1) for k, v in raw_scores.items()}

        ebitda = basis["ebitda_normalized_ttm"]
        result = compute_value_gap(company.id, cat_scores, ebitda)
        result_dict = result.to_dict()

        # Enrich each gap with weak sub-scores, merging qualitative overrides
        cat_modules_map = {
            "revenue_quality":          rev,
            "financial_integrity":      fin,
            "operational_independence": ops,
            "customer_risk":            cust,
            "management_team":          mgmt,
            "growth_drivers":           growth,
        }
        for gap in result_dict["gaps"]:
            cat_key = gap["category"]
            mod = cat_modules_map.get(cat_key)
            if mod:
                sub = mod.to_dict().get("sub_scores") or {}
                if cat_key in qual_sub_overrides:
                    sub = {**sub, **qual_sub_overrides[cat_key]}
                gap["weak_sub_scores"] = [
                    {"key": k, "label": v.get("label", k), "score": round(v.get("score", 0), 1)}
                    for k, v in sub.items()
                    if isinstance(v, dict) and v.get("score", 100) < 75
                ]
            else:
                gap["weak_sub_scores"] = []

        return result_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/advisory-workflow/{company_id}")
def get_advisory_workflow(company: CompanyScoped, db: Session = Depends(get_db)):
    """CEPA-style engagement stages with progress derived from live company + analytics signals."""
    try:
        return build_advisory_workflow(company, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/library-triggered/{company_id}")
def get_library_triggered_items(company: CompanyScoped, db: Session = Depends(get_db)):
    """Return advisory library items whose score_trigger is above the current category score.
    These represent issues the advisor should prioritize based on DRS weakness."""
    from app.ontology.models import AdvisoryLibraryItem
    from app.services.analytics_service import compute_category_scores as _cat_scores
    try:
        cat = _cat_scores(company.id, db)
        # Find library items where the category score is below their trigger threshold
        library_items = (
            db.query(AdvisoryLibraryItem)
            .filter(
                AdvisoryLibraryItem.score_trigger.isnot(None),
                AdvisoryLibraryItem.is_active == True,
            )
            .all()
        )
        triggered = []
        for item in library_items:
            cat_score = cat.get(item.category)
            if cat_score is not None and item.score_trigger is not None:
                if float(cat_score) < float(item.score_trigger):
                    cat_score_f = round(float(cat_score), 1)
                    triggered.append({
                        "id": item.id,
                        "item_type": item.item_type,
                        "title": item.title,
                        "content": item.description,
                        "description": item.description,
                        "category": item.category,
                        "severity": item.severity,
                        "buyer_type": item.buyer_type,
                        "score_trigger": float(item.score_trigger),
                        "category_score": cat_score_f,
                        "current_score": cat_score_f,
                        "score_gap": round(float(item.score_trigger) - cat_score_f, 1),
                        "effort": item.effort,
                        "timeline": item.timeline,
                        "ev_impact": item.ev_impact,
                    })
        # Sort by severity then by gap (biggest gap first)
        sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
        triggered.sort(key=lambda x: (sev_order.get(x.get("severity", "MEDIUM"), 2), x.get("current_score", 100)))
        return {"company_id": company.id, "triggered_items": triggered}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/buyer-questions/{company_id}")
def get_buyer_questions(company: CompanyScoped, db: Session = Depends(get_db)):
    """A13: Generate prioritized buyer due diligence questions from DRS weaknesses."""
    try:
        modules = compute_category_modules(company.id, db)
        rev = modules["revenue_quality"]
        ops = modules["operational_independence"]
        cust = modules["customer_risk"]
        mgmt = modules["management_team"]
        growth = modules["growth_drivers"]
        fin = modules["financial_integrity"]

        ops_raw = ops.composite
        rev_raw = rev.composite
        growth_raw = growth.composite

        # --- P2: Apply qualitative inputs (must mirror get_all_scores logic) ---
        qual = db.query(QualitativeInputs).filter(
            QualitativeInputs.company_id == company.id
        ).first()
        if qual:
            a4_fields = [qual.owner_hours_per_week, qual.sop_pct, qual.automation_pct,
                         qual.mgmt_qualified, qual.mgmt_total_functions]
            if all(v is not None for v in a4_fields):
                s_hours = _qual_owner_hours_score(float(qual.owner_hours_per_week))
                s_sop   = _qual_sop_score(float(qual.sop_pct))
                s_auto  = _qual_automation_score(float(qual.automation_pct))
                s_mgmt  = _qual_mgmt_depth_score(int(qual.mgmt_qualified), int(qual.mgmt_total_functions))
                ops_raw = round(s_hours * 0.35 + s_sop * 0.30 + s_auto * 0.15 + s_mgmt * 0.20, 1)

            a7_fields = [qual.pipeline_value, qual.market_positioning, qual.repeatability_pct]
            if all(v is not None for v in a7_fields):
                metrics_for_qual = compute_metrics(company.id, db)
                ttm_rev = float(metrics_for_qual.total_revenue_ttm)
                s_pipe = _qual_pipeline_score(float(qual.pipeline_value), ttm_rev)
                s_mkt  = _qual_market_pos_score(qual.market_positioning)
                s_rep  = _qual_repeatability_score(float(qual.repeatability_pct))
                growth_raw = round(growth.cagr_score * 0.35 + s_pipe * 0.30 + s_mkt * 0.20 + s_rep * 0.15, 1)

            a3_contract_fields = [qual.contract_pct, qual.customer_contract_type]
            if all(v is not None for v in a3_contract_fields):
                s_contract = _qual_contract_score(float(qual.contract_pct), qual.customer_contract_type)
                rev_qual_composite = round(
                    rev.recurring_rate_score * 0.30
                    + rev.concentration_score * 0.25
                    + s_contract * 0.20
                    + rev.consistency_score * 0.15
                    + rev.nrr_score * 0.10,
                    1,
                )
                if qual.key_person_revenue_pct is not None:
                    s_kp = _qual_key_person_score(float(qual.key_person_revenue_pct))
                    rev_qual_composite = round(rev_qual_composite * 0.85 + s_kp * 0.15, 1)
                rev_raw = rev_qual_composite

        raw_scores = {
            "revenue_quality":          round(rev_raw, 1),
            "financial_integrity":      round(fin.composite, 1),
            "operational_independence": round(ops_raw, 1),
            "customer_risk":            round(cust.composite, 1),
            "management_team":          round(mgmt.composite, 1),
            "growth_drivers":           round(growth_raw, 1),
        }

        # --- P1: Apply advisor overrides ---
        overrides_rows = db.query(AdvisorOverride).filter(
            AdvisorOverride.company_id == company.id
        ).all()
        override_map = {o.category: o for o in overrides_rows}

        def apply_override(key, raw):
            if key in override_map:
                return max(0.0, min(100.0, raw + float(override_map[key].adjustment)))
            return raw

        cat_scores = {k: round(apply_override(k, v), 1) for k, v in raw_scores.items()}
        questions = generate_buyer_questions(cat_scores)
        states = {
            s.question_id: s
            for s in db.query(BuyerQuestionState).filter(BuyerQuestionState.company_id == company.id).all()
        }
        qlist = []
        for q in questions:
            d = q.to_dict()
            st = states.get(q.id)
            d["tracking_status"] = st.status if st else "open"
            d["response_text"] = st.response_text if st else None
            d["mitigating_initiative_id"] = st.mitigating_initiative_id if st else None
            qlist.append(d)
        return {
            "company_id": company.id,
            "total":      len(qlist),
            "questions":  qlist,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BuyerQuestionPatch(BaseModel):
    status: str = "open"
    response_text: Optional[str] = None
    mitigating_initiative_id: Optional[int] = None


@router.patch("/buyer-questions/{company_id}/{question_id}")
def patch_buyer_question(
    company: CompanyScoped,
    question_id: int,
    body: BuyerQuestionPatch,
    db: Session = Depends(get_db),
):
    row = (
        db.query(BuyerQuestionState)
        .filter(
            BuyerQuestionState.company_id == company.id,
            BuyerQuestionState.question_id == question_id,
        )
        .first()
    )
    if not row:
        row = BuyerQuestionState(company_id=company.id, question_id=question_id)
        db.add(row)
    row.status = body.status
    row.response_text = body.response_text
    row.mitigating_initiative_id = body.mitigating_initiative_id
    db.commit()
    db.refresh(row)
    return {
        "question_id": question_id,
        "tracking_status": row.status,
        "response_text": row.response_text,
        "mitigating_initiative_id": row.mitigating_initiative_id,
    }


class InitiativeCreate(BaseModel):
    title: str
    category: Optional[str] = None
    timeline: Optional[str] = None
    cost_estimate: Optional[float] = None
    ev_impact_estimate: Optional[float] = None
    advisor_ev_override: Optional[float] = None
    depends_on_initiative_id: Optional[int] = None


@router.get("/initiatives/{company_id}")
def list_initiatives(company: CompanyScoped, db: Session = Depends(get_db)):
    rows = (
        db.query(CompanyInitiative)
        .filter(CompanyInitiative.company_id == company.id)
        .order_by(CompanyInitiative.created_at.desc())
        .all()
    )
    return {
        "company_id": company.id,
        "initiatives": [
            {
                "id": r.id,
                "title": r.title,
                "category": r.category,
                "timeline": r.timeline,
                "cost_estimate": float(r.cost_estimate) if r.cost_estimate is not None else None,
                "ev_impact_estimate": float(r.ev_impact_estimate) if r.ev_impact_estimate is not None else None,
                "advisor_ev_override": float(r.advisor_ev_override) if r.advisor_ev_override is not None else None,
                "depends_on_initiative_id": r.depends_on_initiative_id,
                "source": r.source,
            }
            for r in rows
        ],
    }


@router.post("/initiatives/{company_id}", status_code=201)
def create_initiative(
    company: CompanyScoped,
    body: InitiativeCreate,
    db: Session = Depends(get_db),
):
    row = CompanyInitiative(
        company_id=company.id,
        title=body.title,
        category=body.category,
        timeline=body.timeline,
        cost_estimate=body.cost_estimate,
        ev_impact_estimate=body.ev_impact_estimate,
        advisor_ev_override=body.advisor_ev_override,
        depends_on_initiative_id=body.depends_on_initiative_id,
        source="custom",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "title": row.title,
        "category": row.category,
        "timeline": row.timeline,
        "cost_estimate": float(row.cost_estimate) if row.cost_estimate is not None else None,
        "ev_impact_estimate": float(row.ev_impact_estimate) if row.ev_impact_estimate is not None else None,
        "advisor_ev_override": float(row.advisor_ev_override) if row.advisor_ev_override is not None else None,
        "depends_on_initiative_id": row.depends_on_initiative_id,
        "source": row.source,
    }


def _build_recast_payload(company_id: int, db: Session) -> dict:
    """
    Shared logic for GET /ebitda-recast and the addback override endpoints.
    Returns the full recast dict after merging stored advisor overrides.
    """
    from decimal import Decimal as _D
    from app.ontology.models import Expense, ExpenseCategory

    metrics = compute_metrics(company_id, db)
    basis = _ebitda_basis(company_id, db)
    market_rate = _D(str(basis["market_rate_replacement_annual"]))

    CHALLENGE_LABELS = {
        "LOW":             "Fully defensible — included in conservative, base, and aggressive",
        "MEDIUM":          "Partially defensible — excluded from conservative; 50% in base; 100% in aggressive",
        "HIGH":            "Challenged — excluded from conservative and base; aggressive only",
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

    # --- Compute three scenarios (conservative = LOW only; base = LOW + 50% MEDIUM; aggressive = all) ---
    reported = float(basis["ebitda_normalized_ttm"])
    conservative = reported
    base = reported
    aggressive = reported

    for ab in final_addbacks:
        amt = ab["amount"]
        ch = ab["challenge"]
        if ch == "NOT_DEFENSIBLE":
            continue
        if ch == "LOW":
            conservative += amt
            base += amt
            aggressive += amt
        elif ch == "MEDIUM":
            base += amt * 0.5
            aggressive += amt
        elif ch == "HIGH":
            aggressive += amt

    total_addbacks = sum(ab["amount"] for ab in final_addbacks if ab["challenge"] != "NOT_DEFENSIBLE")

    # --- Build expense line items for P&L detail view ---
    from collections import defaultdict
    line_item_groups: dict[tuple, dict] = defaultdict(lambda: {"amount": 0.0, "category": None, "description": None})
    for e in expenses:
        cat = _expense_category_code(e.category)
        desc = (e.description or "Unknown").strip()
        key = (desc, cat)
        line_item_groups[key]["amount"] += float(e.amount or 0)
        line_item_groups[key]["category"] = cat
        line_item_groups[key]["description"] = desc

    expense_line_items = sorted(
        [
            {"description": desc, "category": cat, "amount": round(data["amount"], 2)}
            for (desc, cat), data in line_item_groups.items()
            if data["amount"] > 0
        ],
        key=lambda x: -x["amount"],
    )

    return {
        "company_id":         company_id,
        "reported_ebitda":    round(reported, 2),
        "ebitda_proxy_ttm":   round(basis["ebitda_proxy_ttm"], 2),
        "depreciation_amortization_ttm": round(basis["depreciation_amortization_ttm"], 2),
        "interest_expense_ttm": round(basis["interest_expense_ttm"], 2),
        "income_tax_expense_ttm": round(basis["income_tax_expense_ttm"], 2),
        "conservative_ebitda": round(conservative, 2),
        "base_ebitda":        round(base, 2),
        "aggressive_ebitda":  round(aggressive, 2),
        "defensible_ebitda":  round(base, 2),
        "total_addbacks":     round(total_addbacks, 2),
        "owner_comp_total":   float(metrics.owner_compensation_total),
        "market_rate":        float(market_rate),
        "addback_schedule":   final_addbacks,
        "expense_line_items": expense_line_items,
        "has_overrides":      bool(override_map),
        "data_notes": [
            "Starting EBITDA = ontology proxy plus advisor-entered D&A (if any). Interest and tax are stored for disclosure and are not auto-added to EBITDA here.",
            f"Owner market-rate replacement: ${float(market_rate):,.0f}/yr (editable on company / recast settings).",
            "Ontology proxy = revenue − COGS − OpEx when expense detail exists; otherwise a labor-based estimate.",
        ],
    }


@router.get("/ebitda-recast/{company_id}")
def get_ebitda_recast(company: CompanyScoped, db: Session = Depends(get_db)):
    """A2: Defensible EBITDA recast — conservative / base / aggressive with advisor override support."""
    try:
        return _build_recast_payload(company.id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/drs/{company_id}")
def compute_drs_score(company: CompanyScoped, scores: dict, db: Session = Depends(get_db)):
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
def get_overrides(company: CompanyScoped, db: Session = Depends(get_db)):
    rows = db.query(AdvisorOverride).filter(AdvisorOverride.company_id == company.id).all()
    return {
        "company_id": company.id,
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
    company: CompanyScoped,
    category: str,
    body: OverrideRequest,
    db: Session = Depends(get_db),
):
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, f"Unknown category '{category}'")
    if not body.rationale.strip():
        raise HTTPException(400, "Rationale is required")
    adj = max(-20.0, min(20.0, body.adjustment))

    existing = db.query(AdvisorOverride).filter(
        AdvisorOverride.company_id == company.id,
        AdvisorOverride.category == category,
    ).first()

    if existing:
        existing.adjustment = adj
        existing.rationale  = body.rationale.strip()
        existing.advisor_id = body.advisor_id
        existing.updated_at = datetime.utcnow()
    else:
        db.add(AdvisorOverride(
            company_id=company.id, category=category,
            adjustment=adj, rationale=body.rationale.strip(),
            advisor_id=body.advisor_id,
        ))
    db.commit()
    # Capture a score snapshot after each override change
    try:
        from app.services.analytics_service import compute_category_scores as _cat_scores
        from app.analytics.a9_drs_composite import CategoryScores as _CS, compute_drs as _drs
        from app.analytics.ebitda_basis import ebitda_basis_for_company as _ev_basis
        cat_s = _cat_scores(company.id, db)
        cs_s = _CS(**{k: cat_s[k] for k in cat_s})
        drs_s = round(float(_drs(cs_s).base_drs), 2)
        basis_s = _ev_basis(company.id, db)
        ebitda_s = float(basis_s.get("ebitda_normalized_ttm") or basis_s.get("ebitda_proxy_ttm") or 0)
        ev_s = round(ebitda_s * 4.5, 2) if ebitda_s > 0 else None
        db.add(ScoreSnapshot(company_id=company.id, drs_score=drs_s, ev_estimate=ev_s, trigger="override"))
        db.commit()
    except Exception:
        pass  # snapshot failure must not break the override save
    return {"status": "saved", "category": category, "adjustment": adj}


@router.delete("/overrides/{company_id}/{category}")
def delete_override(company: CompanyScoped, category: str, db: Session = Depends(get_db)):
    deleted = db.query(AdvisorOverride).filter(
        AdvisorOverride.company_id == company.id,
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
    company: CompanyScoped,
    addback_key: str,
    body: AddbackOverrideRequest,
    db: Session = Depends(get_db),
):
    """Save or update an advisor override for a specific addback line (or add a custom line)."""
    if body.challenge not in VALID_CHALLENGES:
        raise HTTPException(400, f"challenge must be one of {VALID_CHALLENGES}")

    existing = db.query(AddbackOverride).filter(
        AddbackOverride.company_id == company.id,
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
            company_id=company.id, addback_key=addback_key,
            description=body.description, amount=body.amount,
            challenge=body.challenge, category=body.category,
            documented=body.documented, notes=body.notes,
            rationale=body.rationale, advisor_id=body.advisor_id,
            is_custom=body.is_custom,
        ))
    db.commit()
    return _build_recast_payload(company.id, db)


@router.delete("/addbacks/{company_id}/{addback_key}")
def delete_addback_override(company: CompanyScoped, addback_key: str, db: Session = Depends(get_db)):
    """Remove an advisor override for an addback line (reverts to system default)."""
    deleted = db.query(AddbackOverride).filter(
        AddbackOverride.company_id == company.id,
        AddbackOverride.addback_key == addback_key,
    ).delete()
    db.commit()
    return _build_recast_payload(company.id, db)


# ---------------------------------------------------------------------------
# P2: Qualitative Inputs
# ---------------------------------------------------------------------------

@router.get("/qualitative/{company_id}")
def get_qualitative(company: CompanyScoped, db: Session = Depends(get_db)):
    row = db.query(QualitativeInputs).filter(
        QualitativeInputs.company_id == company.id
    ).first()
    if not row:
        return {"company_id": company.id, "inputs": None}
    return {
        "company_id": company.id,
        "inputs": {
            "owner_hours_per_week":  float(row.owner_hours_per_week) if row.owner_hours_per_week is not None else None,
            "sop_pct":               float(row.sop_pct)               if row.sop_pct               is not None else None,
            "automation_pct":        float(row.automation_pct)        if row.automation_pct        is not None else None,
            "mgmt_qualified":        row.mgmt_qualified,
            "mgmt_total_functions":  row.mgmt_total_functions,
            "mgmt_covered_functions": row.mgmt_covered_functions,
            "pipeline_value":        float(row.pipeline_value)        if row.pipeline_value        is not None else None,
            "market_positioning":    row.market_positioning,
            "repeatability_pct":      float(row.repeatability_pct)      if row.repeatability_pct      is not None else None,
            "contract_pct":           float(row.contract_pct)           if row.contract_pct           is not None else None,
            "customer_contract_type": row.customer_contract_type,
            "key_person_revenue_pct": float(row.key_person_revenue_pct) if row.key_person_revenue_pct is not None else None,
            "updated_at":             row.updated_at.isoformat(),
        },
    }


def _qualitative_snapshot(row: QualitativeInputs) -> dict:
    return {
        "owner_hours_per_week": float(row.owner_hours_per_week) if row.owner_hours_per_week is not None else None,
        "sop_pct": float(row.sop_pct) if row.sop_pct is not None else None,
        "automation_pct": float(row.automation_pct) if row.automation_pct is not None else None,
        "mgmt_qualified": row.mgmt_qualified,
        "mgmt_total_functions": row.mgmt_total_functions,
        "mgmt_covered_functions": row.mgmt_covered_functions,
        "pipeline_value": float(row.pipeline_value) if row.pipeline_value is not None else None,
        "market_positioning": row.market_positioning,
        "repeatability_pct": float(row.repeatability_pct) if row.repeatability_pct is not None else None,
        "contract_pct": float(row.contract_pct) if row.contract_pct is not None else None,
        "customer_contract_type": row.customer_contract_type,
        "key_person_revenue_pct": float(row.key_person_revenue_pct) if row.key_person_revenue_pct is not None else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/qualitative-audit/{company_id}")
def list_qualitative_audit(company: CompanyScoped, db: Session = Depends(get_db), limit: int = 20):
    rows = (
        db.query(QualitativeInputAudit)
        .filter(QualitativeInputAudit.company_id == company.id)
        .order_by(QualitativeInputAudit.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    return {
        "company_id": company.id,
        "entries": [
            {
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "snapshot": json.loads(r.snapshot_json) if r.snapshot_json else {},
            }
            for r in rows
        ],
    }


@router.post("/qualitative/{company_id}")
def save_qualitative(company: CompanyScoped, body: QualitativeRequest, db: Session = Depends(get_db)):
    row = db.query(QualitativeInputs).filter(
        QualitativeInputs.company_id == company.id
    ).first()
    data = body.model_dump(exclude_unset=False)
    if row:
        for k, v in data.items():
            setattr(row, k, v)
        row.updated_at = datetime.utcnow()
    else:
        row = QualitativeInputs(company_id=company.id, **data)
        db.add(row)
    db.commit()
    db.refresh(row)
    db.add(
        QualitativeInputAudit(
            company_id=company.id,
            snapshot_json=json.dumps(_qualitative_snapshot(row)),
        )
    )
    db.commit()
    return {"status": "saved", "company_id": company.id}


# ---------------------------------------------------------------------------
# Engagement timeline snapshots
# ---------------------------------------------------------------------------

def _snap_to_dict(s: EngagementSnapshot) -> dict:
    return {
        "id":               s.id,
        "milestone":        s.milestone,
        "date":             s.date,
        "stage":            s.stage,
        "status":           s.status,
        "drs":              float(s.drs)              if s.drs              is not None else None,
        "drs_tier":         s.drs_tier,
        "ebitda":           float(s.ebitda)           if s.ebitda           is not None else None,
        "ev_floor":         float(s.ev_floor)         if s.ev_floor         is not None else None,
        "ev_ceiling":       float(s.ev_ceiling)       if s.ev_ceiling       is not None else None,
        "ev_midpoint":      float(s.ev_midpoint)      if s.ev_midpoint      is not None else None,
        "multiple_floor":   float(s.multiple_floor)   if s.multiple_floor   is not None else None,
        "multiple_ceiling": float(s.multiple_ceiling) if s.multiple_ceiling is not None else None,
        "notes":            s.notes,
        "sort_order":       s.sort_order,
        "created_at":       s.created_at.isoformat(),
    }


class SnapshotRequest(BaseModel):
    milestone:        str
    date:             str
    stage:            str            = "value_gap"
    status:           str            = "complete"
    drs:              Optional[float] = None
    drs_tier:         Optional[str]  = None
    ebitda:           Optional[float] = None
    ev_floor:         Optional[float] = None
    ev_ceiling:       Optional[float] = None
    ev_midpoint:      Optional[float] = None
    multiple_floor:   Optional[float] = None
    multiple_ceiling: Optional[float] = None
    notes:            Optional[str]  = None


@router.get("/timeline/{company_id}")
def list_timeline(company: CompanyScoped, db: Session = Depends(get_db)):
    rows = (
        db.query(EngagementSnapshot)
        .filter(EngagementSnapshot.company_id == company.id)
        .order_by(EngagementSnapshot.sort_order, EngagementSnapshot.created_at)
        .all()
    )
    return [_snap_to_dict(r) for r in rows]


@router.post("/timeline/{company_id}", status_code=201)
def create_snapshot(company: CompanyScoped, body: SnapshotRequest, db: Session = Depends(get_db)):
    # sort_order = max existing + 1 so new snap appends to end
    existing_count = db.query(EngagementSnapshot).filter(
        EngagementSnapshot.company_id == company.id
    ).count()
    snap = EngagementSnapshot(
        company_id=company.id,
        sort_order=existing_count,
        **body.model_dump(),
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return _snap_to_dict(snap)


@router.delete("/timeline/{company_id}/{snapshot_id}", status_code=204)
def delete_snapshot(company: CompanyScoped, snapshot_id: int, db: Session = Depends(get_db)):
    snap = db.query(EngagementSnapshot).filter(
        EngagementSnapshot.id == snapshot_id,
        EngagementSnapshot.company_id == company.id,
    ).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    db.delete(snap)
    db.commit()


# ---------------------------------------------------------------------------
# Engagement intake (owner goals, exit plan, buyer universe)
# ---------------------------------------------------------------------------

class EngagementProfilePayload(BaseModel):
    owner_goals_narrative: Optional[str] = None
    owner_motivations: Optional[list[str]] = None
    post_exit_plans: Optional[str] = None
    non_negotiables: Optional[str] = None
    engagement_start_date: Optional[str] = None
    exit_timeline: Optional[str] = None
    target_valuation: Optional[float] = None
    personal_financial_gap: Optional[float] = None
    transaction_type: Optional[str] = None
    buyer_universe_notes: Optional[str] = None
    preferred_buyer_types: Optional[list[str]] = None


def _engagement_profile_dict(row: EngagementProfile) -> dict:
    buyers: list[str] = []
    if row.preferred_buyer_types_json:
        try:
            buyers = json.loads(row.preferred_buyer_types_json)
            if not isinstance(buyers, list):
                buyers = []
        except Exception:
            buyers = []
    motivations: list[str] = []
    if row.owner_motivations_json:
        try:
            motivations = json.loads(row.owner_motivations_json)
            if not isinstance(motivations, list):
                motivations = []
        except Exception:
            motivations = []
    return {
        "company_id": row.company_id,
        "owner_goals_narrative": row.owner_goals_narrative,
        "owner_motivations": motivations,
        "post_exit_plans": row.post_exit_plans,
        "non_negotiables": row.non_negotiables,
        "engagement_start_date": row.engagement_start_date,
        "exit_timeline": row.exit_timeline,
        "target_valuation": float(row.target_valuation) if row.target_valuation is not None else None,
        "personal_financial_gap": float(row.personal_financial_gap) if row.personal_financial_gap is not None else None,
        "transaction_type": row.transaction_type,
        "buyer_universe_notes": row.buyer_universe_notes,
        "preferred_buyer_types": buyers,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/engagement-profile/{company_id}")
def get_engagement_profile(company: CompanyScoped, db: Session = Depends(get_db)):
    row = db.query(EngagementProfile).filter(EngagementProfile.company_id == company.id).first()
    if not row:
        return {
            "company_id": company.id,
            "owner_goals_narrative": None,
            "owner_motivations": [],
            "post_exit_plans": None,
            "non_negotiables": None,
            "engagement_start_date": None,
            "exit_timeline": None,
            "target_valuation": None,
            "personal_financial_gap": None,
            "transaction_type": None,
            "buyer_universe_notes": None,
            "preferred_buyer_types": [],
            "updated_at": None,
        }
    return _engagement_profile_dict(row)


@router.patch("/engagement-profile/{company_id}")
def patch_engagement_profile(
    company: CompanyScoped,
    body: EngagementProfilePayload,
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    buyers = data.pop("preferred_buyer_types", None)
    motivations = data.pop("owner_motivations", None)

    row = db.query(EngagementProfile).filter(EngagementProfile.company_id == company.id).first()
    if not row:
        row = EngagementProfile(company_id=company.id)
        db.add(row)

    if buyers is not None:
        row.preferred_buyer_types_json = json.dumps(buyers)
    if motivations is not None:
        row.owner_motivations_json = json.dumps(motivations)
    for k, v in data.items():
        setattr(row, k, v)

    db.commit()
    db.refresh(row)
    return _engagement_profile_dict(row)
