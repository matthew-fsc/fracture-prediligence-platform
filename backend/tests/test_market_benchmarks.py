from datetime import date
from decimal import Decimal

from app.analytics.a10_enterprise_value import compute_enterprise_value, format_ev_valuation_summary
from app.analytics.a9_drs_composite import DRSTier
from app.analytics.market_benchmarks import (
    MarketMultipleContext,
    resolve_industry_slug,
    validate_multiple_range,
)


def test_resolve_industry_slug_traffic():
    assert resolve_industry_slug("Field Services — Traffic Management") == "field_services"


def test_resolve_industry_slug_default():
    assert resolve_industry_slug(None) == "business_services"
    assert resolve_industry_slug("") == "business_services"


def test_compute_enterprise_value_blended():
    ctx = MarketMultipleContext(
        market_floor=4.0,
        market_ceiling=6.0,
        segment_label="Test — $1M–$5M",
        peer_count=100,
        release_label="Curated release",
        as_of_date=date(2025, 3, 1),
        source_type="ibba_curated",
        doc_ref="doc",
        industry_slug="field_services",
        match_note="primary",
    )
    # HIGH_RISK tier: 2.5–3.5 from DRS table
    ev = compute_enterprise_value(Decimal("1000000"), DRSTier.HIGH_RISK, market_context=ctx)
    assert ev.multiple_basis == "blended"
    assert ev.market_reference is not None
    assert ev.drs_multiple_floor == 2.5 and ev.drs_multiple_ceiling == 3.5
    assert abs(ev.multiple_floor - (2.5 + 4.0) / 2) < 0.001
    assert abs(ev.multiple_ceiling - (3.5 + 6.0) / 2) < 0.001
    s = format_ev_valuation_summary(ev)
    assert "Blended" in s or "blended" in s.lower()


def test_compute_enterprise_value_drs_only():
    ev = compute_enterprise_value(Decimal("500000"), DRSTier.PRE_DILIGENCE)
    assert ev.multiple_basis == "drs_tier_heuristic"
    assert ev.market_reference is None


def test_validate_multiple_range():
    assert validate_multiple_range(3.0, 5.0) is True
    assert validate_multiple_range(5.0, 3.0) is False
