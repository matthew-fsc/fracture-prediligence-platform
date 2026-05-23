"""
A2 — EBITDA Recast (Blueprint II §A2)

Transforms reported financials into a defensible, PE-grade EBITDA.
Produces three EBITDA scenarios (conservative, base, aggressive) with
a full addback schedule and challenge likelihood ratings.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Optional

from app.analytics.a1_metric_computation import MetricRegistry


class ChallengeLikelihood(str, Enum):
    LOW          = "LOW"       # Documented, clear non-business nature → full addback both scenarios
    MEDIUM       = "MEDIUM"    # Partially documented / mixed use → 50% conservative, 100% aggressive
    HIGH         = "HIGH"      # Undocumented / large → excluded conservative, included aggressive w/ flag
    NOT_DEFENSIBLE = "NOT_DEFENSIBLE"  # Removed from all scenarios


@dataclass
class AddbackItem:
    description: str
    amount: Decimal
    challenge: ChallengeLikelihood
    category: str  # "owner_comp" | "personal" | "non_recurring" | "related_party" | "proforma"
    documented: bool = False
    notes: str = ""


@dataclass
class EBITDARecast:
    # Step-by-step build (§A2.1)
    reported_net_income: Decimal = Decimal(0)
    addback_da: Decimal = Decimal(0)
    addback_interest: Decimal = Decimal(0)
    addback_taxes: Decimal = Decimal(0)
    reported_ebitda: Decimal = Decimal(0)

    addbacks: list[AddbackItem] = field(default_factory=list)

    # Three scenarios (§A2.3)
    conservative_ebitda: Decimal = Decimal(0)
    base_ebitda: Decimal = Decimal(0)
    aggressive_ebitda: Decimal = Decimal(0)

    # Derived
    total_addbacks: Decimal = Decimal(0)
    defensible_ebitda: Decimal = Decimal(0)  # = base_ebitda


def compute_ebitda_recast(metrics: MetricRegistry, raw_inputs: dict) -> EBITDARecast:
    """
    raw_inputs expected keys:
        net_income, da, interest, taxes,
        addback_items: list of dicts with {description, amount, challenge, category, documented, notes}
        market_rate_replacement_cost: Decimal
    """
    r = EBITDARecast()

    r.reported_net_income = Decimal(str(raw_inputs.get("net_income", 0)))
    r.addback_da          = Decimal(str(raw_inputs.get("da", 0)))
    r.addback_interest    = Decimal(str(raw_inputs.get("interest", 0)))
    r.addback_taxes       = Decimal(str(raw_inputs.get("taxes", 0)))
    r.reported_ebitda     = r.reported_net_income + r.addback_da + r.addback_interest + r.addback_taxes

    # Owner comp normalization (always first addback)
    market_rate = Decimal(str(raw_inputs.get("market_rate_replacement_cost", 0)))
    owner_comp_delta = metrics.owner_compensation_total - market_rate
    if owner_comp_delta > 0:
        r.addbacks.append(AddbackItem(
            description="Owner Compensation Normalization",
            amount=owner_comp_delta,
            challenge=ChallengeLikelihood.MEDIUM,
            category="owner_comp",
            documented=True,
            notes=f"Owner total comp ${metrics.owner_compensation_total:,.0f} vs market ${market_rate:,.0f}",
        ))

    # Additional addbacks from raw_inputs
    for item in raw_inputs.get("addback_items", []):
        r.addbacks.append(AddbackItem(
            description=item["description"],
            amount=Decimal(str(item["amount"])),
            challenge=ChallengeLikelihood(item["challenge"]),
            category=item["category"],
            documented=item.get("documented", False),
            notes=item.get("notes", ""),
        ))

    # Build three scenarios
    r.conservative_ebitda = r.reported_ebitda
    r.base_ebitda         = r.reported_ebitda
    r.aggressive_ebitda   = r.reported_ebitda

    for ab in r.addbacks:
        if ab.challenge == ChallengeLikelihood.NOT_DEFENSIBLE:
            continue  # excluded from all

        if ab.challenge == ChallengeLikelihood.LOW:
            r.conservative_ebitda += ab.amount
            r.base_ebitda         += ab.amount
            r.aggressive_ebitda   += ab.amount

        elif ab.challenge == ChallengeLikelihood.MEDIUM:
            # Conservative: excludes MEDIUM (challenge risk too high)
            # Base: 50% of MEDIUM (partially defensible)
            # Aggressive: 100% of MEDIUM
            r.base_ebitda         += ab.amount * Decimal("0.5")
            r.aggressive_ebitda   += ab.amount

        elif ab.challenge == ChallengeLikelihood.HIGH:
            # excluded from conservative; included in aggressive with flag
            r.aggressive_ebitda += ab.amount

    r.total_addbacks   = sum(ab.amount for ab in r.addbacks if ab.challenge != ChallengeLikelihood.NOT_DEFENSIBLE)
    r.defensible_ebitda = r.base_ebitda

    return r
