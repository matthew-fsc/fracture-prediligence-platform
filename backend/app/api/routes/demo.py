"""
Demo routes — static ABC Company demo payload, personalized demo links,
spots-remaining counter, and admin link management.

CSV sandbox samples for connectors live under `scripts/generate_sandbox_data.py` (separate narrative).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.services import demo_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Spots remaining — module-level mutable state
# ---------------------------------------------------------------------------
_spots_remaining = 18
TOTAL_SPOTS = settings.DEMO_TOTAL_SPOTS

# ---------------------------------------------------------------------------
# Static demo data — ABC Company (demo_company_seed.py TTM targets: ~$3.26M rev, ~$806K EBITDA)
# ---------------------------------------------------------------------------
DEMO_DATA = {
    "company": {
        "id": "demo",
        "name": "ABC Company Inc",
        "industry": "Field Services — Traffic Management & Transportation",
        "founded": 2009,
        "state": "CA",
        "employees": 13,
        "ttm_revenue": 3259172,
        "ebitda": 806357,
        "ebitda_margin": 24.7,
        "owner": "David Merrill",
        "advisor": "Sarah Chen, CEPA",
        "engagement_stage": "Pre-Diligence",
    },
    "drs": {
        "base": 48.9,
        "conservative": 46.5,
        "optimistic": 51.4,
        "tier": "High Risk",
        "contributions": {
            "revenue_quality": 13.0,
            "financial_integrity": 11.6,
            "operational_independence": 9.6,
            "customer_risk": 5.25,
            "management_team": 5.2,
            "growth_drivers": 4.25,
        },
    },
    "category_scores": {
        "revenue_quality": {
            "composite": 52,
            "data_confidence": "HIGH",
            "sub_scores": {
                "recurring_rate": {"score": 38, "label": "Low recurring mix — mostly project-based municipal work"},
                "concentration": {"score": 42, "label": "Top customer ~49% of TTM revenue"},
                "durability": {"score": 55, "label": "Government contracts; renewal timing uneven"},
                "consistency": {"score": 62, "label": "Revenue CV reflects project timing"},
                "nrr": {"score": 45, "label": "Limited expansion within existing accounts"},
            },
        },
        "financial_integrity": {
            "composite": 58,
            "data_confidence": "HIGH",
            "sub_scores": {
                "addback_exposure": {"score": 55, "label": "Officer salary $202K vs ~$120K market replacement"},
                "expense_completeness": {"score": 72, "label": "QB-style GL mapped to ontology categories"},
                "revenue_completeness": {"score": 78, "label": "Monthly 2025 + annual prior years"},
                "data_coverage": {"score": 68, "label": "3-year P&L path ingested"},
            },
        },
        "operational_independence": {
            "composite": 48,
            "data_confidence": "HIGH",
            "sub_scores": {
                "owner_comp": {"score": 50, "label": "Owner comp and field leadership overlap"},
                "key_person": {"score": 44, "label": "Owner-led ops and key estimates"},
                "management_depth": {"score": 52, "label": "Small leadership bench vs workload"},
                "staff_stability": {"score": 58, "label": "Field staff tenure mixed"},
            },
        },
        "customer_risk": {
            "composite": 35,
            "data_confidence": "HIGH",
            "sub_scores": {
                "concentration": {"score": 28, "label": "Top customer ~49% — buyer concentration risk"},
                "diversification": {"score": 40, "label": "55 active customers; revenue skewed to top 5"},
                "churn": {"score": 48, "label": "13 dormant accounts — concentration in active base"},
                "tenure": {"score": 52, "label": "Municipal relationships multi-year but lumpy"},
            },
        },
        "management_team": {
            "composite": 52,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "completeness": {"score": 54, "label": "Ops + field leads identified"},
                "size": {"score": 55, "label": "13 employees — lean vs revenue"},
                "ownership": {"score": 48, "label": "Owner-director role central"},
                "role_coverage": {"score": 50, "label": "Gaps in commercial / BD coverage"},
            },
        },
        "growth_drivers": {
            "composite": 42,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "revenue_cagr": {"score": 48, "label": "YoY growth uneven — project-driven"},
                "new_customers": {"score": 38, "label": "Limited new logo pipeline vs TTM"},
                "contract_pipeline": {"score": 40, "label": "No formal BD cadence"},
            },
        },
    },
    "enterprise_value": {
        "floor": 2016000,
        "midpoint": 2419000,
        "ceiling": 2822000,
        "multiple_used": "2.5-3.5",
        "ebitda_base": 806357,
        "multiple_basis": "drs_tier_heuristic",
        "drs_multiple_floor": 2.5,
        "drs_multiple_ceiling": 3.5,
        "market_reference": None,
        "valuation_summary": (
            "~$806K EBITDA proxy × High Risk DRS band (2.5x–3.5x per scoring_rules). "
            "Matches demo_company_seed.py P&L; live /api/analytics may blend market context."
        ),
        "source_citation": (
            "SCORING_RULES.enterprise_multiples HIGH_RISK (2.5x–3.5x) × rounded EBITDA basis from ABC seed."
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
            "description": "3-year revenue moves from ~$2.79M (2023) to ~$3.26M (2025 TTM) — positive but uneven and below typical buyer expectations for a growth premium without a formal BD engine.",
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
                    {"name": "Certificate of Formation (Colorado)", "status": "complete", "size": "380 KB"},
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
    "monthly_revenue": [
        {"month": "Jan '25", "revenue": 271598},
        {"month": "Feb '25", "revenue": 271598},
        {"month": "Mar '25", "revenue": 271598},
        {"month": "Apr '25", "revenue": 271598},
        {"month": "May '25", "revenue": 271598},
        {"month": "Jun '25", "revenue": 271598},
        {"month": "Jul '25", "revenue": 271598},
        {"month": "Aug '25", "revenue": 271598},
        {"month": "Sep '25", "revenue": 271598},
        {"month": "Oct '25", "revenue": 271598},
        {"month": "Nov '25", "revenue": 271598},
        {"month": "Dec '25", "revenue": 271594},
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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/demo/data")
def get_demo_data():
    """Return full Meridian Consulting Group demo dataset."""
    return DEMO_DATA


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
        "demo_data": DEMO_DATA,
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
