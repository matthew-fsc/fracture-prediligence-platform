"""Blueprint I ingestion pipeline — API routes."""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.ingestion.pipeline import run_pipeline
from app.ontology.ingestion_models import IngestionJob, PhaseStatus

router = APIRouter()


@router.post("/upload/{company_id}")
async def upload_file(
    company_id: int,
    file: UploadFile = File(...),
    source_type: str = Form(default="unknown"),
    db: Session = Depends(get_db),
):
    """
    P2–P6: Receive a raw file and run the full ingestion pipeline up to row extraction.
    Returns the IngestionJob with validation report, schema profile, column mappings,
    and extraction error summary.
    """
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    job = run_pipeline(
        company_id=company_id,
        filename=file.filename,
        file_data=data,
        source_type=source_type,
        db=db,
    )
    db.commit()
    db.refresh(job)

    return {
        "job_id":         job.id,
        "ingestion_id":   job.ingestion_id,
        "filename":       job.filename,
        "status":         job.current_status,
        "phase":          job.current_phase,
        "row_count":      job.row_count,
        "mapped_count":   job.mapped_count,
        "error_count":    job.error_count,
        "validation":     job.validation_report,
        "schema":         job.schema_profile,
        "mappings":       job.column_mappings,
        "errors":         job.extraction_errors,
    }


@router.get("/jobs/{company_id}")
def list_jobs(company_id: int, db: Session = Depends(get_db)):
    """List all ingestion jobs for a company."""
    jobs = (
        db.query(IngestionJob)
        .filter(IngestionJob.company_id == company_id)
        .order_by(IngestionJob.created_at.desc())
        .all()
    )
    return [
        {
            "job_id":       j.id,
            "ingestion_id": j.ingestion_id,
            "filename":     j.filename,
            "source_type":  j.source_type,
            "phase":        j.current_phase,
            "status":       j.current_status,
            "row_count":    j.row_count,
            "mapped_count": j.mapped_count,
            "error_count":  j.error_count,
            "created_at":   j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@router.get("/jobs/{company_id}/{job_id}")
def get_job(company_id: int, job_id: int, db: Session = Depends(get_db)):
    """Get full job details including validation report, schema, mappings, and errors."""
    job = (
        db.query(IngestionJob)
        .filter(IngestionJob.id == job_id, IngestionJob.company_id == company_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found.")
    return {
        "job_id":       job.id,
        "ingestion_id": job.ingestion_id,
        "filename":     job.filename,
        "source_type":  job.source_type,
        "phase":        job.current_phase,
        "status":       job.current_status,
        "row_count":    job.row_count,
        "mapped_count": job.mapped_count,
        "error_count":  job.error_count,
        "file_hash":    job.file_hash,
        "validation":   job.validation_report,
        "schema":       job.schema_profile,
        "mappings":     job.column_mappings,
        "errors":       job.extraction_errors,
        "created_at":   job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


@router.patch("/jobs/{company_id}/{job_id}/mappings")
def update_mappings(
    company_id: int,
    job_id: int,
    overrides: dict,
    db: Session = Depends(get_db),
):
    """
    Advisor manually overrides column mappings for low-confidence fields.
    Accepts: {source_column: ontology_field} pairs.
    Sets match_method='manual', confidence=100, requires_review=False for each.
    After all overrides applied, re-runs P6 if job was AWAITING_REVIEW.
    """
    job = (
        db.query(IngestionJob)
        .filter(IngestionJob.id == job_id, IngestionJob.company_id == company_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    mappings = job.column_mappings or {"mappings": []}
    for m in mappings.get("mappings", []):
        if m["source_column"] in overrides:
            m["ontology_field"]  = overrides[m["source_column"]]
            m["match_method"]    = "manual"
            m["confidence"]      = 100
            m["requires_review"] = False

    job.column_mappings = mappings

    # Re-trigger P6 if previously waiting for review
    if job.current_status == PhaseStatus.AWAITING_REVIEW.value:
        job.current_status = PhaseStatus.COMPLETE.value

    db.commit()
    return {"message": "Mappings updated.", "mappings": job.column_mappings}
