"""
CEPA-style advisory workflow — stage metadata plus per-company progress heuristics.

Progress is derived from ontology + analytics signals (not stored workflow state).
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.a9_drs_composite import CategoryScores, compute_drs
from app.analytics.a11_value_gap import compute_value_gap
from app.analytics.a13_buyer_questions import generate_buyer_questions
from app.analytics.ebitda_basis import ebitda_basis_for_company
from app.ontology.ingestion_models import IngestionJob, PhaseStatus
from app.ontology.models import (
    BuyerQuestionState,
    Company,
    CompanyInitiative,
    EngagementProfile,
    GeneratedReport,
    QualitativeInputs,
)
from app.services.analytics_service import compute_category_scores

# Static methodology (matches product UI). Routes are app paths for deep links.
WORKFLOW_STAGES: list[dict] = [
    {
        "stage": 1,
        "label": "Company Workspace",
        "desc": "Entity profile, industry classification, ownership structure",
        "cepaRef": "Stage 1 · Profile",
        "deliverable": "Completed org profile",
        "iconName": "Building2",
        "route": "/CompanyWorkspace",
    },
    {
        "stage": 2,
        "label": "Data Ingestion",
        "desc": "Connect accounting, CRM, payroll, and banking sources",
        "cepaRef": "Stage 2 · Ingestion",
        "deliverable": "Clean ontology",
        "iconName": "Plug",
        "route": "/Connectors",
    },
    {
        "stage": 3,
        "label": "Valuation Baseline",
        "desc": "EBITDA normalization, multiple benchmarking, EV range",
        "cepaRef": "Stage 3 · Valuation",
        "deliverable": "EV range model",
        "iconName": "BarChart2",
        "route": "/Valuation",
    },
    {
        "stage": 4,
        "label": "Diligence Readiness",
        "desc": "DRS scoring across 6 dimensions with benchmark comparison",
        "cepaRef": "Stage 4 · DRS",
        "deliverable": "DRS scorecard",
        "iconName": "ShieldCheck",
        "route": "/Readiness",
    },
    {
        "stage": 5,
        "label": "Value Gap Analysis",
        "desc": "Current EV vs achievable EV — initiative impact modeling",
        "cepaRef": "Stage 5 · Value Gap",
        "deliverable": "Value gap report",
        "iconName": "Target",
        "route": "/ValueGap",
    },
    {
        "stage": 6,
        "label": "Buyer Risk Analysis",
        "desc": "Identify and quantify diligence flags a buyer will surface",
        "cepaRef": "Stage 6 · Risk",
        "deliverable": "Risk heatmap",
        "iconName": "AlertTriangle",
        "route": "/BuyerLens",
    },
    {
        "stage": 7,
        "label": "Report Generation",
        "desc": "Produce advisor-grade exit readiness deliverable package",
        "cepaRef": "Stage 7 · Reports",
        "deliverable": "Full report package",
        "iconName": "TrendingUp",
        "route": "/Reports",
    },
    {
        "stage": 8,
        "label": "Exit Execution",
        "desc": "Process preparation, buyer targeting, go-to-market readiness",
        "cepaRef": "Stage 8 · Exit",
        "deliverable": "Exit execution plan",
        "iconName": "Shield",
        "route": "/EngagementIntake",
    },
]


def _job_status_value(job: IngestionJob) -> str:
    st = job.current_status
    return st.value if hasattr(st, "value") else str(st)


def _stage_status(pct: int) -> str:
    if pct >= 85:
        return "completed"
    if pct > 0:
        return "in_progress"
    return "not_started"


def build_advisory_workflow(company: Company, db: Session) -> dict:
    cid = company.id
    cat_scores = compute_category_scores(cid, db)
    cs = CategoryScores(
        revenue_quality=cat_scores["revenue_quality"],
        financial_integrity=cat_scores["financial_integrity"],
        operational_independence=cat_scores["operational_independence"],
        customer_risk=cat_scores["customer_risk"],
        management_team=cat_scores["management_team"],
        growth_drivers=cat_scores["growth_drivers"],
    )
    drs_result = compute_drs(cs)
    drs_base = float(drs_result.base_drs)
    tier_raw = drs_result.tier
    tier = str(getattr(tier_raw, "value", tier_raw)).replace("_", " ").title()

    basis = ebitda_basis_for_company(cid, db)
    ebitda = float(basis.get("ebitda_normalized_ttm") or basis.get("ebitda_proxy_ttm") or 0)

    metrics = compute_metrics(cid, db)
    ttm_rev = float(metrics.total_revenue_ttm or 0)

    jobs = db.query(IngestionJob).filter(IngestionJob.company_id == cid).all()
    complete_jobs = [j for j in jobs if _job_status_value(j) == PhaseStatus.COMPLETE.value]
    total_rows = sum(int(j.row_count or 0) for j in complete_jobs)

    qual = db.query(QualitativeInputs).filter(QualitativeInputs.company_id == cid).first()
    profile = db.query(EngagementProfile).filter(EngagementProfile.company_id == cid).first()

    report_count = (
        db.query(func.count(GeneratedReport.id))
        .filter(GeneratedReport.company_id == cid)
        .scalar()
        or 0
    )
    initiative_count = (
        db.query(func.count(CompanyInitiative.id))
        .filter(CompanyInitiative.company_id == cid)
        .scalar()
        or 0
    )

    questions = generate_buyer_questions(cat_scores)
    states = {
        s.question_id: s
        for s in db.query(BuyerQuestionState).filter(BuyerQuestionState.company_id == cid).all()
    }
    resolved_statuses = frozenset({"answered", "mitigated", "waived"})
    n_q = len(questions)
    resolved = 0
    critical_open = 0
    for q in questions:
        st = states.get(q.id)
        status = (st.status if st else "open") or "open"
        if status in resolved_statuses:
            resolved += 1
        elif status == "open" and q.severity == "CRITICAL":
            critical_open += 1

    vg = compute_value_gap(cid, cat_scores, ebitda) if ebitda > 0 else None
    n_gaps = len(vg.gaps) if vg else 0

    # --- Per-stage pct (0–100) and notes ---
    notes: dict[int, str | None] = {}

    # 1 — Company profile
    filled = sum(
        1
        for v in (company.name, company.industry, company.founded, company.state, company.entity_type)
        if v is not None and str(v).strip() != ""
    )
    pct1 = min(100, filled * 20)
    notes[1] = (
        f"{company.name}"
        + (f" · {company.industry}" if company.industry else "")
        + (f" · est. {company.founded}" if company.founded else "")
    )

    # 2 — Data ingestion (was stage 3)
    if complete_jobs:
        pct2 = min(100, 40 + min(60, len(complete_jobs) * 20))
        notes[2] = f"{len(complete_jobs)} file(s) committed · {total_rows:,} rows in ontology"
    elif jobs:
        pct2 = 25
        notes[2] = f"{len(jobs)} pipeline job(s) — complete mapping/review where needed"
    else:
        pct2 = 0
        notes[2] = "Upload QuickBooks / CRM exports under Data Sources"

    # 3 — Valuation baseline (was stage 2)
    if ebitda > 0 and ttm_rev > 0:
        pct3 = 100
        ev_mid = ebitda * 4.5  # rough mid if full EV not computed here
        notes[3] = f"Defensible EBITDA {ebitda:,.0f} · illustrative ~{ev_mid:,.0f} EV (see Valuation for range)"
    elif ebitda > 0:
        pct3 = 70
        notes[3] = f"EBITDA basis {ebitda:,.0f} — add revenue history for tighter benchmarking"
    else:
        pct3 = 15 if ttm_rev > 0 else 0
        notes[3] = "Enter financial normalization on Valuation" if pct3 == 0 else "Partial financials — complete EBITDA bridge"

    # 4 — DRS
    pct4 = min(100, int(round(drs_base)))
    qual_complete = qual is not None and (
        qual.owner_hours_per_week is not None or qual.pipeline_value is not None
    )
    notes[4] = f"DRS {drs_base:.1f}/100 — {tier} tier"
    if qual_complete:
        notes[4] += " · qualitative inputs on file"

    # 5 — Value gap (was stage 6)
    if vg is None or ebitda <= 0:
        pct5 = 20 if drs_base > 0 else 0
        notes[5] = "Need EBITDA basis and scores to quantify value gap" if pct5 == 0 else "Partial — open Value Gap when EBITDA is set"
    else:
        if n_gaps == 0:
            pct5 = 100
            notes[5] = "Categories at or above target — no ranked drivers"
        else:
            pct5 = min(100, 35 + min(65, initiative_count * 12 + (25 if initiative_count else 0)))
            notes[5] = f"{n_gaps} driver(s) · {initiative_count} initiative(s) tracked · +{vg.total_value_gap:,.0f} upside at target DRS"
    pct5 = min(100, pct5)

    # 6 — Buyer risk (was stage 5)
    if n_q == 0:
        pct6 = 100 if drs_base >= 65 else 25
        notes[6] = (
            "No questions fired in current simulation — scores above common diligence triggers"
            if drs_base >= 65
            else "Limited data — buyer simulation may expand as scores and ingestion improve"
        )
    else:
        pct6 = int(round(100 * resolved / n_q))
        crit = sum(1 for q in questions if q.severity == "CRITICAL")
        notes[6] = f"{n_q} questions · {resolved} resolved · {crit} critical in library · {critical_open} critical still open"

    # 7 — Reports (was stage 8)
    pct7 = min(100, report_count * 34)
    notes[7] = f"{report_count} PDF export(s) in history" if report_count else "Generate DRS summary or buyer package under Reports"

    # 8 — Exit execution (engagement intake; was stage 9)
    if profile:
        bits = []
        if profile.exit_timeline:
            bits.append(f"Horizon: {profile.exit_timeline}")
        if profile.target_valuation is not None:
            bits.append(f"Target EV: {float(profile.target_valuation):,.0f}")
        if profile.owner_goals_narrative:
            bits.append("Owner goals captured")
        pct8 = min(100, 25 + (40 if profile.exit_timeline else 0) + (35 if profile.target_valuation else 0))
        pct8 = min(100, pct8)
        notes[8] = " · ".join(bits) if bits else "Engagement profile started — add exit horizon and targets"
    else:
        pct8 = 0
        notes[8] = "Capture exit timeline and valuation targets under Engagement Intake"

    pcts = {1: pct1, 2: pct2, 3: pct3, 4: pct4, 5: pct5, 6: pct6, 7: pct7, 8: pct8}

    stages_out: list[dict] = []
    for meta in WORKFLOW_STAGES:
        sid = meta["stage"]
        pct = int(pcts[sid])
        stages_out.append(
            {
                **meta,
                "status": _stage_status(pct),
                "pct": pct,
                "note": notes.get(sid),
            }
        )

    overall = int(round(sum(pcts.values()) / len(pcts)))
    completed_count = sum(1 for s in stages_out if s["status"] == "completed")
    active_stages = [s["stage"] for s in stages_out if s["status"] == "in_progress"]
    current_stage = active_stages[0] if active_stages else None

    return {
        "company_id": cid,
        "overall_pct": overall,
        "completed_count": completed_count,
        "total_stages": len(stages_out),
        "current_stage": current_stage,
        "active_stages": active_stages,
        "stages": stages_out,
    }
