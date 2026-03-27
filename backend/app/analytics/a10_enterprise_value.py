"""
A10 — Enterprise Value Calculation (Blueprint II §A10)

Applies a DRS-adjusted EBITDA multiple to Defensible EBITDA to compute EV range.
The multiple adjustment table maps DRS tier → multiple range.
"""

from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal

from app.analytics.a9_drs_composite import DRSTier
from app.core.scoring_rules import SCORING_RULES


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


def compute_enterprise_value(
    defensible_ebitda: Decimal,
    drs_tier: DRSTier,
    industry_override: tuple[float, float] | None = None,
) -> EnterpriseValueResult:
    lo, hi = industry_override or MULTIPLE_TABLE[drs_tier]

    ev_floor   = defensible_ebitda * Decimal(str(lo))
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
    )
