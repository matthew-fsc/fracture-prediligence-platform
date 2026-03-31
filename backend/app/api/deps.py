"""Shared FastAPI dependencies (company scoping with role-aware access control)."""

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user_optional
from app.ontology.models import Company, CompanyAccessGrant


def ensure_company_access(
    company_id: int,
    user: Optional[CurrentUser],
    db: Session,
    *,
    require_owner: bool = False,
) -> Company:
    """
    Return the Company row if the requesting user is allowed to access it.

    Access tiers (checked in order):
      1. Unowned companies (demo / shared) — always accessible.
      2. Owner — full access (read + write).
      3. CompanyAccessGrant with role "associate" — read + write (firm colleague).
      4. CompanyAccessGrant with role "client" — read-only (SMB owner view).

    Write-protecting client-role access is enforced per-route by checking the
    "x_access_role" attribute attached to the returned Company object.

    Args:
        require_owner: When True, only the owner (and firm associates) are
                       allowed — client-portal users are rejected.
    """
    row = db.query(Company).filter(Company.id == company_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")

    # Unowned companies (demo / shared) are accessible without authentication
    if row.owner_user_id is None:
        row.x_access_role = "owner"  # type: ignore[attr-defined]
        return row

    if user is None:
        raise HTTPException(status_code=401, detail="Authorization required")

    # Owner check
    if row.owner_user_id == user.user_id:
        row.x_access_role = "owner"  # type: ignore[attr-defined]
        return row

    # Access grant check (2D — client portal + associate seats)
    grant = (
        db.query(CompanyAccessGrant)
        .filter(
            CompanyAccessGrant.company_id == company_id,
            CompanyAccessGrant.user_id == user.user_id,
            CompanyAccessGrant.is_active == True,
        )
        .first()
    )
    if grant:
        if require_owner and grant.role not in ("owner", "associate"):
            raise HTTPException(status_code=403, detail="Owner or associate access required")
        row.x_access_role = grant.role  # type: ignore[attr-defined]
        return row

    raise HTTPException(status_code=403, detail="Not allowed for this company")


async def get_company_scope(
    company_id: int,
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> Company:
    return ensure_company_access(company_id, user, db)


def _assert_write_access(company: Company) -> None:
    """Raise 403 if the resolved access role is read-only (client portal)."""
    role = getattr(company, "x_access_role", "owner")
    if role == "client":
        raise HTTPException(
            status_code=403,
            detail="Client portal access is read-only. Contact your advisor to make changes.",
        )
