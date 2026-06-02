"""Company CRUD routes — scoped by Clerk user (owner_user_id)."""

from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import ensure_company_access, ensure_company_write_access
from app.core.analytics_events import track
from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import CurrentUser, get_current_user, get_current_user_optional
from app.ontology.models import (
    ClientAccess, ClientAccessStatus, Company, CompanyEngagementBilling,
    UserProfile, UserRole, UserSubscription,
)

router = APIRouter()


def _json_num(v: Optional[Decimal]) -> Optional[float]:
    if v is None:
        return None
    return float(v)


def company_to_dict(row: Company) -> dict[str, Any]:
    """Stable JSON for SPA: every advisor-editable company profile field."""
    return {
        "id": row.id,
        "name": row.name,
        "owner_user_id": row.owner_user_id,
        "industry": row.industry,
        "founded": row.founded,
        "ein": row.ein,
        "state": row.state,
        "entity_type": row.entity_type,
        "total_headcount": row.total_headcount,
        "market_rate_replacement_annual": _json_num(row.market_rate_replacement_annual),
        "depreciation_amortization_ttm": _json_num(row.depreciation_amortization_ttm),
        "interest_expense_ttm": _json_num(row.interest_expense_ttm),
        "income_tax_expense_ttm": _json_num(row.income_tax_expense_ttm),
        "report_firm_name": row.report_firm_name,
        "report_cover_blurb": row.report_cover_blurb,
        "report_logo_url": row.report_logo_url,
        "owner_onboarding_completed_at": (
            row.owner_onboarding_completed_at.isoformat()
            if row.owner_onboarding_completed_at else None
        ),
    }


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
    total_headcount: Optional[int] = None
    market_rate_replacement_annual: Optional[float] = None
    depreciation_amortization_ttm: Optional[float] = None
    interest_expense_ttm: Optional[float] = None
    income_tax_expense_ttm: Optional[float] = None
    report_firm_name: Optional[str] = None
    report_cover_blurb: Optional[str] = None
    report_logo_url: Optional[str] = None


@router.get("/")
def list_companies(
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    if not user:
        # No token: return only unowned (demo/shared) companies
        rows = db.query(Company).filter(Company.owner_user_id.is_(None)).order_by(Company.id).all()
        return [company_to_dict(r) for r in rows]

    # Check if this user is a CLIENT — return their linked company instead
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.user_id).first()
    if profile and profile.role == UserRole.CLIENT:
        access_rows = (
            db.query(ClientAccess)
            .filter(
                ClientAccess.client_user_id == user.user_id,
                ClientAccess.status == ClientAccessStatus.ACCEPTED,
            )
            .all()
        )
        company_ids = [a.company_id for a in access_rows]
        if not company_ids:
            return []
        rows = db.query(Company).filter(Company.id.in_(company_ids)).order_by(Company.id).all()
        return [company_to_dict(r) for r in rows]

    # Advisor: return companies they own
    rows = (
        db.query(Company)
        .filter(Company.owner_user_id == user.user_id)
        .order_by(Company.id)
        .all()
    )
    return [company_to_dict(r) for r in rows]


@router.post("/")
def create_company(
    data: CompanyCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Engagement limit gate (1C): check active company count vs plan limit
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    max_companies = sub.max_companies if sub else settings.PLAN_MAX_COMPANIES_PRO
    active_count = db.query(Company).filter(Company.owner_user_id == user.user_id).count()

    billing_status = "included"
    if active_count >= max_companies:
        overage_price_id = settings.STRIPE_ENGAGEMENT_OVERAGE_PRICE_ID
        if not overage_price_id:
            # Overage billing not configured — allow creation but flag it
            billing_status = "add_on"
        elif not (sub and sub.stripe_subscription_id):
            raise HTTPException(
                status_code=402,
                detail={
                    "message": f"Plan limit reached ({active_count} of {max_companies} engagements). "
                               "Add an engagement slot or upgrade your plan.",
                    "action": "add_engagement",
                    "current_count": active_count,
                    "max_companies": max_companies,
                },
            )
        else:
            billing_status = "add_on"  # caller should POST /api/add-engagement after creation

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
    db.flush()  # get company.id before adding billing record

    billing = CompanyEngagementBilling(
        company_id=company.id,
        user_id=user.user_id,
        billing_status=billing_status,
    )
    db.add(billing)
    db.commit()
    db.refresh(company)

    track("company_created", user_id=user.user_id, properties={
        "company_id": company.id,
        "billing_status": billing_status,
        "total_companies": active_count + 1,
    })

    result = company_to_dict(company)
    result["billing_status"] = billing_status
    return result


@router.get("/{company_id}")
def get_company(
    company_id: int,
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    row = ensure_company_access(company_id, user, db)
    return company_to_dict(row)


@router.patch("/{company_id}")
def patch_company(
    company_id: int,
    body: CompanyPatch,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = ensure_company_write_access(company_id, user, db)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return company_to_dict(row)
