"""AI Copilot — Claude-powered Q&A over company diligence data."""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope
from app.core.analytics_events import track
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limiting import limiter
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import AICopilotUsage, Company, QualitativeInputs, EngagementProfile, UserSubscription

logger = logging.getLogger(__name__)
router = APIRouter()

CompanyScoped = __import__("typing").Annotated[Company, Depends(get_company_scope)]


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class CopilotRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    context_hint: Optional[str] = None   # e.g. "Viewing buyer questions: revenue_quality"

    @validator("message")
    def message_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Message cannot be empty.")
        return v


# ---------------------------------------------------------------------------
# Token budget helpers
# ---------------------------------------------------------------------------

_TIER_LIMIT_MAP = {
    "founding": "COPILOT_MONTHLY_TOKEN_LIMIT_FOUNDING",
    "pro":      "COPILOT_MONTHLY_TOKEN_LIMIT_PRO",
    "team":     "COPILOT_MONTHLY_TOKEN_LIMIT_TEAM",
}


def _get_tier_limit(tier: Optional[str]) -> int:
    """Return monthly token limit for the given subscription tier."""
    key = _TIER_LIMIT_MAP.get(tier or "pro", "COPILOT_MONTHLY_TOKEN_LIMIT_PRO")
    return int(getattr(settings, key, 500_000))


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _get_usage(db: Session, user_id: str, month: str) -> AICopilotUsage:
    row = (
        db.query(AICopilotUsage)
        .filter(AICopilotUsage.user_id == user_id, AICopilotUsage.month == month)
        .with_for_update()
        .first()
    )
    if row is None:
        row = AICopilotUsage(user_id=user_id, month=month)
        db.add(row)
        db.flush()
    return row


def _record_usage(db: Session, user_id: str, month: str, tokens_in: int, tokens_out: int) -> None:
    row = _get_usage(db, user_id, month)
    row.tokens_input += tokens_in
    row.tokens_output += tokens_out
    row.request_count += 1
    row.last_request_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def _build_context(company_id: int, db: Session) -> str:
    """Assemble a structured company context string to inject into the system prompt."""
    lines: list[str] = []

    # --- DRS + EV from analytics pipeline ---
    try:
        from app.services.analytics_service import compute_category_modules
        from app.analytics.a9_drs_composite import CategoryScores, compute_drs
        from app.analytics.a10_enterprise_value import compute_enterprise_value
        from app.analytics.a11_value_gap import compute_value_gap
        from app.analytics.ebitda_basis import ebitda_basis_for_company
        from app.analytics.market_benchmarks import get_market_multiple_context
        from decimal import Decimal

        modules = compute_category_modules(company_id, db)

        cat = CategoryScores(
            revenue_quality=modules["revenue_quality"].composite,
            financial_integrity=modules["financial_integrity"].composite,
            operational_independence=modules["operational_independence"].composite,
            customer_risk=modules["customer_risk"].composite,
            management_team=modules["management_team"].composite,
            growth_drivers=modules["growth_drivers"].composite,
        )
        drs = compute_drs(cat)

        lines.append(f"DRS Score: {drs.base_drs:.1f}/100 (Tier: {drs.tier.value})")
        lines.append(f"  Conservative: {drs.conservative_drs:.1f}  |  Optimistic: {drs.optimistic_drs:.1f}")
        lines.append("")
        lines.append("Category Scores (weight → score/100):")
        for label, key, weight in [
            ("Revenue Quality",          "revenue_quality",          25),
            ("Financial Integrity",      "financial_integrity",      20),
            ("Operational Independence", "operational_independence", 20),
            ("Customer Risk",            "customer_risk",            15),
            ("Management & Team",        "management_team",          10),
            ("Growth Drivers",           "growth_drivers",           10),
        ]:
            score = modules[key].composite
            lines.append(f"  {label} ({weight}%): {score:.1f}/100")

        # EV
        basis = ebitda_basis_for_company(company_id, db)
        ebitda = basis.get("ebitda_normalized_ttm", 0) or 0
        ebitda_dec = Decimal(str(round(float(ebitda), 2)))
        mctx = get_market_multiple_context(db, company_id, float(ebitda_dec))
        ev = compute_enterprise_value(ebitda_dec, drs.tier, market_context=mctx)

        if float(ebitda_dec) > 0:
            lines.append("")
            lines.append(f"Defensible EBITDA (TTM): ${float(ebitda_dec):,.0f}")
            lines.append(f"Enterprise Value Range: ${float(ev.ev_floor):,.0f} – ${float(ev.ev_ceiling):,.0f}")
            lines.append(f"  Midpoint: ${float(ev.ev_midpoint):,.0f}")
            lines.append(f"  EBITDA Multiple: {ev.multiple_floor:.1f}x – {ev.multiple_ceiling:.1f}x ({ev.multiple_basis})")

        # Value gap top items
        gap = compute_value_gap(cat, ebitda_dec)
        if gap.gaps:
            lines.append("")
            lines.append("Value Gap (top items by EV uplift):")
            for g in gap.gaps[:4]:
                cat_label = g.category.replace("_", " ").title()
                lines.append(
                    f"  {cat_label}: score {g.current_score:.0f}/100 → target 80, "
                    f"gap {g.score_gap:.0f} pts, EV uplift ${float(g.ev_uplift):,.0f}"
                )

    except Exception as exc:
        lines.append(f"(Analytics partially unavailable: {exc})")

    # --- Engagement profile ---
    try:
        ep = db.query(EngagementProfile).filter(EngagementProfile.company_id == company_id).first()
        if ep:
            lines.append("")
            lines.append("Owner / Engagement Profile:")
            if ep.exit_timeline:
                lines.append(f"  Exit timeline: {ep.exit_timeline}")
            if ep.target_valuation:
                lines.append(f"  Valuation target: ${float(ep.target_valuation):,.0f}")
            if ep.personal_financial_gap:
                lines.append(f"  Personal financial gap to meet goals: ${float(ep.personal_financial_gap):,.0f}")
            if ep.transaction_type:
                lines.append(f"  Preferred transaction type: {ep.transaction_type}")
            if ep.post_exit_plans:
                lines.append(f"  Post-exit plan: {ep.post_exit_plans}")
            if ep.owner_motivations_json:
                try:
                    motivations = json.loads(ep.owner_motivations_json)
                    if motivations:
                        lines.append(f"  Owner motivations: {', '.join(motivations)}")
                except Exception:
                    pass
    except Exception:
        logger.warning("Engagement profile context build failed for company_id=%s", company_id, exc_info=True)

    # --- Qualitative inputs ---
    try:
        qi = db.query(QualitativeInputs).filter(QualitativeInputs.company_id == company_id).first()
        if qi:
            lines.append("")
            lines.append("Qualitative Operational Inputs:")
            if qi.owner_hours_per_week is not None:
                lines.append(f"  Owner hours/week in operations: {float(qi.owner_hours_per_week):.0f}")
            if qi.sop_pct is not None:
                lines.append(f"  SOP documentation coverage: {float(qi.sop_pct):.0f}%")
            if qi.automation_pct is not None:
                lines.append(f"  Process automation level: {float(qi.automation_pct):.0f}%")
            if qi.customer_contract_type:
                lines.append(f"  Primary contract type: {qi.customer_contract_type}")
            if qi.key_person_revenue_pct is not None:
                lines.append(f"  Revenue dependent on owner relationships: {float(qi.key_person_revenue_pct):.0f}%")
            if qi.market_positioning:
                lines.append(f"  Market positioning: {qi.market_positioning}")
    except Exception:
        logger.warning("Qualitative inputs context build failed for company_id=%s", company_id, exc_info=True)

    return "\n".join(lines) if lines else "No company data available yet."


# ---------------------------------------------------------------------------
# System prompt — static instructions are prompt-cached; dynamic context is fresh
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTIONS = """\
You are an expert M&A AI Copilot embedded in Exit Blueprint — a sell-side advisory tool used by M&A advisors, CEPAs, and business owners preparing for exit.

Your role: help users interpret Diligence Readiness Scores (DRS), enterprise value estimates, EBITDA normalization, buyer diligence questions, value gaps, and actionable improvement plans.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLATFORM ONTOLOGY — KNOW THIS DEEPLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DRS (Diligence Readiness Score) — 0 to 100 weighted composite:

  Revenue Quality (25% weight)
    Drives: % recurring/subscription revenue, contract coverage, revenue predictability,
    churn rate, customer payment terms, revenue concentration by product/segment.
    Low score causes: project-based or one-time revenue, no signed contracts, high churn,
    single-product dependency.

  Financial Integrity (20% weight)
    Drives: clean GAAP books, normalized/defensible EBITDA, addback documentation quality,
    audit or review-level statements, separation of personal/business expenses.
    Low score causes: cash-basis books, commingled expenses, undocumented addbacks,
    missing bank reconciliations, related-party transactions at non-arm's-length rates.

  Operational Independence (20% weight)
    Drives: owner hours/week in daily operations, SOP documentation coverage %,
    process automation level %, depth of management layer below owner.
    Low score causes: owner working 40+ hrs/week on delivery, no documented processes,
    all customer relationships held personally by the owner.

  Customer Risk (15% weight)
    Drives: top-customer revenue concentration (top 1 and top 3), active customer count,
    average customer tenure (years), industry diversification of customer base.
    Low score causes: single customer >40% of revenue, fewer than 10 active customers,
    all customers in one industry/geography.

  Management & Team (10% weight)
    Drives: key manager depth (non-owner leadership), retention rates, non-compete
    and non-solicitation agreements in place, documented succession plan.
    Low score causes: no second-in-command, all institutional knowledge with owner,
    no employment agreements.

  Growth Drivers (10% weight)
    Drives: historical revenue growth rate (3-year CAGR), pipeline coverage,
    market positioning strength, competitive differentiation.
    Low score causes: flat/declining revenue, no documented pipeline, undifferentiated
    commodity offering.

DRS Tiers and EV Multiple Ranges:
  85–100 Institutional Grade   → 7.5x–9.0x EBITDA multiple
  70–84  Investment Grade      → 5.5x–7.5x EBITDA multiple
  55–69  Conditional           → 4.0x–5.5x EBITDA multiple
  40–54  High Risk             → 2.5x–4.0x EBITDA multiple
  <40    Foundation Stage       → 2.0x–2.5x EBITDA multiple

Enterprise Value (EV) = Defensible EBITDA × tier multiple (midpoint of range).
Improving DRS enough to move a full tier tier can increase EV by 30–80% on the same earnings.

EBITDA Normalization:
  Defensible EBITDA = Reported EBITDA + Owner addbacks + Non-recurring addbacks
  Common addbacks (must be documented to survive QofE):
    - Owner W-2 above market replacement salary
    - Personal expenses run through business (auto, travel, meals)
    - One-time legal, accounting, or consulting fees
    - Non-recurring capex or write-offs
    - Related-party rent at above-market rates
    - COVID-period PPP forgiveness or EIDL impact (disclosed separately)
  QofE standard: each addback needs a paper trail (invoices, returns, bank statements).
  Challenged addbacks are the #1 cause of deal renegotiation or price reduction.

Value Gap:
  The $ increase in EV achievable by improving weak categories to a target score of 80/100.
  Calculated as: score gap × category weight × EV sensitivity to multiple expansion.
  Prioritize by: (1) highest DRS weight category, (2) largest score gap, (3) speed to improve.
  Revenue Quality and Financial Integrity give the most EV leverage per point improved.

━━━━━━━━━━━━━━━━━━━━━━━━━
BUYER TYPES & PRIORITIES
━━━━━━━━━━━━━━━━━━━━━━━━━

PE (Private Equity):
  Hold period: 3–7 years. Return target: 2.5–4x MOIC.
  Must-haves: recurring revenue (minimum 30% preferred), management team that can operate
  without the owner post-close, clean EBITDA with defensible addbacks, scalable ops.
  Top diligence concerns: customer concentration, EBITDA quality, owner dependency,
  hidden liabilities, working capital normalization, cap table cleanliness.

Strategic Buyers:
  Seeking synergies: customer lists, geographic expansion, talent, IP, market share.
  May pay premium (strategic premium) above financial buyer range for the right fit.
  Less focused on EBITDA multiple, more focused on integration risk and customer retention.
  Key concern: will key employees and customers stay post-acquisition?

Financial Buyers (family offices, search funds, independent sponsors):
  Smaller checks ($5M–$50M EV range), more flexible on owner transition timeline.
  More tolerant of some owner involvement during a 12–24 month transition.
  Often use SBA financing (requires owner to stay 12 months), seller notes, or earnouts.

Deal Structures:
  Asset sale vs stock sale (tax treatment difference — sellers prefer stock, buyers prefer assets).
  Earnout: portion of price contingent on future performance — signals buyer uncertainty on EBITDA.
  Seller note: seller finances part of purchase price — common in lower-middle market.
  Recapitalization: PE buys majority stake, owner retains equity for second bite at the apple.

M&A Process Stages:
  Pre-diligence preparation → CIM (Confidential Information Memorandum) →
  IOI (Indication of Interest) → LOI (Letter of Intent) →
  QofE (Quality of Earnings audit by buyer's accounting firm) →
  Definitive Agreement → Close
  DRS benchmarks: 60+ to attract IOIs, 70+ to get through LOI without major retrading,
  80+ to pass QofE without price reduction.

━━━━━━━━━━━━━━━━━━━━━
RESPONSE GUIDELINES
━━━━━━━━━━━━━━━━━━━━━
- Tone: Direct, advisor-grade. Speak like a senior M&A advisor, not a chatbot.
- Always cite specific numbers from the company data when available.
- Be concise (3–6 sentences) unless user explicitly asks for detail or a breakdown.
- Use plain English — explain jargon the first time you use it.
- If you do not have the data to answer precisely, say so clearly. Never speculate.
- Do not answer questions unrelated to M&A advisory, exit planning, business valuation,
  or the company data in context. Politely redirect."""


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/chat/{company_id}")
@limiter.limit("60/hour")
async def copilot_chat(
    request: Request,
    company: CompanyScoped,
    body: CopilotRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to the AI Copilot with full company diligence context."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI Copilot is not configured — set ANTHROPIC_API_KEY in environment variables.",
        )

    # --- Token budget check ---
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    tier = sub.tier if sub else None
    limit = _get_tier_limit(tier)
    month = _current_month()

    tokens_before = 0
    if limit > 0:
        usage = _get_usage(db, user.user_id, month)
        tokens_before = usage.tokens_input + usage.tokens_output
        if tokens_before >= limit:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Monthly AI Copilot limit reached ({tokens_before:,} of {limit:,} tokens used). "
                    "Limit resets on the 1st of next month."
                ),
            )

    # --- Build prompts ---
    context = _build_context(company.id, db)

    # Static instructions are prompt-cached; dynamic company context is appended fresh.
    from app.core.ai_client import make_hybrid_system, call_claude

    dynamic_parts = [f"CURRENT COMPANY DATA:\n{context}"]
    if body.context_hint:
        dynamic_parts.append(f"USER CONTEXT: {body.context_hint.strip()[:500]}")

    system_blocks = make_hybrid_system(
        _SYSTEM_INSTRUCTIONS,
        "\n\n".join(dynamic_parts),
    )

    # Build message list (history capped at last 10 turns)
    messages = []
    for h in body.history[-10:]:
        if h.role in ("user", "assistant"):
            messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": body.message})

    try:
        result = call_claude(
            system=system_blocks,
            messages=messages,
            max_tokens=1024,
            model=settings.ANTHROPIC_MODEL,
            timeout=30.0,
            max_retries=settings.ANTHROPIC_MAX_RETRIES,
            check_content_safety=True,
        )
    except ValueError as exc:
        # Content safety or input validation — 422 so the frontend can surface the message
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Copilot Claude API call failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

    tokens_in  = result["input_tokens"]
    tokens_out = result["output_tokens"]
    _record_usage(db, user.user_id, month, tokens_in, tokens_out)

    tokens_after = tokens_before + tokens_in + tokens_out
    budget_pct = tokens_after / limit if limit > 0 else 0.0
    budget_warning = (
        budget_pct >= settings.COPILOT_BUDGET_WARNING_PCT and budget_pct < 1.0
    )

    track("copilot_query", user_id=user.user_id, properties={
        "company_id":    company.id,
        "tier":          tier,
        "tokens_input":  tokens_in,
        "tokens_output": tokens_out,
        "cache_hit":     result["cached"],
        "latency_ms":    result["latency_ms"],
        "cost_usd":      result["cost_usd"],
    })

    return {
        "reply": result["text"],
        "has_context": bool(context),
        "usage": {
            "tokens_this_request":    tokens_in + tokens_out,
            "tokens_used_this_month": tokens_after if limit > 0 else None,
            "monthly_limit":          limit if limit > 0 else None,
            "budget_pct":             round(budget_pct * 100, 1) if limit > 0 else None,
            "budget_warning":         budget_warning,
            "cache_hit":              result["cached"],
            "cost_usd":               result["cost_usd"],
        },
    }
