"""
Owner Personal Readiness (PRE) Score

Measures the owner's personal readiness for an exit transaction across
four dimensions:
  Financial Readiness   35% — target valuation vs current EV midpoint alignment
  Timeline Realism      25% — exit timeline set and reasonable
  Business Independence 25% — operational independence from owner (hours, key-person risk, SOPs)
  Motivation Clarity    15% — motivations documented and post-exit plan defined
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class PREDimension:
    name: str
    score: float        # 0–100
    weight: float       # fraction
    label: str          # narrative label
    detail: str         # one-line explanation


@dataclass
class PREResult:
    pre_score: float                    # 0–100 weighted composite
    tier: str                           # Aligned / Mostly Ready / Moderate Gap / Critical Gap
    dimensions: list[PREDimension] = field(default_factory=list)
    summary: str = ""


def _tier(score: float) -> str:
    if score >= 80:
        return "Aligned"
    if score >= 65:
        return "Mostly Ready"
    if score >= 45:
        return "Moderate Gap"
    return "Critical Gap"


def compute_owner_readiness(
    *,
    # Engagement profile inputs
    exit_timeline: str | None = None,
    target_valuation: float | None = None,
    personal_financial_gap: float | None = None,
    transaction_type: str | None = None,
    post_exit_plans: str | None = None,
    owner_motivations: list[str] | None = None,
    # EV
    ev_midpoint: float | None = None,
    # Qualitative inputs
    owner_hours_per_week: float | None = None,
    key_person_revenue_pct: float | None = None,
    sop_pct: float | None = None,
    automation_pct: float | None = None,
) -> PREResult:
    dims: list[PREDimension] = []

    # -----------------------------------------------------------------------
    # 1. Financial Readiness (35%)
    # -----------------------------------------------------------------------
    fin_score = 50.0  # default when no data
    fin_detail = "No financial target data entered"

    if target_valuation and ev_midpoint and ev_midpoint > 0:
        ratio = ev_midpoint / target_valuation
        if ratio >= 0.90:
            fin_score = 95.0
            fin_detail = f"EV midpoint (${ev_midpoint:,.0f}) meets or exceeds target (${target_valuation:,.0f})"
        elif ratio >= 0.75:
            fin_score = 75.0
            fin_detail = f"EV midpoint is {ratio*100:.0f}% of target — moderate gap"
        elif ratio >= 0.50:
            fin_score = 50.0
            fin_detail = f"EV midpoint is {ratio*100:.0f}% of target — significant gap"
        else:
            fin_score = 25.0
            fin_detail = f"EV midpoint is {ratio*100:.0f}% of target — substantial shortfall"

        if personal_financial_gap and personal_financial_gap > 0:
            # If there's still a personal gap after accounting for EV, penalize slightly
            fin_score = max(0.0, fin_score - 10.0)
            fin_detail += f"; personal financial gap of ${personal_financial_gap:,.0f} remains"
    elif target_valuation:
        fin_score = 40.0
        fin_detail = "Target set but EV not yet computed — upload financials"

    dims.append(PREDimension(
        name="Financial Readiness",
        score=fin_score,
        weight=0.35,
        label="Aligned" if fin_score >= 80 else "Gap Exists" if fin_score >= 50 else "Critical",
        detail=fin_detail,
    ))

    # -----------------------------------------------------------------------
    # 2. Timeline Realism (25%)
    # -----------------------------------------------------------------------
    tl_score = 40.0
    tl_detail = "No exit timeline entered"

    if exit_timeline:
        tl_lower = exit_timeline.lower()
        # Score based on whether timeline is set and realistic
        if any(x in tl_lower for x in ["1 year", "12 month", "asap", "immediate"]):
            tl_score = 60.0  # Very short — may be unrealistic without DRS prep
            tl_detail = "Short timeline — ensure DRS improvements are complete before going to market"
        elif any(x in tl_lower for x in ["2 year", "18 month", "3 year"]):
            tl_score = 90.0
            tl_detail = "Timeline provides adequate preparation runway"
        elif any(x in tl_lower for x in ["4 year", "5 year", "long"]):
            tl_score = 80.0
            tl_detail = "Long timeline — stay engaged to avoid score drift"
        else:
            tl_score = 70.0
            tl_detail = f"Timeline defined: {exit_timeline}"

        if transaction_type:
            tl_score = min(100.0, tl_score + 5.0)
            tl_detail += f"; preferred transaction type: {transaction_type}"

    dims.append(PREDimension(
        name="Timeline Realism",
        score=tl_score,
        weight=0.25,
        label="On Track" if tl_score >= 75 else "Needs Definition" if tl_score < 50 else "Review",
        detail=tl_detail,
    ))

    # -----------------------------------------------------------------------
    # 3. Business Independence (25%)
    # -----------------------------------------------------------------------
    bi_scores = []
    bi_notes = []

    if owner_hours_per_week is not None:
        h = float(owner_hours_per_week)
        if h <= 10:
            bi_scores.append(95.0); bi_notes.append(f"{h:.0f} hrs/wk")
        elif h <= 20:
            bi_scores.append(75.0); bi_notes.append(f"{h:.0f} hrs/wk")
        elif h <= 35:
            bi_scores.append(50.0); bi_notes.append(f"{h:.0f} hrs/wk in ops")
        else:
            bi_scores.append(20.0); bi_notes.append(f"{h:.0f} hrs/wk — high dependency")

    if key_person_revenue_pct is not None:
        k = float(key_person_revenue_pct)
        if k <= 10:
            bi_scores.append(95.0); bi_notes.append(f"{k:.0f}% key-person rev")
        elif k <= 25:
            bi_scores.append(70.0); bi_notes.append(f"{k:.0f}% key-person rev")
        elif k <= 40:
            bi_scores.append(45.0); bi_notes.append(f"{k:.0f}% key-person rev risk")
        else:
            bi_scores.append(20.0); bi_notes.append(f"{k:.0f}% revenue owner-dependent")

    if sop_pct is not None:
        s = float(sop_pct)
        bi_scores.append(min(100.0, s * 1.1))
        bi_notes.append(f"{s:.0f}% SOP coverage")

    if automation_pct is not None:
        a = float(automation_pct)
        bi_scores.append(min(100.0, a * 1.1))
        bi_notes.append(f"{a:.0f}% automated")

    if bi_scores:
        bi_score = sum(bi_scores) / len(bi_scores)
        bi_detail = "; ".join(bi_notes)
    else:
        bi_score = 40.0
        bi_detail = "No operational independence data entered"

    dims.append(PREDimension(
        name="Business Independence",
        score=bi_score,
        weight=0.25,
        label="Independent" if bi_score >= 75 else "Partial" if bi_score >= 50 else "Owner-Dependent",
        detail=bi_detail,
    ))

    # -----------------------------------------------------------------------
    # 4. Motivation Clarity (15%)
    # -----------------------------------------------------------------------
    mot_score = 30.0
    mot_parts = []

    if owner_motivations and len(owner_motivations) > 0:
        mot_score += 40.0
        mot_parts.append(f"{len(owner_motivations)} motivation(s) documented")

    if post_exit_plans:
        mot_score += 30.0
        mot_parts.append("post-exit plan defined")

    mot_score = min(100.0, mot_score)
    mot_detail = "; ".join(mot_parts) if mot_parts else "No motivations or post-exit plan entered"

    dims.append(PREDimension(
        name="Motivation Clarity",
        score=mot_score,
        weight=0.15,
        label="Clear" if mot_score >= 70 else "Partial" if mot_score >= 40 else "Undefined",
        detail=mot_detail,
    ))

    # -----------------------------------------------------------------------
    # Composite
    # -----------------------------------------------------------------------
    pre_score = sum(d.score * d.weight for d in dims)
    tier = _tier(pre_score)

    summary = (
        f"Owner readiness: {pre_score:.0f}/100 ({tier}). "
        f"Strongest: {max(dims, key=lambda d: d.score).name}. "
        f"Focus area: {min(dims, key=lambda d: d.score).name}."
    )

    return PREResult(pre_score=round(pre_score, 1), tier=tier, dimensions=dims, summary=summary)
