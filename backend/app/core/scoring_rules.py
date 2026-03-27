from dataclasses import dataclass


@dataclass(frozen=True)
class ScoringRulesV1:
    category_weights: dict[str, float]
    drs_tier_thresholds: list[tuple[float, str]]
    enterprise_multiples: dict[str, tuple[float, float]]
    value_gap_target_score: float
    drs_multiple_anchors: list[tuple[float, float]]
    qual_owner_hours_thresholds: list[tuple[float, float]]
    qual_pipeline_ratio_thresholds: list[tuple[float, float]]


SCORING_RULES_VERSION = "v1"

SCORING_RULES = ScoringRulesV1(
    category_weights={
        "revenue_quality": 0.25,
        "financial_integrity": 0.20,
        "operational_independence": 0.20,
        "customer_risk": 0.15,
        "management_team": 0.10,
        "growth_drivers": 0.10,
    },
    drs_tier_thresholds=[
        (85.0, "INSTITUTIONAL"),
        (70.0, "INVESTMENT"),
        (55.0, "CONDITIONAL"),
        (40.0, "HIGH_RISK"),
        (0.0, "PRE_DILIGENCE"),
    ],
    enterprise_multiples={
        "INSTITUTIONAL": (7.0, 9.0),
        "INVESTMENT": (5.0, 7.0),
        "CONDITIONAL": (3.5, 5.0),
        "HIGH_RISK": (2.5, 3.5),
        "PRE_DILIGENCE": (2.5, 3.0),
    },
    value_gap_target_score=80.0,
    drs_multiple_anchors=[(0, 2.0), (40, 3.0), (55, 4.25), (70, 6.0), (85, 8.0), (100, 9.0)],
    qual_owner_hours_thresholds=[(5, 90.0), (15, 75.0), (25, 55.0), (40, 35.0), (float("inf"), 10.0)],
    qual_pipeline_ratio_thresholds=[(1.5, 95.0), (1.0, 80.0), (0.5, 60.0), (0.25, 40.0), (0.0, 20.0)],
)
