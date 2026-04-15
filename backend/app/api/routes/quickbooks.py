"""
QuickBooks OAuth + data ingestion routes.

Endpoints:
  GET  /api/qb/authorize/{company_id}  → build Intuit consent URL
  GET  /api/qb/callback                → exchange auth code for token
  POST /api/qb/refresh/{company_id}    → force token refresh
  GET  /api/qb/status/{company_id}     → token + realm_id status
  POST /api/qb/fetch/{company_id}      → pull QB data and run ingestion pipeline
  DELETE /api/qb/disconnect/{company_id} → revoke + delete stored token
"""

from __future__ import annotations

import hashlib
from datetime import date, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope, get_company_write_scope
from app.core.config import settings
from app.core.database import get_db
from app.integrations.quickbooks.auth import (
    build_authorize_url,
    exchange_code_for_token,
    force_refresh,
    refresh_token_if_needed,
)
from app.integrations.quickbooks.extractor import (
    get_customers,
    get_invoices,
    get_profit_and_loss,
)
from app.integrations.quickbooks.normalizer import (
    customers_to_csv,
    invoices_to_csv,
    pl_report_to_csv,
)
from app.ingestion.pipeline import run_pipeline
from app.ontology.ingestion_models import IngestionJob
from app.ontology.models import Company, QBToken

router = APIRouter()

CompanyScoped      = Annotated[Company, Depends(get_company_scope)]
CompanyWriteScoped = Annotated[Company, Depends(get_company_write_scope)]


class FetchRequest(BaseModel):
    start_date: Optional[date] = None   # defaults to 3 years ago
    end_date:   Optional[date] = None   # defaults to today


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

@router.get("/authorize/{company_id}")
def authorize(company: CompanyWriteScoped):
    """
    Step 1 of OAuth: return the Intuit consent-page URL.
    The frontend should redirect the user (or open a popup) to this URL.
    """
    if not settings.QB_CLIENT_ID:
        raise HTTPException(status_code=503, detail="QuickBooks integration is not configured.")
    url = build_authorize_url(company.id)
    return {"authorize_url": url}


@router.get("/callback")
def oauth_callback(
    code: str = Query(...),
    realmId: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Step 2 of OAuth: Intuit redirects here with the auth code.
    Exchanges the code for tokens, stores them, and redirects the user to
    the frontend connector page.
    """
    try:
        company_id, _tok = exchange_code_for_token(code, realmId, state, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Redirect to frontend connector page
    redirect_url = f"{settings.FRONTEND_URL}/advisor/{company_id}/connectors?qb_connected=1"
    return RedirectResponse(url=redirect_url)


# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

@router.post("/refresh/{company_id}")
def refresh(company: CompanyWriteScoped, db: Session = Depends(get_db)):
    """Force-refresh the stored OAuth token for this company."""
    try:
        tok = force_refresh(company.id, db)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "company_id": company.id,
        "realm_id":   tok.realm_id,
        "expires_at": tok.expires_at.isoformat() if tok.expires_at else None,
    }


@router.get("/status/{company_id}")
def status(company: CompanyScoped, db: Session = Depends(get_db)):
    """Return current token status: connected, realm_id, expiry."""
    tok = db.query(QBToken).filter(QBToken.company_id == company.id).first()
    if not tok:
        return {"connected": False, "company_id": company.id}
    return {
        "connected":  True,
        "company_id": company.id,
        "realm_id":   tok.realm_id,
        "expires_at": tok.expires_at.isoformat() if tok.expires_at else None,
    }


@router.delete("/disconnect/{company_id}", status_code=204)
def disconnect(company: CompanyWriteScoped, db: Session = Depends(get_db)):
    """Delete the stored QB token, effectively disconnecting the integration."""
    tok = db.query(QBToken).filter(QBToken.company_id == company.id).first()
    if tok:
        db.delete(tok)
        db.commit()


# ---------------------------------------------------------------------------
# Data fetch + pipeline trigger
# ---------------------------------------------------------------------------

@router.post("/fetch/{company_id}")
def fetch_and_ingest(
    company: CompanyWriteScoped,
    body: FetchRequest = None,
    db: Session = Depends(get_db),
):
    """
    Pull data from QuickBooks and run the ingestion pipeline on each dataset.

    Three ingestion jobs are created:
      1. qb_invoices_<dates>.csv   → revenue streams
      2. qb_customers.csv          → customer master
      3. qb_pl_<dates>.csv         → P&L expense rows

    The QB extractor output enters run_pipeline() as serialised CSV bytes —
    identical to a manual CSV upload — so the existing pipeline is untouched.
    """
    if not settings.QB_CLIENT_ID:
        raise HTTPException(status_code=503, detail="QuickBooks integration is not configured.")

    # Validate token is present before fetching
    try:
        refresh_token_if_needed(company.id, db)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"No QuickBooks connection found: {exc}",
        ) from exc

    if body is None:
        body = FetchRequest()
    end   = body.end_date   or date.today()
    start = body.start_date or (end - timedelta(days=3 * 365))

    created_jobs: list[dict] = []
    errors: list[str] = []

    # 1. Invoices → revenue streams
    try:
        invoices  = get_invoices(company.id, start, end, db)
        inv_bytes = invoices_to_csv(invoices)
        inv_name  = f"qb_invoices_{start}_{end}.csv"
        _skip, job = _run_if_new(company.id, inv_name, inv_bytes, "quickbooks_ar", db)
        if job:
            created_jobs.append(_job_summary(job, "invoices"))
    except Exception as exc:
        errors.append(f"invoices: {exc}")

    # 2. Customers
    try:
        customers  = get_customers(company.id, db)
        cust_bytes = customers_to_csv(customers)
        cust_name  = "qb_customers.csv"
        _skip, job = _run_if_new(company.id, cust_name, cust_bytes, "customer_list", db)
        if job:
            created_jobs.append(_job_summary(job, "customers"))
    except Exception as exc:
        errors.append(f"customers: {exc}")

    # 3. P&L
    try:
        pl_report  = get_profit_and_loss(company.id, start, end, db)
        pl_bytes   = pl_report_to_csv(pl_report)
        pl_name    = f"qb_pl_{start}_{end}.csv"
        _skip, job = _run_if_new(company.id, pl_name, pl_bytes, "quickbooks_pl", db)
        if job:
            created_jobs.append(_job_summary(job, "profit_and_loss"))
    except Exception as exc:
        errors.append(f"profit_and_loss: {exc}")

    return {
        "company_id":   company.id,
        "start_date":   str(start),
        "end_date":     str(end),
        "jobs_created": created_jobs,
        "errors":       errors,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_if_new(
    company_id: int,
    filename: str,
    data: bytes,
    source_type: str,
    db: Session,
) -> tuple[bool, IngestionJob | None]:
    """
    Run run_pipeline() unless the same file content was already ingested
    (duplicate SHA-256 guard matching the upload endpoint behaviour).
    Returns (skipped, job_or_None).
    """
    file_hash = hashlib.sha256(data).hexdigest()
    existing = (
        db.query(IngestionJob)
        .filter(IngestionJob.company_id == company_id, IngestionJob.file_hash == file_hash)
        .first()
    )
    if existing:
        return True, None

    job = run_pipeline(
        company_id=company_id,
        filename=filename,
        file_data=data,
        source_type=source_type,
        db=db,
    )
    db.commit()
    db.refresh(job)
    return False, job


def _job_summary(job: IngestionJob, dataset: str) -> dict:
    return {
        "dataset":      dataset,
        "job_id":       job.id,
        "ingestion_id": job.ingestion_id,
        "status":       str(job.current_status),
        "row_count":    job.row_count,
    }
