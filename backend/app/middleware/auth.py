"""
Clerk JWT verification middleware for FastAPI.

Usage:
    from app.middleware.auth import get_current_user, CurrentUser
    from fastapi import Depends

    @router.get("/protected")
    async def protected(user: CurrentUser = Depends(get_current_user)):
        return {"user_id": user.user_id}

Environment variables:
    CLERK_JWKS_URL  — your Clerk instance JWKS URL, e.g.:
                      https://your-instance.clerk.accounts.dev/.well-known/jwks.json
    SECRET_KEY      — fallback HS256 secret for local dev (when CLERK_JWKS_URL is empty)
"""

import logging
import time
from typing import Optional

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.core.config import settings

CLERK_JWKS_URL: str = settings.CLERK_JWKS_URL
SECRET_KEY: str = settings.SECRET_KEY

# ---------------------------------------------------------------------------
# JWKS in-memory cache (refreshed every hour)
# ---------------------------------------------------------------------------
_jwks_keys: list = []
_jwks_fetched_at: float = 0.0
_JWKS_TTL: float = settings.AUTH_JWKS_TTL_SECONDS

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


async def _get_jwks_keys() -> list:
    global _jwks_keys, _jwks_fetched_at
    now = time.monotonic()
    if _jwks_keys and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_keys
    if not CLERK_JWKS_URL:
        return []
    try:
        async with httpx.AsyncClient(timeout=settings.AUTH_JWKS_TIMEOUT_SECONDS) as client:
            resp = await client.get(CLERK_JWKS_URL)
            resp.raise_for_status()
            data = resp.json()
            _jwks_keys = data.get("keys", [])
            _jwks_fetched_at = now
    except Exception as exc:
        if _jwks_keys:
            logger.warning(
                "Clerk JWKS refresh failed (%s); using cached keys until cache TTL expires.",
                exc,
            )
        else:
            logger.warning(
                "Clerk JWKS fetch failed and no cached keys are available (%s). "
                "JWT verification will fail until JWKS is reachable.",
                exc,
            )
    return _jwks_keys


# ---------------------------------------------------------------------------
# CurrentUser value object
# ---------------------------------------------------------------------------

class CurrentUser:
    def __init__(self, user_id: str, payload: dict):
        self.user_id = user_id
        self.payload = payload

    def __repr__(self) -> str:  # pragma: no cover
        return f"CurrentUser(user_id={self.user_id!r})"


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def authenticate_credentials(credentials: HTTPAuthorizationCredentials) -> CurrentUser:
    token = credentials.credentials

    try:
        keys = await _get_jwks_keys()

        if keys:
            # Clerk RS256 path
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            key = next((k for k in keys if k.get("kid") == kid), keys[0])
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
        else:
            if settings.APP_ENV.lower() == "production":
                raise HTTPException(
                    status_code=503,
                    detail="Clerk JWKS is not configured (set CLERK_JWKS_URL in production)",
                )
            # Local dev HS256 fallback (SECRET_KEY) when CLERK_JWKS_URL is unset
            payload = jwt.decode(
                token,
                SECRET_KEY,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing sub claim")

        return CurrentUser(user_id=user_id, payload=payload)

    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Token invalid: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}") from exc


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")
    return await authenticate_credentials(credentials)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[CurrentUser]:
    """Return the authenticated user if a token is present, otherwise None.

    Authorization enforcement is deferred to the company-scoping layer
    (ensure_company_access) so that unowned demo companies remain accessible
    without a token in every environment.
    """
    if not credentials:
        return None
    return await authenticate_credentials(credentials)
