"""Company ownership checks (IDOR prevention)."""

import pytest
from fastapi import HTTPException

from app.api.deps import ensure_company_access
from app.middleware.auth import CurrentUser
from app.ontology.models import Company, CompanyAccessGrant, ClientAccess


class _Q:
    def __init__(self, row):
        self._row = row

    def filter(self, *a, **k):
        return self

    def with_for_update(self):
        return self

    def first(self):
        return self._row


class _DB:
    """
    Mock DB that returns the company for Company queries and None for
    all other models (CompanyAccessGrant, ClientAccess, etc.).
    """
    def __init__(self, company):
        self._company = company

    def query(self, model):
        if model is Company:
            return _Q(self._company)
        return _Q(None)


class _Co:
    def __init__(self, cid, owner):
        self.id = cid
        self.owner_user_id = owner


def test_ensure_company_access_owner_ok():
    c = _Co(1, "user_a")
    db = _DB(c)
    user = CurrentUser("user_a", {})
    assert ensure_company_access(1, user, db).id == 1


def test_ensure_company_access_wrong_user():
    c = _Co(1, "user_a")
    db = _DB(c)
    user = CurrentUser("user_b", {})
    with pytest.raises(HTTPException) as exc:
        ensure_company_access(1, user, db)
    assert exc.value.status_code == 403


def test_ensure_company_access_missing_company():
    db = _DB(None)
    user = CurrentUser("user_a", {})
    with pytest.raises(HTTPException) as exc:
        ensure_company_access(99, user, db)
    assert exc.value.status_code == 404
