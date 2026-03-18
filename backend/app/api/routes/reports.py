"""Report generation routes — A14 Insight Package Assembly."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db

router = APIRouter()


@router.post("/{company_id}/generate")
def generate_report(company_id: int, report_type: str = "full", db: Session = Depends(get_db)):
    """Trigger A14 insight package assembly and return report metadata."""
    # TODO: implement full report generation pipeline
    return {
        "company_id": company_id,
        "report_type": report_type,
        "status": "queued",
        "message": "Report generation queued — implement A14 pipeline",
    }
