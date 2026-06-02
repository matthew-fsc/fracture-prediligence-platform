"""
Owner onboarding routes — self-service data input for business owners.

Business owners arrive via a ClientAccess invite link. These endpoints let them
update their company's basic profile and mark the onboarding wizard complete.

Endpoints:
  GET  /api/owner-onboarding/{company_id}          — get basics + onboarding status
  PATCH /api/owner-onboarding/{company_id}/company  — update company basics
  POST  /api/owner-onboarding/{company_id}/complete — mark onboarding done
"""

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import ClientAccess, ClientAccessStatus, Company

router = APIRouter()


# ---------------------------------------------------------------------------
# Dependency: resolve a company that the current user has client (owner) access to
# ---------------------------------------------------------------------------

def _get_owner_company(company_id: int, user: CurrentUser, db: Session) -> Company:
    """Return the Company if the user has an ACCEPTED ClientAccess record for it."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Allow the advisor (company owner) to access this too — useful for testing
    if company.owner_user_id == user.user_id:
        return company

    access = (
        db.query(ClientAccess)
        .filter(
            ClientAccess.company_id == company_id,
            ClientAccess.client_user_id == user.user_id,
            ClientAccess.status == ClientAccessStatus.ACCEPTED,
        )
        .first()
    )
    if not access:
        raise HTTPException(status_code=403, detail="You do not have access to this company")
    return company


async def get_owner_company(
    company_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Company:
    return _get_owner_company(company_id, user, db)


OwnerCompany = Annotated[Company, Depends(get_owner_company)]


# ---------------------------------------------------------------------------
# GET /api/owner-onboarding/{company_id}
# ---------------------------------------------------------------------------

@router.get("/owner-onboarding/{company_id}")
def get_onboarding_state(company: OwnerCompany, db: Session = Depends(get_db)):
    """Return company basics and onboarding completion status for the owner wizard."""
    return {
        "company_id": company.id,
        "name": company.name,
        "industry": company.industry,
        "founded": company.founded,
        "state": company.state,
        "entity_type": company.entity_type,
        "total_headcount": company.total_headcount,
        "owner_onboarding_completed_at": (
            company.owner_onboarding_completed_at.isoformat()
            if company.owner_onboarding_completed_at else None
        ),
        "onboarding_complete": company.owner_onboarding_completed_at is not None,
    }


# ---------------------------------------------------------------------------
# PATCH /api/owner-onboarding/{company_id}/company — update company basics
# ---------------------------------------------------------------------------

INDUSTRY_CHOICES = [
    "technology", "manufacturing", "healthcare", "professional_services",
    "retail", "construction", "financial_services", "distribution",
    "food_beverage", "real_estate", "education", "media_entertainment",
    "transportation", "energy", "agriculture", "other",
]

ENTITY_TYPES = ["LLC", "S-Corp", "C-Corp", "Sole Proprietorship", "Partnership", "Other"]

STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
]


class CompanyBasicsPayload(BaseModel):
    industry: Optional[str] = None
    founded: Optional[int] = None
    state: Optional[str] = None
    entity_type: Optional[str] = None
    total_headcount: Optional[int] = None
    business_description: Optional[str] = None


@router.patch("/owner-onboarding/{company_id}/company")
def patch_company_basics(
    company: OwnerCompany,
    body: CompanyBasicsPayload,
    db: Session = Depends(get_db),
):
    """Owner updates basic company fields. Only non-sensitive descriptive fields are writable."""
    data = body.model_dump(exclude_unset=True)

    # Validate industry
    if "industry" in data and data["industry"] and data["industry"] not in INDUSTRY_CHOICES:
        raise HTTPException(status_code=422, detail=f"Invalid industry: {data['industry']}")

    # Validate state
    if "state" in data and data["state"] and data["state"].upper() not in STATES:
        raise HTTPException(status_code=422, detail=f"Invalid state: {data['state']}")

    # Validate entity_type
    if "entity_type" in data and data["entity_type"] and data["entity_type"] not in ENTITY_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid entity type: {data['entity_type']}")

    # Validate founded year
    if "founded" in data and data["founded"] is not None:
        if not (1800 <= data["founded"] <= datetime.utcnow().year):
            raise HTTPException(status_code=422, detail="Founded year is out of range")

    # Validate headcount
    if "total_headcount" in data and data["total_headcount"] is not None:
        if data["total_headcount"] < 0:
            raise HTTPException(status_code=422, detail="Headcount cannot be negative")

    # business_description maps to report_cover_blurb (owner's words about the business)
    if "business_description" in data:
        company.report_cover_blurb = data.pop("business_description")

    for field, value in data.items():
        if field in ("industry", "founded", "state", "entity_type", "total_headcount"):
            setattr(company, field, value)

    db.commit()
    db.refresh(company)

    return {
        "company_id": company.id,
        "name": company.name,
        "industry": company.industry,
        "founded": company.founded,
        "state": company.state,
        "entity_type": company.entity_type,
        "total_headcount": company.total_headcount,
        "business_description": company.report_cover_blurb,
    }


# ---------------------------------------------------------------------------
# POST /api/owner-onboarding/{company_id}/complete
# ---------------------------------------------------------------------------

@router.post("/owner-onboarding/{company_id}/complete")
def complete_onboarding(
    company: OwnerCompany,
    db: Session = Depends(get_db),
):
    """Mark the owner onboarding wizard as complete. Idempotent."""
    if company.owner_onboarding_completed_at is None:
        company.owner_onboarding_completed_at = datetime.utcnow()
        db.commit()
        db.refresh(company)

    return {
        "company_id": company.id,
        "owner_onboarding_completed_at": company.owner_onboarding_completed_at.isoformat(),
        "onboarding_complete": True,
    }
