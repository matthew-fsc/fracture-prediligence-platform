"""
conftest.py — Lightweight stubs for framework dependencies that are absent
from the minimal CI / test-only Python environment.

Loaded automatically by pytest before collection.  Only stubs packages that
are NOT importable; if a real package is installed it is left alone.
"""
from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# Core helper
# ---------------------------------------------------------------------------

def _mod(name: str) -> types.ModuleType:
    """Return existing sys.modules entry or create a blank ModuleType stub."""
    if name not in sys.modules:
        sys.modules[name] = types.ModuleType(name)
    return sys.modules[name]


def _ensure(name: str, **attrs) -> types.ModuleType:
    """Create/retrieve stub module and set any keyword attrs on it."""
    m = _mod(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    # Wire up as attribute on parent package
    if "." in name:
        parent, _, leaf = name.rpartition(".")
        parent_mod = _mod(parent)
        if not hasattr(parent_mod, leaf):
            setattr(parent_mod, leaf, m)
    return m


# ---------------------------------------------------------------------------
# SQLAlchemy
# ---------------------------------------------------------------------------
try:
    import sqlalchemy  # noqa: F401
except ImportError:
    _ensure("sqlalchemy",
            Column=MagicMock(), Integer=MagicMock(), String=MagicMock(),
            Text=MagicMock(), Boolean=MagicMock(), Numeric=MagicMock(),
            DateTime=MagicMock(), Date=MagicMock(), Float=MagicMock(),
            JSON=MagicMock(), Enum=MagicMock(), LargeBinary=MagicMock(),
            ForeignKey=MagicMock(), func=MagicMock(), text=MagicMock(),
            desc=MagicMock(), asc=MagicMock(), and_=MagicMock(), or_=MagicMock(),
            create_engine=MagicMock(), event=MagicMock(), inspect=MagicMock())
    _ensure("sqlalchemy.orm",
            Session=MagicMock, Mapped=MagicMock, mapped_column=MagicMock(),
            relationship=MagicMock(), DeclarativeBase=MagicMock,
            declarative_base=MagicMock(), sessionmaker=MagicMock)
    for _sub in ["session", "decl_api", "attributes", "query"]:
        _ensure(f"sqlalchemy.orm.{_sub}")
    for _sub in ["engine", "engine.base", "pool", "event",
                 "ext", "ext.declarative", "dialects", "dialects.postgresql"]:
        _ensure(f"sqlalchemy.{_sub}")


# ---------------------------------------------------------------------------
# Pydantic + pydantic-settings
# ---------------------------------------------------------------------------
try:
    import pydantic  # noqa: F401
except ImportError:
    class _BaseModel:
        model_fields: dict = {}
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self, *, exclude_unset=False, **_kw):
            return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        @classmethod
        def model_validate(cls, data):
            return cls(**data)

    _ensure("pydantic",
            BaseModel=_BaseModel,
            field_validator=lambda *a, **kw: (lambda f: f),
            model_validator=lambda *a, **kw: (lambda f: f),
            ConfigDict=dict,
            Field=MagicMock())
    for _sub in ["v1", "fields", "validators", "types"]:
        _ensure(f"pydantic.{_sub}")

try:
    import pydantic_settings  # noqa: F401
except ImportError:
    try:
        from pydantic import BaseModel as _BM
        _ensure("pydantic_settings", BaseSettings=_BM)
    except Exception:
        _ensure("pydantic_settings", BaseSettings=object)


# ---------------------------------------------------------------------------
# FastAPI + Starlette
# ---------------------------------------------------------------------------
try:
    import fastapi  # noqa: F401
except ImportError:
    class _HTTPException(Exception):
        def __init__(self, status_code: int = 500, detail=None):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

    _ensure("fastapi",
            APIRouter=MagicMock, Depends=lambda x: x,
            HTTPException=_HTTPException,
            Query=MagicMock(), File=MagicMock(), UploadFile=MagicMock,
            Header=MagicMock(), Body=MagicMock(), Path=MagicMock(),
            Request=MagicMock, Response=MagicMock)
    _ensure("fastapi.security",
            HTTPBearer=MagicMock, HTTPAuthorizationCredentials=MagicMock,
            OAuth2PasswordBearer=MagicMock)
    for _sub in ["responses", "middleware", "middleware.cors",
                 "staticfiles", "encoders", "params", "background", "routing"]:
        _ensure(f"fastapi.{_sub}")
    _ensure("starlette.responses", JSONResponse=MagicMock, Response=MagicMock,
            RedirectResponse=MagicMock)
    for _sub in ["starlette", "starlette.middleware", "starlette.middleware.cors",
                 "starlette.staticfiles", "starlette.routing"]:
        _ensure(_sub)


# ---------------------------------------------------------------------------
# Other heavy deps
# ---------------------------------------------------------------------------
try:
    import pandas  # noqa: F401
except ImportError:
    _pd = _ensure("pandas",
                  DataFrame=MagicMock, Series=MagicMock,
                  read_csv=MagicMock(), to_datetime=MagicMock(),
                  isna=MagicMock(), NA=None, NaT=None)
    _ensure("pandas.core")
    _ensure("pandas.core.frame")

try:
    import alembic  # noqa: F401
except ImportError:
    _ensure("alembic")
    _ensure("alembic.op", upgrade=MagicMock(), downgrade=MagicMock())
    _ensure("alembic.context")

try:
    import anthropic  # noqa: F401
except ImportError:
    _ensure("anthropic", Anthropic=MagicMock, AsyncAnthropic=MagicMock)

try:
    import stripe  # noqa: F401
except ImportError:
    _ensure("stripe")

try:
    import posthog  # noqa: F401
except ImportError:
    _ensure("posthog", Posthog=MagicMock)

# ---------------------------------------------------------------------------
# App-internal stubs — prevent side-effectful module-level code running
# during test collection (DB connection, Stripe init, etc.)
# Note: do NOT stub the real 'app' package tree — only stub the specific
# sub-modules that have import-time side effects.
# ---------------------------------------------------------------------------

# app.core.database calls create_engine() at module level — register a stub
# so that `from app.core.database import ...` succeeds without hitting the DB.
# We must NOT override sys.modules["app"] or sys.modules["app.core"] as those
# are real packages on disk; only the leaf module is stubbed.
#
# NOTE: app.ingestion.pipeline is NOT stubbed here — all ingestion dependencies
# (pandas, chardet, p2–p11 phases) are installed and import cleanly.  A stub
# would hide private helpers like _load_dataframe that ingestion tests need.

_SQLA_DESCRIPTOR_NAMES = frozenset({
    "MappedColumn", "RelationshipProperty", "column_property",
    "InstrumentedAttribute", "QueryableAttribute", "AssociationProxyInstance",
})

class _StubBase:
    """Plain-Python stub for SQLAlchemy declarative Base.
    Must be a real class (not a MagicMock instance) so that model classes can
    inherit from it without triggering a metaclass conflict.

    The __init__ accepts arbitrary kwargs and sets them as instance attributes,
    mimicking the generated __init__ that SQLAlchemy's declarative machinery
    would normally produce.  Unset mapped columns are initialised to None so
    that accessing them on a new instance returns None rather than the raw
    MappedColumn descriptor object."""
    __abstract__ = True

    def __init__(self, **kwargs):
        # Pre-initialise any SQLAlchemy column/relationship descriptors to None
        # so that unset attributes on new instances return None rather than the
        # raw descriptor object (which is what real SQLAlchemy ORM does).
        for name, val in type(self).__dict__.items():
            if not name.startswith("_") and type(val).__name__ in _SQLA_DESCRIPTOR_NAMES:
                object.__setattr__(self, name, None)
        for k, v in kwargs.items():
            setattr(self, k, v)

_db_stub = types.ModuleType("app.core.database")
_db_stub.engine = MagicMock()
_db_stub.SessionLocal = MagicMock()
_db_stub.Base = _StubBase
_db_stub.get_db = MagicMock()
sys.modules["app.core.database"] = _db_stub

# ---------------------------------------------------------------------------
try:
    from jose import jwt  # noqa: F401
except ImportError:
    # Add JWTError to the top-level jose module (auth.py does `from jose import JWTError, jwt`)
    _jose_jwt_stub = _ensure("jose.jwt", decode=MagicMock(), encode=MagicMock())
    _ensure("jose", JWTError=Exception, ExpiredSignatureError=Exception, jwt=_jose_jwt_stub)
    _ensure("jose.exceptions", JWTError=Exception, ExpiredSignatureError=Exception)

try:
    import intuitlib  # noqa: F401
except ImportError:
    _ensure("intuitlib")
    _ensure("intuitlib.client", AuthClient=MagicMock)
    _ensure("intuitlib.enums", Scopes=MagicMock())
    _ensure("intuitlib.exceptions")

try:
    import quickbooks  # noqa: F401
except ImportError:
    _ensure("quickbooks", QuickBooks=MagicMock)
    _ensure("quickbooks.objects")
    _ensure("quickbooks.objects.invoice", Invoice=MagicMock)
    _ensure("quickbooks.objects.customer", Customer=MagicMock)
    _ensure("quickbooks.objects.account", Account=MagicMock)
    _ensure("quickbooks.client")

try:
    from passlib.context import CryptContext  # noqa: F401
except ImportError:
    _ensure("passlib")
    _ensure("passlib.context", CryptContext=MagicMock)

try:
    import boto3  # noqa: F401
except ImportError:
    _ensure("boto3")
    _ensure("botocore")
    _ensure("botocore.exceptions", ClientError=Exception)

try:
    import httpx  # noqa: F401
except ImportError:
    _ensure("httpx", AsyncClient=MagicMock, get=MagicMock())

try:
    from jwcrypto import jwk  # noqa: F401
except ImportError:
    _ensure("jwcrypto")
    _ensure("jwcrypto.jwk")
    _ensure("jwcrypto.jwt")
