"""
User profile routes — role management and client access invitations.

Endpoints:
  GET  /api/me                    — return current user's profile (role, linked company)
  POST /api/me                    — set or update user role (ADVISOR | CLIENT)
  POST /api/me/invite-client      — (ADVISOR) create a client invite for a company
  GET  /api/me/invites            — (ADVISOR) list pending/accepted client invites per company
  POST /api/me/accept-invite/{token} — (CLIENT) accept an invite, link account to company
  DELETE /api/me/invites/{invite_id}  — (ADVISOR) revoke an invite
"""

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user, get_current_user_optional
from app.ontology.models import (
    ClientAccess, ClientAccessStatus, Company,
    UserProfile, UserRole,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_none(db: Session, user_id: str) -> Optional[UserProfile]:
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first()


def _client_company(db: Session, user_id: str) -> Optional[dict]:
    """Return the company dict for a CLIENT user, or None."""
    access = (
        db.query(ClientAccess)
        .filter(
            ClientAccess.client_user_id == user_id,
            ClientAccess.status == ClientAccessStatus.ACCEPTED,
        )
        .first()
    )
    if not access:
        return None
    company = db.query(Company).filter(Company.id == access.company_id).first()
    if not company:
        return None
    return {"id": company.id, "name": company.name, "industry": company.industry}


def _profile_response(profile: Optional[UserProfile], db: Session) -> dict:
    if not profile:
        return {"role": None, "company": None}
    out: dict = {"role": profile.role, "company": None}
    if profile.role == UserRole.CLIENT:
        out["company"] = _client_company(db, profile.user_id)
    return out


# ---------------------------------------------------------------------------
# GET /api/me
# ---------------------------------------------------------------------------

@router.get("/me")
def get_my_profile(
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Return the calling user's profile (role + linked company for CLIENTs).

    Anonymous callers receive an empty profile so frontend boot can proceed
    while Clerk finishes loading in development.
    """
    if not user:
        return {"role": None, "company": None}
    profile = _get_or_none(db, user.user_id)
    return _profile_response(profile, db)


# ---------------------------------------------------------------------------
# POST /api/me  — set role
# ---------------------------------------------------------------------------

class SetRoleBody(BaseModel):
    role: str  # ADVISOR | CLIENT


@router.post("/me")
def set_my_role(
    body: SetRoleBody,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update the calling user's role. Can only be called once per user
    (subsequent calls for role changes require admin intervention)."""
    role = body.role.upper()
    if role not in (UserRole.ADVISOR, UserRole.CLIENT):
        raise HTTPException(status_code=422, detail="role must be ADVISOR or CLIENT")

    profile = _get_or_none(db, user.user_id)
    if profile:
        # Allow re-setting the same role (idempotent); block changing it silently
        if profile.role != role:
            raise HTTPException(
                status_code=409,
                detail=f"Role already set to {profile.role}. Contact support to change it.",
            )
    else:
        profile = UserProfile(user_id=user.user_id, role=role)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return _profile_response(profile, db)


# ---------------------------------------------------------------------------
# POST /api/me/invite-client  — advisor creates a client invite
# ---------------------------------------------------------------------------

class InviteClientBody(BaseModel):
    company_id: int
    invite_email: str
    client_name: Optional[str] = None  # optional — for display purposes only


@router.post("/me/invite-client")
def invite_client(
    body: InviteClientBody,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Advisor creates an invite link for a business-owner client.
    The invite is scoped to a specific company the advisor owns.
    Returns the invite token (frontend constructs the full URL).
    """
    # Verify the advisor owns this company
    company = db.query(Company).filter(Company.id == body.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="You do not own this company")

    # Check if an active invite for this email+company already exists
    existing = (
        db.query(ClientAccess)
        .filter(
            ClientAccess.company_id == body.company_id,
            ClientAccess.invite_email == body.invite_email.lower().strip(),
            ClientAccess.status == ClientAccessStatus.PENDING,
        )
        .first()
    )
    if existing:
        return {
            "invite_token": existing.invite_token,
            "invite_email": existing.invite_email,
            "company_id": existing.company_id,
            "status": existing.status,
            "already_existed": True,
        }

    token = secrets.token_urlsafe(32)
    invite = ClientAccess(
        company_id=body.company_id,
        invited_by_user_id=user.user_id,
        invite_email=body.invite_email.lower().strip(),
        invite_token=token,
        status=ClientAccessStatus.PENDING,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    return {
        "invite_token": invite.invite_token,
        "invite_email": invite.invite_email,
        "company_id": invite.company_id,
        "company_name": company.name,
        "status": invite.status,
        "already_existed": False,
    }


# ---------------------------------------------------------------------------
# GET /api/me/invites  — advisor lists client invites per company
# ---------------------------------------------------------------------------

@router.get("/me/invites")
def list_invites(
    company_id: Optional[int] = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all client invites created by this advisor, optionally filtered by company."""
    q = db.query(ClientAccess).filter(ClientAccess.invited_by_user_id == user.user_id)
    if company_id is not None:
        q = q.filter(ClientAccess.company_id == company_id)
    rows = q.order_by(ClientAccess.created_at.desc()).all()

    company_names: dict[int, str] = {}
    for row in rows:
        if row.company_id not in company_names:
            c = db.query(Company).filter(Company.id == row.company_id).first()
            company_names[row.company_id] = c.name if c else ""

    return [
        {
            "id": r.id,
            "company_id": r.company_id,
            "company_name": company_names.get(r.company_id, ""),
            "invite_email": r.invite_email,
            "invite_token": r.invite_token,
            "client_user_id": r.client_user_id,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "accepted_at": r.accepted_at.isoformat() if r.accepted_at else None,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# POST /api/me/accept-invite/{token}  — client accepts invite
# ---------------------------------------------------------------------------

@router.post("/me/accept-invite/{token}")
def accept_invite(
    token: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Called by a signed-in user after they click a client invite link.
    Links their Clerk account to the company and sets their role to CLIENT.
    """
    invite = (
        db.query(ClientAccess)
        .filter(ClientAccess.invite_token == token)
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or has expired")
    if invite.status == ClientAccessStatus.REVOKED:
        raise HTTPException(status_code=410, detail="This invite has been revoked")
    if invite.status == ClientAccessStatus.ACCEPTED:
        # Already accepted — verify it belongs to this user
        if invite.client_user_id == user.user_id:
            company = db.query(Company).filter(Company.id == invite.company_id).first()
            return {
                "status": "already_accepted",
                "company_id": invite.company_id,
                "company_name": company.name if company else None,
            }
        raise HTTPException(status_code=409, detail="This invite has already been accepted by another user")

    # Accept the invite
    invite.client_user_id = user.user_id
    invite.status = ClientAccessStatus.ACCEPTED
    invite.accepted_at = datetime.utcnow()

    # Create or update UserProfile to CLIENT role
    profile = _get_or_none(db, user.user_id)
    if not profile:
        profile = UserProfile(user_id=user.user_id, role=UserRole.CLIENT)
        db.add(profile)
    elif profile.role != UserRole.CLIENT:
        # If somehow they were already an ADVISOR — unlikely but guard it
        raise HTTPException(
            status_code=409,
            detail="Your account is already registered as an Advisor. "
                   "A separate account is required to accept a client invite.",
        )

    db.commit()

    company = db.query(Company).filter(Company.id == invite.company_id).first()
    return {
        "status": "accepted",
        "company_id": invite.company_id,
        "company_name": company.name if company else None,
    }


# ---------------------------------------------------------------------------
# DELETE /api/me/invites/{invite_id}  — advisor revokes invite
# ---------------------------------------------------------------------------

@router.delete("/me/invites/{invite_id}")
def revoke_invite(
    invite_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Advisor revokes a client invite they created."""
    invite = db.query(ClientAccess).filter(ClientAccess.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.invited_by_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    invite.status = ClientAccessStatus.REVOKED
    db.commit()
    return {"status": "revoked"}
