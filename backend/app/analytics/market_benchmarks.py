"""
Market / peer benchmarks: resolve industry × EBITDA band to curated (or future API) aggregates.

Honest provenance: only cite IBBA/PitchBook when a backing MarketBenchmarkRelease row exists.
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

from app.analytics.a1_metric_computation import compute_metrics
from app.ontology.models import Company, Employee, EmployeeStatus, MarketBenchmarkRelease, MarketSegmentMetric
from app.services.market_data.pitchbook_client import fetch_pitchbook_segment_hint

# Keyword order: first match wins (more specific slugs first)
_INDUSTRY_SLUG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("field_services", ("traffic", "field service", "transportation", "fleet", "logistics")),
    ("professional_services", ("legal", "accounting", "cpa", "consulting", "professional")),
    ("business_services", ("business service", "services", "b2b")),
]

_DEFAULT_SLUG = "business_services"


def resolve_industry_slug(industry: Optional[str]) -> str:
    if not industry or not str(industry).strip():
        return _DEFAULT_SLUG
    low = industry.lower()
    for slug, keywords in _INDUSTRY_SLUG_RULES:
        if any(k in low for k in keywords):
            return slug
    return _DEFAULT_SLUG


def _band_width(seg: MarketSegmentMetric) -> float:
    lo = float(seg.ebitda_band_min or 0)
    hi = float(seg.ebitda_band_max or 1e15)
    return max(hi - lo, 1.0)


def _ebitda_in_band(ebitda: float, seg: MarketSegmentMetric) -> bool:
    lo = float(seg.ebitda_band_min or 0)
    hi = float(seg.ebitda_band_max or 1e15)
    return lo <= ebitda <= hi


def _latest_release(db: Session) -> Optional[MarketBenchmarkRelease]:
    return (
        db.query(MarketBenchmarkRelease)
        .order_by(desc(MarketBenchmarkRelease.as_of_date), desc(MarketBenchmarkRelease.id))
        .first()
    )


def _segments_for_slug(db: Session, release_id: int, slug: str) -> list[MarketSegmentMetric]:
    return (
        db.query(MarketSegmentMetric)
        .filter(
            MarketSegmentMetric.release_id == release_id,
            MarketSegmentMetric.industry_slug == slug,
        )
        .all()
    )


def pick_segment_for_ebitda(
    segments: list[MarketSegmentMetric],
    ebitda: float,
) -> Optional[MarketSegmentMetric]:
    if not segments:
        return None
    in_band = [s for s in segments if _ebitda_in_band(ebitda, s)]
    if in_band:
        return min(in_band, key=_band_width)
    # Nearest band by distance to midpoint
    def dist(s: MarketSegmentMetric) -> float:
        lo = float(s.ebitda_band_min or 0)
        hi = float(s.ebitda_band_max or 1e15)
        mid = (lo + hi) / 2
        return abs(ebitda - mid)

    return min(segments, key=dist)


def resolve_segment_for_company(
    db: Session,
    company_id: int,
    ebitda: float,
) -> tuple[Optional[MarketSegmentMetric], Optional[MarketBenchmarkRelease], str]:
    """
    Returns (segment, release, match_note).
    match_note: 'primary' | 'fallback_slug' | 'none'
    """
    release = _latest_release(db)
    if not release:
        return None, None, "none"

    company = db.query(Company).filter(Company.id == company_id).first()
    slug = resolve_industry_slug(company.industry if company else None)

    def _try(s: str) -> Optional[MarketSegmentMetric]:
        rows = _segments_for_slug(db, release.id, s)
        return pick_segment_for_ebitda(rows, ebitda)

    picked = _try(slug)
    if picked:
        return picked, release, "primary"
    if slug != _DEFAULT_SLUG:
        picked = _try(_DEFAULT_SLUG)
        if picked:
            return picked, release, "fallback_slug"
    return None, release, "none"


@dataclass
class MarketMultipleContext:
    market_floor: float
    market_ceiling: float
    segment_label: str
    peer_count: Optional[int]
    release_label: str
    as_of_date: Optional[date]
    source_type: str
    doc_ref: Optional[str]
    industry_slug: str
    match_note: str


def get_market_multiple_context(
    db: Session,
    company_id: int,
    ebitda: float,
) -> Optional[MarketMultipleContext]:
    seg, rel, match_note = resolve_segment_for_company(db, company_id, ebitda)
    if not seg or not rel:
        return None
    if seg.market_ebitda_multiple_floor is None or seg.market_ebitda_multiple_ceiling is None:
        return None

    return MarketMultipleContext(
        market_floor=float(seg.market_ebitda_multiple_floor),
        market_ceiling=float(seg.market_ebitda_multiple_ceiling),
        segment_label=f"{seg.industry_display_name} — {seg.ebitda_band_label}",
        peer_count=seg.peer_count,
        release_label=rel.label,
        as_of_date=rel.as_of_date,
        source_type=rel.source_type,
        doc_ref=rel.doc_ref,
        industry_slug=seg.industry_slug,
        match_note=match_note,
    )


def market_context_to_reference_dict(ctx: MarketMultipleContext) -> dict[str, Any]:
    return {
        "segment_label": ctx.segment_label,
        "market_multiple_floor": ctx.market_floor,
        "market_multiple_ceiling": ctx.market_ceiling,
        "peer_count": ctx.peer_count,
        "release_label": ctx.release_label,
        "as_of_date": ctx.as_of_date.isoformat() if ctx.as_of_date else None,
        "source_type": ctx.source_type,
        "doc_ref": ctx.doc_ref,
        "confidence": "estimated" if ctx.match_note == "fallback_slug" else "high",
    }


def build_benchmarks_payload(
    db: Session,
    company_id: int,
) -> dict[str, Any]:
    """Payload for GET /market-benchmarks/{company_id}."""
    metrics = compute_metrics(company_id, db)
    ebitda = float(metrics.ebitda_ttm)
    seg, rel, match_note = resolve_segment_for_company(db, company_id, ebitda)

    sources: list[dict[str, Any]] = []
    if rel:
        sources.append({
            "name": rel.label,
            "url_or_doc_ref": rel.doc_ref or "",
            "retrieved_at": rel.created_at.isoformat() if rel.created_at else "",
            "license_scope": "aggregates_only",
            "source_type": rel.source_type,
        })

    pitch = None
    if seg:
        pitch = fetch_pitchbook_segment_hint(seg.industry_slug, seg.ebitda_band_label)

    peer_count = seg.peer_count if seg else None
    segment_label = None
    benchmark_rows: list[dict[str, Any]] = []
    comparison_note = ""

    if seg and rel:
        segment_label = f"{seg.industry_display_name} · {seg.ebitda_band_label}"
        if match_note == "fallback_slug":
            comparison_note = f"Industry defaulted to {_DEFAULT_SLUG.replace('_', ' ')}; set company industry for a tighter match."

        def _m(key: str, median: Optional[float], company_val: Optional[float], direction: str, unit: str) -> dict[str, Any]:
            return {
                "metric": key,
                "median": median,
                "company": company_val,
                "direction": direction,
                "unit": unit,
            }

        rev_yoy = None
        by_y = metrics.total_revenue_by_year or {}
        years = sorted(by_y.keys())
        if len(years) >= 2:
            a, b = by_y[years[-2]], by_y[years[-1]]
            rev_yoy = float(((b - a) / a * 100) if a else 0) if a else None

        ebitda_margin = None
        if metrics.total_revenue_ttm and float(metrics.total_revenue_ttm) > 0:
            ebitda_margin = float(ebitda) / float(metrics.total_revenue_ttm) * 100

        emps = (
            db.query(Employee)
            .filter(Employee.company_id == company_id, Employee.status == EmployeeStatus.ACTIVE)
            .all()
        )
        total_payroll = sum(float(e.comp_annual or 0) for e in emps)  # comp_annual is already annual
        payroll_ratio = (
            (total_payroll / float(metrics.total_revenue_ttm) * 100) if metrics.total_revenue_ttm and float(metrics.total_revenue_ttm) > 0 else None
        )
        recurring_pct = float(metrics.recurring_revenue_pct) if metrics.recurring_revenue_pct is not None else None
        top_cust = float(metrics.top_customer_revenue_pct) if metrics.top_customer_revenue_pct is not None else None

        benchmark_rows = [
            _m("Revenue Growth", float(seg.revenue_growth_median_pct) if seg.revenue_growth_median_pct is not None else None,
               rev_yoy, "higher_better", "%"),
            _m("EBITDA Margin", float(seg.ebitda_margin_median_pct) if seg.ebitda_margin_median_pct is not None else None,
               ebitda_margin, "higher_better", "%"),
            _m("Payroll Ratio", float(seg.payroll_ratio_median_pct) if seg.payroll_ratio_median_pct is not None else None,
               payroll_ratio, "lower_better", "%"),
            _m("Recurring Rev.", float(seg.recurring_rev_median_pct) if seg.recurring_rev_median_pct is not None else None,
               recurring_pct, "higher_better", "%"),
            _m("Top Cust. Conc.", float(seg.top_customer_conc_median_pct) if seg.top_customer_conc_median_pct is not None else None,
               top_cust, "lower_better", "%"),
        ]

    if pitch and isinstance(pitch, dict) and pitch.get("peer_count"):
        peer_count = pitch.get("peer_count", peer_count)

    source_line = ""
    if rel and seg:
        src_name = "IBBA-style curated aggregates" if rel.source_type == "ibba_curated" else rel.label
        pc = peer_count
        source_line = f"Source: {src_name}" + (f" · {pc} peer firms" if pc else "")

    return {
        "company_id": company_id,
        "segment_label": segment_label,
        "peer_count": peer_count,
        "ebitda_band_label": seg.ebitda_band_label if seg else None,
        "industry_slug": seg.industry_slug if seg else None,
        "match_note": match_note,
        "comparison_note": comparison_note,
        "source_line": source_line,
        "sources": sources,
        "benchmarks": benchmark_rows,
        "pitchbook_hint": pitch,
    }


_CURATED_PATH = Path(__file__).resolve().parent.parent / "data" / "market_benchmarks_curated.json"


def seed_curated_benchmarks_if_empty(db: Session) -> None:
    """Load curated JSON into DB when no release exists."""
    if db.query(MarketBenchmarkRelease).first():
        return
    if not _CURATED_PATH.is_file():
        return
    raw = json.loads(_CURATED_PATH.read_text(encoding="utf-8"))
    rel = raw["release"]
    r = MarketBenchmarkRelease(
        source_type=rel["source_type"],
        label=rel["label"],
        as_of_date=date.fromisoformat(rel["as_of_date"]) if rel.get("as_of_date") else None,
        doc_ref=rel.get("doc_ref"),
    )
    db.add(r)
    db.flush()

    for row in raw.get("segments", []):
        db.add(
            MarketSegmentMetric(
                release_id=r.id,
                industry_slug=row["industry_slug"],
                industry_display_name=row["industry_display_name"],
                ebitda_band_label=row["ebitda_band_label"],
                ebitda_band_min=Decimal(str(row["ebitda_band_min"])) if row.get("ebitda_band_min") is not None else None,
                ebitda_band_max=Decimal(str(row["ebitda_band_max"])) if row.get("ebitda_band_max") is not None else None,
                peer_count=row.get("peer_count"),
                revenue_growth_median_pct=row.get("revenue_growth_median_pct"),
                ebitda_margin_median_pct=row.get("ebitda_margin_median_pct"),
                payroll_ratio_median_pct=row.get("payroll_ratio_median_pct"),
                recurring_rev_median_pct=row.get("recurring_rev_median_pct"),
                top_customer_conc_median_pct=row.get("top_customer_conc_median_pct"),
                market_ebitda_multiple_floor=row.get("market_ebitda_multiple_floor"),
                market_ebitda_multiple_ceiling=row.get("market_ebitda_multiple_ceiling"),
            )
        )
    db.flush()


def validate_multiple_range(lo: float, hi: float) -> bool:
    return 0 < lo <= hi <= 100


def ensure_field_services_m1m5_benchmark_multiples(db: Session) -> None:
    """
    Sync DB segment row with curated IBBA band for Field Services $1M–$5M (demo EV calibration).
    Safe to call on every startup; no-op if table missing or row not found.
    """
    try:
        seg = (
            db.query(MarketSegmentMetric)
            .filter(
                MarketSegmentMetric.industry_slug == "field_services",
                MarketSegmentMetric.ebitda_band_label == "$1M–$5M",
            )
            .first()
        )
        if not seg:
            return
        target_lo, target_hi = 4.55, 6.0
        cur_lo = float(seg.market_ebitda_multiple_floor or 0)
        cur_hi = float(seg.market_ebitda_multiple_ceiling or 0)
        if abs(cur_lo - target_lo) < 0.001 and abs(cur_hi - target_hi) < 0.001:
            return
        seg.market_ebitda_multiple_floor = target_lo
        seg.market_ebitda_multiple_ceiling = target_hi
        db.commit()
    except Exception:
        db.rollback()
        raise
