"""
A10 — Enterprise Value Calculation (Blueprint II §A10)

Applies a DRS-adjusted EBITDA multiple to Defensible EBITDA to compute EV range.
The multiple adjustment table maps DRS tier → multiple range.

When market_context is provided (curated IBBA-style or future PitchBook aggregates),
the applied multiple band is blended 50/50 with the DRS tier band so valuation
stays tied to diligence quality while reflecting segment-level market data.
"""

from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from app.analytics.a9_drs_composite import DRSTier
from app.core.scoring_rules import SCORING_RULES

if TYPE_CHECKING:
    from app.analytics.market_benchmarks import MarketMultipleContext


# Multiple ranges by DRS tier and industry (professional services baseline)
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

    ev_floor = defensible_ebitda * Decimal(str(lo))
    ev_ceiling = defensible_ebitda * Decimal(str(hi))
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
    """Human-readable provenance for API/UI (no fake vendor citations)."""
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
