# Fracture Prediligence Platform — Claude Code Guide

## Project Overview

Enterprise M&A operating intelligence platform that transforms raw business data (QuickBooks, CRM, payroll, contracts) into investor-grade operational readiness assessments. Produces:
- **Diligence Readiness Score (DRS)** (0–100)
- **Defensible EBITDA** with addback schedules
- **Enterprise Value** estimates
- **Value creation roadmaps** (18–36mo initiatives)
- **Buyer risk simulations** (PE diligence Q&A prep)

Target users: M&A advisors, CEPA-certified exit planners, PE-backed acquirers.

## Tech Stack

| Layer | Technologies |
|-------|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3.4, Recharts 2.12, TanStack React Query 5, Clerk (auth), Framer Motion |
| Backend | Python 3.12, FastAPI 0.115+, SQLAlchemy 2.0+, Alembic |
| Database | PostgreSQL 16 |
| Auth | Clerk (JWKS in prod, HS256 fallback in dev) |
| AI | Anthropic Claude API (field mapping, copilot, buyer Q simulation) |
| Payments | Stripe |
| Analytics | PostHog |
| Deployment | Docker (multi-stage), Fly.io / Render / Railway configs |

## Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173 — proxies /api/* to localhost:8000
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env         # Fill in DATABASE_URL, Clerk keys, etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Docker (prod-like)
```bash
docker compose up --build
# App served at http://localhost:8000
```

## Key Environment Variables

**`backend/.env`:**
```
APP_ENV=development|production
DATABASE_URL=postgresql://user:pass@localhost:5432/fracture
SECRET_KEY=<random-32-hex>
CLERK_SECRET_KEY=sk_...
CLERK_JWKS_URL=https://<instance>.clerk.accounts.dev/.well-known/jwks.json
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
POSTHOG_API_KEY=...
USE_S3_STORAGE=false
```

**`frontend/.env`:**
```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_BASE_URL=          # Empty for same-origin; set to https://api.example.com for split-origin
VITE_POSTHOG_KEY=ph_...
```

## Architecture

### Two Core Blueprints

**Blueprint I — Ingestion Pipeline** (`backend/app/ingestion/`): P1–P11
- File upload → validation → schema profiling → column mapping (Claude-assisted) → row extraction → business rule validation → normalization → entity resolution → relationship mapping → ontology commit with audit trail

**Blueprint II — Analytical Engine** (`backend/app/analytics/`): A1–A14
- Metric computation → EBITDA recast → revenue quality → operational independence → customer risk → management assessment → growth drivers → financial integrity → DRS composite → enterprise value → value gap → initiative roadmap → buyer Q simulation → report assembly

### Multi-Tenancy
Every database query is scoped via `Depends(get_company_scope)` in `backend/app/api/deps.py`. Never bypass this dependency.

### Authentication
- Dev: HS256 JWT with `SECRET_KEY`
- Prod: Clerk JWKS verification via `backend/app/middleware/auth.py`

## Directory Structure

```
fracture-prediligence-platform/
├── frontend/src/
│   ├── components/        # UI primitives, auth, layout shells
│   ├── pages/             # 30+ page components
│   ├── hooks/             # Custom React hooks
│   ├── context/           # CompanyContext, UserRoleContext
│   ├── lib/               # apiClient.js, mockData.js, utils.js
│   └── theme/             # Dark mode + Tailwind config
├── backend/app/
│   ├── api/routes/        # FastAPI routers (one file per domain)
│   ├── ingestion/         # Blueprint I: p2_raw_storage.py → p11_ontology_commit.py
│   ├── analytics/         # Blueprint II: a1_metric_computation.py → a14_report_generator.py
│   ├── ontology/          # SQLAlchemy models (Company, Customer, RevenueStream, etc.)
│   ├── services/          # Business logic orchestration
│   ├── core/              # config.py, database.py, scoring_rules.py
│   └── middleware/auth.py # Clerk JWT verification
├── backend/alembic/       # Database migrations
└── backend/tests/         # Pytest test suite
```

## Important Patterns

### Backend
- **New routes**: Add a router file in `backend/app/api/routes/`, register it in `backend/app/main.py`
- **DB schema changes**: Always use `alembic revision --autogenerate -m "description"` — never call `Base.metadata.create_all()` directly in production code
- **All DB queries must use** `Depends(get_company_scope)` for multi-tenancy isolation
- **Pydantic models** for all request/response validation
- **Audit columns** (`created_at`, `updated_at`, `ingestion_id`, `source_file`, `confidence_level`) on all ontology records
- **DRS scoring weights** live in `backend/app/core/scoring_rules.py` (`SCORING_RULES_VERSION`)

### Frontend
- **API calls**: Use `lib/apiClient.js` — it injects Clerk JWT automatically
- **Server state**: Use TanStack React Query (stale-time 30s, retry once)
- **UI theme**: Dark mode default; use existing Tailwind CSS variables and `theme/` config
- **Icons**: Lucide React
- **Charts**: Recharts wrappers (see existing pages for patterns)
- **Routing**: React Router v6; protected routes wrap authenticated pages

### Claude API Usage
The platform uses Claude for:
1. Column mapping suggestions during ingestion (`backend/app/ingestion/p5_column_mapping.py`)
2. AI Copilot chat over company data (`backend/app/api/routes/copilot.py`)
3. Buyer Q&A simulation (`backend/app/analytics/a13_buyer_questions.py`)

Use `claude-sonnet-4-6` or newer for all Claude API calls.

## Running Tests

```bash
cd backend
pytest tests/ -v
```

Key test files:
- `tests/test_company_access.py` — Multi-tenancy/auth isolation
- `tests/test_scoring_rules.py` — DRS scoring logic
- `tests/test_demo_data_integrity.py` — Demo dataset consistency
- `tests/test_market_benchmarks.py` — Market comp data

## Deployment

### Same-origin (recommended)
Single Docker image: Vite build output served as static files by FastAPI at port 8000.
```bash
docker build -t fracture-platform .
docker run -p 8000:8000 --env-file backend/.env fracture-platform
```

Set `RUN_MIGRATIONS=true` in env to auto-run `alembic upgrade head` on container start.

### Split-origin
- Frontend → Vercel (set `VITE_API_BASE_URL=https://api.yourapp.com`)
- Backend → Fly.io / Render / Railway (set `CORS_ORIGINS=https://yourapp.vercel.app`)

### Health Checks
- `GET /health` — Liveness (no DB)
- `GET /health/ready` — Readiness (checks DB with `SELECT 1`)

## Demo Mode

A seeded demo company (Client-0) is available without real data ingestion:
- Backend: `python backend/scripts/seed_abc_company.py`
- Demo login endpoints: `backend/app/api/routes/demo.py`
- Mock data for frontend: `frontend/src/lib/mockData.js`
