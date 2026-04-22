"""
QuickBooks data extractor (Blueprint I — QB ingestion path).

Uses python-quickbooks to pull raw QB response objects.
Intentionally no transformation here — returns QB SDK objects as-is.

Functions:
  get_profit_and_loss(company_id, start_date, end_date, db)
  get_customers(company_id, db)
  get_invoices(company_id, start_date, end_date, db)
  get_chart_of_accounts(company_id, db)
"""

from __future__ import annotations

from datetime import date
from typing import Any

from quickbooks import QuickBooks
from quickbooks.objects.customer import Customer
from quickbooks.objects.invoice import Invoice
from quickbooks.objects.account import Account
from sqlalchemy.orm import Session

from app.integrations.quickbooks.auth import refresh_token_if_needed


def _qb_client(company_id: int, db: Session) -> QuickBooks:
    """Return an authenticated QuickBooks client for the given company."""
    tok = refresh_token_if_needed(company_id, db)
    from intuitlib.client import AuthClient
    from app.core.config import settings

    auth_client = AuthClient(
        client_id=settings.QB_CLIENT_ID,
        client_secret=settings.QB_CLIENT_SECRET,
        redirect_uri=settings.QB_REDIRECT_URI,
        environment=settings.QB_ENVIRONMENT,
        access_token=tok.access_token,
        refresh_token=tok.refresh_token,
        realm_id=tok.realm_id,
    )
    return QuickBooks(
        auth_client=auth_client,
        refresh_token=tok.refresh_token,
        company_id=tok.realm_id,
    )


def get_profit_and_loss(
    company_id: int,
    start_date: date,
    end_date: date,
    db: Session,
) -> dict[str, Any]:
    """
    Pull a Profit & Loss report from QuickBooks.
    Returns the raw report dict from the QB Reports API.
    """
    from quickbooks.objects.reportbase import Report

    client = _qb_client(company_id, db)
    report = Report.get(
        "ProfitAndLoss",
        params={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "accounting_method": "Accrual",
        },
        qb=client,
    )
    return report.to_dict() if hasattr(report, "to_dict") else dict(report)


def get_customers(company_id: int, db: Session) -> list[Customer]:
    """Return all Customer objects for the company."""
    client = _qb_client(company_id, db)
    return Customer.all(qb=client)


def get_invoices(
    company_id: int,
    start_date: date,
    end_date: date,
    db: Session,
) -> list[Invoice]:
    """Return all Invoice objects in the given date range."""
    client = _qb_client(company_id, db)
    query = (
        f"SELECT * FROM Invoice WHERE TxnDate >= '{start_date.isoformat()}' "
        f"AND TxnDate <= '{end_date.isoformat()}'"
    )
    return Invoice.query(query, qb=client)


def get_chart_of_accounts(company_id: int, db: Session) -> list[Account]:
    """Return all Account objects (Chart of Accounts)."""
    client = _qb_client(company_id, db)
    return Account.all(qb=client)
