"""Report generation routes — A14 Insight Package Assembly."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.analytics.a9_drs_composite import CategoryScores, compute_drs
from app.api.deps import get_company_scope
from app.core.database import get_db
from app.analytics.a14_report_generator import generate_report_pdf, REPORT_BUILDERS
from app.analytics.ebitda_basis import ebitda_basis_for_company
from app.ontology.models import Company, GeneratedReport, ScoreSnapshot
from app.services.analytics_service import compute_category_modules

router = APIRouter()

CompanyScoped = Annotated[Company, Depends(get_company_scope)]


def _snapshot_drs(company_id: int, db: Session) -> float | None:
    try:
        mod = compute_category_modules(company_id, db)
        cat = CategoryScores(
            revenue_quality=mod["revenue_quality"].composite,
            financial_integrity=mod["financial_integrity"].composite,
            operational_independence=mod["operational_independence"].composite,
            customer_risk=mod["customer_risk"].composite,
            management_team=mod["management_team"].composite,
            growth_drivers=mod["growth_drivers"].composite,
        )
        return round(float(compute_drs(cat).base_drs), 2)
    except Exception:
        return None


def _snapshot_ev(company_id: int, db: Session) -> float | None:
    try:
        basis = ebitda_basis_for_company(company_id, db)
        ebitda = float(basis.get("ebitda_normalized_ttm") or basis.get("ebitda_proxy_ttm") or 0)
        if ebitda <= 0:
            return None
        # Use midpoint multiple of 4.5x as EV snapshot
        return round(ebitda * 4.5, 2)
    except Exception:
        return None


@router.get("/{company_id}/history")
def report_history(company: CompanyScoped, db: Session = Depends(get_db)):
    """Recent PDF generations for this company (metadata only)."""
    rows = (
        db.query(GeneratedReport)
        .filter(GeneratedReport.company_id == company.id)
        .order_by(desc(GeneratedReport.created_at))
        .limit(100)
        .all()
    )
    return {
        "company_id": company.id,
        "reports": [
            {
                "id": r.id,
                "template_id": r.template_id,
                "drs_at_generation": float(r.drs_score) if r.drs_score is not None else None,
                "ev_at_generation": float(r.ev_at_generation) if r.ev_at_generation is not None else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


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
        filename = f"{report_type}_company_{company.id}.pdf"
        try:
            snap = _snapshot_drs(company.id, db)
            ev_snap = _snapshot_ev(company.id, db)
            db.add(
                GeneratedReport(
                    company_id=company.id,
                    template_id=report_type,
                    drs_score=snap,
                    ev_at_generation=ev_snap,
                )
            )
            if snap is not None:
                db.add(ScoreSnapshot(
                    company_id=company.id,
                    drs_score=snap,
                    ev_estimate=ev_snap,
                    trigger="report",
                ))
            db.commit()
        except Exception:
            db.rollback()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
