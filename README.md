# Pre-Diligence Platform — Fracture Systems

> Pre-diligence operating intelligence platform that transforms fragmented SMB business data into investor-grade operational readiness scores.

---

## What This Is

The Pre-Diligence Platform helps M&A advisors, CEPA-certified exit planners, and PE-backed acquirers assess the diligence readiness of small-to-mid-size businesses before a formal sale process begins. It ingests raw business data (QuickBooks, CRM, payroll, contracts), normalizes it into a clean ontological model, then runs a battery of financial and operational scoring algorithms to produce a **Diligence Readiness Score (DRS)** and **Enterprise Value estimate** — along with a prioritized roadmap of value creation initiatives.

---

## Architecture

```
Raw Data (QuickBooks / CRM / Payroll / Contracts)
    │
    ▼
[Blueprint I — Ingestion Pipeline]  (backend/ingestion/)
    P1  Source Intake & Triage
    P2  Raw Extraction
    P3  File Validation & Pre-Screening
    P4  Schema Profiling
    P5  Column Classification & Mapping
    P6  Row-Level Extraction & Parsing
    P7  Business Rule Validation
    P8  Normalization & Standardization
    P9  Entity Resolution & Deduplication
    P10 Relationship Mapping
    P11 Ontology Commit & Lineage Tagging
    │
    ▼
[Clean Ontology Store]  (PostgreSQL)
    Entities: Revenue Streams · Customers · Employees · Expenses · Contracts · Owners
    │
    ▼
[Blueprint II — Analytical Engine]  (backend/analytics/)
    A1  Metric Computation          (40+ computed measures)
    A2  EBITDA Recast               (defensible EBITDA + addback schedule)
    A3  Revenue Quality Analysis    (recurring %, HHI, churn, contracts)
    A4  Operational Independence    (key person dependency, SOP coverage)
    A5  Customer Risk Profiling     (concentration, tenure, contract status)
    A6  Management & Team           (depth, comp benchmarks, retention)
    A7  Growth Driver Analysis      (CAGR, pipeline coverage, repeatability)
    A8  Financial Integrity         (auditability, GAAP proximity, recon)
    A9  DRS Composite Score         (0–100, 3 confidence bands)
    A10 Enterprise Value            (DRS-adjusted multiple × Defensible EBITDA)
    A11 Value Gap Analysis          (current EV vs. achievable EV)
    A12 Initiative Roadmap          (18–36mo milestones with EV impact)
    A13 Buyer Question Simulation   (PE diligence question prep)
    A14 Insight Package Assembly    (advisor-ready deliverables)
    │
    ▼
[Pre-Diligence Platform UI]  (frontend/)
    Dark-mode advisory dashboard — React + Vite + Tailwind
```

---

## Repository Structure

```
prediligence-platform/
├── frontend/                   # React + Vite UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/             # Primitives: cards, badges, progress bars
│   │   │   ├── layout/         # Sidebar, header, app shell
│   │   │   └── charts/         # Recharts wrappers
│   │   ├── pages/              # One file per route (17 pages)
│   │   ├── lib/
│   │   │   ├── utils.js
│   │   │   └── mockData.js     # Client-0 demo data
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                    # Python FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/         # REST endpoints
│   │   ├── ingestion/          # Blueprint I: P1–P11
│   │   ├── analytics/          # Blueprint II: A1–A14
│   │   ├── ontology/           # Data models & schema
│   │   ├── services/           # Service orchestration layer
│   │   └── core/               # Config, DB, auth, scoring rules
│   ├── tests/                  # Pytest baseline coverage
│   ├── requirements.txt
│   └── alembic/                # DB migrations
│
├── .github/workflows/          # CI (lint/build/tests)
├── deploy/                     # Example nginx / Caddy TLS + hosting runbooks
├── Dockerfile                  # Multi-stage: frontend build + FastAPI
├── docker-compose.yml          # Postgres + app (prod-like local)
├── fly.toml                    # Fly.io app config
├── render.yaml                 # Render Blueprint (Docker web)
├── railway.toml                # Railway Docker hints
├── PLATFORMIZATION.md          # Phased roadmap: hosting → platform maturity
├── ROADMAP.md
└── README.md
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Lucide Icons, Recharts |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL (ontology store) |
| Auth | JWT (advisor-level, client-level roles) |
| File storage | Local → S3-compatible (phase 2) |
| AI / NLP | Claude API (field mapping suggestions, AI Copilot, buyer Q sim) |

---

## Quick Start (Development)

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in DB credentials
alembic upgrade head
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

The Vite dev server (`npm run dev` on port 5173) proxies `/api` to `http://127.0.0.1:8000` — run `uvicorn` on port **8000** (the default) and the proxy works out of the box.

---

## Happy Path — End-to-End Walkthrough

This is the canonical flow every engineer should be able to run locally before touching any feature work.

### Prerequisites

- PostgreSQL 16 running locally (or via `docker compose up db`)
- Python 3.11+ and Node 18+ installed
- `backend/.env` populated from `backend/.env.example` (at minimum `DATABASE_URL` and `SECRET_KEY`)

### Step 1 — Boot the stack

```bash
# Terminal A — backend
cd backend
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal B — frontend
cd frontend
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies all `/api` requests to port 8000.

### Step 2 — Load the demo company

On first boot, the app auto-seeds **ABC Company Inc** (company `id=1`) — a 13-employee traffic-management field-services business with 3 years of synthetic QuickBooks P&L. If the seed did not run automatically:

```bash
cd backend
python scripts/seed_abc_company.py
```

Expected result: 68 customers, 36 months of revenue streams, COGS + OPEX + OWNER expense rows. See [`docs/DEMO_FIXTURE.md`](docs/DEMO_FIXTURE.md) for full fixture spec.

### Step 3 — Review ingested data (Blueprint I)

1. Navigate to **Data Sources** in the sidebar.
2. The pre-loaded ingestion job (`seed-demo-abc-qb-pl-v1`) should show status `COMPLETE`.
3. Open **Field Mapping** — 8 source columns are pre-mapped with confidence scores; 2 are flagged for review (`Memo / Description`, `Class`).

### Step 4 — Run the analytical engine (Blueprint II)

Hit the analytics endpoint directly or navigate to the **Dashboard**:

```bash
curl http://localhost:8000/api/analytics/drs/1
```

Expected output:
```json
{
  "drs": 72,
  "tier": "INVESTMENT",
  "confidence_band": { "conservative": 70, "base": 72, "optimistic": 74 }
}
```

Full scoring breakdown across 6 categories is available at `/api/analytics/full/1`.

### Step 5 — Review the DRS dashboard

1. **Dashboard** → DRS gauge reads ~72 (Investment Grade), EV range $9.8M–$11.3M.
2. **EBITDA Recast** → Reported NI $1.74M, owner comp addback $82.2K → Defensible EBITDA $1.83M.
3. **Customer Risk** → Top 5 customers = 78.4% of TTM revenue (concentration flag).
4. **Initiative Roadmap** → 3–5 value creation items ranked by EV impact.

### Step 6 — AI Copilot

With `ANTHROPIC_API_KEY` set in `backend/.env`:

```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Authorization: Bearer <dev-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"company_id": 1, "message": "What is driving customer concentration risk?"}'
```

### Step 7 — Generate a report

`POST /api/reports/generate` with `{"company_id": 1, "template_id": "advisor_summary"}` returns a downloadable PDF/DOCX at `/api/reports/<id>/download`.

### Step 8 — Verify tests pass

```bash
cd backend
pytest tests/ -v
```

All 5 test files should pass: company access isolation, demo data integrity, market benchmarks, scoring rules, and settings.

---

## Production deployment

### Environment variables

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | `development` (default) or `production`. In production, `CLERK_JWKS_URL` must be set for Clerk-authenticated API routes; the HS256 dev fallback is disabled. |
| `DATABASE_URL` | Managed PostgreSQL connection string (not localhost in real deployments). |
| `SECRET_KEY` | Strong random secret (`openssl rand -hex 32`). Do not use the example default in production. |
| `CORS_ORIGINS` | Comma-separated allowed browser origins (no trailing slash), e.g. `https://app.example.com`. |
| `FRONTEND_URL` | Public HTTPS URL of the SPA — used for Stripe redirects and similar. Must match `CORS_ORIGINS` for the SPA origin. |
| `ADMIN_API_KEY` | Protects admin/demo HTTP routes when set; callers send `X-Admin-Key`. |
| `DEMO_ACCESS_CODE` | Optional. When set, the generic `/demo` route is gated; visitors use `/request-demo` and exchange this passphrase for a short-lived demo JWT. Empty leaves the generic demo open (typical local dev). Personalized `/demo/:slug` links are unaffected. |
| `CLERK_SECRET_KEY` / `CLERK_JWKS_URL` | Backend Clerk verification; JWKS URL must match your Clerk Frontend API instance. |
| `STRIPE_*` / `STRIPE_WEBHOOK_SECRET` | Billing; register the Stripe webhook endpoint on your **public** API origin (e.g. `https://app.example.com/api/webhooks/stripe`). |

Frontend (build-time `VITE_*`):

| Variable | Purpose |
|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Required for production builds that use sign-in; same Clerk instance as backend JWKS. |
| `VITE_API_BASE_URL` | Optional. Empty for same-origin (SPA and API on one host). Set to `https://api.example.com` (no trailing slash) when the SPA is hosted separately from the API. |

In the **Clerk Dashboard**, add your production domain under allowed origins and redirect URLs (e.g. `https://app.example.com` and `https://app.example.com/*`). In **Stripe Dashboard**, set success/cancel URLs and the webhook endpoint to match `FRONTEND_URL` and your public API base.

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env` locally; inject secrets via your host’s secret store in production.

### Docker (single container, same-origin)

From the repo root that contains `frontend/`, `backend/`, and `Dockerfile`:

```bash
docker build -t prediligence \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_API_BASE_URL= \
  .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/dbname \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e APP_ENV=production \
  -e CORS_ORIGINS=https://app.example.com \
  -e FRONTEND_URL=https://app.example.com \
  -e CLERK_JWKS_URL=https://YOUR_INSTANCE.clerk.accounts.dev/.well-known/jwks.json \
  -e RUN_MIGRATIONS=true \
  prediligence
```

The `--build-arg` values are baked into the static SPA at build time. Omitting them produces a UI without Clerk/API configuration. For split hosting, set `VITE_API_BASE_URL` to your API origin (no trailing slash).

The image runs `uvicorn` on `0.0.0.0:$PORT` (default `8000`) with `--proxy-headers` so `X-Forwarded-*` from nginx/Caddy works. Set `RUN_MIGRATIONS=true` to run `alembic upgrade head` on container start (recommended for first deploys; then consider running migrations as a separate job).

### Local production-like stack

```bash
docker compose up --build
# UI + API: http://localhost:8000
```

### TLS and reverse proxy

Terminate HTTPS at **nginx**, **Caddy**, or a cloud load balancer; forward to the container. Use your public `https://…` URL in `CORS_ORIGINS` and `FRONTEND_URL`.

Example snippets are in `deploy/nginx.example.conf` and `deploy/Caddyfile.example`.

### Hosting (cloud)

| Config | Use case |
|--------|----------|
| **`fly.toml`** | Deploy with [Fly.io](https://fly.io/) (`fly deploy`). |
| **`render.yaml`** | [Render](https://render.com/) Blueprint (Docker web service). |
| **`railway.toml`** | [Railway](https://railway.app/) Docker deploy from repo root. |
| **`frontend/vercel.json`** | Static SPA on [Vercel](https://vercel.com/) when using **split** hosting (set root directory to `frontend` and `VITE_API_BASE_URL`). |

Step-by-step instructions: **`deploy/README.md`**. Roadmap for going from demo to production platform: **`PLATFORMIZATION.md`**.

### Database migrations vs bootstrap

- **Deploy policy:** run `alembic upgrade head` on each release (via `RUN_MIGRATIONS=true` in Docker, or a CI/CD step, or your platform’s release command).
- **Startup bootstrap:** the app still runs `create_all` + small additive `ALTER`s in `lifespan` for empty DBs and legacy columns — prefer Alembic for schema changes going forward; see `backend/alembic/`.

### Operations

- **Health:** `GET /health` — liveness (no DB). `GET /health/ready` — readiness (executes `SELECT 1` on the DB; returns 503 if unavailable).
- **Logging:** use uvicorn/Starlette access logs; add JSON or centralized logging (e.g. CloudWatch, Datadog) at the platform layer.
- **Backups:** rely on managed Postgres automated backups + periodic restore tests.
- **Rate limiting:** not enforced in-app by default; use `limit_req` in nginx (see `deploy/nginx.example.conf`) or your edge/WAF for `/api`.

---

## DRS Scoring Weights

| Category | Weight | Phases |
|---|---|---|
| Revenue Quality | 25% | A3 |
| Financial Integrity | 20% | A8 |
| Operational Independence | 20% | A4 |
| Customer Risk | 15% | A5 |
| Management & Team | 10% | A6 |
| Growth Drivers | 10% | A7 |

**DRS Tiers:** 85–100 Institutional Grade · 70–84 Investment Grade · 55–69 Conditional · 40–54 High Risk · <40 Pre-Diligence Required

---

## Key Outputs

- **DRS 0–100** with Conservative / Base / Optimistic confidence bands
- **Defensible EBITDA** (3 scenarios: conservative, base, aggressive)
- **Enterprise Value range** (current floor/ceiling)
- **Value gap** — dollar delta between current EV and achievable EV
- **Initiative roadmap** — ranked, time-boxed, EV-impact-quantified
- **Buyer question simulation** — PE diligence prep by risk category
- **Advisor report** — exportable PDF/DOCX deliverable

---

*Fracture Systems — Confidential*
