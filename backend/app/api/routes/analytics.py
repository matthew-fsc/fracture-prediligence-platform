"""Blueprint II analytics engine — API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.a9_drs_composite import CategoryScores, compute_drs

router = APIRouter()


@router.get("/metrics/{company_id}")
def get_metrics(company_id: int, db: Session = Depends(get_db)):
    """A1: Compute and return the full metric registry for a company."""
    metrics = compute_metrics(company_id, db)
    return metrics


@router.post("/drs/{company_id}")
def compute_drs_score(company_id: int, scores: dict, db: Session = Depends(get_db)):
    """A9: Compute DRS composite from submitted category scores."""
    try:
        category_scores = CategoryScores(**scores)
        result = compute_drs(category_scores)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
