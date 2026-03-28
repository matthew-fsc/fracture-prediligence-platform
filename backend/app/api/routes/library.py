"""Advisory Library — CRUD API for the unified catalog of buyer questions,
value creation initiatives, and risk flags."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.ontology.models import AdvisoryLibraryItem

router = APIRouter()

DRS_CATEGORIES = [
    "revenue_quality",
    "financial_integrity",
    "operational_independence",
    "customer_risk",
    "management_team",
    "growth_drivers",
]

ITEM_TYPES = ["buyer_question", "initiative", "risk_flag"]
SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM"]
BUYER_TYPES = ["PE", "Strategic", "Financial", "All"]


def _row_to_dict(item: AdvisoryLibraryItem) -> dict:
    return {
        "id": item.id,
        "item_type": item.item_type,
        "title": item.title,
        "description": item.description,
        "category": item.category,
        "severity": item.severity,
        "buyer_type": item.buyer_type,
        "tags": json.loads(item.tags_json) if item.tags_json else [],
        "data_needed": item.data_needed,
        "score_trigger": float(item.score_trigger) if item.score_trigger is not None else None,
        "effort": item.effort,
        "timeline": item.timeline,
        "ev_impact": item.ev_impact,
        "source": item.source,
        "is_active": item.is_active,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/")
def list_library_items(
    item_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    buyer_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(AdvisoryLibraryItem)
    if item_type:
        q = q.filter(AdvisoryLibraryItem.item_type == item_type)
    if category:
        q = q.filter(AdvisoryLibraryItem.category == category)
    if severity:
        q = q.filter(AdvisoryLibraryItem.severity == severity)
    if buyer_type:
        q = q.filter(AdvisoryLibraryItem.buyer_type == buyer_type)
    if source:
        q = q.filter(AdvisoryLibraryItem.source == source)
    if is_active is not None:
        q = q.filter(AdvisoryLibraryItem.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter(
            AdvisoryLibraryItem.title.ilike(like)
            | AdvisoryLibraryItem.description.ilike(like)
            | AdvisoryLibraryItem.tags_json.ilike(like)
        )
    items = q.order_by(AdvisoryLibraryItem.item_type, AdvisoryLibraryItem.category, AdvisoryLibraryItem.id).all()
    return {"items": [_row_to_dict(i) for i in items], "total": len(items)}


class LibraryItemCreate(BaseModel):
    item_type: str
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    buyer_type: Optional[str] = None
    tags: Optional[list[str]] = None
    data_needed: Optional[str] = None
    score_trigger: Optional[float] = None
    effort: Optional[str] = None
    timeline: Optional[str] = None
    ev_impact: Optional[str] = None


class LibraryItemUpdate(BaseModel):
    item_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    buyer_type: Optional[str] = None
    tags: Optional[list[str]] = None
    data_needed: Optional[str] = None
    score_trigger: Optional[float] = None
    effort: Optional[str] = None
    timeline: Optional[str] = None
    ev_impact: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/")
def create_library_item(body: LibraryItemCreate, db: Session = Depends(get_db)):
    if body.item_type not in ITEM_TYPES:
        raise HTTPException(400, f"item_type must be one of {ITEM_TYPES}")
    if body.category and body.category not in DRS_CATEGORIES:
        raise HTTPException(400, f"category must be one of {DRS_CATEGORIES}")

    item = AdvisoryLibraryItem(
        item_type=body.item_type,
        title=body.title,
        description=body.description,
        category=body.category,
        severity=body.severity,
        buyer_type=body.buyer_type,
        tags_json=json.dumps(body.tags) if body.tags else None,
        data_needed=body.data_needed,
        score_trigger=body.score_trigger,
        effort=body.effort,
        timeline=body.timeline,
        ev_impact=body.ev_impact,
        source="advisor",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _row_to_dict(item)


@router.patch("/{item_id}")
def update_library_item(item_id: int, body: LibraryItemUpdate, db: Session = Depends(get_db)):
    item = db.query(AdvisoryLibraryItem).filter(AdvisoryLibraryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Library item not found")

    if body.item_type is not None:
        if body.item_type not in ITEM_TYPES:
            raise HTTPException(400, f"item_type must be one of {ITEM_TYPES}")
        item.item_type = body.item_type
    if body.title is not None:
        item.title = body.title
    if body.description is not None:
        item.description = body.description
    if body.category is not None:
        if body.category and body.category not in DRS_CATEGORIES:
            raise HTTPException(400, f"category must be one of {DRS_CATEGORIES}")
        item.category = body.category
    if body.severity is not None:
        item.severity = body.severity
    if body.buyer_type is not None:
        item.buyer_type = body.buyer_type
    if body.tags is not None:
        item.tags_json = json.dumps(body.tags)
    if body.data_needed is not None:
        item.data_needed = body.data_needed
    if body.score_trigger is not None:
        item.score_trigger = body.score_trigger
    if body.effort is not None:
        item.effort = body.effort
    if body.timeline is not None:
        item.timeline = body.timeline
    if body.ev_impact is not None:
        item.ev_impact = body.ev_impact
    if body.is_active is not None:
        item.is_active = body.is_active

    db.commit()
    db.refresh(item)
    return _row_to_dict(item)


@router.delete("/{item_id}")
def delete_library_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(AdvisoryLibraryItem).filter(AdvisoryLibraryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Library item not found")
    db.delete(item)
    db.commit()
    return {"ok": True, "deleted_id": item_id}


@router.get("/meta")
def library_metadata():
    """Return valid enum values for the frontend to build filter dropdowns."""
    return {
        "item_types": ITEM_TYPES,
        "categories": DRS_CATEGORIES,
        "severities": SEVERITIES,
        "buyer_types": BUYER_TYPES,
        "efforts": ["Low", "Medium", "High"],
        "ev_impacts": ["Low", "Medium", "High", "Critical"],
        "sources": ["system", "advisor"],
    }


def seed_library_if_empty(db: Session) -> int:
    """Populate the advisory library from the hardcoded question/initiative templates.
    Only runs if the table is empty (first boot)."""
    existing = db.query(AdvisoryLibraryItem).count()
    if existing > 0:
        return 0

    from app.analytics.a13_buyer_questions import _LIBRARY as Q_LIBRARY

    count = 0

    # Seed buyer questions
    for category, templates in Q_LIBRARY.items():
        for trigger, severity, buyer_type, question, data_needed in templates:
            db.add(AdvisoryLibraryItem(
                item_type="buyer_question",
                title=question,
                description=None,
                category=category,
                severity=severity,
                buyer_type=buyer_type,
                data_needed=data_needed,
                score_trigger=trigger,
                source="system",
            ))
            count += 1

    # Seed initiatives from the known template set
    INIT_LIBRARY = {
        "revenue_quality": [
            {"title": "Formalize recurring contracts", "effort": "Medium", "timeline": "60–90 days", "ev_impact": "High", "description": "Convert month-to-month clients to annual contracts to reduce concentration risk."},
            {"title": "Implement CRM pipeline tracker", "effort": "Low", "timeline": "30 days", "ev_impact": "Medium", "description": "Document all revenue relationships in a CRM to create institutional visibility."},
        ],
        "operational_independence": [
            {"title": "Document all core operating procedures", "effort": "Medium", "timeline": "60 days", "ev_impact": "High", "description": "Create SOPs for client onboarding, service delivery, and account management."},
            {"title": "Hire or promote an operations manager", "effort": "High", "timeline": "60–120 days", "ev_impact": "Critical", "description": "A credible GM/COO running day-to-day removes the largest PE valuation discount."},
        ],
        "customer_risk": [
            {"title": "Reduce top-customer revenue concentration", "effort": "High", "timeline": "6–12 months", "ev_impact": "High", "description": "Target: no single customer > 20% of revenue."},
            {"title": "Add customer reference letters to VDR", "effort": "Low", "timeline": "14 days", "ev_impact": "Medium", "description": "Written references reduce buyer concern about post-close customer attrition."},
        ],
        "management_team": [
            {"title": "Hire fractional CFO", "effort": "Medium", "timeline": "30–60 days", "ev_impact": "High", "description": "Financial leadership independent of the owner removes a major red flag for PE buyers."},
            {"title": "Execute retention agreements for key managers", "effort": "Low", "timeline": "14 days", "ev_impact": "High", "description": "Retention bonuses tied to transaction close remove key-person deal risk."},
        ],
        "financial_integrity": [
            {"title": "Commission a CPA review or audit", "effort": "Low", "timeline": "30–60 days", "ev_impact": "Critical", "description": "An independent CPA review dramatically increases buyer confidence."},
            {"title": "Prepare 3-year normalized EBITDA schedule", "effort": "Low", "timeline": "14 days", "ev_impact": "High", "description": "Document each add-back with supporting receipts to reduce buyer skepticism."},
        ],
        "growth_drivers": [
            {"title": "Build and document a 3-year growth plan", "effort": "Low", "timeline": "30 days", "ev_impact": "Medium", "description": "A credible, data-backed growth plan increases strategic value to potential buyers."},
            {"title": "Launch structured outbound sales motion", "effort": "Medium", "timeline": "60–90 days", "ev_impact": "High", "description": "Adding a repeatable new-client acquisition channel improves growth score."},
        ],
    }

    for category, inits in INIT_LIBRARY.items():
        for init in inits:
            db.add(AdvisoryLibraryItem(
                item_type="initiative",
                title=init["title"],
                description=init["description"],
                category=category,
                effort=init.get("effort"),
                timeline=init.get("timeline"),
                ev_impact=init.get("ev_impact"),
                source="system",
            ))
            count += 1

    # Seed a few risk flags derived from the question library (the highest-severity items)
    risk_flags = [
        {"title": "Owner dependency — single point of failure", "category": "operational_independence", "severity": "CRITICAL",
         "description": "The business cannot sustain 90 days without the owner. Key relationships, decisions, and institutional knowledge are concentrated in one person."},
        {"title": "Customer concentration above 40%", "category": "customer_risk", "severity": "CRITICAL",
         "description": "Top 2 customers represent an outsized share of revenue. Loss of either would materially impact enterprise value."},
        {"title": "No audited or reviewed financials", "category": "financial_integrity", "severity": "CRITICAL",
         "description": "Financials have not been independently reviewed or audited by a CPA, reducing buyer confidence in reported numbers."},
        {"title": "Key-person flight risk", "category": "management_team", "severity": "HIGH",
         "description": "One or more critical managers may leave in the event of an acquisition. No retention agreements are in place."},
        {"title": "Insufficient financial history", "category": "financial_integrity", "severity": "HIGH",
         "description": "Less than 36 months of P&L history is available, limiting a buyer's ability to assess trends and normalize earnings."},
        {"title": "Revenue decline year without explanation", "category": "financial_integrity", "severity": "HIGH",
         "description": "Revenue declined in a recent fiscal year and no documented explanation or corrective action is on file."},
        {"title": "No recurring revenue contracts", "category": "revenue_quality", "severity": "HIGH",
         "description": "Revenue is entirely project-based or transactional with no contractual recurring component."},
        {"title": "Weak or undocumented growth pipeline", "category": "growth_drivers", "severity": "MEDIUM",
         "description": "No formal sales pipeline, CRM tracking, or documented growth strategy exists."},
    ]
    for rf in risk_flags:
        db.add(AdvisoryLibraryItem(
            item_type="risk_flag",
            title=rf["title"],
            description=rf["description"],
            category=rf["category"],
            severity=rf["severity"],
            source="system",
        ))
        count += 1

    db.commit()
    return count
