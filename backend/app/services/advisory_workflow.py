"""
Exit Blueprint advisory workflow — 5-phase deal process derived from live company data.

Phases follow the NewCo/wealth-manager deal flow:
  P1 Preparation & Exit Readiness → P2 Positioning & Marketing Prep →
  P3 Go to Market → P4 Bids & Negotiation → P5 Due Diligence & Close
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.a9_drs_composite import CategoryScores, compute_drs
from app.analytics.a11_value_gap import compute_value_gap
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
from app.analytics.a13_buyer_questions import generate_buyer_questions


def _job_status_value(job: IngestionJob) -> str:
    st = job.current_status
    return st.value if hasattr(st, "value") else str(st)


def _pct_to_status(pct: int) -> str:
    if pct >= 85:
        return "completed"
    if pct > 0:
        return "in_progress"
    return "not_started"


def build_advisory_workflow(company: Company, db: Session) -> dict:
    cid = company.id

    # --- Compute analytics signals ---
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
    resolved = sum(
        1 for q in questions
        if ((states.get(q.id).status if states.get(q.id) else "open") or "open") in resolved_statuses
    )

    # -------------------------------------------------------------------------
    # Phase 1 — Preparation & Exit Readiness
    # -------------------------------------------------------------------------
    profile_filled = sum(
        1 for v in (company.name, company.industry, company.founded, company.state, company.entity_type)
        if v is not None and str(v).strip()
    )
    step_eng = min(100, profile_filled * 20)

    if profile:
        fp_bits = [bool(profile.exit_timeline), bool(profile.target_valuation), bool(profile.owner_goals_narrative)]
        step_fp = min(100, 25 + sum(37 if b else 0 for b in fp_bits))
    else:
        step_fp = 0

    if ebitda > 0 and ttm_rev > 0:
        step_fmv = 100
    elif ebitda > 0 or ttm_rev > 0:
        step_fmv = 60
    else:
        step_fmv = 15 if complete_jobs else 0

    step_qoe = min(100, int(ebitda > 0) * 60 + (len(complete_jobs) > 0) * 40) if complete_jobs else 0
    step_drs = min(100, int(round(drs_base)))
    if initiative_count > 0 and ebitda > 0:
        step_vcp = min(100, 30 + min(70, initiative_count * 14))
    elif drs_base > 0:
        step_vcp = 20
    else:
        step_vcp = 0

    p1_steps = [
        {
            "id": "ENG",
            "label": "Engagement & discovery",
            "pct": step_eng,
            "note": f"{company.name}" + (f" · {company.industry}" if company.industry else ""),
            "route": "/CompanyWorkspace",
        },
        {
            "id": "FP",
            "label": "Financial plan: post-transaction wealth need",
            "pct": step_fp,
            "note": (
                f"Horizon: {profile.exit_timeline}" if profile and profile.exit_timeline else
                "Add exit horizon and targets under Engagement Intake"
            ),
            "route": "/EngagementIntake",
        },
        {
            "id": "FMV",
            "label": "Valuation / FMV: current business value",
            "pct": step_fmv,
            "note": (
                f"Defensible EBITDA {ebitda:,.0f}" if ebitda > 0 else
                "Upload financials to establish valuation baseline"
            ),
            "route": "/Valuation",
        },
        {
            "id": "QOE",
            "label": "EBITDA normalization & quality of earnings",
            "pct": step_qoe,
            "note": (
                f"{len(complete_jobs)} source file(s) · {total_rows:,} rows ingested" if complete_jobs else
                "Connect QuickBooks or upload financial exports"
            ),
            "route": "/Connectors",
        },
        {
            "id": "DRS",
            "label": "Diligence Readiness Score",
            "pct": step_drs,
            "note": f"DRS {drs_base:.1f}/100 — {tier} tier" + (" · qualitative inputs on file" if qual else ""),
            "route": "/Readiness",
            "ip_badge": True,
        },
        {
            "id": "VCP",
            "label": "Value-creation plan: levers, actions, goals",
            "pct": step_vcp,
            "note": (
                f"{initiative_count} initiative(s) tracked · +{_vg_upside(cid, cat_scores, ebitda):,.0f} upside potential"
                if initiative_count > 0 else
                "Open Value Gap to model improvement initiatives"
            ),
            "route": "/ValueGap",
        },
    ]
    p1_pct = int(round(sum(s["pct"] for s in p1_steps) / len(p1_steps)))

    # -------------------------------------------------------------------------
    # Phase 2 — Positioning & Marketing Prep
    # -------------------------------------------------------------------------
    qual_has_mgmt = qual and (qual.owner_hours_per_week is not None)
    step_tax = 30 if (profile and profile.exit_timeline) else 0
    step_team = min(100, int(round(cat_scores.get("management_team", 0)))) if qual_has_mgmt else 15
    step_cim = min(100, report_count * 34)

    p2_steps = [
        {
            "id": "TAX",
            "label": "Tax & estate structuring",
            "pct": step_tax,
            "note": "Coordinate with estate attorney and CPA once exit timeline is set",
            "route": "/EngagementIntake",
        },
        {
            "id": "TEAM",
            "label": "Management team & key positions",
            "pct": step_team,
            "note": (
                f"Management score {cat_scores.get('management_team', 0):.0f}/100" if qual_has_mgmt else
                "Complete qualitative inputs to score management depth"
            ),
            "route": "/Readiness",
        },
        {
            "id": "CIM",
            "label": "Marketing materials: teaser & CIM",
            "pct": step_cim,
            "note": f"{report_count} report(s) generated" if report_count else "Generate DRS summary under Reports",
            "route": "/Reports",
        },
    ]
    p2_pct = int(round(sum(s["pct"] for s in p2_steps) / len(p2_steps)))

    # -------------------------------------------------------------------------
    # Phase 3 — Go to Market
    # -------------------------------------------------------------------------
    buyer_pct = int(round(100 * resolved / n_q)) if n_q > 0 else (80 if drs_base >= 65 else 20)
    step_buy = buyer_pct
    step_out = 0  # outreach/NDA tracking not yet in platform

    p3_steps = [
        {
            "id": "BUY",
            "label": "Buyer targeting & screening",
            "pct": step_buy,
            "note": (
                f"{n_q} buyer questions · {resolved} resolved" if n_q > 0 else
                "Run buyer risk simulation under Buyer Analysis"
            ),
            "route": "/BuyerLens",
            "ip_badge": True,
        },
        {
            "id": "OUT",
            "label": "Outreach, NDA & CIM distribution",
            "pct": step_out,
            "note": "Outreach tracking coming in next release",
            "route": None,
        },
    ]
    p3_pct = int(round(sum(s["pct"] for s in p3_steps) / len(p3_steps)))

    # -------------------------------------------------------------------------
    # Phase 4 — Bids & Negotiation
    # -------------------------------------------------------------------------
    p4_steps = [
        {
            "id": "IOI",
            "label": "IOIs & management meetings",
            "pct": 0,
            "note": "Bid tracking coming in next release",
            "route": None,
        },
        {
            "id": "LOI",
            "label": "LOI & buyer selection",
            "pct": 0,
            "note": "LOI management coming in next release",
            "route": None,
        },
    ]
    p4_pct = 0

    # -------------------------------------------------------------------------
    # Phase 5 — Due Diligence & Close
    # -------------------------------------------------------------------------
    p5_steps = [
        {
            "id": "DD",
            "label": "Confirmatory due diligence",
            "pct": 0,
            "note": "Virtual data room integration planned",
            "route": None,
        },
        {
            "id": "DEF",
            "label": "Definitive agreement",
            "pct": 0,
            "note": "Agreement tracking coming in next release",
            "route": None,
        },
        {
            "id": "CLOSE",
            "label": "Close",
            "pct": 0,
            "note": "Post-close AUM retained by wealth manager",
            "route": None,
        },
    ]
    p5_pct = 0

    # -------------------------------------------------------------------------
    # Assemble phases
    # -------------------------------------------------------------------------
    phases = [
        {
            "phase": 1,
            "label": "Preparation & Exit Readiness",
            "pct": p1_pct,
            "status": _pct_to_status(p1_pct),
            "steps": p1_steps,
            "has_dashboard": True,
            "dashboard_note": "Exit Readiness Dashboard: DRS, EV range, wealth gap, exit checklist",
        },
        {
            "phase": 2,
            "label": "Positioning & Marketing Prep",
            "pct": p2_pct,
            "status": _pct_to_status(p2_pct),
            "steps": p2_steps,
        },
        {
            "phase": 3,
            "label": "Go to Market",
            "pct": p3_pct,
            "status": _pct_to_status(p3_pct),
            "steps": p3_steps,
        },
        {
            "phase": 4,
            "label": "Bids & Negotiation",
            "pct": p4_pct,
            "status": _pct_to_status(p4_pct),
            "steps": p4_steps,
        },
        {
            "phase": 5,
            "label": "Due Diligence & Close",
            "pct": p5_pct,
            "status": _pct_to_status(p5_pct),
            "steps": p5_steps,
        },
    ]

    phase_pcts = [p1_pct, p2_pct, p3_pct, p4_pct, p5_pct]
    overall = int(round(sum(phase_pcts) / len(phase_pcts)))
    completed_count = sum(1 for p in phases if p["status"] == "completed")
    active_phase = next((p["phase"] for p in phases if p["status"] == "in_progress"), None)

    return {
        "company_id": cid,
        "overall_pct": overall,
        "completed_count": completed_count,
        "total_phases": len(phases),
        "current_phase": active_phase,
        "phases": phases,
        # Legacy fields for any existing consumers
        "stages": [],
        "total_stages": 0,
        "current_stage": None,
        "active_stages": [],
    }


def _vg_upside(cid: int, cat_scores: dict, ebitda: float) -> float:
    try:
        vg = compute_value_gap(cid, cat_scores, ebitda) if ebitda > 0 else None
        return float(vg.total_value_gap) if vg else 0.0
    except Exception:
        return 0.0
