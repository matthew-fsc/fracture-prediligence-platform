"""
Buyer Universe — curated active acquirer matching (Blueprint II §A10 extension)

Resolves which active acquirers are the best fit for a given company based on:
  1. Industry slug match (primary filter)
  2. EBITDA range overlap (secondary filter)
  3. EV range overlap (scoring bonus)
  4. Buyer type (returned for advisory framing)

Returns ranked list with per-acquirer fit scores (0–100).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.ontology.models import ActiveAcquirer, BuyerUniverseRelease, Company
from app.analytics.market_benchmarks import resolve_industry_slug
from app.analytics.a1_metric_computation import compute_metrics

_CURATED_PATH = Path(__file__).resolve().parent.parent / "data" / "buyer_universe_curated.json"

_BUYER_TYPE_LABELS = {
    "pe": "Private Equity",
    "strategic": "Strategic Acquirer",
    "financial": "Financial / Family Office",
}


@dataclass
class AcquirerMatch:
    id: int
    name: str
    buyer_type: str
    buyer_type_label: str
    hq_state: Optional[str]
    preferred_industries: list[str]
    ebitda_range: str
    ev_range: str
    investment_thesis: Optional[str]
    hold_period_years: Optional[str]
    portfolio_count: Optional[int]
    notable_platforms: Optional[str]
    fit_score: int           # 0–100
    fit_reasons: list[str]
    source_note: Optional[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id":                  self.id,
            "name":                self.name,
            "buyer_type":          self.buyer_type,
            "buyer_type_label":    self.buyer_type_label,
            "hq_state":            self.hq_state,
            "preferred_industries": self.preferred_industries,
            "ebitda_range":        self.ebitda_range,
            "ev_range":            self.ev_range,
            "investment_thesis":   self.investment_thesis,
            "hold_period_years":   self.hold_period_years,
            "portfolio_count":     self.portfolio_count,
            "notable_platforms":   self.notable_platforms,
            "fit_score":           self.fit_score,
            "fit_reasons":         self.fit_reasons,
            "source_note":         self.source_note,
        }


def _latest_release(db: Session) -> Optional[BuyerUniverseRelease]:
    return (
        db.query(BuyerUniverseRelease)
        .order_by(desc(BuyerUniverseRelease.as_of_date), desc(BuyerUniverseRelease.id))
        .first()
    )


def _fmt_range(lo: Optional[float], hi: Optional[float], suffix: str = "M") -> str:
    if lo is None and hi is None:
        return "Any"
    if lo is None:
        return f"Up to ${hi:.1f}{suffix}"
    if hi is None:
        return f"${lo:.1f}{suffix}+"
    return f"${lo:.1f}{suffix}–${hi:.1f}{suffix}"


def _score_acquirer(
    acq: ActiveAcquirer,
    industry_slug: str,
    ebitda_m: float,
    ev_m: float,
) -> tuple[int, list[str]]:
    """Return (fit_score 0–100, fit_reasons list)."""
    score = 0
    reasons: list[str] = []

    # Industry match — 40 pts
    preferred = [s.strip() for s in (acq.preferred_industries or "").split(",") if s.strip()]
    if industry_slug in preferred:
        score += 40
        reasons.append(f"Industry match ({industry_slug.replace('_', ' ')})")
    else:
        # Partial credit for adjacent industry (e.g. business_services as fallback)
        if "business_services" in preferred:
            score += 15
            reasons.append("Adjacent industry fit (business services)")

    # EBITDA range — 35 pts
    ebitda_lo = float(acq.ebitda_min_m or 0)
    ebitda_hi = float(acq.ebitda_max_m or 1e9)
    if ebitda_lo <= ebitda_m <= ebitda_hi:
        score += 35
        reasons.append(f"EBITDA ${ebitda_m:.2f}M within mandate (${ebitda_lo:.1f}M–${ebitda_hi:.1f}M)")
    elif ebitda_m < ebitda_lo:
        gap_pct = (ebitda_lo - ebitda_m) / ebitda_lo
        if gap_pct <= 0.20:
            score += 20
            reasons.append("EBITDA slightly below mandate floor (within 20%)")
    else:
        gap_pct = (ebitda_m - ebitda_hi) / ebitda_hi
        if gap_pct <= 0.30:
            score += 15
            reasons.append("EBITDA slightly above mandate ceiling (within 30%)")

    # EV range — 25 pts
    ev_lo = float(acq.ev_min_m or 0)
    ev_hi = float(acq.ev_max_m or 1e9)
    if ev_lo <= ev_m <= ev_hi:
        score += 25
        reasons.append(f"Enterprise value ${ev_m:.1f}M within mandate")
    elif ev_m < ev_lo:
        gap_pct = (ev_lo - ev_m) / ev_lo
        if gap_pct <= 0.25:
            score += 12
            reasons.append("EV slightly below mandate floor")
    else:
        gap_pct = (ev_m - ev_hi) / ev_hi
        if gap_pct <= 0.30:
            score += 8
            reasons.append("EV slightly above mandate ceiling")

    return min(100, score), reasons


def resolve_buyer_universe(
    db: Session,
    company_id: int,
    buyer_type_filter: Optional[str] = None,
    max_results: int = 15,
) -> dict[str, Any]:
    """
    Match active acquirers against the company's industry slug and EBITDA/EV.
    Returns ranked list with fit scores and advisory context.
    """
    # Resolve company context
    company = db.query(Company).filter(Company.id == company_id).first()
    industry_slug = resolve_industry_slug(
        company.industry if company else None,
        naics_code=company.naics_code if company else None,
    )

    metrics = compute_metrics(company_id, db)
    ebitda_m = float(metrics.ebitda_ttm or 0) / 1_000_000
    # Approximate EV midpoint: ebitda * 5x
    ev_m = ebitda_m * 5.0

    # Fetch acquirers from DB
    release = _latest_release(db)
    if not release:
        return _empty_result(company_id, industry_slug, ebitda_m, ev_m)

    query = db.query(ActiveAcquirer).filter(
        ActiveAcquirer.release_id == release.id,
        ActiveAcquirer.is_active == True,
    )
    if buyer_type_filter:
        query = query.filter(ActiveAcquirer.buyer_type == buyer_type_filter)
    acquirers = query.all()

    matches: list[AcquirerMatch] = []
    for acq in acquirers:
        fit_score, fit_reasons = _score_acquirer(acq, industry_slug, ebitda_m, ev_m)
        preferred = [s.strip() for s in (acq.preferred_industries or "").split(",") if s.strip()]
        matches.append(AcquirerMatch(
            id=acq.id,
            name=acq.name,
            buyer_type=acq.buyer_type,
            buyer_type_label=_BUYER_TYPE_LABELS.get(acq.buyer_type, acq.buyer_type),
            hq_state=acq.hq_state,
            preferred_industries=preferred,
            ebitda_range=_fmt_range(
                float(acq.ebitda_min_m) if acq.ebitda_min_m is not None else None,
                float(acq.ebitda_max_m) if acq.ebitda_max_m is not None else None,
            ),
            ev_range=_fmt_range(
                float(acq.ev_min_m) if acq.ev_min_m is not None else None,
                float(acq.ev_max_m) if acq.ev_max_m is not None else None,
            ),
            investment_thesis=acq.investment_thesis,
            hold_period_years=acq.hold_period_years,
            portfolio_count=acq.portfolio_count,
            notable_platforms=acq.notable_platforms,
            fit_score=fit_score,
            fit_reasons=fit_reasons,
            source_note=acq.source_note,
        ))

    # Sort: fit_score descending, then by name for stability
    matches.sort(key=lambda m: (-m.fit_score, m.name))
    top = matches[:max_results]

    # Type breakdown
    type_counts: dict[str, int] = {}
    for m in top:
        type_counts[m.buyer_type] = type_counts.get(m.buyer_type, 0) + 1

    return {
        "company_id":   company_id,
        "industry_slug": industry_slug,
        "ebitda_m":     round(ebitda_m, 2),
        "ev_m_estimate": round(ev_m, 2),
        "release_label": release.label,
        "as_of_date":   release.as_of_date.isoformat() if release.as_of_date else None,
        "total_matched": len(top),
        "total_universe": len(matches),
        "buyer_type_filter": buyer_type_filter,
        "type_breakdown": type_counts,
        "acquirers": [m.to_dict() for m in top],
    }


def _empty_result(company_id: int, slug: str, ebitda_m: float, ev_m: float) -> dict:
    return {
        "company_id": company_id,
        "industry_slug": slug,
        "ebitda_m": round(ebitda_m, 2),
        "ev_m_estimate": round(ev_m, 2),
        "release_label": None,
        "as_of_date": None,
        "total_matched": 0,
        "total_universe": 0,
        "buyer_type_filter": None,
        "type_breakdown": {},
        "acquirers": [],
    }


def seed_buyer_universe_if_empty(db: Session) -> None:
    """Load curated JSON into DB when no release exists."""
    if db.query(BuyerUniverseRelease).first():
        return
    if not _CURATED_PATH.is_file():
        return
    raw = json.loads(_CURATED_PATH.read_text(encoding="utf-8"))
    rel_data = raw["release"]
    release = BuyerUniverseRelease(
        source_type=rel_data["source_type"],
        label=rel_data["label"],
        as_of_date=date.fromisoformat(rel_data["as_of_date"]) if rel_data.get("as_of_date") else None,
    )
    db.add(release)
    db.flush()

    for row in raw.get("acquirers", []):
        db.add(ActiveAcquirer(
            release_id=release.id,
            name=row["name"],
            buyer_type=row["buyer_type"],
            hq_state=row.get("hq_state"),
            preferred_industries=row.get("preferred_industries", ""),
            ebitda_min_m=Decimal(str(row["ebitda_min_m"])) if row.get("ebitda_min_m") is not None else None,
            ebitda_max_m=Decimal(str(row["ebitda_max_m"])) if row.get("ebitda_max_m") is not None else None,
            ev_min_m=Decimal(str(row["ev_min_m"])) if row.get("ev_min_m") is not None else None,
            ev_max_m=Decimal(str(row["ev_max_m"])) if row.get("ev_max_m") is not None else None,
            investment_thesis=row.get("investment_thesis"),
            hold_period_years=row.get("hold_period_years"),
            portfolio_count=row.get("portfolio_count"),
            notable_platforms=row.get("notable_platforms"),
            source_note=row.get("source_note"),
            is_active=True,
        ))
    db.flush()
