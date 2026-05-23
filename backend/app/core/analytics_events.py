"""
Server-side analytics event tracking (PostHog).

Usage:
    from app.core.analytics_events import track
    track("report_generated", user_id="user_abc", properties={"company_id": 1, "template": "pdf"})

When POSTHOG_API_KEY is not set the calls are silently no-ops so local dev
requires no extra configuration.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    from app.core.config import settings
    if not settings.POSTHOG_API_KEY:
        return None

    try:
        import posthog as ph
        ph.api_key = settings.POSTHOG_API_KEY
        ph.host = settings.POSTHOG_HOST
        ph.on_error = lambda err, items: logger.warning("PostHog error: %s", err)
        _client = ph
        return _client
    except ImportError:
        logger.debug("posthog package not installed — analytics disabled")
        return None


def track(event_name: str, user_id: str, properties: dict[str, Any] | None = None) -> None:
    """Emit a server-side event. Safe to call anywhere — never raises."""
    client = _get_client()
    if client is None:
        return
    try:
        client.capture(distinct_id=user_id, event=event_name, properties=properties or {})
    except Exception as exc:
        logger.debug("analytics track failed: %s", exc)


def identify(user_id: str, traits: dict[str, Any] | None = None) -> None:
    """Associate user traits (tier, status) with a distinct_id."""
    client = _get_client()
    if client is None:
        return
    try:
        client.identify(distinct_id=user_id, properties=traits or {})
    except Exception as exc:
        logger.debug("analytics identify failed: %s", exc)
