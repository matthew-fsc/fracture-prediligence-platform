"""
PitchBook (or similar) aggregate fetch — server-side only.

When PITCHBOOK_API_KEY is unset, returns None. A real integration would:
  OAuth / API key auth, rate limiting, and cache via MarketBenchmarkCache.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.core.config import settings

_log = logging.getLogger(__name__)
_logged_no_key = False
_logged_key_stub = False


def fetch_pitchbook_segment_hint(
    industry_slug: str,
    ebitda_band_label: str,
) -> Optional[dict[str, Any]]:
    """
    Placeholder for PitchBook peer-count or multiple hints.
    Returns None when not configured so callers keep curated DB data only.
    """
    global _logged_no_key, _logged_key_stub
    key = getattr(settings, "PITCHBOOK_API_KEY", "") or ""
    if not key.strip():
        if not _logged_no_key:
            _logged_no_key = True
            _log.info(
                "PitchBook API not configured (PITCHBOOK_API_KEY empty); "
                "benchmark hints use curated seed data only."
            )
        return None
    # Future: HTTP client with retries, store aggregates in MarketBenchmarkCache
    if not _logged_key_stub:
        _logged_key_stub = True
        _log.warning(
            "PITCHBOOK_API_KEY is set but live PitchBook integration is not implemented; "
            "returning no hint (curated seed benchmarks still apply)."
        )
    return None
