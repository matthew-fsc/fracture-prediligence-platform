"""
PitchBook (or similar) aggregate fetch — server-side only.

When PITCHBOOK_API_KEY is unset, returns None. A real integration would:
  OAuth / API key auth, rate limiting, and cache via MarketBenchmarkCache.
"""

from __future__ import annotations

from typing import Any, Optional

from app.core.config import settings


def fetch_pitchbook_segment_hint(
    industry_slug: str,
    ebitda_band_label: str,
) -> Optional[dict[str, Any]]:
    """
    Placeholder for PitchBook peer-count or multiple hints.
    Returns None when not configured so callers keep curated DB data only.
    """
    key = getattr(settings, "PITCHBOOK_API_KEY", "") or ""
    if not key.strip():
        return None
    # Future: HTTP client with retries, store aggregates in MarketBenchmarkCache
    return None
