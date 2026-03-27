"""Report generation routes — A14 Insight Package Assembly."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope
from app.core.database import get_db
from app.ontology.models import Company
from app.analytics.a14_report_generator import generate_report_pdf, REPORT_BUILDERS

router = APIRouter()

CompanyScoped = Annotated[Company, Depends(get_company_scope)]


@router.get("/{company_id}/generate/{report_type}")
def generate_report(
    company: CompanyScoped,
    report_type: str,
    db: Session = Depends(get_db),
):
    """Generate a PDF report and return it as a file download."""
    if report_type not in REPORT_BUILDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown report type '{report_type}'. Valid: {list(REPORT_BUILDERS.keys())}",
        )
    try:
        pdf_bytes = generate_report_pdf(report_type, company.id, db)
        filename  = f"{report_type}_company_{company.id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
