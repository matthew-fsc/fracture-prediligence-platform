"""
Unified confidence model for DRS and category scores.

Aggregates per-category data_confidence levels (HIGH / MEDIUM / LOW) into a
single ConfidenceSummary that includes:
  - overall_level          – worst-case level across all categories
  - score_range            – {conservative, base, optimistic} DRS band
  - band_width             – optimistic − conservative (uncertainty spread)
  - category_levels        – per-category confidence levels
  - factors                – human-readable explanations for reduced confidence
  - low_categories         – categories with LOW confidence
  - medium_categories      – categories with MEDIUM confidence

Band multipliers
----------------
Multipliers are applied to individual category scores before the weighted DRS
sum is computed:

  HIGH   → 1.00 / 1.00   (no adjustment; data fully supports the score)
  MEDIUM → 0.97 / 1.02   (small haircut / uplift; limited but plausible data)
  LOW    → 0.90 / 1.05   (wider band; sparse data warrants more uncertainty)

The LOW multipliers match the legacy DRS_CONFIDENCE_LOW_MULTIPLIER (0.90) and
DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER (1.05) settings so existing behaviour
is preserved for low-confidence categories.

Usage
-----
    from app.core.confidence import build_confidence_summary, BAND_MULTIPLIERS

    # In analytics route, when constructing CategoryScores:
    def _mult(level: str, variant: str) -> float:
        return BAND_MULTIPLIERS.get(level, BAND_MULTIPLIERS["MEDIUM"])[variant]

    cat = CategoryScores(
        revenue_quality=adj_scores["revenue_quality"],
        revenue_quality_conservative=adj_scores["revenue_quality"] * _mult(rev.data_confidence, "conservative"),
        revenue_quality_optimistic=min(100, adj_scores["revenue_quality"] * _mult(rev.data_confidence, "optimistic")),
        ...
    )
    drs = compute_drs(cat)
    summary = build_confidence_summary(category_scores_dict, drs.base_drs, drs.conservative_drs, drs.optimistic_drs)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Literal

ConfidenceLevel = Literal["HIGH", "MEDIUM", "LOW"]

# ---------------------------------------------------------------------------
# Band multipliers applied per-category when computing conservative / optimistic
# DRS variants.  Keyed by confidence level → {conservative, optimistic}.
# ---------------------------------------------------------------------------
BAND_MULTIPLIERS: dict[str, dict[str, float]] = {
    "HIGH":   {"conservative": 1.00, "optimistic": 1.00},
    "MEDIUM": {"conservative": 0.97, "optimistic": 1.02},
    "LOW":    {"conservative": 0.90, "optimistic": 1.05},
}

# Human-readable category names used in factor messages
CATEGORY_LABELS: dict[str, str] = {
    "revenue_quality":          "Revenue Quality",
    "financial_integrity":      "Financial Integrity",
    "operational_independence": "Operational Independence",
    "customer_risk":            "Customer Risk",
    "management_team":          "Management & Team",
    "growth_drivers":           "Growth Drivers",
}

# Minimum data thresholds driving each category's confidence level
CATEGORY_THRESHOLDS: dict[str, str] = {
    "revenue_quality":          "HIGH requires ≥50 revenue rows; MEDIUM requires ≥12",
    "financial_integrity":      "HIGH requires ≥100 financial records; MEDIUM requires ≥24",
    "operational_independence": "HIGH requires ≥10 employee records; MEDIUM requires ≥3",
    "customer_risk":            "HIGH requires ≥20 customers; MEDIUM requires ≥5",
    "management_team":          "HIGH requires ≥5 staff records; MEDIUM requires ≥2",
    "growth_drivers":           "HIGH requires multi-year revenue history and customer data",
}


@dataclass
class ConfidenceSummary:
    overall_level: str                  # "HIGH" | "MEDIUM" | "LOW"
    score_range: dict[str, float]       # {conservative, base, optimistic}
    band_width: float                   # optimistic − conservative
    category_levels: dict[str, str]     # {category_key: "HIGH"|"MEDIUM"|"LOW"}
    factors: list[str]                  # human-readable explanations
    low_categories: list[str]           # category keys with LOW confidence
    medium_categories: list[str]        # category keys with MEDIUM confidence

    def to_dict(self) -> dict:
        return {
            "overall_level":     self.overall_level,
            "score_range":       self.score_range,
            "band_width":        round(self.band_width, 1),
            "category_levels":   self.category_levels,
            "factors":           self.factors,
            "low_categories":    self.low_categories,
            "medium_categories": self.medium_categories,
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def overall_confidence_level(levels: list[str]) -> str:
    """Return the worst-case confidence level across all supplied levels."""
    if "LOW" in levels:
        return "LOW"
    if "MEDIUM" in levels:
        return "MEDIUM"
    return "HIGH"


def band_multiplier(level: str, variant: str) -> float:
    """
    Return the score multiplier for *variant* ('conservative' or 'optimistic')
    given a data_confidence *level* string.  Unknown levels default to MEDIUM.
    """
    return BAND_MULTIPLIERS.get(level, BAND_MULTIPLIERS["MEDIUM"])[variant]


# ---------------------------------------------------------------------------
# Primary builder
# ---------------------------------------------------------------------------

def build_confidence_summary(
    category_scores: dict[str, dict],
    drs_base: float,
    drs_conservative: float,
    drs_optimistic: float,
) -> ConfidenceSummary:
    """
    Produce a ConfidenceSummary from per-category analytics results and the
    already-computed DRS band values.

    Parameters
    ----------
    category_scores : dict[str, dict]
        Mapping of category key → analytics module .to_dict() output.  Each
        entry is expected to contain a ``data_confidence`` field.
    drs_base, drs_conservative, drs_optimistic : float
        Already-computed DRS variants from a9_drs_composite.compute_drs().
    """
    levels: dict[str, str] = {}
    for key in CATEGORY_LABELS:
        cat_data = category_scores.get(key, {})
        levels[key] = cat_data.get("data_confidence", "MEDIUM")

    overall = overall_confidence_level(list(levels.values()))
    low_cats = [k for k, v in levels.items() if v == "LOW"]
    medium_cats = [k for k, v in levels.items() if v == "MEDIUM"]

    factors: list[str] = []
    for k in low_cats:
        label = CATEGORY_LABELS[k]
        hint = CATEGORY_THRESHOLDS.get(k, "")
        factors.append(
            f"Insufficient data for {label} — score band widened significantly. {hint}."
        )
    for k in medium_cats:
        label = CATEGORY_LABELS[k]
        hint = CATEGORY_THRESHOLDS.get(k, "")
        factors.append(
            f"Limited data for {label} — minor uncertainty applied. {hint}."
        )
    if not factors:
        factors = ["All categories have sufficient data; confidence band is tight."]

    band_width = round(drs_optimistic - drs_conservative, 1)

    return ConfidenceSummary(
        overall_level=overall,
        score_range={
            "conservative": round(drs_conservative, 1),
            "base":         round(drs_base, 1),
            "optimistic":   round(drs_optimistic, 1),
        },
        band_width=band_width,
        category_levels=levels,
        factors=factors,
        low_categories=low_cats,
        medium_categories=medium_cats,
    )
