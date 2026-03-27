"""Company CRUD routes — scoped by Clerk user (owner_user_id)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import ensure_company_access
from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user, get_current_user_optional
from app.ontology.models import Company

router = APIRouter()


class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    founded: Optional[int] = None
    ein: Optional[str] = None
    state: Optional[str] = None
    entity_type: Optional[str] = None


class CompanyPatch(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    founded: Optional[int] = None
    ein: Optional[str] = None
    state: Optional[str] = None
    entity_type: Optional[str] = None


@router.get("/")
def list_companies(
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    q = db.query(Company)
    if user:
        q = q.filter(Company.owner_user_id == user.user_id)
    else:
        if settings.APP_ENV.lower() != "development":
            raise HTTPException(status_code=401, detail="Authorization required")
    return q.order_by(Company.id).all()


@router.post("/")
def create_company(
    data: CompanyCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = Company(
        name=data.name,
        industry=data.industry,
        founded=data.founded,
        ein=data.ein,
        state=data.state,
        entity_type=data.entity_type,
        owner_user_id=user.user_id,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}")
def get_company(
    company_id: int,
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return ensure_company_access(company_id, user, db)


@router.patch("/{company_id}")
def patch_company(
    company_id: int,
    body: CompanyPatch,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = ensure_company_access(company_id, user, db)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row
