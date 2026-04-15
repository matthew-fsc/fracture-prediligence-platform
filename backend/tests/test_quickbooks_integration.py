"""
Tests for QuickBooks integration (Task 1).

Covers:
  - QBToken model upsert logic
  - OAuth state CSRF protection
  - normalizer CSV output format
  - /api/qb/status endpoint (no token vs token present)
  - /api/qb/fetch duplicate-hash guard
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.integrations.quickbooks.normalizer import (
    customers_to_csv,
    invoices_to_csv,
    pl_report_to_csv,
)


# ---------------------------------------------------------------------------
# Normalizer unit tests — no DB required
# ---------------------------------------------------------------------------

class TestInvoicesToCsv:
    def _make_invoice(self, txn_date, amount, cust_name):
        inv = MagicMock()
        inv.TxnDate = txn_date
        inv.TotalAmt = amount
        cust_ref = MagicMock()
        cust_ref.name = cust_name
        inv.CustomerRef = cust_ref
        return inv

    def test_produces_expected_column_headers(self):
        inv = self._make_invoice("2025-01-15", 5000.0, "Acme Corp")
        csv_bytes = invoices_to_csv([inv])
        header_line = csv_bytes.decode("utf-8").splitlines()[0]
        assert "TxnDate" in header_line
        assert "TotalAmount" in header_line
        assert "CustomerRef.name" in header_line

    def test_empty_list_returns_header_only(self):
        csv_bytes = invoices_to_csv([])
        lines = csv_bytes.decode("utf-8").splitlines()
        assert len(lines) == 1  # header only
        assert "TxnDate" in lines[0]

    def test_single_row_values(self):
        inv = self._make_invoice("2025-03-01", 12500.0, "Beta LLC")
        csv_bytes = invoices_to_csv([inv])
        content = csv_bytes.decode("utf-8")
        assert "2025-03-01" in content
        assert "12500.0" in content
        assert "Beta LLC" in content


class TestCustomersToCsv:
    def _make_customer(self, fqn, active=True):
        c = MagicMock()
        c.FullyQualifiedName = fqn
        c.Active = active
        return c

    def test_produces_fullyqualifiedname_column(self):
        c = self._make_customer("Acme:West Division")
        csv_bytes = customers_to_csv([c])
        header = csv_bytes.decode("utf-8").splitlines()[0]
        assert "FullyQualifiedName" in header

    def test_active_flag_serialised(self):
        c = self._make_customer("Some Co", active=True)
        csv_bytes = customers_to_csv([c])
        assert "TRUE" in csv_bytes.decode("utf-8")


class TestPlReportToCsv:
    def test_empty_report_returns_header(self):
        csv_bytes = pl_report_to_csv({})
        lines = csv_bytes.decode("utf-8").splitlines()
        assert lines[0] == "Account,Amount,Category,Period"

    def test_nested_data_rows_are_extracted(self):
        report = {
            "Rows": {
                "Row": [
                    {
                        "type": "DATA",
                        "ColData": [
                            {"value": "Salaries"},
                            {"value": "45000"},
                        ],
                    }
                ]
            }
        }
        csv_bytes = pl_report_to_csv(report)
        content = csv_bytes.decode("utf-8")
        assert "Salaries" in content
        assert "45000" in content


# ---------------------------------------------------------------------------
# Auth CSRF state tests
# ---------------------------------------------------------------------------

class TestOAuthCsrfGuard:
    def test_unknown_state_raises_value_error(self):
        from app.integrations.quickbooks.auth import exchange_code_for_token

        mock_db = MagicMock()
        with pytest.raises(ValueError, match="Unknown OAuth state"):
            exchange_code_for_token("fake_code", "realm123", "nonexistent_state", mock_db)

    def test_authorize_url_registers_state(self):
        from app.integrations.quickbooks import auth as qb_auth

        with patch("app.integrations.quickbooks.auth._auth_client") as mock_client_factory:
            mock_client = MagicMock()
            mock_client.get_authorization_url.return_value = "https://appcenter.intuit.com/connect?state=abc"
            mock_client_factory.return_value = mock_client

            with patch("app.core.config.settings") as mock_settings:
                mock_settings.QB_CLIENT_ID = "test_client"
                mock_settings.QB_CLIENT_SECRET = "test_secret"
                mock_settings.QB_REDIRECT_URI = "http://localhost:8000/api/qb/callback"
                mock_settings.QB_ENVIRONMENT = "sandbox"

                url = qb_auth.build_authorize_url(company_id=42)
                # State should now be in the OAUTH_STATE dict
                assert len(qb_auth._OAUTH_STATE) >= 1
                assert 42 in qb_auth._OAUTH_STATE.values()


# ---------------------------------------------------------------------------
# Token auto-refresh logic
# ---------------------------------------------------------------------------

class TestTokenAutoRefresh:
    def _make_token(self, expires_in_minutes: int):
        tok = MagicMock()
        tok.expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        tok.access_token = "old_access"
        tok.refresh_token = "old_refresh"
        tok.realm_id = "realm999"
        return tok

    def test_token_not_refreshed_when_plenty_of_time(self):
        from app.integrations.quickbooks import auth as qb_auth

        mock_db = MagicMock()
        fresh_tok = self._make_token(60)
        mock_db.query.return_value.filter.return_value.first.return_value = fresh_tok

        result = qb_auth.refresh_token_if_needed(company_id=1, db=mock_db)
        assert result is fresh_tok

    def test_raises_lookup_error_when_no_token(self):
        from app.integrations.quickbooks.auth import refresh_token_if_needed

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(LookupError):
            refresh_token_if_needed(company_id=999, db=mock_db)


# ---------------------------------------------------------------------------
# /api/qb/status endpoint
# ---------------------------------------------------------------------------

class TestQbStatusEndpoint:
    def _mock_company(self, company_id=5):
        c = MagicMock()
        c.id = company_id
        return c

    def test_status_not_connected_when_no_token(self):
        from app.api.routes.quickbooks import status as qb_status_route

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        company = self._mock_company(5)

        result = qb_status_route(company=company, db=mock_db)
        assert result["connected"] is False
        assert result["company_id"] == 5

    def test_status_connected_when_token_exists(self):
        from app.api.routes.quickbooks import status as qb_status_route

        mock_db = MagicMock()
        tok = MagicMock()
        tok.realm_id = "realm_abc"
        tok.expires_at = datetime(2027, 1, 1)
        mock_db.query.return_value.filter.return_value.first.return_value = tok
        company = self._mock_company(5)

        result = qb_status_route(company=company, db=mock_db)
        assert result["connected"] is True
        assert result["realm_id"] == "realm_abc"


# ---------------------------------------------------------------------------
# Duplicate hash guard in /api/qb/fetch
# ---------------------------------------------------------------------------

class TestDuplicateHashGuard:
    def test_existing_file_hash_skipped(self):
        """_run_if_new should return (True, None) when same hash is already ingested."""
        from app.api.routes.quickbooks import _run_if_new
        from app.ontology.ingestion_models import IngestionJob

        data = b"col1,col2\n1,2\n3,4\n"
        file_hash = hashlib.sha256(data).hexdigest()

        mock_db = MagicMock()
        existing_job = MagicMock(spec=IngestionJob)
        mock_db.query.return_value.filter.return_value.first.return_value = existing_job

        skipped, job = _run_if_new(1, "file.csv", data, "unknown", mock_db)
        assert skipped is True
        assert job is None
