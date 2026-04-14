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
| Frontend | React 18, Vite 5, Tailwind CSS 3.4, Recharts 2.12, TanStack React Query 5, Clerk (auth), Framer Motion, Sonner (toasts) |
| Backend | Python 3.12, FastAPI 0.115+, SQLAlchemy 2.0+, Alembic |
| Database | PostgreSQL 16 |
| Auth | Clerk (JWKS in prod, HS256 fallback in dev) |
| AI | Anthropic Claude API (field mapping, copilot, buyer Q simulation) |
| Payments | Stripe |
| Analytics | PostHog |
| Deployment | Docker (multi-stage), Fly.io / Render / Railway configs |

---

## Quick Start

```bash
# 1. Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL + SECRET_KEY at minimum
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend && npm install && npm run dev   # → http://localhost:5173
```

Dev auth uses HS256 — just set any `SECRET_KEY` in `.env`. Leave `CLERK_JWKS_URL` empty to stay in dev mode.

---

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
VITE_API_BASE_URL=          # Empty = same-origin proxy; set to https://api.example.com for split-origin
VITE_POSTHOG_KEY=ph_...
```

> `VITE_*` vars are **baked into the frontend bundle at build time** — they are not available at runtime. If you change them, rebuild the frontend.

---

## Architecture

### Two Core Blueprints

**Blueprint I — Ingestion Pipeline** (`backend/app/ingestion/`): Steps P2–P11

```
run_pipeline()   ← entry point (pipeline.py)
  p2_raw_storage       → immutable file + SHA-256
  p3_file_validation   → structural/content checks
  p4_schema_profiling  → column profile generation
  p5_column_mapping    → ontology field assignment (Claude-assisted)
  p6_row_extraction    → multi-format row parsing
  p7_business_rules    → domain validation
  p8_normalization     → canonical format conversion
  p9_entity_resolution → deduplication
  p10_relationship_mapping → revenue/contract-to-customer linking
  p11_ontology_commit  → DB write with full audit lineage
```

Always trigger via `run_pipeline()` — never call individual phases directly. Pipeline phase statuses: `RUNNING → SUCCESS | FAILED | QUARANTINED | PENDING_REVIEW`.

**Blueprint II — Analytical Engine** (`backend/app/analytics/`): Steps A1–A14

```
a1_metric_computation    → base financial metrics
a2_ebitda_recast         → EBITDA addback logic
a3_revenue_quality       → revenue stream analysis
a4_operational_independence
a5_customer_risk         → concentration analysis
a6_management_team
a7_growth_drivers
a8_financial_integrity
a9_drs_composite         → DRS tier (0–100)
a10_enterprise_value     → EV estimation
a11_value_gap
a13_buyer_questions      → buyer Q&A simulation (Claude)
a14_report_generator     → PDF assembly
```

Call individual modules or orchestrate via `analytics_service.compute_category_modules()`. Every module returns a dataclass with a `.composite` score (0–100) and a `.details` dict.

### Multi-Tenancy

Every database query is scoped via `Depends(get_company_scope)` in `backend/app/api/deps.py`. **Never bypass this dependency.**

Access tiers (enforced in order):
1. **Unowned / demo companies** — always readable, no auth required
2. **Owner** — `user_id == Company.owner_user_id` → full read + write
3. **CompanyAccessGrant `owner|associate`** — firm colleague, read + write
4. **CompanyAccessGrant `client`** — read-only (client portal)
5. **ClientAccess `ACCEPTED`** — legacy client portal, read-only

```python
# Read-only route
CompanyScoped = Annotated[Company, Depends(get_company_scope)]

# Write route — raises 403 for client-role users automatically
CompanyWriteScoped = Annotated[Company, Depends(get_company_write_scope)]
```

To check write access inside a hybrid route:
```python
from app.api.deps import _assert_write_access
_assert_write_access(company)  # raises 403 if role == "client"
```

### Authentication

- **Dev**: HS256 JWT with `SECRET_KEY` (set `CLERK_JWKS_URL=` empty)
- **Prod**: Clerk RS256 JWKS via `backend/app/middleware/auth.py`; JWKS keys cached in-memory with 1-hour TTL

```python
from app.middleware.auth import get_current_user, get_current_user_optional

@router.get("/protected")
def endpoint(user = Depends(get_current_user)):      # required auth
    ...

@router.get("/public")
def endpoint(user = Depends(get_current_user_optional)):  # optional auth
    ...
```

---

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
│   ├── api/routes/        # FastAPI routers (one file per domain — 16 files)
│   ├── api/deps.py        # get_company_scope, get_company_write_scope
│   ├── ingestion/         # Blueprint I: p2_raw_storage.py → p11_ontology_commit.py
│   ├── analytics/         # Blueprint II: a1_metric_computation.py → a14_report_generator.py
│   ├── ontology/          # SQLAlchemy models (models.py, ingestion_models.py)
│   ├── services/          # Business logic orchestration
│   ├── core/              # config.py, database.py, scoring_rules.py, file_storage.py
│   └── middleware/auth.py # Clerk JWT verification
├── backend/alembic/       # Database migrations (versions 0001–0010)
├── backend/scripts/       # seed_abc_company.py, generate_sandbox_data.py, etc.
└── backend/tests/         # Pytest test suite
```

**Frontend path alias:** `@/` maps to `frontend/src/` (configured in `vite.config.js`). Use `import Foo from '@/components/Foo'` instead of relative paths.

---

## Important Patterns

### Adding a New Backend Route

1. Create `backend/app/api/routes/<domain>.py` with a `router = APIRouter()`.
2. Register it in `backend/app/main.py`:
   ```python
   from app.api.routes import <domain>
   app.include_router(<domain>.router, prefix="/api/<domain>", tags=["<domain>"])
   ```
3. Always use `Depends(get_company_scope)` or `Depends(get_company_write_scope)` — never query `Company` without it.
4. Use Pydantic models for all request/response validation.
5. Raise `HTTPException(status_code=..., detail="...")` for API errors — the frontend's `apiClient` parses the `detail` field automatically.

### Database Schema Changes

Always generate migrations — **never** call `Base.metadata.create_all()` in production code:

```bash
cd backend
alembic revision --autogenerate -m "add foo column to companies"
alembic upgrade head
```

Add audit columns to all new ontology records: `created_at`, `updated_at`, `ingestion_id`, `source_file`, `confidence_level`.

### Frontend API Calls

Use `lib/apiClient.js` — it injects the Clerk JWT automatically and parses FastAPI error responses:

```javascript
import { apiClient } from '@/lib/apiClient'

// GET
const data = await apiClient.get('/api/companies/123')

// POST / PATCH
const result = await apiClient.post('/api/companies/123/reports', { ... })

// File upload
const uploaded = await apiClient.postMultipart('/api/ingestion/upload/123', formData)

// Download binary
const blob = await apiClient.getBlob('/api/reports/123/pdf')
```

Handle errors with the `ApiError` class:
```javascript
import { ApiError } from '@/lib/apiClient'
try {
  await apiClient.post(...)
} catch (e) {
  if (e instanceof ApiError) toast.error(e.message)
}
```

### Server State (React Query)

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const { data, isLoading } = useQuery({
  queryKey: ['company', companyId],
  queryFn: () => apiClient.get(`/api/companies/${companyId}`),
  staleTime: 30_000,
  retry: 1,
})
```

### DRS Scoring Weights

All weights live in `backend/app/core/scoring_rules.py` (`SCORING_RULES_VERSION`). Change them there — never hardcode weights in analytics modules.

### Claude API Usage

The platform uses Claude for:
1. Column mapping suggestions during ingestion (`backend/app/ingestion/p5_column_mapping.py`)
2. AI Copilot chat over company data (`backend/app/api/routes/copilot.py`)
3. Buyer Q&A simulation (`backend/app/analytics/a13_buyer_questions.py`)

Use `claude-sonnet-4-6` or newer for all Claude API calls. Always include prompt caching headers for large context payloads.

### File Storage

Local FS by default; S3-compatible in production. Access via `backend/app/core/file_storage.py` — never write to disk paths directly.

```python
from app.core.file_storage import get_file_storage
storage = get_file_storage()
await storage.write(path, content)
url = await storage.read_url(path)
```

Set `USE_S3_STORAGE=true` and provide S3 env vars for cloud deployments.

---

## Testing

```bash
cd backend
pytest tests/ -v
```

Key test files:
- `tests/test_company_access.py` — Multi-tenancy/auth isolation
- `tests/test_scoring_rules.py` — DRS scoring logic
- `tests/test_demo_data_integrity.py` — Demo dataset consistency
- `tests/test_market_benchmarks.py` — Market comp data
- `tests/test_settings.py` — Config parsing

**No shared conftest.py** — each test file sets up its own mocks. Minimal DB mock pattern used throughout:

```python
class _MockQuery:
    def __init__(self, row): self._row = row
    def filter(self, *a, **k): return self
    def first(self): return self._row

class _MockDB:
    def __init__(self, company): self._company = company
    def query(self, _model): return _MockQuery(self._company)
```

Use this pattern for testing access control logic without a real database.

---

## Common Gotchas

| ID | Area | Issue | Workaround |
|----|------|-------|------------|
| KI-005 | DB | `Base.metadata.create_all()` called in lifespan alongside Alembic | `alembic check` may show false drift; use Alembic exclusively for schema changes |
| KI-007 | AI | Anthropic API calls in copilot/buyer-Q have no timeout or fallback | Add `timeout=` to Claude client; wrap with try/except |
| KI-008 | Demo | Demo seed idempotency checks only revenue count, not job ID | Partial ingests can block ABC fixture; reseed with `seed_abc_company.py` |
| KI-006 | Security | No application-layer rate limiting | Nginx/load balancer must provide this before traffic hits the app |

**Other patterns to watch:**
- The demo company (id=1) is **read-only** when `DEMO_BLOCK_INGESTION_UPLOAD_FOR_COMPANY_1=true` — writes will be silently rejected unless you override this.
- `VITE_*` env vars are baked at build time. Changing them requires a frontend rebuild.
- The SPA fallback route in `main.py` must stay **last** — any route registered after it will be unreachable.
- JWKS keys use an in-memory cache. In multi-worker deployments each worker has its own cache; JWKS rotations take up to `AUTH_JWKS_TTL_SECONDS` (default 3600s) to propagate per worker.

---

## Running Locally with Docker

```bash
docker compose up --build
# App served at http://localhost:8000
```

---

## Deployment

### Pre-flight Checklist (Production)

- [ ] `APP_ENV=production`
- [ ] `CLERK_JWKS_URL` set (disables HS256 dev fallback)
- [ ] `SECRET_KEY` is not the default placeholder
- [ ] `STRIPE_WEBHOOK_SECRET` set and `ALLOW_UNSIGNED_STRIPE_WEBHOOKS` not set to `true`
- [ ] `RUN_MIGRATIONS=true` for auto-migration on container start
- [ ] `GET /health/ready` returns 200 before routing traffic

### Same-origin (recommended)

Single Docker image: Vite build output served as static files by FastAPI at port 8000.

```bash
docker build -t fracture-platform .
docker run -p 8000:8000 --env-file backend/.env fracture-platform
```

### Split-origin

- Frontend → Vercel (`VITE_API_BASE_URL=https://api.yourapp.com`)
- Backend → Fly.io / Render / Railway (`CORS_ORIGINS=https://yourapp.vercel.app`)

### Health Checks

- `GET /health` — Liveness (no DB, instant)
- `GET /health/ready` — Readiness (checks `SELECT 1`, returns 503 if DB unreachable)

---

## Demo Mode

A seeded demo company (Client-0 / ABC Company) is available without real data ingestion:

```bash
python backend/scripts/seed_abc_company.py   # manual seed
python backend/scripts/generate_sandbox_data.py && \
python backend/scripts/ingest_sandbox_data.py  # generate + ingest synthetic data
```

- Demo login endpoints: `backend/app/api/routes/demo.py`
- Mock data for frontend development: `frontend/src/lib/mockData.js`
- Set `SEED_COMPANY_1_OWNER_USER_ID` to your Clerk `sub` to own the demo company in dev
