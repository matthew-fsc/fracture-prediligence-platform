from app.analytics.a9_drs_composite import CategoryScores, DRSTier, compute_drs
from app.analytics.a10_enterprise_value import MULTIPLE_TABLE
from app.core.scoring_rules import SCORING_RULES


def test_drs_weights_sum_to_one():
    total = sum(SCORING_RULES.category_weights.values())
    assert round(total, 6) == 1.0


def test_tier_classification_from_rules():
    scores = CategoryScores(
        revenue_quality=90,
        financial_integrity=90,
        operational_independence=90,
        customer_risk=90,
        management_team=90,
        growth_drivers=90,
    )
    drs = compute_drs(scores)
    assert drs.tier == DRSTier.INSTITUTIONAL


def test_enterprise_multiple_table_matches_rules():
    for tier in DRSTier:
        assert tier in MULTIPLE_TABLE
