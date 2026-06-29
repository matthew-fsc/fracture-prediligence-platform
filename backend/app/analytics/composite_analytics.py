"""
Composite Analytics — Blueprint II §A9, §A10, §A11 + shared utilities

Consolidates:
  A9  — DRS Composite Score       (compute_drs, CategoryScores, DRSTier, DRSResult)
  A10 — Enterprise Value          (compute_enterprise_value, EnterpriseValueResult, format_ev_valuation_summary)
  A11 — Value Gap Analysis        (compute_value_gap, ValueGapResult, GapItem)
  ebitda_basis                    (ebitda_basis_for_company)
  owner_readiness                 (compute_owner_readiness, PREResult, PREDimension)
"""

# ============================================================================
# A9 — DRS Composite Score
# ============================================================================

from __future__ import annotations
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Optional

from app.core.scoring_rules import SCORING_RULES


class DRSTier(str, Enum):
    INSTITUTIONAL  = "Institutional Grade"
    INVESTMENT     = "Investment Grade"
    CONDITIONAL    = "Conditional"
    HIGH_RISK      = "High Risk"
    PRE_DILIGENCE  = "Foundation Stage"


@dataclass
class CategoryScores:
    revenue_quality: float
    financial_integrity: float
    operational_independence: float
    customer_risk: float
    management_team: float
    growth_drivers: float

    revenue_quality_conservative: float = None
    financial_integrity_conservative: float = None
    operational_independence_conservative: float = None
    customer_risk_conservative: float = None
    management_team_conservative: float = None
    growth_drivers_conservative: float = None

    revenue_quality_optimistic: float = None
    financial_integrity_optimistic: float = None
    operational_independence_optimistic: float = None
    customer_risk_optimistic: float = None
    management_team_optimistic: float = None
    growth_drivers_optimistic: float = None

    def __post_init__(self):
        for attr in ['revenue_quality', 'financial_integrity', 'operational_independence',
                     'customer_risk', 'management_team', 'growth_drivers']:
            if getattr(self, f"{attr}_conservative") is None:
                setattr(self, f"{attr}_conservative", getattr(self, attr))
            if getattr(self, f"{attr}_optimistic") is None:
                setattr(self, f"{attr}_optimistic", getattr(self, attr))


WEIGHTS = SCORING_RULES.category_weights


@dataclass
class DRSResult:
    base_drs: float
    conservative_drs: float
    optimistic_drs: float
    tier: DRSTier
    category_contributions: dict[str, float]


def _weighted_sum(scores: dict[str, float], weights: dict[str, float]) -> float:
    return sum(scores[k] * weights[k] for k in weights)


def _classify_tier(drs: float) -> DRSTier:
    for threshold, tier_name in SCORING_RULES.drs_tier_thresholds:
        if drs >= threshold:
            return DRSTier[tier_name]
    return DRSTier.PRE_DILIGENCE


def compute_drs(
    scores: CategoryScores,
    weights: dict[str, float] | None = None,
) -> DRSResult:
    w = weights if weights is not None else WEIGHTS

    base_scores = {
        "revenue_quality":          scores.revenue_quality,
        "financial_integrity":      scores.financial_integrity,
        "operational_independence": scores.operational_independence,
        "customer_risk":            scores.customer_risk,
        "management_team":          scores.management_team,
        "growth_drivers":           scores.growth_drivers,
    }
    conservative_scores = {k: getattr(scores, f"{k}_conservative") for k in base_scores}
    optimistic_scores   = {k: getattr(scores, f"{k}_optimistic")   for k in base_scores}

    base_drs         = _weighted_sum(base_scores, w)
    conservative_drs = _weighted_sum(conservative_scores, w)
    optimistic_drs   = _weighted_sum(optimistic_scores, w)
    contributions    = {k: base_scores[k] * w[k] for k in w}

    return DRSResult(
        base_drs=round(base_drs, 1),
        conservative_drs=round(conservative_drs, 1),
        optimistic_drs=round(optimistic_drs, 1),
        tier=_classify_tier(base_drs),
        category_contributions=contributions,
    )


# ============================================================================
# A10 — Enterprise Value
# ============================================================================

if TYPE_CHECKING:
    from app.analytics.market_benchmarks import MarketMultipleContext

MULTIPLE_TABLE: dict[DRSTier, tuple[float, float]] = {
    DRSTier[key]: value for key, value in SCORING_RULES.enterprise_multiples.items()
}


@dataclass
class EnterpriseValueResult:
    defensible_ebitda: Decimal
    multiple_floor: float
    multiple_ceiling: float
    ev_floor: Decimal
    ev_ceiling: Decimal
    ev_midpoint: Decimal
    drs_tier: DRSTier
    multiple_basis: str = "drs_tier_heuristic"
    drs_multiple_floor: float = 0.0
    drs_multiple_ceiling: float = 0.0
    market_reference: Optional[dict] = None


def compute_enterprise_value(
    defensible_ebitda: Decimal,
    drs_tier: DRSTier,
    industry_override: tuple[float, float] | None = None,
    market_context: Optional["MarketMultipleContext"] = None,
) -> EnterpriseValueResult:
    d_lo, d_hi = MULTIPLE_TABLE[drs_tier]
    market_reference: Optional[dict] = None
    multiple_basis = "drs_tier_heuristic"

    if industry_override is not None:
        lo, hi = industry_override[0], industry_override[1]
        multiple_basis = "market_median"
    elif market_context is not None:
        from app.analytics.market_benchmarks import market_context_to_reference_dict
        m_lo = float(market_context.market_floor)
        m_hi = float(market_context.market_ceiling)
        lo = (d_lo + m_lo) / 2.0
        hi = (d_hi + m_hi) / 2.0
        multiple_basis = "blended"
        market_reference = market_context_to_reference_dict(market_context)
    else:
        lo, hi = d_lo, d_hi

    ev_floor    = defensible_ebitda * Decimal(str(lo))
    ev_ceiling  = defensible_ebitda * Decimal(str(hi))
    ev_midpoint = (ev_floor + ev_ceiling) / 2

    return EnterpriseValueResult(
        defensible_ebitda=defensible_ebitda,
        multiple_floor=lo,
        multiple_ceiling=hi,
        ev_floor=ev_floor,
        ev_ceiling=ev_ceiling,
        ev_midpoint=ev_midpoint,
        drs_tier=drs_tier,
        multiple_basis=multiple_basis,
        drs_multiple_floor=d_lo,
        drs_multiple_ceiling=d_hi,
        market_reference=market_reference,
    )


def format_ev_valuation_summary(ev: EnterpriseValueResult) -> str:
    tier = ev.drs_tier.value
    if ev.multiple_basis == "drs_tier_heuristic":
        return (
            f"DRS tier {tier}: internal multiple band {ev.drs_multiple_floor}x-{ev.drs_multiple_ceiling}x "
            "(platform heuristic; not a live PitchBook/IBBA pull)."
        )
    if ev.multiple_basis == "market_median":
        return f"DRS tier {tier} with advisor multiple override {ev.multiple_floor}x-{ev.multiple_ceiling}x."
    if ev.multiple_basis == "blended" and ev.market_reference:
        seg = ev.market_reference.get("segment_label") or "selected segment"
        rel = ev.market_reference.get("release_label") or "market release"
        return (
            f"Blended DRS tier {tier} with curated market reference ({rel}; {seg}). "
            f"Applied range {ev.multiple_floor}x-{ev.multiple_ceiling}x EBITDA."
        )
    return f"EV band {ev.multiple_floor}x-{ev.multiple_ceiling}x EBITDA (DRS tier {tier})."


# ============================================================================
# A11 — Value Gap Analysis
# ============================================================================

_TARGET_SCORE       = SCORING_RULES.value_gap_target_score
_DRS_MULTIPLE_ANCHORS = SCORING_RULES.drs_multiple_anchors

CATEGORY_META = {
    "revenue_quality":          {"label": "Revenue Quality",          "weight": WEIGHTS["revenue_quality"]},
    "financial_integrity":      {"label": "Financial Integrity",      "weight": WEIGHTS["financial_integrity"]},
    "operational_independence": {"label": "Operational Independence", "weight": WEIGHTS["operational_independence"]},
    "customer_risk":            {"label": "Customer Risk",            "weight": WEIGHTS["customer_risk"]},
    "management_team":          {"label": "Management & Team",        "weight": WEIGHTS["management_team"]},
    "growth_drivers":           {"label": "Growth Drivers",          "weight": WEIGHTS["growth_drivers"]},
}


def _drs_to_multiple(drs: float) -> float:
    for i in range(len(_DRS_MULTIPLE_ANCHORS) - 1):
        lo_drs, lo_m = _DRS_MULTIPLE_ANCHORS[i]
        hi_drs, hi_m = _DRS_MULTIPLE_ANCHORS[i + 1]
        if lo_drs <= drs <= hi_drs:
            t = (drs - lo_drs) / (hi_drs - lo_drs)
            return lo_m + t * (hi_m - lo_m)
    return _DRS_MULTIPLE_ANCHORS[-1][1]


def _continuous_ev_mid(drs: float, ebitda: float) -> float:
    return ebitda * _drs_to_multiple(drs)


@dataclass
class GapItem:
    category: str
    label: str
    current_score: float
    target_score: float
    score_gap: float
    drs_uplift: float
    ev_uplift: float
    priority: int
    category_weight: float = 0.0
    ebitda_used: float = 0.0
    drs_before: float = 0.0
    drs_after_sim: float = 0.0
    multiple_before: float = 0.0
    multiple_after: float = 0.0

    def to_dict(self) -> dict:
        return {
            "category":      self.category,
            "label":         self.label,
            "current_score": self.current_score,
            "target_score":  self.target_score,
            "score_gap":     self.score_gap,
            "drs_uplift":    round(self.drs_uplift, 2),
            "ev_uplift":     round(self.ev_uplift, 0),
            "priority":      self.priority,
            "methodology": {
                "summary": (
                    "Illustrative marginal enterprise value if only this category were raised to the "
                    f"target score ({self.target_score}), holding other categories constant."
                ),
                "formula": "ev_uplift = EV_mid(DRS_simulated) - EV_mid(DRS_current); "
                "EV_mid(DRS) = EBITDA × interpolated_multiple(DRS) from internal anchor curve.",
                "ebitda_ttm_used":              round(self.ebitda_used, 2),
                "category_weight_in_drs":       round(self.category_weight * 100, 1),
                "drs_before":                   round(self.drs_before, 2),
                "drs_after_category_at_target": round(self.drs_after_sim, 2),
                "multiple_mid_before":          round(self.multiple_before, 3),
                "multiple_mid_after":           round(self.multiple_after, 3),
            },
        }


@dataclass
class ValueGapResult:
    company_id: int
    current_drs: float
    potential_drs: float
    current_ev_midpoint: float
    potential_ev_midpoint: float
    total_value_gap: float
    gaps: list[GapItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id":            self.company_id,
            "current_drs":           self.current_drs,
            "potential_drs":         self.potential_drs,
            "current_ev_midpoint":   round(self.current_ev_midpoint, 0),
            "potential_ev_midpoint": round(self.potential_ev_midpoint, 0),
            "total_value_gap":       round(self.total_value_gap, 0),
            "gaps":                  [g.to_dict() for g in self.gaps],
        }


def compute_value_gap(
    company_id: int,
    current_scores: dict[str, float],
    ebitda: float,
) -> ValueGapResult:
    def _build_cat_scores(overrides: dict[str, float] | None = None) -> CategoryScores:
        merged = {**current_scores, **(overrides or {})}
        return CategoryScores(
            revenue_quality=merged.get("revenue_quality", 50),
            financial_integrity=merged.get("financial_integrity", 50),
            operational_independence=merged.get("operational_independence", 50),
            customer_risk=merged.get("customer_risk", 50),
            management_team=merged.get("management_team", 50),
            growth_drivers=merged.get("growth_drivers", 50),
        )

    def _ev_midpoint(cat_scores: CategoryScores) -> float:
        return _continuous_ev_mid(compute_drs(cat_scores).base_drs, ebitda)

    current_cat  = _build_cat_scores()
    current_drs  = compute_drs(current_cat)
    current_mid  = _ev_midpoint(current_cat)

    potential_overrides = {k: max(v, _TARGET_SCORE) for k, v in current_scores.items()}
    potential_cat = _build_cat_scores(potential_overrides)
    potential_drs = compute_drs(potential_cat)
    potential_mid = _ev_midpoint(potential_cat)

    gaps: list[GapItem] = []
    for key, meta in CATEGORY_META.items():
        score = current_scores.get(key, 50.0)
        if score >= _TARGET_SCORE:
            continue

        sim_scores = {**current_scores, key: _TARGET_SCORE}
        sim_cat    = _build_cat_scores(sim_scores)
        sim_drs    = compute_drs(sim_cat)
        sim_mid    = _ev_midpoint(sim_cat)

        gaps.append(GapItem(
            category=key,
            label=meta["label"],
            current_score=round(score, 1),
            target_score=_TARGET_SCORE,
            score_gap=round(_TARGET_SCORE - score, 1),
            drs_uplift=sim_drs.base_drs - current_drs.base_drs,
            ev_uplift=sim_mid - current_mid,
            priority=0,
            category_weight=meta["weight"],
            ebitda_used=ebitda,
            drs_before=current_drs.base_drs,
            drs_after_sim=sim_drs.base_drs,
            multiple_before=_drs_to_multiple(current_drs.base_drs),
            multiple_after=_drs_to_multiple(sim_drs.base_drs),
        ))

    gaps.sort(key=lambda g: g.ev_uplift, reverse=True)
    for i, g in enumerate(gaps):
        g.priority = i + 1

    return ValueGapResult(
        company_id=company_id,
        current_drs=current_drs.base_drs,
        potential_drs=potential_drs.base_drs,
        current_ev_midpoint=current_mid,
        potential_ev_midpoint=potential_mid,
        total_value_gap=potential_mid - current_mid,
        gaps=gaps,
    )


# ============================================================================
# EBITDA Basis — shared ontology proxy
# ============================================================================

from sqlalchemy.orm import Session
from app.analytics.financial_analytics import compute_metrics
from app.ontology.models import Company

DEFAULT_MARKET_RATE = Decimal("120000")


def ebitda_basis_for_company(company_id: int, db: Session) -> dict:
    m  = compute_metrics(company_id, db)
    co = db.query(Company).filter(Company.id == company_id).first()
    proxy    = float(m.ebitda_ttm)
    da       = float(co.depreciation_amortization_ttm or 0) if co else 0.0
    interest = float(co.interest_expense_ttm or 0) if co else 0.0
    tax      = float(co.income_tax_expense_ttm or 0) if co else 0.0
    mr = float(co.market_rate_replacement_annual) if co and co.market_rate_replacement_annual is not None else float(DEFAULT_MARKET_RATE)
    return {
        "ebitda_proxy_ttm":              proxy,
        "ebitda_normalized_ttm":         proxy + da,
        "depreciation_amortization_ttm": da,
        "interest_expense_ttm":          interest,
        "income_tax_expense_ttm":        tax,
        "market_rate_replacement_annual": mr,
    }


# ============================================================================
# Owner Personal Readiness (PRE)
# ============================================================================


@dataclass
class PREDimension:
    name: str
    score: float
    weight: float
    label: str
    detail: str


@dataclass
class PREResult:
    pre_score: float
    tier: str
    dimensions: list[PREDimension] = field(default_factory=list)
    summary: str = ""


def _pre_tier(score: float) -> str:
    if score >= 80: return "Aligned"
    if score >= 65: return "Mostly Ready"
    if score >= 45: return "Moderate Gap"
    return "Critical Gap"


def compute_owner_readiness(
    *,
    exit_timeline: str | None = None,
    target_valuation: float | None = None,
    personal_financial_gap: float | None = None,
    transaction_type: str | None = None,
    post_exit_plans: str | None = None,
    owner_motivations: list[str] | None = None,
    ev_midpoint: float | None = None,
    owner_hours_per_week: float | None = None,
    key_person_revenue_pct: float | None = None,
    sop_pct: float | None = None,
    automation_pct: float | None = None,
) -> PREResult:
    dims: list[PREDimension] = []

    # 1. Financial Readiness (35%)
    fin_score, fin_detail = 50.0, "No financial target data entered"
    if target_valuation and ev_midpoint and ev_midpoint > 0:
        ratio = ev_midpoint / target_valuation
        if ratio >= 0.90:   fin_score, fin_detail = 95.0, f"EV midpoint (${ev_midpoint:,.0f}) meets or exceeds target"
        elif ratio >= 0.75: fin_score, fin_detail = 75.0, f"EV midpoint is {ratio*100:.0f}% of target — moderate gap"
        elif ratio >= 0.50: fin_score, fin_detail = 50.0, f"EV midpoint is {ratio*100:.0f}% of target — significant gap"
        else:               fin_score, fin_detail = 25.0, f"EV midpoint is {ratio*100:.0f}% of target — substantial shortfall"
        if personal_financial_gap and personal_financial_gap > 0:
            fin_score = max(0.0, fin_score - 10.0)
            fin_detail += f"; personal financial gap of ${personal_financial_gap:,.0f} remains"
    elif target_valuation:
        fin_score, fin_detail = 40.0, "Target set but EV not yet computed — upload financials"
    dims.append(PREDimension("Financial Readiness", fin_score, 0.35,
        "Aligned" if fin_score >= 80 else "Gap Exists" if fin_score >= 50 else "Critical", fin_detail))

    # 2. Timeline Realism (25%)
    tl_score, tl_detail = 40.0, "No exit timeline entered"
    if exit_timeline:
        tl_lower = exit_timeline.lower()
        if any(x in tl_lower for x in ["1 year", "12 month", "asap", "immediate"]):
            tl_score, tl_detail = 60.0, "Short timeline — ensure DRS improvements are complete before going to market"
        elif any(x in tl_lower for x in ["2 year", "18 month", "3 year"]):
            tl_score, tl_detail = 90.0, "Timeline provides adequate preparation runway"
        elif any(x in tl_lower for x in ["4 year", "5 year", "long"]):
            tl_score, tl_detail = 80.0, "Long timeline — stay engaged to avoid score drift"
        else:
            tl_score, tl_detail = 70.0, f"Timeline defined: {exit_timeline}"
        if transaction_type:
            tl_score = min(100.0, tl_score + 5.0)
            tl_detail += f"; preferred transaction type: {transaction_type}"
    dims.append(PREDimension("Timeline Realism", tl_score, 0.25,
        "On Track" if tl_score >= 75 else "Needs Definition" if tl_score < 50 else "Review", tl_detail))

    # 3. Business Independence (25%)
    bi_scores, bi_notes = [], []
    if owner_hours_per_week is not None:
        h = float(owner_hours_per_week)
        s = 95.0 if h <= 10 else 75.0 if h <= 20 else 50.0 if h <= 35 else 20.0
        bi_scores.append(s); bi_notes.append(f"{h:.0f} hrs/wk" + (" — high dependency" if h > 35 else ""))
    if key_person_revenue_pct is not None:
        k = float(key_person_revenue_pct)
        s = 95.0 if k <= 10 else 70.0 if k <= 25 else 45.0 if k <= 40 else 20.0
        bi_scores.append(s); bi_notes.append(f"{k:.0f}% key-person rev" + (" risk" if k > 25 else ""))
    if sop_pct is not None:
        bi_scores.append(min(100.0, float(sop_pct) * 1.1)); bi_notes.append(f"{sop_pct:.0f}% SOP coverage")
    if automation_pct is not None:
        bi_scores.append(min(100.0, float(automation_pct) * 1.1)); bi_notes.append(f"{automation_pct:.0f}% automated")
    bi_score  = sum(bi_scores) / len(bi_scores) if bi_scores else 40.0
    bi_detail = "; ".join(bi_notes) if bi_notes else "No operational independence data entered"
    dims.append(PREDimension("Business Independence", bi_score, 0.25,
        "Independent" if bi_score >= 75 else "Partial" if bi_score >= 50 else "Owner-Dependent", bi_detail))

    # 4. Motivation Clarity (15%)
    mot_score = 30.0
    mot_parts = []
    if owner_motivations and len(owner_motivations) > 0:
        mot_score += 40.0; mot_parts.append(f"{len(owner_motivations)} motivation(s) documented")
    if post_exit_plans:
        mot_score += 30.0; mot_parts.append("post-exit plan defined")
    mot_score = min(100.0, mot_score)
    dims.append(PREDimension("Motivation Clarity", mot_score, 0.15,
        "Clear" if mot_score >= 70 else "Partial" if mot_score >= 40 else "Undefined",
        "; ".join(mot_parts) if mot_parts else "No motivations or post-exit plan entered"))

    pre_score = sum(d.score * d.weight for d in dims)
    tier      = _pre_tier(pre_score)
    summary   = (
        f"Owner readiness: {pre_score:.0f}/100 ({tier}). "
        f"Strongest: {max(dims, key=lambda d: d.score).name}. "
        f"Focus area: {min(dims, key=lambda d: d.score).name}."
    )
    return PREResult(pre_score=round(pre_score, 1), tier=tier, dimensions=dims, summary=summary)
