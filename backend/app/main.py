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
            'contract_pct':            'NUMERIC(5,1)',
            'customer_contract_type':  'VARCHAR(32)',
            'key_person_revenue_pct':  'NUMERIC(5,1)',
            'mgmt_covered_functions':  'VARCHAR(256)',
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
        fin_cols = {
            'market_rate_replacement_annual': 'NUMERIC(14,2)',
            'depreciation_amortization_ttm': 'NUMERIC(14,2)',
            'interest_expense_ttm': 'NUMERIC(14,2)',
            'income_tax_expense_ttm': 'NUMERIC(14,2)',
            'report_firm_name': 'VARCHAR(256)',
            'report_cover_blurb': 'TEXT',
            'report_logo_url': 'VARCHAR(512)',
            'total_headcount': 'INTEGER',
        }
        with engine.connect() as conn:
            for col, col_type in fin_cols.items():
                if col not in co_cols:
                    conn.execute(text(f'ALTER TABLE companies ADD COLUMN {col} {col_type}'))
            conn.commit()

    # score_snapshots table — auto-create if missing (create_all won't run in prod)
    if 'score_snapshots' not in inspector.get_table_names():
        with engine.connect() as conn:
            conn.execute(text(
                """CREATE TABLE IF NOT EXISTS score_snapshots (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    drs_score NUMERIC(6,2) NOT NULL,
                    ev_estimate NUMERIC(16,2),
                    trigger VARCHAR(64),
                    created_at TIMESTAMP DEFAULT NOW()
                )"""
            ))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_score_snapshots_company_id ON score_snapshots (company_id)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_score_snapshots_created_at ON score_snapshots (created_at)'))
            conn.commit()

    if 'advisory_library_items' not in inspector.get_table_names():
        with engine.connect() as conn:
            conn.execute(text(
                """CREATE TABLE IF NOT EXISTS advisory_library_items (
                    id SERIAL PRIMARY KEY,
                    item_type VARCHAR(32) NOT NULL,
                    title VARCHAR(512) NOT NULL,
                    description TEXT,
                    category VARCHAR(64),
                    severity VARCHAR(16),
                    buyer_type VARCHAR(32),
                    tags_json TEXT,
                    data_needed TEXT,
                    score_trigger NUMERIC(5,1),
                    effort VARCHAR(32),
                    timeline VARCHAR(128),
                    ev_impact VARCHAR(32),
                    source VARCHAR(32) DEFAULT 'system',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )"""
            ))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_advisory_library_items_item_type ON advisory_library_items (item_type)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_advisory_library_items_category ON advisory_library_items (category)'))
            conn.commit()
            logger.info('Created advisory_library_items table (additive migration).')

    if 'generated_reports' in inspector.get_table_names():
        gr_cols = {c['name'] for c in inspector.get_columns('generated_reports')}
        if 'ev_at_generation' not in gr_cols:
            with engine.connect() as conn:
                conn.execute(text('ALTER TABLE generated_reports ADD COLUMN ev_at_generation NUMERIC(16,2)'))
                conn.commit()

    if 'engagement_profiles' in inspector.get_table_names():
        ep_cols = {c['name'] for c in inspector.get_columns('engagement_profiles')}
        ep_new = {
            'owner_motivations_json': 'TEXT',
            'post_exit_plans':        'VARCHAR(64)',
            'non_negotiables':        'TEXT',
            'engagement_start_date':  'VARCHAR(32)',
        }
        with engine.connect() as conn:
            for col, col_type in ep_new.items():
                if col not in ep_cols:
                    conn.execute(text(f'ALTER TABLE engagement_profiles ADD COLUMN {col} {col_type}'))
            conn.commit()

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
app.include_router(copilot.router,    prefix="/api/copilot",    tags=["copilot"])


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

    # SPA catch-all: serve index.html for every non-API route
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")
