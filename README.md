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

The Vite dev server (`npm run dev` on port 5173) proxies `/api` to `http://127.0.0.1:8004` — set `uvicorn` to port **8004** in dev if you use that proxy, or change `vite.config.js` to match your API port.

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
