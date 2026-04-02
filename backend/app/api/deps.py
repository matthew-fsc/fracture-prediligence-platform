"""Shared FastAPI dependencies (company scoping, role-aware access)."""

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user_optional
from app.ontology.models import ClientAccess, ClientAccessStatus, Company


def ensure_company_access(
    company_id: int,
    user: Optional[CurrentUser],
    db: Session,
) -> Company:
    """
    Verify that `user` may access `company_id` and return the Company row.

    Access is granted when any of the following is true:
      1. The company has no owner (demo / shared company) — public access.
      2. The authenticated user is the company's owner (advisor).
      3. The authenticated user has an ACCEPTED ClientAccess record for the company.
    """
    row = db.query(Company).filter(Company.id == company_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")

    # Unowned companies (demo / shared) are accessible without authentication
    if row.owner_user_id is None:
        return row

    if user is None:
        raise HTTPException(status_code=401, detail="Authorization required")

    # Advisor owns the company
    if row.owner_user_id == user.user_id:
        return row

    # Client has explicit access via an accepted ClientAccess invitation
    client_access = (
        db.query(ClientAccess)
        .filter(
            ClientAccess.company_id == company_id,
            ClientAccess.client_user_id == user.user_id,
            ClientAccess.status == ClientAccessStatus.ACCEPTED,
        )
        .first()
    )
    if client_access:
        return row

    raise HTTPException(status_code=403, detail="Not allowed for this company")


async def get_company_scope(
    company_id: int,
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> Company:
    return ensure_company_access(company_id, user, db)
