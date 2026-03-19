from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ingestion, analytics, companies, reports
from app.core.database import engine, SessionLocal, Base


def _bootstrap_db():
    """Create all tables and seed demo company if not present."""
    # Import all models so Base knows about them
    import app.ontology.models           # noqa: F401
    import app.ontology.ingestion_models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        from app.ontology.models import Company
        if not db.query(Company).filter(Company.id == 1).first():
            db.add(Company(id=1, name="Demo Company"))
            db.commit()
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion.router,  prefix="/api/ingestion",  tags=["ingestion"])
app.include_router(analytics.router,  prefix="/api/analytics",  tags=["analytics"])
app.include_router(companies.router,  prefix="/api/companies",  tags=["companies"])
app.include_router(reports.router,    prefix="/api/reports",    tags=["reports"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "prediligence-platform"}
