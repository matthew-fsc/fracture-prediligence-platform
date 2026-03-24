"""
Demo routes — Lakeside HVAC Services demo data, personalized demo links,
spots-remaining counter, and admin link management.
"""

import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.ontology.models import DemoLink

router = APIRouter()

# ---------------------------------------------------------------------------
# Hardcoded admin key — in production this would be an env var
# ---------------------------------------------------------------------------
ADMIN_API_KEY = "fs-admin-2026"

# ---------------------------------------------------------------------------
# Spots remaining — module-level mutable state
# ---------------------------------------------------------------------------
_spots_remaining = 18
TOTAL_SPOTS = 20

# ---------------------------------------------------------------------------
# Static demo data — Lakeside HVAC Services LLC
# ---------------------------------------------------------------------------
DEMO_DATA = {
    "company": {
        "id": "demo",
        "name": "Lakeside HVAC Services LLC",
        "industry": "HVAC / Mechanical Services",
        "founded": 2009,
        "state": "OH",
        "employees": 9,
        "ttm_revenue": 2397000,
        "ebitda": 522000,
        "ebitda_margin": 21.8,
        "owner": "Doug Holt",
        "advisor": "Sarah Chen, CEPA",
        "engagement_stage": "Pre-Diligence",
    },
    "drs": {
        "base": 67.4,
        "conservative": 63.1,
        "optimistic": 71.2,
        "tier": "Near Investment Grade",
        "contributions": {
            "revenue_quality": 16.25,
            "financial_integrity": 14.4,
            "operational_independence": 11.4,
            "customer_risk": 10.95,
            "management_team": 6.8,
            "growth_drivers": 7.6,
        },
    },
    "category_scores": {
        "revenue_quality": {
            "composite": 65,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "recurring_rate": {"score": 58, "label": "43% recurring (service contracts)"},
                "concentration": {"score": 72, "label": "Top customer 28% of revenue"},
                "durability": {"score": 61, "label": "61% of contracts multi-year"},
                "consistency": {"score": 70, "label": "CV 24% — seasonal variation"},
                "nrr": {"score": 64, "label": "NRR 91% — moderate churn"},
            },
        },
        "financial_integrity": {
            "composite": 72,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "addback_exposure": {"score": 64, "label": "Owner/personal 22% of expenses ($114K addbacks)"},
                "expense_completeness": {"score": 88, "label": "88% categorized"},
                "revenue_completeness": {"score": 95, "label": "95% with period + type"},
                "data_coverage": {"score": 80, "label": "24 months of data"},
            },
        },
        "operational_independence": {
            "composite": 57,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "owner_comp": {"score": 62, "label": "Owner comp $185K vs $120K market rate"},
                "key_person": {"score": 38, "label": "Owner manages all client relationships"},
                "management_depth": {"score": 55, "label": "1 service manager, no financial leadership"},
                "staff_stability": {"score": 82, "label": "Avg tenure 4.2 years"},
            },
        },
        "customer_risk": {
            "composite": 73,
            "data_confidence": "HIGH",
            "sub_scores": {
                "concentration": {"score": 68, "label": "Lakeside Commons Apts: 28% of revenue"},
                "diversification": {"score": 79, "label": "340 active customers, 3 industries"},
                "churn": {"score": 77, "label": "11% inactive last 12 months"},
                "tenure": {"score": 81, "label": "Avg tenure 5.1 years"},
            },
        },
        "management_team": {
            "composite": 68,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "completeness": {"score": 60, "label": "Missing CFO/Controller and Sales lead"},
                "size": {"score": 72, "label": "9 employees, 2 management roles"},
                "ownership": {"score": 55, "label": "100% owner-held, no equity sharing"},
                "role_coverage": {"score": 74, "label": "Operations covered, Finance gap"},
            },
        },
        "growth_drivers": {
            "composite": 76,
            "data_confidence": "MEDIUM",
            "sub_scores": {
                "revenue_cagr": {"score": 78, "label": "CAGR 11.2% (2022–2024)"},
                "new_customers": {"score": 72, "label": "18% new customers YoY"},
                "contract_pipeline": {"score": 80, "label": "1.2x pipeline coverage"},
            },
        },
    },
    "enterprise_value": {
        "floor": 1566000,
        "midpoint": 2088000,
        "ceiling": 2610000,
        "multiple_used": "3.0-5.0",
        "ebitda_base": 522000,
    },
    "flagged_issues": [
        {
            "id": 1,
            "severity": "CRITICAL",
            "category": "operational_independence",
            "title": "Owner-dependent sales — key person risk",
            "description": "Doug Holt manages all customer acquisition and renewal conversations personally. No documented handoff process exists. A buyer would need a 12-18 month earnout to mitigate this risk.",
            "data_needed": "Document CRM process, assign service manager to 30% of accounts",
            "timeline": "12 months",
            "ev_impact": 280000,
        },
        {
            "id": 2,
            "severity": "HIGH",
            "category": "customer_risk",
            "title": "28% revenue concentration — Lakeside Commons Apartments",
            "description": "A single property management client represents $671,000 of $2.4M TTM revenue. Their 3-year service agreement expires in 14 months. Any buyer will price this risk into their offer.",
            "data_needed": "Renewal negotiations, backup commercial pipeline, contract copy",
            "timeline": "6 months",
            "ev_impact": 195000,
        },
        {
            "id": 3,
            "severity": "HIGH",
            "category": "financial_integrity",
            "title": "No CPA-reviewed financials — self-prepared QuickBooks only",
            "description": "Three years of P&Ls are owner-prepared. PE buyers and SBA lenders require at minimum a CPA review engagement. Without it, defensible EBITDA cannot be confirmed and buyers will apply a 15-20% discount.",
            "data_needed": "CPA review letter for FY2022–2024, addback schedule",
            "timeline": "3 months",
            "ev_impact": 155000,
        },
        {
            "id": 4,
            "severity": "MEDIUM",
            "category": "revenue_quality",
            "title": "Service contracts lack auto-renewal clauses",
            "description": "14 of 23 commercial service agreements require manual renewal each year. This creates unnecessary churn risk and reduces contract durability scores. Standardized MSA with auto-renewal would add ~$180K to durable ARR.",
            "data_needed": "Updated MSA template, customer re-signature campaign",
            "timeline": "6 months",
            "ev_impact": 92000,
        },
    ],
    "checklist": {
        "total": 15,
        "completed": 9,
        "pct": 60,
        "items": [
            {"id": 1, "category": "Legal", "name": "Certificate of Formation / Articles of Organization", "status": "complete"},
            {"id": 2, "category": "Legal", "name": "EIN confirmation letter", "status": "complete"},
            {"id": 3, "category": "Legal", "name": "Operating Agreement (current)", "status": "complete"},
            {"id": 4, "category": "Legal", "name": "Buy-Sell Agreement", "status": "missing"},
            {"id": 5, "category": "Financial", "name": "P&L Statement 2022–2024 (owner-prepared)", "status": "complete"},
            {"id": 6, "category": "Financial", "name": "Balance Sheet 2022–2024", "status": "complete"},
            {"id": 7, "category": "Financial", "name": "CPA Review or Audit Letter", "status": "missing"},
            {"id": 8, "category": "Financial", "name": "Business Tax Returns 2022–2024", "status": "missing"},
            {"id": 9, "category": "Operations", "name": "Equipment & Vehicle Inventory", "status": "complete"},
            {"id": 10, "category": "Operations", "name": "Supplier and Vendor List", "status": "complete"},
            {"id": 11, "category": "Operations", "name": "Insurance Certificates (GL + Workers Comp)", "status": "complete"},
            {"id": 12, "category": "HR", "name": "Employee Roster with Compensation", "status": "complete"},
            {"id": 13, "category": "HR", "name": "Non-Compete and Non-Solicitation Agreements", "status": "missing"},
            {"id": 14, "category": "Customers", "name": "Top 10 Customer Contracts", "status": "missing"},
            {"id": 15, "category": "Customers", "name": "Customer List with Revenue by Account (3yr)", "status": "complete"},
        ],
    },
    "data_room": {
        "sections": [
            {
                "name": "Financial Documents",
                "icon": "dollar",
                "docs": [
                    {"name": "P&L 2022–2024 (QuickBooks Export)", "status": "complete", "size": "2.1 MB"},
                    {"name": "Balance Sheet — Dec 2024", "status": "complete", "size": "840 KB"},
                    {"name": "Equipment Depreciation Schedule", "status": "complete", "size": "310 KB"},
                    {"name": "Owner Add-Back Schedule (draft)", "status": "complete", "size": "185 KB"},
                    {"name": "CPA Review Letter — MISSING", "status": "missing"},
                    {"name": "Business Tax Returns 2022–2024 — MISSING", "status": "missing"},
                ],
            },
            {
                "name": "Legal & Corporate",
                "icon": "shield",
                "docs": [
                    {"name": "Certificate of Formation (Ohio)", "status": "complete", "size": "420 KB"},
                    {"name": "Operating Agreement — 2021 Amended", "status": "complete", "size": "1.2 MB"},
                    {"name": "EIN Confirmation Letter (IRS)", "status": "complete", "size": "180 KB"},
                    {"name": "Buy-Sell Agreement — MISSING", "status": "missing"},
                ],
            },
            {
                "name": "Customer Contracts",
                "icon": "users",
                "docs": [
                    {"name": "Standard Residential Service Agreement", "status": "complete", "size": "560 KB"},
                    {"name": "Lakeside Commons — Commercial MSA", "status": "complete", "size": "1.8 MB"},
                    {"name": "Commercial Contract Renewals (14 accounts) — MISSING", "status": "missing"},
                    {"name": "Warranty Documentation — MISSING", "status": "missing"},
                ],
            },
            {
                "name": "HR & People",
                "icon": "users",
                "docs": [
                    {"name": "Employee Roster with Compensation", "status": "complete", "size": "290 KB"},
                    {"name": "Employee Handbook (2023)", "status": "complete", "size": "3.4 MB"},
                    {"name": "Payroll Summary 2022–2024", "status": "complete", "size": "510 KB"},
                    {"name": "Non-Compete Agreements — MISSING", "status": "missing"},
                ],
            },
            {
                "name": "Operations",
                "icon": "tool",
                "docs": [
                    {"name": "Vehicle & Equipment Fleet Inventory", "status": "complete", "size": "680 KB"},
                    {"name": "Supplier and Vendor List", "status": "complete", "size": "220 KB"},
                    {"name": "Insurance Certificates (GL + WC)", "status": "complete", "size": "1.1 MB"},
                    {"name": "HVAC Contractor License (Ohio)", "status": "complete", "size": "95 KB"},
                ],
            },
        ]
    },
    "buyer_questions": [
        {
            "id": 1,
            "category": "operational_independence",
            "severity": "CRITICAL",
            "buyer_type": "PE",
            "question": "What happens to customer relationships if Doug Holt is unavailable for 90 days?",
            "data_needed": "Transition plan, CRM ownership documentation",
        },
        {
            "id": 2,
            "category": "customer_risk",
            "severity": "HIGH",
            "buyer_type": "All",
            "question": "What is the renewal status of the Lakeside Commons service agreement expiring in 14 months?",
            "data_needed": "Renewal conversation notes, contract extension terms",
        },
        {
            "id": 3,
            "category": "financial_integrity",
            "severity": "HIGH",
            "buyer_type": "PE",
            "question": "Can you provide CPA-reviewed or audited financials for the past 3 years?",
            "data_needed": "CPA engagement letter, review report",
        },
        {
            "id": 4,
            "category": "revenue_quality",
            "severity": "MEDIUM",
            "buyer_type": "Strategic",
            "question": "What percentage of your commercial service agreements auto-renew vs. require manual renewal?",
            "data_needed": "Contract schedule with renewal terms for all commercial accounts",
        },
    ],
    "monthly_revenue": [
        {"month": "Jan '24", "revenue": 148000},
        {"month": "Feb '24", "revenue": 162000},
        {"month": "Mar '24", "revenue": 198000},
        {"month": "Apr '24", "revenue": 241000},
        {"month": "May '24", "revenue": 287000},
        {"month": "Jun '24", "revenue": 312000},
        {"month": "Jul '24", "revenue": 298000},
        {"month": "Aug '24", "revenue": 264000},
        {"month": "Sep '24", "revenue": 218000},
        {"month": "Oct '24", "revenue": 194000},
        {"month": "Nov '24", "revenue": 168000},
        {"month": "Dec '24", "revenue": 107000},
    ],
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _check_admin_key(x_admin_key: Optional[str] = Header(default=None)):
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Key header")
    return x_admin_key


def _generate_slug(recipient_name: str) -> str:
    name_part = recipient_name.lower().replace(" ", "-")[:20]
    rand_part = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"{name_part}-{rand_part}"


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
    """Return full Lakeside HVAC Services demo dataset."""
    return DEMO_DATA


@router.get("/spots-remaining")
def get_spots_remaining():
    """Return current founding advisor spots remaining."""
    return {"spots_remaining": _spots_remaining, "total_spots": TOTAL_SPOTS}


@router.post("/demo/create-link")
def create_demo_link(
    body: CreateLinkRequest,
    db: Session = Depends(get_db),
    _: str = Depends(_check_admin_key),
):
    """Create a personalized demo link for a specific recipient."""
    slug = _generate_slug(body.recipient_name)

    # Ensure slug uniqueness — retry up to 5 times
    for _ in range(5):
        existing = db.query(DemoLink).filter(DemoLink.slug == slug).first()
        if not existing:
            break
        slug = _generate_slug(body.recipient_name)

    link = DemoLink(
        slug=slug,
        recipient_name=body.recipient_name,
        recipient_firm=body.recipient_firm,
        recipient_email=body.recipient_email,
        sender_note=body.sender_note,
        created_at=datetime.utcnow(),
    )
    db.add(link)
    db.commit()
    db.refresh(link)

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
    link = db.query(DemoLink).filter(DemoLink.slug == slug).first()
    if not link:
        raise HTTPException(status_code=404, detail="Demo link not found")

    now = datetime.utcnow()
    link.visit_count = (link.visit_count or 0) + 1
    if link.first_visited_at is None:
        link.first_visited_at = now
    link.last_visited_at = now
    db.commit()

    return {
        "personalized": {
            "recipient_name": link.recipient_name,
            "recipient_firm": link.recipient_firm,
            "recipient_email": link.recipient_email,
        },
        "demo_data": DEMO_DATA,
    }


@router.get("/admin/demos")
def list_demo_links(
    db: Session = Depends(get_db),
    _: str = Depends(_check_admin_key),
):
    """Return all demo links ordered by created_at descending."""
    links = db.query(DemoLink).order_by(DemoLink.created_at.desc()).all()
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
