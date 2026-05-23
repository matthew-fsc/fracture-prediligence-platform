"""
Advisor firm routes (3C) — multi-advisor Team tier.

POST /api/firms/              — create a firm (Team-tier subscribers only)
GET  /api/firms/me            — get the firm the current user belongs to
POST /api/firms/invite-member — add an associate to the firm
GET  /api/firms/members       — list firm members and their engagement counts
DELETE /api/firms/members/{member_user_id} — remove an associate
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user
from app.ontology.models import AdvisorFirm, Company, CompanyAccessGrant, UserSubscription

router = APIRouter()


def _get_firm_for_user(user_id: str, db: Session) -> Optional[AdvisorFirm]:
    """Return the firm owned by or associated with this user, if any."""
    firm = db.query(AdvisorFirm).filter(AdvisorFirm.owner_user_id == user_id).first()
    if firm:
        return firm
    # Also check if user is an associate via CompanyAccessGrant
    # For firm membership, look up via subscription_user_id
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
    if sub:
        firm = db.query(AdvisorFirm).filter(AdvisorFirm.subscription_user_id == user_id).first()
    return firm


class FirmCreate(BaseModel):
    name: str


class InviteMemberRequest(BaseModel):
    member_user_id: str   # Clerk sub of the associate being added


@router.post("/")
def create_firm(
    body: FirmCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a firm. Requires an active Team-tier subscription."""
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    if not sub or sub.status != "active" or sub.tier != "team":
        raise HTTPException(
            status_code=402,
            detail="An active Team subscription is required to create a firm.",
        )
    existing = db.query(AdvisorFirm).filter(AdvisorFirm.owner_user_id == user.user_id).first()
    if existing:
        return {"status": "already_exists", "firm_id": existing.id, "name": existing.name}

    firm = AdvisorFirm(
        name=body.name,
        owner_user_id=user.user_id,
        subscription_user_id=user.user_id,
        max_seats=5,
    )
    db.add(firm)
    db.commit()
    db.refresh(firm)
    return {"status": "created", "firm_id": firm.id, "name": firm.name, "max_seats": firm.max_seats}


@router.get("/me")
def get_my_firm(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the firm associated with the current user."""
    firm = _get_firm_for_user(user.user_id, db)
    if not firm:
        return {"firm": None}
    # Count current associates (non-owner grants)
    associate_grants = (
        db.query(CompanyAccessGrant)
        .filter(
            CompanyAccessGrant.granted_by == firm.owner_user_id,
            CompanyAccessGrant.role == "associate",
            CompanyAccessGrant.is_active == True,
        )
        .all()
    )
    unique_associates = len({g.user_id for g in associate_grants})
    return {
        "firm": {
            "id": firm.id,
            "name": firm.name,
            "owner_user_id": firm.owner_user_id,
            "max_seats": firm.max_seats,
            "seats_used": unique_associates + 1,  # +1 for owner
            "is_owner": firm.owner_user_id == user.user_id,
        }
    }


@router.post("/invite-member")
def invite_member(
    body: InviteMemberRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an associate to the firm. Firm owner only."""
    firm = db.query(AdvisorFirm).filter(AdvisorFirm.owner_user_id == user.user_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail="No firm found. Create one first.")

    # Seat limit check
    existing_grants = (
        db.query(CompanyAccessGrant)
        .filter(
            CompanyAccessGrant.granted_by == user.user_id,
            CompanyAccessGrant.role == "associate",
            CompanyAccessGrant.is_active == True,
        )
        .all()
    )
    current_seats = len({g.user_id for g in existing_grants}) + 1  # +1 for owner
    if current_seats >= firm.max_seats:
        raise HTTPException(
            status_code=402,
            detail=f"Seat limit reached ({firm.max_seats} seats). Upgrade to add more advisors.",
        )

    # Grant associate access to all companies owned by the firm owner
    owned_companies = (
        db.query(Company).filter(Company.owner_user_id == user.user_id).all()
    )
    granted_count = 0
    for company in owned_companies:
        existing = (
            db.query(CompanyAccessGrant)
            .filter(
                CompanyAccessGrant.company_id == company.id,
                CompanyAccessGrant.user_id == body.member_user_id,
            )
            .first()
        )
        if existing:
            existing.is_active = True
            existing.role = "associate"
        else:
            db.add(CompanyAccessGrant(
                company_id=company.id,
                user_id=body.member_user_id,
                role="associate",
                granted_by=user.user_id,
                is_active=True,
            ))
        granted_count += 1

    db.commit()
    return {
        "status": "invited",
        "member_user_id": body.member_user_id,
        "companies_granted": granted_count,
    }


@router.delete("/members/{member_user_id}")
def remove_member(
    member_user_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an associate from the firm (revokes all CompanyAccessGrants)."""
    firm = db.query(AdvisorFirm).filter(AdvisorFirm.owner_user_id == user.user_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail="No firm found")

    grants = (
        db.query(CompanyAccessGrant)
        .filter(
            CompanyAccessGrant.user_id == member_user_id,
            CompanyAccessGrant.granted_by == user.user_id,
            CompanyAccessGrant.is_active == True,
        )
        .all()
    )
    for g in grants:
        g.is_active = False
    db.commit()
    return {"status": "removed", "grants_revoked": len(grants)}
