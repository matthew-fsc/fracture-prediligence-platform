"""
Demo routes — Meridian Consulting Group demo data, personalized demo links,
spots-remaining counter, and admin link management.
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
# Static demo data — Meridian Consulting Group (mirrors company_id=1 sandbox)
# ---------------------------------------------------------------------------
DEMO_DATA = {
    "company": {
        "id": "demo",
        "name": "Meridian Consulting Group",
        "industry": "Professional Services / Management Consulting",
        "founded": 2014,
        "state": "CO",
        "employees": 13,
        "ttm_revenue": 4280000,
        "ebitda": 2400000,
        "ebitda_margin": 56.1,
        "owner": "David Merrill",
        "advisor": "Sarah Chen, CEPA",
        "engagement_stage": "Pre-Diligence",
    },
    "drs": {
        "base": 81.2,
        "conservative": 77.4,
        "optimistic": 85.1,
        "tier": "Investment Grade",
        "contributions": {
            "revenue_quality": 17.6,
            "financial_integrity": 18.3,
            "operational_independence": 16.1,
            "customer_risk": 14.96,
            "management_team": 16.4,
            "growth_drivers": 10.76,
        },
    },
    "category_scores": {
        "revenue_quality": {
            "composite": 88,
            "data_confidence": "HIGH",
            "sub_scores": {
                "recurring_rate": {"score": 91, "label": "87% recurring retainer contracts"},
                "concentration": {"score": 82, "label": "Top customer 19% of revenue"},
                "durability": {"score": 90, "label": "83% of contracts multi-year"},
                "consistency": {"score": 88, "label": "CV 9% — highly consistent"},
                "nrr": {"score": 89, "label": "NRR 104% — net expansion"},
            },
        },
        "financial_integrity": {
            "composite": 91.5,
            "data_confidence": "HIGH",
            "sub_scores": {
                "addback_exposure": {"score": 88, "label": "Owner comp $320K vs $280K market (modest delta)"},
                "expense_completeness": {"score": 96, "label": "96% categorized"},
                "revenue_completeness": {"score": 98, "label": "98% with period + type"},
                "data_coverage": {"score": 95, "label": "36 months of data"},
            },
        },
        "operational_independence": {
            "composite": 80.7,
            "data_confidence": "HIGH",
            "sub_scores": {
                "owner_comp": {"score": 82, "label": "Owner comp $320K vs $280K market ($40K delta)"},
                "key_person": {"score": 76, "label": "3 senior consultants run day-to-day delivery"},
                "management_depth": {"score": 84, "label": "Director of Ops + Practice Leads in place"},
                "staff_stability": {"score": 88, "label": "Avg tenure 5.8 years"},
            },
        },
        "customer_risk": {
            "composite": 74.8,
            "data_confidence": "HIGH",
            "sub_scores": {
                "concentration": {"score": 72, "label": "Top customer 19% of revenue"},
                "diversification": {"score": 79, "label": "18 active customers, 4 industries"},
                "churn": {"score": 71, "label": "28% inactive last 12 months — GAP"},
                "tenure": {"score": 80, "label": "Avg tenure 4.1 years"},
            },
        },
        "management_team": {
            "composite": 82,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "completeness": {"score": 84, "label": "Director of Ops, 3 Practice Leads"},
                "size": {"score": 80, "label": "13 employees, 4 leadership roles"},
                "ownership": {"score": 78, "label": "Partial equity sharing with 2 principals"},
                "role_coverage": {"score": 86, "label": "Operations and delivery well-covered"},
            },
        },
        "growth_drivers": {
            "composite": 53.8,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "revenue_cagr": {"score": 58, "label": "CAGR 7.9% (2022–2024) — below benchmark"},
                "new_customers": {"score": 46, "label": "Pipeline 0.46x coverage — GAP"},
                "contract_pipeline": {"score": 55, "label": "No formal new business development process"},
            },
        },
    },
    "enterprise_value": {
        "floor": 12000000,
        "midpoint": 14400000,
        "ceiling": 16800000,
        "multiple_used": "5.0-7.0",
        "ebitda_base": 2400000,
        "multiple_basis": "blended",
        "drs_multiple_floor": 5.0,
        "drs_multiple_ceiling": 7.0,
        "market_reference": None,
        "valuation_summary": "Illustrative demo EV — not tied to live benchmark seed data.",
        "source_citation": "Illustrative demo EV — not tied to live benchmark seed data.",
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
            "title": "28% customer churn rate — above professional services benchmark",
            "description": "13 of 18 customers are active; 5 accounts went inactive in the trailing 12 months. Industry benchmark for management consulting is 10–15% annual churn. Buyers will apply a revenue quality discount until a retention program is demonstrated.",
            "data_needed": "Churn analysis by account, client health scoring system",
            "timeline": "6 months",
            "ev_impact": 840000,
        },
        {
            "id": 3,
            "severity": "MEDIUM",
            "category": "growth_drivers",
            "title": "CAGR 7.9% trails professional services benchmark of 12%+",
            "description": "Revenue grew from $3.7M to $4.28M over 36 months — solid but below the benchmark buyers use to justify a premium multiple. Without a documented pipeline and growth plan, buyers will not apply a growth premium to the valuation.",
            "data_needed": "Revenue forecast by account, market expansion plan",
            "timeline": "9 months",
            "ev_impact": 720000,
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
            "question": "Why did 5 accounts go inactive in the trailing 12 months and what is the reactivation pipeline?",
            "data_needed": "Churn analysis by account with exit reasons, reactivation outreach log",
        },
        {
            "id": 3,
            "category": "growth_drivers",
            "severity": "HIGH",
            "buyer_type": "PE",
            "question": "What is the documented plan to accelerate revenue growth from 7.9% CAGR to the 15–20% range required for a premium multiple?",
            "data_needed": "3-year revenue forecast, market expansion plan, new service line roadmap",
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
        {"month": "Jan '24", "revenue": 312000},
        {"month": "Feb '24", "revenue": 298000},
        {"month": "Mar '24", "revenue": 358000},
        {"month": "Apr '24", "revenue": 382000},
        {"month": "May '24", "revenue": 421000},
        {"month": "Jun '24", "revenue": 395000},
        {"month": "Jul '24", "revenue": 368000},
        {"month": "Aug '24", "revenue": 412000},
        {"month": "Sep '24", "revenue": 389000},
        {"month": "Oct '24", "revenue": 354000},
        {"month": "Nov '24", "revenue": 341000},
        {"month": "Dec '24", "revenue": 250000},
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
