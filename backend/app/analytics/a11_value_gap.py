"""
A11 — Value Gap Analysis (Blueprint II §A11)

Quantifies the spread between current enterprise value and achievable EV if
identified diligence gaps are resolved. Produces:
  - Current EV (from A10)
  - Potential EV at each improvement scenario
  - Per-category uplift opportunity ($ and score points needed)
  - Priority ranking of initiatives by EV impact

Gap formula:
  For each weak category (score < 75):
    simulated_score = min(score + improvement_delta, 85)
    new_DRS         = weighted composite with simulated score
    new_EV          = compute_ev(ebitda, new_tier)
    uplift          = new_EV.midpoint - current_EV.midpoint
"""

from __future__ import annotations
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from app.analytics.a9_drs_composite import CategoryScores, compute_drs, WEIGHTS, DRSTier
from app.analytics.a10_enterprise_value import compute_enterprise_value


# Target score for a "resolved" category (investment grade threshold)
_TARGET_SCORE = 80.0

# Category display metadata
CATEGORY_META = {
    "revenue_quality":          {"label": "Revenue Quality",          "weight": 0.25},
    "financial_integrity":      {"label": "Financial Integrity",      "weight": 0.20},
    "operational_independence": {"label": "Operational Independence", "weight": 0.20},
    "customer_risk":            {"label": "Customer Risk",            "weight": 0.15},
    "management_team":          {"label": "Management & Team",        "weight": 0.10},
    "growth_drivers":           {"label": "Growth Drivers",           "weight": 0.10},
}


@dataclass
class GapItem:
    category: str
    label: str
    current_score: float
    target_score: float
    score_gap: float
    drs_uplift: float          # DRS points gained if resolved
    ev_uplift: float           # $ uplift at midpoint EV
    priority: int              # 1 = highest

    def to_dict(self) -> dict:
        return {
            "category":     self.category,
            "label":        self.label,
            "current_score": self.current_score,
            "target_score":  self.target_score,
            "score_gap":     self.score_gap,
            "drs_uplift":    round(self.drs_uplift, 2),
            "ev_uplift":     round(self.ev_uplift, 0),
            "priority":      self.priority,
        }


@dataclass
class ValueGapResult:
    company_id: int
    current_drs: float
    potential_drs: float          # if all gaps resolved to target
    current_ev_midpoint: float
    potential_ev_midpoint: float
    total_value_gap: float
    gaps: list[GapItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_id":          self.company_id,
            "current_drs":         self.current_drs,
            "potential_drs":       self.potential_drs,
            "current_ev_midpoint": round(self.current_ev_midpoint, 0),
            "potential_ev_midpoint": round(self.potential_ev_midpoint, 0),
            "total_value_gap":     round(self.total_value_gap, 0),
            "gaps":                [g.to_dict() for g in self.gaps],
        }


def compute_value_gap(
    company_id: int,
    current_scores: dict[str, float],  # {category_key: composite_score}
    ebitda: float,
) -> ValueGapResult:
    """
    Compute the value gap from current scores to target (all categories ≥ 80).
    current_scores: dict of {category_key: float 0-100}
    ebitda: defensible EBITDA in dollars
    """
    ebitda_dec = Decimal(str(round(ebitda, 2)))

    def _build_cat_scores(overrides: dict[str, float] = {}) -> CategoryScores:
        merged = {**current_scores, **overrides}
        return CategoryScores(
            revenue_quality=merged.get("revenue_quality", 50),
            financial_integrity=merged.get("financial_integrity", 50),
            operational_independence=merged.get("operational_independence", 50),
            customer_risk=merged.get("customer_risk", 50),
            management_team=merged.get("management_team", 50),
            growth_drivers=merged.get("growth_drivers", 50),
        )

    def _ev_midpoint(cat_scores: CategoryScores) -> float:
        drs = compute_drs(cat_scores)
        ev  = compute_enterprise_value(ebitda_dec, drs.tier)
        return float(ev.ev_midpoint)

    # Current state
    current_cat = _build_cat_scores()
    current_drs = compute_drs(current_cat)
    current_mid = _ev_midpoint(current_cat)

    # Potential state (all gaps resolved to target)
    potential_overrides = {
        k: max(v, _TARGET_SCORE)
        for k, v in current_scores.items()
    }
    potential_cat = _build_cat_scores(potential_overrides)
    potential_drs = compute_drs(potential_cat)
    potential_mid = _ev_midpoint(potential_cat)

    # Per-category gap analysis
    gaps: list[GapItem] = []
    for key, meta in CATEGORY_META.items():
        score = current_scores.get(key, 50.0)
        if score >= _TARGET_SCORE:
            continue   # already at target — no gap

        # Simulate resolving just this category
        sim_scores = {**current_scores, key: _TARGET_SCORE}
        sim_cat = _build_cat_scores(sim_scores)
        sim_drs = compute_drs(sim_cat)
        sim_mid = _ev_midpoint(sim_cat)

        drs_uplift = sim_drs.base_drs - current_drs.base_drs
        ev_uplift  = sim_mid - current_mid

        gaps.append(GapItem(
            category=key,
            label=meta["label"],
            current_score=round(score, 1),
            target_score=_TARGET_SCORE,
            score_gap=round(_TARGET_SCORE - score, 1),
            drs_uplift=drs_uplift,
            ev_uplift=ev_uplift,
            priority=0,  # set after sort
        ))

    # Sort by EV uplift descending
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
