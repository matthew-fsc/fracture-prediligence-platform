"""
AI Insight Layer — three analytical interpretation modules powered by Claude.

All dollar figures, scores, and multiples are computed deterministically upstream
and passed to Claude as facts. Claude handles interpretation only — never computation.

Modules:
  buyer_questions       — PE diligence question simulation keyed to actual risk flags
  addback_defensibility — narrative defense for each EBITDA addback item
  drs_interpretation    — plain-English category score explanations

Every request/response is logged to insights_log.jsonl for dataset use.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope
from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import Company

logger = logging.getLogger(__name__)
router = APIRouter()

CompanyScoped = Annotated[Company, Depends(get_company_scope)]

# Write logs next to the app package so Railway/Render can mount a volume there.
_LOG_DIR = Path(__file__).resolve().parents[3] / "logs"
_LOG_FILE = _LOG_DIR / "insights_log.jsonl"


def _append_log(entry: dict) -> None:
    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
        with _LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, default=str) + "\n")
    except Exception as exc:
        logger.warning("insights_log write failed: %s", exc)


# ── System prompts ────────────────────────────────────────────────────────────

_BUYER_QUESTIONS_SYSTEM = """You are a senior PE diligence analyst at a lower-middle-market buyout firm.
You are reviewing an acquisition target's pre-diligence profile and generating the specific questions
you would ask during the management presentation and formal QofE process.

Rules:
- Output ONLY a valid JSON array. No markdown fences, no explanation, no preamble.
- Generate exactly 8–12 questions. No more, no fewer.
- Every question MUST reference a specific metric value from the payload (numbers, percentages, dollar amounts).
- Never write generic questions that could apply to any company.
- Each question object must have exactly these keys:
    question          (string — the specific diligence question)
    risk_category     (string — one of: revenue_quality, customer_concentration, operational_independence,
                       financial_integrity, management_team, growth_drivers, ebitda_quality)
    metric_anchor     (string — the specific metric value from the payload that drives this question,
                       e.g. "Top 2 customers = 68% of revenue" or "DRS: 27/100")
    documentation_checklist (array of strings — 2–4 specific documents or data items needed to answer this question)

Tone: direct, analytical, skeptical. This is a QofE process, not a sales call."""

_ADDBACK_DEFENSIBILITY_SYSTEM = """You are an M&A advisory specialist writing addback defensibility narratives
for an EBITDA recast schedule. These narratives will be presented to a PE buyer or their QofE accountant.

Rules:
- Output ONLY a valid JSON object. No markdown fences, no explanation.
- The object must have one key per addback_key in the input, each containing a string paragraph.
- Each paragraph must: (1) state what the item is and why it is a legitimate addback,
  (2) explain the documentation standard required to defend it in a QofE,
  (3) note any risk that a buyer might push back (if challenge flag is MEDIUM or HIGH).
- Maximum 3 sentences per paragraph. Write in M&A advisory tone — confident, specific, no hedging.
- Never use phrases like "it is important to note" or "it should be mentioned".
- Reference the specific dollar amount in each narrative."""

_DRS_INTERPRETATION_SYSTEM = """You are an exit planning advisor explaining a Diligence Readiness Score
analysis to an M&A advisory client. Your explanations will appear alongside the scored output in a
professional report.

Rules:
- Output ONLY a valid JSON object. No markdown fences, no explanation.
- The object must have one key per category in the input, each containing a string of 2–3 sentences.
- Each explanation must: (1) state what the score means in plain English,
  (2) cite the specific input values that drove the score (percentages, dollar amounts, counts),
  (3) name the single most important thing the owner could do to improve this category.
- Write at advisor-to-owner level — no jargon, no generic statements, no tier labels.
- Never use "it is" or "there are" as sentence openers.
- Each response is for a specific company — reference their actual numbers, not hypotheticals."""


# ── Request / response models ─────────────────────────────────────────────────

class InsightsRequest(BaseModel):
    module: str  # "buyer_questions" | "addback_defensibility" | "drs_interpretation"
    payload: dict[str, Any]


class InsightsResponse(BaseModel):
    module: str
    result: Any
    latency_ms: int
    model: str
    cached: bool = False


# ── Claude call helper ────────────────────────────────────────────────────────

def _call_claude(system_prompt: str, user_content: str, max_tokens: int = 2048) -> tuple[str, int, int, int]:
    """
    Returns (text, input_tokens, output_tokens, latency_ms).
    Raises HTTPException on auth/config errors, returns empty string on generation failure.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI insights are not configured — set ANTHROPIC_API_KEY in environment variables.",
        )
    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=503, detail="Anthropic SDK not installed.")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60.0)
    t0 = int(time.time() * 1000)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    latency = int(time.time() * 1000) - t0
    text = response.content[0].text if response.content else ""
    tokens_in = response.usage.input_tokens if response.usage else 0
    tokens_out = response.usage.output_tokens if response.usage else 0
    return text, tokens_in, tokens_out, latency


def _safe_parse_json(text: str) -> Any:
    """Parse JSON, stripping markdown fences if present."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        stripped = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(stripped)


# ── Module handlers ───────────────────────────────────────────────────────────

def _handle_buyer_questions(payload: dict) -> tuple[Any, str]:
    """Build user prompt and return (parsed_result, raw_text)."""
    drs = payload.get("drs_score", 0)
    tier = payload.get("drs_tier", "")
    ebitda = payload.get("ebitda", 0)
    ev_floor = payload.get("ev_floor", 0)
    ev_ceiling = payload.get("ev_ceiling", 0)
    category_scores = payload.get("category_scores", {})
    risk_flags = payload.get("risk_flags", [])
    company_name = payload.get("company_name", "the target company")

    risk_block = "\n".join(
        f"  - {f['label']}: {f['value']}" for f in risk_flags
    ) if risk_flags else "  (no specific risk flags provided)"

    cat_block = "\n".join(
        f"  {k.replace('_', ' ').title()}: {v:.1f}/100"
        for k, v in category_scores.items()
    ) if category_scores else "  (no category scores provided)"

    user_content = f"""Company: {company_name}
DRS Score: {drs}/100 (Tier: {tier})
Defensible EBITDA: ${ebitda:,.0f}
Enterprise Value Range: ${ev_floor:,.0f} – ${ev_ceiling:,.0f}

Category Scores:
{cat_block}

Specific Risk Flags:
{risk_block}

Generate the PE diligence questions for this specific company profile."""

    raw, _, _, _ = _call_claude(_BUYER_QUESTIONS_SYSTEM, user_content, max_tokens=2048)
    result = _safe_parse_json(raw)
    return result, raw


def _handle_addback_defensibility(payload: dict) -> tuple[Any, str]:
    ebitda_base = payload.get("ebitda_base", 0)
    addbacks = payload.get("addbacks", [])
    company_name = payload.get("company_name", "the target company")

    if not addbacks:
        return {}, ""

    addback_lines = []
    for ab in addbacks:
        addback_lines.append(
            f"  Key: {ab.get('addback_key', 'unknown')}\n"
            f"  Description: {ab.get('description', '')}\n"
            f"  Amount: ${float(ab.get('amount', 0)):,.0f}\n"
            f"  Category: {ab.get('category', '')}\n"
            f"  Challenge Likelihood: {ab.get('challenge', 'MEDIUM')}\n"
            f"  Documented: {ab.get('documented', False)}\n"
            f"  Notes: {ab.get('notes', '')}"
        )

    user_content = f"""Company: {company_name}
Reported EBITDA (before addbacks): ${ebitda_base:,.0f}

Addback Schedule:
{chr(10).join(addback_lines)}

Generate the defensibility narrative for each addback item.
Use each item's Key as the JSON key in your response."""

    raw, _, _, _ = _call_claude(_ADDBACK_DEFENSIBILITY_SYSTEM, user_content, max_tokens=2048)
    result = _safe_parse_json(raw)
    return result, raw


def _handle_drs_interpretation(payload: dict) -> tuple[Any, str]:
    drs = payload.get("drs_score", 0)
    tier = payload.get("drs_tier", "")
    company_name = payload.get("company_name", "the target company")
    categories = payload.get("categories", {})

    cat_lines = []
    for key, data in categories.items():
        label = key.replace("_", " ").title()
        score = data.get("score", 0)
        drivers = data.get("drivers", [])
        driver_str = "; ".join(
            f"{d['label']}: {d['value']}" for d in drivers
        ) if drivers else "no driver data available"
        cat_lines.append(
            f"  {label}: {score:.1f}/100\n"
            f"    Key drivers: {driver_str}"
        )

    user_content = f"""Company: {company_name}
DRS Composite Score: {drs}/100 (Tier: {tier})

Category Detail:
{chr(10).join(cat_lines)}

Write a plain-English explanation for each category score.
Use the category key (e.g. revenue_quality) as the JSON key in your response."""

    raw, _, _, _ = _call_claude(_DRS_INTERPRETATION_SYSTEM, user_content, max_tokens=2048)
    result = _safe_parse_json(raw)
    return result, raw


_MODULE_HANDLERS = {
    "buyer_questions": _handle_buyer_questions,
    "addback_defensibility": _handle_addback_defensibility,
    "drs_interpretation": _handle_drs_interpretation,
}


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/{company_id}")
async def generate_insights(
    company: CompanyScoped,
    body: InsightsRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate AI-powered analytical narrative for one of three modules.
    All scoring inputs must be pre-computed and passed in body.payload.
    If the AI call fails the endpoint returns a 200 with result=null so the
    frontend can degrade gracefully without blocking the full report.
    """
    handler = _MODULE_HANDLERS.get(body.module)
    if handler is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown module '{body.module}'. Valid: {list(_MODULE_HANDLERS)}",
        )

    t0 = int(time.time() * 1000)
    raw_text = ""
    result: Any = None
    error_msg: Optional[str] = None
    tokens_in = tokens_out = 0

    try:
        result, raw_text = handler(body.payload)
    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        error_msg = f"Claude response was not valid JSON: {exc}. Raw: {raw_text[:200]}"
        logger.warning("insights JSON parse error (module=%s): %s", body.module, error_msg)
        result = None
    except Exception as exc:
        error_msg = str(exc)
        logger.warning("insights generation error (module=%s): %s", body.module, exc)
        result = None

    latency = int(time.time() * 1000) - t0

    _append_log({
        "ts": datetime.now(timezone.utc).isoformat(),
        "module": body.module,
        "company_id": getattr(company, "id", None),
        "user_id": getattr(user, "user_id", None),
        "payload": body.payload,
        "raw_response": raw_text,
        "tokens_input": tokens_in,
        "tokens_output": tokens_out,
        "latency_ms": latency,
        "error": error_msg,
    })

    return {
        "module": body.module,
        "result": result,
        "latency_ms": latency,
        "model": "claude-sonnet-4-6",
        "error": error_msg,
    }
