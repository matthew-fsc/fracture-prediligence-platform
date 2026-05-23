import logging
import secrets
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.api.routes import ingestion, analytics, companies, reports, demo, library
from app.api.routes import payments, webhooks
from app.api.routes import copilot
from app.api.routes import user_profiles
from app.api.routes import admin_metrics, client_portal, firms, partners, referrals
from app.api.routes import quickbooks, engagement
from app.core.config import settings
from app.core.database import engine, SessionLocal, Base

logger = logging.getLogger(__name__)

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"


def _bootstrap_db():
    """Seed data on startup. Production/staging schema must come from Alembic only."""
    # Import all models so Base knows about them (UserProfile, ClientAccess included)
    import app.ontology.models           # noqa: F401
    import app.ontology.ingestion_models  # noqa: F401

    db = SessionLocal()
    try:
        from app.ontology.models import Company
        from app.core.db_functions import _ensure_spots_setting
        from app.analytics.market_benchmarks import seed_curated_benchmarks_if_empty

        c1 = db.query(Company).filter(Company.id == 1).first()
        if not c1:
            db.add(Company(id=1, name="Demo Company"))
            db.commit()
            c1 = db.query(Company).filter(Company.id == 1).first()
        if (
            c1
            and c1.owner_user_id is None
            and settings.SEED_COMPANY_1_OWNER_USER_ID
        ):
            c1.owner_user_id = settings.SEED_COMPANY_1_OWNER_USER_ID
            db.commit()

        _ensure_spots_setting(db)
        seed_curated_benchmarks_if_empty(db)
        try:
            from app.analytics.market_benchmarks import ensure_field_services_m1m5_benchmark_multiples

            ensure_field_services_m1m5_benchmark_multiples(db)
        except Exception:
            logger.exception("Field services benchmark multiple sync skipped.")
        try:
            from app.services.demo_company_seed import (
                ensure_demo_company_seeded,
                ensure_demo_ingestion_job_if_missing,
            )

            ensure_demo_company_seeded(db)
            ensure_demo_ingestion_job_if_missing(db)
        except Exception:
            logger.exception(
                "Demo company seed failed — analytics may be empty until "
                "you run: python scripts/seed_abc_company.py"
            )
        try:
            from app.api.routes.library import seed_library_if_empty
            seeded = seed_library_if_empty(db)
            if seeded:
                logger.info(f'Advisory library seeded with {seeded} items.')
            db.commit()
        except Exception:
            logger.exception('Advisory library seed failed — table may not exist yet; will retry on next startup.')
        try:
            from app.analytics.buyer_universe import seed_buyer_universe_if_empty
            seed_buyer_universe_if_empty(db)
            db.commit()
        except Exception:
            logger.exception('Buyer universe seed failed — table may not exist yet; will retry on next startup.')
    finally:
        db.close()


def _validate_production_config():
    """SEC-1/SEC-2/CFG-1: Fail fast if critical env vars are missing or insecure in production."""
    env = settings.APP_ENV.lower()
    if env != "production":
        return

    # SEC-1: Reject default SECRET_KEY in production (JWT forgery risk).
    # Also handle the case where Railway's ${{secret(...)}} generation syntax
    # was passed as a literal string instead of being evaluated — in that
    # situation we generate a cryptographically-strong key at runtime so the
    # deployment can proceed securely rather than crashing on startup.
    _secret_key = settings.SECRET_KEY
    _is_default = _secret_key == "change-me-in-production"
    _is_unevaluated_railway_var = "${{" in _secret_key
    if _is_default or _is_unevaluated_railway_var:
        _generated = secrets.token_hex(32)
        settings.SECRET_KEY = _generated
        logger.warning(
            "SECURITY: SECRET_KEY was %s. "
            "A random key has been generated for this process. "
            "Set a persistent SECRET_KEY environment variable to avoid "
            "invalidating existing JWT tokens on every restart.",
            "the default placeholder" if _is_default else "an unevaluated Railway variable reference",
        )

    # SEC-2: Unsigned Stripe webhooks must never be enabled in production
    if settings.ALLOW_UNSIGNED_STRIPE_WEBHOOKS:
        raise RuntimeError(
            "SECURITY: ALLOW_UNSIGNED_STRIPE_WEBHOOKS=true is not allowed in production. "
            "This flag is only for local Stripe CLI testing (APP_ENV=development)."
        )

    # CFG-1: Required credentials must be set
    _required = {
        "CLERK_SECRET_KEY": settings.CLERK_SECRET_KEY,
        "CLERK_JWKS_URL": settings.CLERK_JWKS_URL,
        "STRIPE_SECRET_KEY": settings.STRIPE_SECRET_KEY,
        "STRIPE_WEBHOOK_SECRET": settings.STRIPE_WEBHOOK_SECRET,
        "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY,
    }
    missing = [k for k, v in _required.items() if not v or v.startswith("replace-me") or v.startswith("sk_test_replace")]
    if missing:
        raise RuntimeError(
            f"CRITICAL: The following required environment variables are not configured for production: "
            f"{', '.join(missing)}"
        )


def _check_db_connectivity():
    """DEPLOY-1: Verify database is reachable before accepting traffic."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise RuntimeError(f"DEPLOY-1: Database is not reachable at startup: {exc}") from exc


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast on misconfiguration before accepting any traffic
    _validate_production_config()
    _check_db_connectivity()

    # Run DB bootstrap in a background thread so /health responds immediately.
    # Railway's health check must pass before traffic is routed — bootstrap must not block yield.
    import asyncio

    async def _bg_bootstrap():
        try:
            await asyncio.to_thread(_bootstrap_db)
        except Exception:
            logger.exception(
                "Database bootstrap failed; API is up but /health/ready will report unavailable until DB works."
            )

    asyncio.create_task(_bg_bootstrap())
    yield


from app.core.rate_limiting import limiter
from app.core.startup_checks import run_production_startup_checks

app = FastAPI(
    title="Pre-Diligence Platform API",
    description="Fracture Systems — Blueprint I & II backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# SEC-5: Restrict CORS to explicit methods and headers instead of wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["content-type", "authorization", "x-admin-key", "x-request-id"],
)


# OBS-2: Attach a unique request ID to every request for log correlation
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

app.include_router(ingestion.router,  prefix="/api/ingestion",  tags=["ingestion"])
app.include_router(analytics.router,  prefix="/api/analytics",  tags=["analytics"])
app.include_router(companies.router,  prefix="/api/companies",  tags=["companies"])
app.include_router(reports.router,    prefix="/api/reports",    tags=["reports"])
app.include_router(library.router,    prefix="/api/library",    tags=["library"])
app.include_router(demo.router,       prefix="/api",            tags=["demo"])
app.include_router(payments.router,   prefix="/api",            tags=["payments"])
app.include_router(webhooks.router,   prefix="/api",            tags=["webhooks"])
app.include_router(copilot.router,       prefix="/api/copilot",       tags=["copilot"])
app.include_router(user_profiles.router, prefix="/api",               tags=["user-profiles"])
app.include_router(client_portal.router, prefix="/api/portal",        tags=["portal"])
app.include_router(referrals.router,     prefix="/api/referrals",     tags=["referrals"])
app.include_router(firms.router,         prefix="/api/firms",         tags=["firms"])
app.include_router(partners.router,      prefix="/api/partners",      tags=["partners"])
app.include_router(admin_metrics.router, prefix="/api/admin",         tags=["admin"])
app.include_router(quickbooks.router,    prefix="/api/qb",             tags=["quickbooks"])
app.include_router(engagement.router,    prefix="/api/engagement",     tags=["engagement"])


@app.api_route("/health", methods=["GET", "HEAD"])
def health(request: Request):
    """Liveness: process is up (use for load balancer probes that should not hit the DB).

    HEAD is supported — some platforms probe with HEAD; GET-only routes return 405 and fail checks.
    """
    if request.method == "HEAD":
        return Response(status_code=200)
    return {
        "status": "ok",
        "service": "prediligence-platform",
        "env": settings.APP_ENV,
    }


@app.api_route("/health/ready", methods=["GET", "HEAD"])
def health_ready(request: Request):
    """Readiness: DB accepts connections. Returns 503 if the database is unreachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        logger.exception("readiness check failed")
        raise HTTPException(status_code=503, detail="database_unavailable")
    if request.method == "HEAD":
        return Response(status_code=200)
    return {"status": "ok", "database": "connected", "env": settings.APP_ENV}


# ── Serve React SPA ──────────────────────────────────────────────────────────
# Mount static assets (JS, CSS, images) — must come after all API routes
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/favicon.svg")
    def favicon():
        return FileResponse(FRONTEND_DIST / "favicon.svg")

    @app.get("/logo.png")
    def logo():
        return FileResponse(FRONTEND_DIST / "logo.png")

    # SPA catch-all: serve index.html for every non-API route.
    # API paths without trailing slash would otherwise be swallowed by this
    # catch-all before FastAPI's redirect_slashes can fire, so redirect them.
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str, request: Request):
        from fastapi.responses import RedirectResponse
        if full_path.startswith("api/") or full_path == "api":
            # Preserve query string and redirect to the same path with trailing slash
            qs = f"?{request.url.query}" if request.url.query else ""
            return RedirectResponse(url=f"/{full_path}/{qs}", status_code=307)
        return FileResponse(FRONTEND_DIST / "index.html")
