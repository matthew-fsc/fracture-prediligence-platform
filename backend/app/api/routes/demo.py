"""
Demo routes — static ABC Company demo payload, personalized demo links,
spots-remaining counter, and admin link management.

CSV sandbox samples for connectors live under `scripts/generate_sandbox_data.py` (separate narrative).
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.db_functions import get_demo_locked, set_demo_locked
from app.services import demo_service

router = APIRouter()

TOTAL_SPOTS = settings.DEMO_TOTAL_SPOTS

# ---------------------------------------------------------------------------
# Static demo data — ABC Company (demo_company_seed.py: ~$4.20M TTM rev, ~$1.74M EBITDA proxy)
# ---------------------------------------------------------------------------
DEMO_DATA = {
    "company": {
        "id": "demo",
        "name": "ABC Company Inc",
        "industry": "Field Services — Traffic Management & Transportation",
        "founded": 2009,
        "state": "CA",
        "employees": 25,
        "ttm_revenue": 4196172,
        "ebitda": 1743357,
        "ebitda_margin": 41.5,
        "owner": "David Merrill",
        "advisor": "Sarah Chen, CEPA",
        "engagement_stage": "Pre-Diligence",
    },
    "drs": {
        "base": 72.0,
        "conservative": 68.5,
        "optimistic": 75.5,
        "tier": "Investment Grade",
        "contributions": {
            "revenue_quality": 17.5,
            "financial_integrity": 14.8,
            "operational_independence": 14.2,
            "customer_risk": 10.5,
            "management_team": 7.2,
            "growth_drivers": 7.8,
        },
    },
    "category_scores": {
        "revenue_quality": {
            "composite": 70,
            "data_confidence": "HIGH",
            "sub_scores": {
                "recurring_rate": {"score": 58, "label": "Project-based municipal work; limited recurring revenue mix"},
                "concentration": {"score": 62, "label": "Top customer ~49% of TTM revenue — primary concentration risk"},
                "durability": {"score": 80, "label": "Government contracts provide multi-year durability"},
                "consistency": {"score": 82, "label": "Revenue trend positive across 3-year P&L window"},
                "nrr": {"score": 75, "label": "Stable account base; limited expansion within existing accounts"},
            },
        },
        "financial_integrity": {
            "composite": 74,
            "data_confidence": "HIGH",
            "sub_scores": {
                "addback_exposure": {"score": 68, "label": "Officer salary $202K vs ~$120K market replacement — $82K addback"},
                "expense_completeness": {"score": 78, "label": "QB-style GL fully mapped to ontology categories"},
                "revenue_completeness": {"score": 82, "label": "Monthly 2025 + annual 2023/2024 ingested"},
                "data_coverage": {"score": 76, "label": "3-year P&L path with complete monthly TTM"},
            },
        },
        "operational_independence": {
            "composite": 71,
            "data_confidence": "HIGH",
            "sub_scores": {
                "owner_comp": {"score": 68, "label": "Owner comp normalized; field ops documented"},
                "key_person": {"score": 65, "label": "Owner-led customer relationships — key person dependency noted"},
                "management_depth": {"score": 74, "label": "Field leads identified; bench depth improving"},
                "staff_stability": {"score": 76, "label": "Field staff tenure stable across core accounts"},
            },
        },
        "customer_risk": {
            "composite": 70,
            "data_confidence": "HIGH",
            "sub_scores": {
                "concentration": {"score": 58, "label": "Top customer ~49% — concentration risk flagged for buyer review"},
                "diversification": {"score": 76, "label": "68 customers total; 55 active — solid breadth for field services"},
                "churn": {"score": 72, "label": "13 dormant accounts; 55 active customers retained"},
                "tenure": {"score": 80, "label": "Municipal relationships multi-year with strong renewal history"},
            },
        },
        "management_team": {
            "composite": 72,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "completeness": {"score": 72, "label": "Ops + field leads identified; BD coverage gap noted"},
                "size": {"score": 70, "label": "25 employees — lean field services structure"},
                "ownership": {"score": 68, "label": "Owner-director role central; succession path in progress"},
                "role_coverage": {"score": 74, "label": "Core operational roles covered; commercial expansion needed"},
            },
        },
        "growth_drivers": {
            "composite": 78,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "revenue_cagr": {"score": 76, "label": "2023→2025 TTM growth: $2.79M → $4.20M (+50% over 2 years)"},
                "new_customers": {"score": 72, "label": "Active customer count stable; new logo acquisition limited"},
                "contract_pipeline": {"score": 74, "label": "Pipeline coverage below 1.0x; formal BD cadence in development"},
            },
        },
    },
    "enterprise_value": {
        "floor": 8320000,
        "midpoint": 9810000,
        "ceiling": 11320000,
        "multiple_used": "4.8–6.5",
        "ebitda_base": 1743357,
        "multiple_basis": "blended",
        "drs_multiple_floor": 5.0,
        "drs_multiple_ceiling": 7.0,
        "market_reference": None,
        "valuation_summary": (
            "~$1.74M normalized EBITDA × blended DRS Investment band (5.0x–7.0x) with curated "
            "field_services $1M–$5M market reference (4.55x–6.0x). Live /api/analytics/scores/1 should align after re-seed."
        ),
        "source_citation": (
            "Blended per a10_enterprise_value with market_benchmarks field_services band; ABC seed P&L TTM."
        ),
    },
    "flagged_issues": [
        {
            "id": 1,
            "severity": "HIGH",
            "category": "growth_drivers",
            "title": "Pipeline coverage at 0.46x — insufficient for buyer confidence",
            "description": "Active deal pipeline represents only 46% of TTM revenue. PE buyers and strategics require 1.0x–1.5x pipeline coverage to underwrite a growth premium. The absence of a formal business development process creates over-dependence on existing accounts.",
            "data_needed": "Formal pipeline report, new business development plan",
            "timeline": "6 months",
            "ev_impact": 1200000,
        },
        {
            "id": 2,
            "severity": "HIGH",
            "category": "customer_risk",
            "title": "Customer concentration and dormant accounts",
            "description": "Top customer is ~49% of TTM revenue and 13 of 68 accounts are inactive (dormant segment). Buyers will haircut revenue quality until concentration and reactivation plans are documented.",
            "data_needed": "Churn analysis by account, reactivation pipeline, concentration mitigation plan",
            "timeline": "6 months",
            "ev_impact": 480000,
        },
        {
            "id": 3,
            "severity": "MEDIUM",
            "category": "growth_drivers",
            "title": "Growth is project-led — limited premium multiple",
            "description": "3-year revenue moves from ~$2.79M (2023) to ~$4.20M (2025 TTM) — positive but uneven and below typical buyer expectations for a growth premium without a formal BD engine.",
            "data_needed": "Revenue forecast by account, market expansion plan",
            "timeline": "9 months",
            "ev_impact": 360000,
        },
        {
            "id": 4,
            "severity": "MEDIUM",
            "category": "customer_risk",
            "title": "No formal client success program — renewals handled ad hoc",
            "description": "Renewal conversations are initiated by the owner or practice leads without a standardized cadence or success criteria. Formalizing QBRs and NPS tracking would improve both churn metrics and buyer confidence in revenue durability.",
            "data_needed": "Client success playbook, QBR schedule",
            "timeline": "3 months",
            "ev_impact": 480000,
        },
    ],
    "checklist": {
        "total": 15,
        "completed": 12,
        "pct": 80,
        "items": [
            {"id": 1, "category": "Legal", "name": "Certificate of Formation / Articles of Organization", "status": "complete"},
            {"id": 2, "category": "Legal", "name": "EIN confirmation letter", "status": "complete"},
            {"id": 3, "category": "Legal", "name": "Operating Agreement (current)", "status": "complete"},
            {"id": 4, "category": "Legal", "name": "Buy-Sell Agreement (2024)", "status": "complete"},
            {"id": 5, "category": "Financial", "name": "P&L Statement 2022–2024 (CPA-reviewed)", "status": "complete"},
            {"id": 6, "category": "Financial", "name": "Balance Sheet 2022–2024", "status": "complete"},
            {"id": 7, "category": "Financial", "name": "CPA Review Letter FY2022–2024", "status": "complete"},
            {"id": 8, "category": "Financial", "name": "Business Tax Returns 2022–2024", "status": "missing"},
            {"id": 9, "category": "Operations", "name": "Organizational Chart (current)", "status": "complete"},
            {"id": 10, "category": "Operations", "name": "Client List with Revenue by Account (3yr)", "status": "complete"},
            {"id": 11, "category": "Operations", "name": "Insurance Certificates (GL + E&O)", "status": "complete"},
            {"id": 12, "category": "HR", "name": "Employee Roster with Compensation", "status": "complete"},
            {"id": 13, "category": "HR", "name": "Non-Compete and Non-Solicitation Agreements", "status": "missing"},
            {"id": 14, "category": "Customers", "name": "Top 10 Client Contracts", "status": "complete"},
            {"id": 15, "category": "Customers", "name": "Pipeline Report (CRM export)", "status": "missing"},
        ],
    },
    "data_room": {
        "sections": [
            {
                "name": "Financial Documents",
                "icon": "dollar",
                "docs": [
                    {"name": "P&L 2022–2024 (CPA-Reviewed)", "status": "complete", "size": "1.8 MB"},
                    {"name": "Balance Sheet — Dec 2024", "status": "complete", "size": "740 KB"},
                    {"name": "CPA Review Letter — FY2022–2024", "status": "complete", "size": "420 KB"},
                    {"name": "Owner Add-Back Schedule", "status": "complete", "size": "210 KB"},
                    {"name": "Business Tax Returns 2022–2024 — MISSING", "status": "missing"},
                ],
            },
            {
                "name": "Legal & Corporate",
                "icon": "shield",
                "docs": [
                    {"name": "Certificate of Formation (California)", "status": "complete", "size": "380 KB"},
                    {"name": "Operating Agreement — 2023 Amended", "status": "complete", "size": "1.4 MB"},
                    {"name": "Buy-Sell Agreement (2024)", "status": "complete", "size": "890 KB"},
                    {"name": "EIN Confirmation Letter (IRS)", "status": "complete", "size": "160 KB"},
                ],
            },
            {
                "name": "Client Contracts",
                "icon": "users",
                "docs": [
                    {"name": "Standard Retainer Agreement (MSA)", "status": "complete", "size": "620 KB"},
                    {"name": "Top 10 Client Contracts", "status": "complete", "size": "4.2 MB"},
                    {"name": "Pipeline Report (HubSpot Export) — MISSING", "status": "missing"},
                    {"name": "Client NPS Survey Results — MISSING", "status": "missing"},
                ],
            },
            {
                "name": "HR & People",
                "icon": "users",
                "docs": [
                    {"name": "Employee Roster with Compensation", "status": "complete", "size": "310 KB"},
                    {"name": "Org Chart (current)", "status": "complete", "size": "180 KB"},
                    {"name": "Payroll Summary 2022–2024 (Gusto)", "status": "complete", "size": "480 KB"},
                    {"name": "Non-Compete Agreements — MISSING", "status": "missing"},
                ],
            },
            {
                "name": "Operations",
                "icon": "tool",
                "docs": [
                    {"name": "Service Delivery Playbook", "status": "complete", "size": "2.1 MB"},
                    {"name": "Client Success Process Documentation", "status": "complete", "size": "860 KB"},
                    {"name": "Insurance Certificates (GL + E&O)", "status": "complete", "size": "940 KB"},
                    {"name": "Technology & Tools Inventory", "status": "complete", "size": "290 KB"},
                ],
            },
        ]
    },
    "buyer_questions": [
        {
            "id": 1,
            "category": "growth_drivers",
            "severity": "HIGH",
            "buyer_type": "PE",
            "question": "What is your current pipeline coverage ratio and typical sales cycle for new client acquisition?",
            "data_needed": "CRM pipeline export, average sales cycle data, new business development plan",
        },
        {
            "id": 2,
            "category": "customer_risk",
            "severity": "HIGH",
            "buyer_type": "All",
            "question": "What is the plan to reduce top-customer concentration (~49% of TTM) and reactivate dormant accounts?",
            "data_needed": "Account-level revenue roll-forward, reactivation outreach log, concentration mitigation plan",
        },
        {
            "id": 3,
            "category": "growth_drivers",
            "severity": "HIGH",
            "buyer_type": "PE",
            "question": "What is the documented plan to build pipeline and new logos beyond project-based municipal awards?",
            "data_needed": "3-year revenue forecast, BD budget and coverage, win-rate by segment",
        },
        {
            "id": 4,
            "category": "customer_risk",
            "severity": "MEDIUM",
            "buyer_type": "Strategic",
            "question": "How are client renewals managed and what is the NPS or client satisfaction measurement process?",
            "data_needed": "Client success playbook, QBR cadence documentation, NPS results",
        },
    ],
    # Monthly revenue: same seasonal shape and annual total as demo_company_seed
    # (MONTHLY_WEIGHTS_2025 × ANNUAL_REVENUE[2025]); each month is distinct; Dec
    # absorbs cent rounding so the sum equals exactly $4,196,172.
    "monthly_revenue": [
        {"month": "Jan '25", "revenue": 226593},
        {"month": "Feb '25", "revenue": 234986},
        {"month": "Mar '25", "revenue": 310517},
        {"month": "Apr '25", "revenue": 373459},
        {"month": "May '25", "revenue": 423813},
        {"month": "Jun '25", "revenue": 436402},
        {"month": "Jul '25", "revenue": 444794},
        {"month": "Aug '25", "revenue": 415421},
        {"month": "Sep '25", "revenue": 394440},
        {"month": "Oct '25", "revenue": 360871},
        {"month": "Nov '25", "revenue": 297928},
        {"month": "Dec '25", "revenue": 276948},
    ],
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _check_admin_key(x_admin_key: Optional[str] = Header(default=None)):
    if not settings.ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API key is not configured")
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Key header")
    return x_admin_key


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CreateLinkRequest(BaseModel):
    recipient_name: str
    recipient_firm: str
    recipient_email: str
    sender_note: Optional[str] = None


class VerifyAccessCodeRequest(BaseModel):
    code: str


# ---------------------------------------------------------------------------
# Generic demo access (shared passphrase when DEMO_ACCESS_CODE is set)
# ---------------------------------------------------------------------------

DEMO_ACCESS_TOKEN_EXPIRE_DAYS = 7


def _encode_demo_access_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=DEMO_ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": "demo_access", "exp": expire},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _demo_token_valid(token: str) -> bool:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub") == "demo_access"
    except JWTError:
        return False


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/demo/data")
def get_demo_data(db: Session = Depends(get_db)):
    """Return full ABC Company demo dataset with current lock state."""
    return {**DEMO_DATA, "demo_locked": get_demo_locked(db)}


@router.get("/demo/access-status")
def demo_access_status(
    x_demo_access_token: Optional[str] = Header(default=None, alias="X-Demo-Access-Token"),
):
    """Whether generic demo access is gated and whether the caller's token is valid.

    The demo is ALWAYS gated — access requires either:
      1. A valid JWT token obtained via /demo/verify-access-code (when DEMO_ACCESS_CODE is set), or
      2. A personalized slug link (/demo/:slug), which bypasses this check in the frontend.

    When DEMO_ACCESS_CODE is not configured, no code-based entry is possible;
    visitors must request access via email. The 'code_configured' field tells the
    frontend whether to show the code input form.
    """
    code_configured = bool(settings.DEMO_ACCESS_CODE)
    if x_demo_access_token and _demo_token_valid(x_demo_access_token):
        return {"required": True, "granted": True, "code_configured": code_configured}
    return {"required": True, "granted": False, "code_configured": code_configured}


@router.post("/demo/verify-access-code")
def verify_access_code(body: VerifyAccessCodeRequest):
    """Exchange the configured passphrase for a short-lived demo access JWT."""
    if not settings.DEMO_ACCESS_CODE:
        raise HTTPException(
            status_code=400,
            detail="Demo access code is not configured on the server",
        )
    provided = (body.code or "").strip()
    if not secrets.compare_digest(provided, settings.DEMO_ACCESS_CODE):
        raise HTTPException(status_code=401, detail="Invalid access code")
    token = _encode_demo_access_token()
    return {
        "access_token": token,
        "expires_in": DEMO_ACCESS_TOKEN_EXPIRE_DAYS * 86400,
    }


@router.get("/spots-remaining")
def get_spots_remaining(db: Session = Depends(get_db)):
    """Return current founding advisor spots remaining (from DB)."""
    from app.core.db_functions import get_spots_remaining as _db_spots
    return {"spots_remaining": _db_spots(db), "total_spots": TOTAL_SPOTS}


@router.post("/demo/create-link")
def create_demo_link(
    body: CreateLinkRequest,
    db: Session = Depends(get_db),
    _: str = Depends(_check_admin_key),
):
    """Create a personalized demo link for a specific recipient."""
    link = demo_service.create_demo_link(
        db=db,
        recipient_name=body.recipient_name,
        recipient_firm=body.recipient_firm,
        recipient_email=body.recipient_email,
        sender_note=body.sender_note,
    )

    return {
        "id": link.id,
        "slug": link.slug,
        "recipient_name": link.recipient_name,
        "recipient_firm": link.recipient_firm,
        "recipient_email": link.recipient_email,
        "sender_note": link.sender_note,
        "created_at": link.created_at.isoformat(),
        "demo_url": f"/demo/{link.slug}",
    }


@router.get("/demo/{slug}")
def get_personalized_demo(slug: str, db: Session = Depends(get_db)):
    """Return demo data personalized for the specific recipient link."""
    link = demo_service.get_personalized_demo(db, slug)

    return {
        "personalized": {
            "recipient_name": link.recipient_name,
            "recipient_firm": link.recipient_firm,
            "recipient_email": link.recipient_email,
        },
        "demo_data": {**DEMO_DATA, "demo_locked": get_demo_locked(db)},
    }


@router.post("/demo/{slug}/track")
def track_section(slug: str, body: dict, db: Session = Depends(get_db)):
    """Track which section a visitor viewed. Body: { section: str }"""
    section = body.get("section", "")
    demo_service.track_section_view(db, slug, section)
    return {"status": "ok"}


@router.post("/demo/{slug}/mark-converted")
def mark_demo_converted(slug: str, db: Session = Depends(get_db)):
    """Record that the visitor took a conversion action (e.g. requested Founding license)."""
    demo_service.mark_demo_converted(db, slug)
    return {"status": "ok"}


@router.get("/admin/demo-lock")
def get_demo_lock_status(
    db: Session = Depends(get_db),
    _: str = Depends(_check_admin_key),
):
    """Return current demo lock state."""
    return {"locked": get_demo_locked(db)}


class SetDemoLockRequest(BaseModel):
    locked: bool


@router.post("/admin/demo-lock")
def set_demo_lock(
    body: SetDemoLockRequest,
    db: Session = Depends(get_db),
    _: str = Depends(_check_admin_key),
):
    """Set demo lock state. When locked=true, all demo inputs are read-only for visitors."""
    new_state = set_demo_locked(db, body.locked)
    return {"locked": new_state}


@router.get("/admin/demos")
def list_demo_links(
    db: Session = Depends(get_db),
    _: str = Depends(_check_admin_key),
):
    """Return all demo links ordered by created_at descending."""
    links = demo_service.list_demo_links(db)
    return [
        {
            "id": lnk.id,
            "slug": lnk.slug,
            "recipient_name": lnk.recipient_name,
            "recipient_firm": lnk.recipient_firm,
            "recipient_email": lnk.recipient_email,
            "sender_note": lnk.sender_note,
            "created_at": lnk.created_at.isoformat() if lnk.created_at else None,
            "visit_count": lnk.visit_count,
            "first_visited_at": lnk.first_visited_at.isoformat() if lnk.first_visited_at else None,
            "last_visited_at": lnk.last_visited_at.isoformat() if lnk.last_visited_at else None,
            "converted": lnk.converted,
            "ref_code": lnk.ref_code,
            "demo_url": f"/demo/{lnk.slug}",
        }
        for lnk in links
    ]
