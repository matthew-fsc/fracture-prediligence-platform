from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.routes import ingestion, analytics, companies, reports, demo
from app.api.routes import payments, webhooks
from app.core.config import settings
from app.core.database import engine, SessionLocal, Base

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"


def _bootstrap_db():
    """Create all tables and seed demo company + app settings if not present."""
    # Import all models so Base knows about them
    import app.ontology.models           # noqa: F401
    import app.ontology.ingestion_models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        from app.ontology.models import Company
        from app.core.db_functions import _ensure_spots_setting

        if not db.query(Company).filter(Company.id == 1).first():
            db.add(Company(id=1, name="Demo Company"))
            db.commit()

        _ensure_spots_setting(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _bootstrap_db()
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
    return {"status": "ok", "service": "prediligence-platform"}


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
