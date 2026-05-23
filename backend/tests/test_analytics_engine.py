"""Tests for Blueprint II analytics engine modules A9 (DRS) and A10 (EV)."""

from decimal import Decimal

import pytest

from app.analytics.a9_drs_composite import (
    CategoryScores,
    DRSTier,
    DRSResult,
    compute_drs,
)
from app.analytics.a10_enterprise_value import compute_enterprise_value


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _scores(**kwargs) -> CategoryScores:
    defaults = dict(
        revenue_quality=70.0,
        financial_integrity=70.0,
        operational_independence=70.0,
        customer_risk=70.0,
        management_team=70.0,
        growth_drivers=70.0,
    )
    defaults.update(kwargs)
    return CategoryScores(**defaults)


# ---------------------------------------------------------------------------
# A9 — DRS Composite
# ---------------------------------------------------------------------------

class TestDRSComposite:
    def test_all_100_yields_100(self):
        result = compute_drs(_scores(
            revenue_quality=100,
            financial_integrity=100,
            operational_independence=100,
            customer_risk=100,
            management_team=100,
            growth_drivers=100,
        ))
        assert result.base_drs == pytest.approx(100.0)

    def test_all_zero_yields_zero(self):
        result = compute_drs(_scores(
            revenue_quality=0,
            financial_integrity=0,
            operational_independence=0,
            customer_risk=0,
            management_team=0,
            growth_drivers=0,
        ))
        assert result.base_drs == pytest.approx(0.0)

    def test_weights_sum_to_100(self):
        from app.analytics.a9_drs_composite import WEIGHTS
        assert sum(WEIGHTS.values()) == pytest.approx(1.0)

    def test_institutional_tier_at_90(self):
        result = compute_drs(_scores(
            revenue_quality=90, financial_integrity=90, operational_independence=90,
            customer_risk=90, management_team=90, growth_drivers=90,
        ))
        assert result.tier == DRSTier.INSTITUTIONAL

    def test_investment_tier_at_75(self):
        result = compute_drs(_scores(
            revenue_quality=75, financial_integrity=75, operational_independence=75,
            customer_risk=75, management_team=75, growth_drivers=75,
        ))
        assert result.tier == DRSTier.INVESTMENT

    def test_pre_diligence_tier_at_30(self):
        result = compute_drs(_scores(
            revenue_quality=30, financial_integrity=30, operational_independence=30,
            customer_risk=30, management_team=30, growth_drivers=30,
        ))
        assert result.tier == DRSTier.PRE_DILIGENCE

    def test_conservative_leq_base_leq_optimistic(self):
        scores = CategoryScores(
            revenue_quality=80,
            financial_integrity=60,
            operational_independence=70,
            customer_risk=75,
            management_team=65,
            growth_drivers=50,
            revenue_quality_conservative=70,
            financial_integrity_conservative=50,
            operational_independence_conservative=60,
            customer_risk_conservative=65,
            management_team_conservative=55,
            growth_drivers_conservative=40,
            revenue_quality_optimistic=90,
            financial_integrity_optimistic=70,
            operational_independence_optimistic=80,
            customer_risk_optimistic=85,
            management_team_optimistic=75,
            growth_drivers_optimistic=60,
        )
        result = compute_drs(scores)
        assert result.conservative_drs <= result.base_drs
        assert result.base_drs <= result.optimistic_drs

    def test_result_has_category_contributions(self):
        result = compute_drs(_scores())
        assert "revenue_quality" in result.category_contributions
        assert "financial_integrity" in result.category_contributions

    def test_contributions_sum_to_base_drs(self):
        result = compute_drs(_scores(
            revenue_quality=80, financial_integrity=60, operational_independence=70,
            customer_risk=75, management_team=65, growth_drivers=55,
        ))
        total = sum(result.category_contributions.values())
        # base_drs is rounded to 1 decimal; contributions are unrounded — allow 0.1 tolerance
        assert total == pytest.approx(result.base_drs, abs=0.1)

    def test_drs_bounded_0_to_100(self):
        result = compute_drs(_scores(
            revenue_quality=55, financial_integrity=45, operational_independence=60,
            customer_risk=50, management_team=40, growth_drivers=35,
        ))
        assert 0.0 <= result.base_drs <= 100.0

    def test_revenue_quality_has_highest_weight_impact(self):
        """Revenue quality (25%) should move DRS more than growth drivers (10%)."""
        baseline = compute_drs(_scores()).base_drs
        high_rq = compute_drs(_scores(revenue_quality=100)).base_drs
        high_gd = compute_drs(_scores(growth_drivers=100)).base_drs
        assert (high_rq - baseline) > (high_gd - baseline)


# ---------------------------------------------------------------------------
# A10 — Enterprise Value
# ---------------------------------------------------------------------------

class TestEnterpriseValue:
    def test_positive_ebitda_yields_positive_ev(self):
        result = compute_enterprise_value(Decimal("1000000"), DRSTier.INVESTMENT)
        assert result.ev_floor > 0
        assert result.ev_ceiling > 0

    def test_floor_leq_midpoint_leq_ceiling(self):
        result = compute_enterprise_value(Decimal("2000000"), DRSTier.CONDITIONAL)
        assert result.ev_floor <= result.ev_midpoint <= result.ev_ceiling

    def test_higher_tier_yields_higher_multiple(self):
        ebitda = Decimal("1500000")
        institutional = compute_enterprise_value(ebitda, DRSTier.INSTITUTIONAL)
        pre_diligence = compute_enterprise_value(ebitda, DRSTier.PRE_DILIGENCE)
        assert institutional.multiple_floor > pre_diligence.multiple_floor

    def test_zero_ebitda_yields_zero_ev(self):
        result = compute_enterprise_value(Decimal("0"), DRSTier.INVESTMENT)
        assert result.ev_floor == Decimal("0")
        assert result.ev_ceiling == Decimal("0")

    def test_industry_override_applied(self):
        override = (4.0, 6.0)
        result = compute_enterprise_value(
            Decimal("1000000"), DRSTier.INVESTMENT, industry_override=override
        )
        assert result.multiple_basis == "market_median"

    def test_ev_midpoint_is_average_of_floor_and_ceiling(self):
        result = compute_enterprise_value(Decimal("1000000"), DRSTier.INVESTMENT)
        expected_mid = (result.ev_floor + result.ev_ceiling) / 2
        assert result.ev_midpoint == pytest.approx(float(expected_mid), rel=0.01)

    def test_all_tiers_produce_results(self):
        ebitda = Decimal("1000000")
        for tier in DRSTier:
            result = compute_enterprise_value(ebitda, tier)
            assert result.ev_midpoint > 0
