"""
A9 — DRS Composite Score (Blueprint II §A9)

Combines all six category scores into the single Diligence Readiness Score (0–100).
Also produces Conservative / Base / Optimistic confidence bands.

DRS Weights:
  Revenue Quality        25%   A3
  Financial Integrity    20%   A8
  Operational Independence 20% A4
  Customer Risk          15%   A5
  Management & Team      10%   A6
  Growth Drivers         10%   A7
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum

from app.core.scoring_rules import SCORING_RULES

class DRSTier(str, Enum):
    INSTITUTIONAL  = "Institutional Grade"   # 85–100
    INVESTMENT     = "Investment Grade"       # 70–84
    CONDITIONAL    = "Conditional"            # 55–69
    HIGH_RISK      = "High Risk"              # 40–54
    PRE_DILIGENCE  = "Pre-Diligence Required" # <40


@dataclass
class CategoryScores:
    revenue_quality: float          # 0–100  (A3)
    financial_integrity: float      # 0–100  (A8)
    operational_independence: float # 0–100  (A4)
    customer_risk: float            # 0–100  (A5)
    management_team: float          # 0–100  (A6)
    growth_drivers: float           # 0–100  (A7)

    # Confidence variants (conservative = low-confidence inputs at lower bound)
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
        # Default conservative/optimistic to base if not provided
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
    """
    Compute the DRS composite.

    Pass ``weights`` to apply a buyer-type profile (e.g. BUYER_WEIGHT_PROFILES["pe"]).
    When omitted, the default SCORING_RULES.category_weights are used.
    """
    w = weights if weights is not None else WEIGHTS

    base_scores = {
        "revenue_quality":          scores.revenue_quality,
        "financial_integrity":      scores.financial_integrity,
        "operational_independence": scores.operational_independence,
        "customer_risk":            scores.customer_risk,
        "management_team":          scores.management_team,
        "growth_drivers":           scores.growth_drivers,
    }
    conservative_scores = {
        "revenue_quality":          scores.revenue_quality_conservative,
        "financial_integrity":      scores.financial_integrity_conservative,
        "operational_independence": scores.operational_independence_conservative,
        "customer_risk":            scores.customer_risk_conservative,
        "management_team":          scores.management_team_conservative,
        "growth_drivers":           scores.growth_drivers_conservative,
    }
    optimistic_scores = {
        "revenue_quality":          scores.revenue_quality_optimistic,
        "financial_integrity":      scores.financial_integrity_optimistic,
        "operational_independence": scores.operational_independence_optimistic,
        "customer_risk":            scores.customer_risk_optimistic,
        "management_team":          scores.management_team_optimistic,
        "growth_drivers":           scores.growth_drivers_optimistic,
    }

    base_drs         = _weighted_sum(base_scores, w)
    conservative_drs = _weighted_sum(conservative_scores, w)
    optimistic_drs   = _weighted_sum(optimistic_scores, w)

    contributions = {k: base_scores[k] * w[k] for k in w}

    return DRSResult(
        base_drs=round(base_drs, 1),
        conservative_drs=round(conservative_drs, 1),
        optimistic_drs=round(optimistic_drs, 1),
        tier=_classify_tier(base_drs),
        category_contributions=contributions,
    )
