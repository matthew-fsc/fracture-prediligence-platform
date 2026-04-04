"""
Admin-only metrics endpoint — unit economics for investor data room reporting.
Gated by ADMIN_API_KEY header. Never exposed to end users.

GET /api/admin/unit-economics
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.core.config import settings
from app.core.database import get_db
from app.services.unit_economics import compute_unit_economics

router = APIRouter()


def _verify_admin_key(x_admin_key: Optional[str] = Header(default=None)) -> None:
    if not settings.ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured — set ADMIN_API_KEY")
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.get("/unit-economics")
def get_unit_economics(
    db: Session = Depends(get_db),
    _: None = Depends(_verify_admin_key),
):
    """
    Return live unit economics snapshot: MRR, ARR, churn, tier breakdown.
    Source of truth for investor data room reporting.
    """
    return compute_unit_economics(db)
