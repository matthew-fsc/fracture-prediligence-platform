import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.routes import ingestion, analytics, companies, reports, demo
from app.api.routes import payments, webhooks
from app.core.config import settings
from app.core.database import engine, SessionLocal, Base

logger = logging.getLogger(__name__)

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"


def _bootstrap_db():
    """Seed and additive fixes. Schema in production/staging must come from Alembic — not create_all."""
    # Import all models so Base knows about them
    import app.ontology.models           # noqa: F401
    import app.ontology.ingestion_models  # noqa: F401

    # In production, create_all races Alembic (duplicate tables). Dev-only convenience for local DBs.
    if settings.APP_ENV.lower() == "development":
        Base.metadata.create_all(bind=engine)

    # Additive column migrations — safe to run on every startup
    from sqlalchemy import text, inspect as sa_inspect
    inspector = sa_inspect(engine)
    if 'qualitative_inputs' in inspector.get_table_names():
        existing = {c['name'] for c in inspector.get_columns('qualitative_inputs')}
        new_cols = {
            'contract_pct':           'NUMERIC(5,1)',
            'customer_contract_type': 'VARCHAR(32)',
            'key_person_revenue_pct': 'NUMERIC(5,1)',
        }
        with engine.connect() as conn:
            for col, col_type in new_cols.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE qualitative_inputs ADD COLUMN {col} {col_type}'))
            conn.commit()

    if 'companies' in inspector.get_table_names():
        co_cols = {c['name'] for c in inspector.get_columns('companies')}
        if 'owner_user_id' not in co_cols:
            with engine.connect() as conn:
                conn.execute(text('ALTER TABLE companies ADD COLUMN owner_user_id VARCHAR(256)'))
                conn.commit()
            logger.info('Added companies.owner_user_id column (additive migration).')

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
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV.lower() == "production" and settings.SECRET_KEY == "change-me-in-production":
        logger.warning(
            "SECRET_KEY is still the default; set a strong random SECRET_KEY in production."
        )
    # Do not fail process startup if DB is unreachable — Railway/load balancers need /health (liveness)
    # while Postgres is provisioning or DATABASE_URL is wrong. Use /health/ready for DB readiness.
    try:
        _bootstrap_db()
    except Exception:
        logger.exception(
            "Database bootstrap failed; API is up but /health/ready will report unavailable until DB works."
        )
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
app.include_router(demo.router,       prefix="/api",            tags=["demo"])
app.include_router(payments.router,   prefix="/api",            tags=["payments"])
app.include_router(webhooks.router,   prefix="/api",            tags=["webhooks"])


@app.get("/health")
def health():
    """Liveness: process is up (use for load balancer probes that should not hit the DB)."""
    return {
        "status": "ok",
        "service": "prediligence-platform",
        "env": settings.APP_ENV,
    }


@app.get("/health/ready")
def health_ready():
    """Readiness: DB accepts connections. Returns 503 if the database is unreachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected", "env": settings.APP_ENV}
    except Exception:
        logger.exception("readiness check failed")
        raise HTTPException(status_code=503, detail="database_unavailable")


# ── Serve React SPA ──────────────────────────────────────────────────────────
# Mount static assets (JS, CSS, images) — must come after all API routes
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/favicon.svg")
    def favicon():
        return FileResponse(FRONTEND_DIST / "favicon.svg")

    # SPA catch-all: serve index.html for every non-API route
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")
