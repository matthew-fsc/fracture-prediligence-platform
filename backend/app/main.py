import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.routes import ingestion, analytics, companies, reports, demo, library
from app.api.routes import payments, webhooks
from app.api.routes import copilot
from app.api.routes import admin_metrics, client_portal, firms, partners, referrals
from app.core.config import settings
from app.core.database import engine, SessionLocal, Base

logger = logging.getLogger(__name__)

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"


def _bootstrap_db():
    """Seed data and dev-only create_all. Production/staging schema must come from Alembic only."""
    # Import all models so Base knows about them
    import app.ontology.models           # noqa: F401
    import app.ontology.ingestion_models  # noqa: F401

    # Dev-only: sync ORM metadata to a local DB. In production, create_all races Alembic (duplicate objects).
    if settings.APP_ENV.lower() == "development":
        Base.metadata.create_all(bind=engine)

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
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV.lower() == "production" and settings.SECRET_KEY == "change-me-in-production":
        logger.warning(
            "SECRET_KEY is still the default; set a strong random SECRET_KEY in production."
        )
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


app = FastAPI(
    title="Pre-Diligence Platform API",
    description="Fracture Systems — Blueprint I & II backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion.router,  prefix="/api/ingestion",  tags=["ingestion"])
app.include_router(analytics.router,  prefix="/api/analytics",  tags=["analytics"])
app.include_router(companies.router,  prefix="/api/companies",  tags=["companies"])
app.include_router(reports.router,    prefix="/api/reports",    tags=["reports"])
app.include_router(library.router,    prefix="/api/library",    tags=["library"])
app.include_router(demo.router,       prefix="/api",            tags=["demo"])
app.include_router(payments.router,   prefix="/api",            tags=["payments"])
app.include_router(webhooks.router,   prefix="/api",            tags=["webhooks"])
app.include_router(copilot.router,       prefix="/api/copilot",       tags=["copilot"])
app.include_router(client_portal.router, prefix="/api/portal",        tags=["portal"])
app.include_router(referrals.router,     prefix="/api/referrals",     tags=["referrals"])
app.include_router(firms.router,         prefix="/api/firms",         tags=["firms"])
app.include_router(partners.router,      prefix="/api/partners",      tags=["partners"])
app.include_router(admin_metrics.router, prefix="/api/admin",         tags=["admin"])


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
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/favicon.svg")
    def favicon():
        return FileResponse(FRONTEND_DIST / "favicon.svg")

    @app.get("/logo.png")
    def logo():
        return FileResponse(FRONTEND_DIST / "logo.png")

    # SPA catch-all: serve index.html for every non-API route
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")
