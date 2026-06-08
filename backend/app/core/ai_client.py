"""
Centralized Anthropic AI client for the Fracture platform.

Provides:
  - Exponential-backoff retry on transient errors (429, 500, 529, network)
  - Prompt-cache helpers (ephemeral blocks for static system prompts)
  - Input guardrails (length caps, content safety heuristics)
  - Cost estimation per request
  - Structured response envelope

All Claude calls throughout the app should go through `call_claude()`.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pricing constants — Claude models (USD per million tokens).
# Update when Anthropic changes pricing.
# ---------------------------------------------------------------------------

_PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-6": {
        "input":        3.00,
        "output":      15.00,
        "cache_write":  3.75,
        "cache_read":   0.30,
    },
    "claude-haiku-4-5-20251001": {
        "input":        0.80,
        "output":       4.00,
        "cache_write":  1.00,
        "cache_read":   0.08,
    },
}
_DEFAULT_PRICING = _PRICING["claude-sonnet-4-6"]


# ---------------------------------------------------------------------------
# Off-topic / injection heuristics
# ---------------------------------------------------------------------------

# Patterns that suggest the message is not a legitimate business question.
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bignore\s+(all\s+)?(previous|prior|above)\b", re.I),
    re.compile(r"\bnew\s+(instructions?|persona|role)\b", re.I),
    re.compile(r"\bact\s+as\s+(?!an?\s+(advisor|analyst|expert))", re.I),
    re.compile(r"\bsystem\s+prompt\b", re.I),
    re.compile(r"\bjailbreak\b", re.I),
    re.compile(r"\bDAN\b"),   # "Do Anything Now" jailbreak
]

# Topics that are clearly off-topic for an M&A advisory platform.
_OFF_TOPIC_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b(write|generate|create|compose)\s+(an?\s+)?(poem|song|story|essay|novel|joke|rap)\b", re.I),
    re.compile(r"\b(hack|exploit|malware|ransomware|phishing)\b", re.I),
    re.compile(r"\bpersonal\s+(advice|relationship|medical|legal)\b", re.I),
]


def _check_content_safety(text: str) -> str | None:
    """
    Return an error message if the text fails content safety checks,
    or None if it is acceptable.
    """
    for pat in _INJECTION_PATTERNS:
        if pat.search(text):
            return "Your message contains patterns that look like prompt injection. Please ask a business question."
    for pat in _OFF_TOPIC_PATTERNS:
        if pat.search(text):
            return (
                "This platform is designed for M&A advisory and diligence questions. "
                "Please ask something related to your company's financials, readiness score, or exit planning."
            )
    return None


# ---------------------------------------------------------------------------
# Prompt-cache helpers
# ---------------------------------------------------------------------------

def make_cached_system(static_text: str) -> list[dict]:
    """
    Wrap a static system prompt as a cache-eligible block.

    Usage: pass the return value as `system=` to call_claude().
    When the same static_text is sent twice within Anthropic's cache TTL
    (~5 minutes), the second call pays only cache-read price (~90% cheaper).
    """
    return [{"type": "text", "text": static_text, "cache_control": {"type": "ephemeral"}}]


def make_hybrid_system(static_instructions: str, dynamic_context: str) -> list[dict]:
    """
    Two-block system: static instructions are cache-eligible; dynamic
    context (company data, scores) is appended fresh each call.

    The static block must always be the first block and must be identical
    across calls for the cache hit to fire.
    """
    return [
        {"type": "text", "text": static_instructions, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": dynamic_context},
    ]


# ---------------------------------------------------------------------------
# Cost estimation
# ---------------------------------------------------------------------------

def estimate_cost_usd(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> float:
    """Estimate USD cost for a single Claude API call."""
    p = _PRICING.get(model, _DEFAULT_PRICING)
    standard_input = max(0, input_tokens - cache_read_tokens - cache_write_tokens)
    cost = (
        standard_input       * p["input"]       / 1_000_000
        + output_tokens      * p["output"]      / 1_000_000
        + cache_write_tokens * p["cache_write"] / 1_000_000
        + cache_read_tokens  * p["cache_read"]  / 1_000_000
    )
    return round(cost, 6)


# ---------------------------------------------------------------------------
# Core call function
# ---------------------------------------------------------------------------

def call_claude(
    system: str | list[dict],
    messages: list[dict],
    *,
    max_tokens: int = 1024,
    model: str | None = None,
    timeout: float = 60.0,
    max_retries: int = 3,
    check_content_safety: bool = False,
) -> dict[str, Any]:
    """
    Call Claude with retry, guardrails, and cost tracking.

    Parameters
    ----------
    system : str or list[dict]
        System prompt (string) or a list of content blocks (for prompt caching).
    messages : list[dict]
        Conversation messages in Anthropic format.
    max_tokens : int
        Maximum tokens to generate.
    model : str | None
        Model to use; defaults to settings.ANTHROPIC_MODEL.
    timeout : float
        Per-request timeout in seconds.
    max_retries : int
        Max retry attempts on transient errors.
    check_content_safety : bool
        When True, run input guardrails on the last user message.

    Returns
    -------
    dict with keys:
        text, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        latency_ms, cost_usd, model, cached (bool)

    Raises
    ------
    ValueError : ANTHROPIC_API_KEY not set, or content safety violation.
    anthropic.APIError subclasses : on permanent API errors.
    """
    from app.core.config import settings

    try:
        import anthropic as _anthropic
    except ImportError as exc:
        raise RuntimeError("Anthropic SDK not installed. Run: pip install anthropic") from exc

    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured.")

    resolved_model = model or settings.ANTHROPIC_MODEL

    # --- Input guardrails ---
    if check_content_safety and messages:
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        if isinstance(last_user, str):
            if len(last_user) > settings.ANTHROPIC_MAX_INPUT_CHARS:
                raise ValueError(
                    f"Message too long ({len(last_user):,} chars). "
                    f"Maximum allowed is {settings.ANTHROPIC_MAX_INPUT_CHARS:,} characters."
                )
            safety_error = _check_content_safety(last_user)
            if safety_error:
                raise ValueError(safety_error)

    # Silently truncate any message that exceeds the hard limit (no error raised for non-user messages)
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str) and len(content) > settings.ANTHROPIC_MAX_INPUT_CHARS:
            msg["content"] = content[:settings.ANTHROPIC_MAX_INPUT_CHARS] + "\n\n[Truncated]"

    client = _anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=timeout)

    retryable = {429, 500, 529, 503}
    last_exc: Exception | None = None

    for attempt in range(max_retries):
        if attempt > 0:
            sleep_s = min(2 ** attempt, 16)  # 2, 4, 8, max 16s
            logger.warning(
                "Claude API transient error — retry %d/%d in %.0fs (model=%s)",
                attempt, max_retries, sleep_s, resolved_model,
            )
            time.sleep(sleep_s)

        try:
            t0 = time.monotonic()
            response = client.messages.create(
                model=resolved_model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            latency_ms = int((time.monotonic() - t0) * 1000)

            usage = response.usage
            input_tokens   = getattr(usage, "input_tokens",               0) or 0
            output_tokens  = getattr(usage, "output_tokens",              0) or 0
            cache_read     = getattr(usage, "cache_read_input_tokens",    0) or 0
            cache_write    = getattr(usage, "cache_creation_input_tokens", 0) or 0

            text = response.content[0].text if response.content else ""

            return {
                "text":               text,
                "input_tokens":       input_tokens,
                "output_tokens":      output_tokens,
                "cache_read_tokens":  cache_read,
                "cache_write_tokens": cache_write,
                "latency_ms":         latency_ms,
                "cost_usd":           estimate_cost_usd(
                    resolved_model, input_tokens, output_tokens, cache_read, cache_write
                ),
                "model":   resolved_model,
                "cached":  cache_read > 0,
            }

        except _anthropic.RateLimitError as exc:
            if attempt < max_retries - 1:
                last_exc = exc
                continue
            raise

        except _anthropic.APIStatusError as exc:
            status = getattr(exc, "status_code", None)
            if status in retryable and attempt < max_retries - 1:
                last_exc = exc
                continue
            raise

        except _anthropic.APIConnectionError as exc:
            if attempt < max_retries - 1:
                last_exc = exc
                continue
            raise

    # Should be unreachable, but satisfies type checkers
    if last_exc:
        raise last_exc
    raise RuntimeError("call_claude exhausted retries without a result")  # pragma: no cover
