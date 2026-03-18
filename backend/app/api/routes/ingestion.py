"""Blueprint I ingestion pipeline — API routes."""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db

router = APIRouter()


@router.post("/upload/{company_id}")
async def upload_file(company_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """P2: Raw Extraction — receive and store file immutably."""
    # TODO: implement P2–P11 pipeline
    return {"company_id": company_id, "filename": file.filename, "status": "received"}


@router.get("/status/{ingestion_id}")
def ingestion_status(ingestion_id: str, db: Session = Depends(get_db)):
    """Return pipeline phase status for a given ingestion job."""
    # TODO: implement job tracking
    return {"ingestion_id": ingestion_id, "phase": "P1", "status": "pending"}
