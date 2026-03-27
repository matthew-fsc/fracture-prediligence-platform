"""Shared FastAPI dependencies (company scoping)."""

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user_optional
from app.ontology.models import Company


def ensure_company_access(
    company_id: int,
    user: Optional[CurrentUser],
    db: Session,
) -> Company:
    row = db.query(Company).filter(Company.id == company_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    if row.owner_user_id is None:
        if settings.APP_ENV.lower() == "development":
            return row
        raise HTTPException(status_code=403, detail="Company has no owner assigned")
    if user is None:
        raise HTTPException(status_code=401, detail="Authorization required")
    if row.owner_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not allowed for this company")
    return row


async def get_company_scope(
    company_id: int,
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> Company:
    return ensure_company_access(company_id, user, db)
