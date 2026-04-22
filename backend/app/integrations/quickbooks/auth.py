"""
QuickBooks OAuth 2.0 flow (Blueprint I — QB ingestion path).

Uses intuit-oauth for the 3-legged OAuth dance. Tokens are persisted in the
qb_tokens table; the helper auto-refreshes when the token is within 5 minutes
of expiry.

Endpoints registered in api/routes/quickbooks.py:
  GET  /api/qb/authorize/{company_id}   → redirect to Intuit consent page
  GET  /api/qb/callback                 → exchange code, store token
  POST /api/qb/refresh/{company_id}     → force token refresh
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.ontology.models import QBToken

# In-process CSRF state map: {state_str: company_id}
# Short-lived; not persisted across restarts (acceptable — OAuth dance completes
# in seconds).  For multi-worker deployments a Redis store could be substituted.
_OAUTH_STATE: dict[str, int] = {}


def _scopes():
    from intuitlib.enums import Scopes
    return [Scopes.ACCOUNTING]


def _auth_client():
    from intuitlib.client import AuthClient
    return AuthClient(
        client_id=settings.QB_CLIENT_ID,
        client_secret=settings.QB_CLIENT_SECRET,
        redirect_uri=settings.QB_REDIRECT_URI,
        environment=settings.QB_ENVIRONMENT,  # "sandbox" | "production"
    )


def build_authorize_url(company_id: int) -> str:
    """Return the Intuit consent page URL and stash CSRF state."""
    client = _auth_client()
    state = secrets.token_urlsafe(24)
    _OAUTH_STATE[state] = company_id
    return client.get_authorization_url(_scopes(), state=state)


def exchange_code_for_token(
    code: str,
    realm_id: str,
    state: str,
    db: Session,
) -> tuple[int, QBToken]:
    """
    Complete the OAuth dance.  Returns (company_id, QBToken row).
    Raises ValueError on unknown state (CSRF protection).
    """
    company_id = _OAUTH_STATE.pop(state, None)
    if company_id is None:
        raise ValueError("Unknown OAuth state — possible CSRF or expired request.")

    client = _auth_client()
    client.get_bearer_token(code, realm_id=realm_id)

    token = _upsert_token(
        db=db,
        company_id=company_id,
        realm_id=realm_id,
        access_token=client.access_token,
        refresh_token=client.refresh_token,
        expires_at=_parse_expiry(client.expires_in),
    )
    return company_id, token


def refresh_token_if_needed(company_id: int, db: Session) -> QBToken:
    """
    Return a valid QBToken for *company_id*, refreshing it automatically if it
    expires within the next 5 minutes.
    Raises LookupError if no token is on file.
    """
    tok = db.query(QBToken).filter(QBToken.company_id == company_id).first()
    if not tok:
        raise LookupError(f"No QuickBooks token for company {company_id}.")

    margin = timedelta(minutes=5)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if tok.expires_at is None or tok.expires_at - now > margin:
        return tok

    client = _auth_client()
    client.refresh(refresh_token=tok.refresh_token)

    tok.access_token = client.access_token
    tok.refresh_token = client.refresh_token
    tok.expires_at = _parse_expiry(client.expires_in)
    db.commit()
    db.refresh(tok)
    return tok


def force_refresh(company_id: int, db: Session) -> QBToken:
    """Unconditionally refresh the stored token."""
    tok = db.query(QBToken).filter(QBToken.company_id == company_id).first()
    if not tok:
        raise LookupError(f"No QuickBooks token for company {company_id}.")
    client = _auth_client()
    client.refresh(refresh_token=tok.refresh_token)
    tok.access_token = client.access_token
    tok.refresh_token = client.refresh_token
    tok.expires_at = _parse_expiry(client.expires_in)
    db.commit()
    db.refresh(tok)
    return tok


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_expiry(expires_in) -> Optional[datetime]:
    """Convert expires_in seconds to an absolute UTC datetime."""
    try:
        return datetime.utcnow() + timedelta(seconds=int(expires_in))
    except (TypeError, ValueError):
        return None


def _upsert_token(
    db: Session,
    company_id: int,
    realm_id: str,
    access_token: str,
    refresh_token: str,
    expires_at: Optional[datetime],
) -> QBToken:
    tok = db.query(QBToken).filter(QBToken.company_id == company_id).first()
    if tok:
        tok.realm_id = realm_id
        tok.access_token = access_token
        tok.refresh_token = refresh_token
        tok.expires_at = expires_at
        tok.updated_at = datetime.utcnow()
    else:
        tok = QBToken(
            company_id=company_id,
            realm_id=realm_id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
        )
        db.add(tok)
    db.commit()
    db.refresh(tok)
    return tok
