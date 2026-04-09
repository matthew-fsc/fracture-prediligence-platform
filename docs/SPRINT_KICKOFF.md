# Sprint Kickoff — Scope Document

**Platform:** Fracture Pre-Diligence Platform
**Prepared:** 2026-04-09
**Audience:** External contributors onboarding to the codebase

---

## Purpose of this document

This is the written record of the sprint kickoff scope. Walk through it explicitly with any incoming engineer before they write a line of code. It covers: what we are building, what is already built, what is in scope for this sprint, and how to orient in the codebase.

---

## What this platform does (30-second version)

An M&A advisor uploads a client company's QuickBooks export, CRM data, or payroll CSV. The platform:
1. Ingests and normalizes the data into a clean relational ontology (Blueprint I, P1–P11).
2. Runs 14 analytical modules to produce a **Diligence Readiness Score (DRS 0–100)**, a **Defensible EBITDA**, an **Enterprise Value range**, and a ranked **value creation roadmap** (Blueprint II, A1–A14).
3. Delivers an advisor-ready report and client portal with AI-assisted PE diligence prep.

The canonical demo company is **ABC Company Inc** — a 13-employee traffic management business with $4.2M TTM revenue and a DRS of 72. All local development should verify against this fixture. See [`docs/DEMO_FIXTURE.md`](DEMO_FIXTURE.md).

---

## What is already built and stable

| Area | Status | Notes |
|------|--------|-------|
| Blueprint I ingestion pipeline (P1–P11) | Stable | Column mapping (P5) uses Claude API |
| Blueprint II analytical engine (A1–A14) | Stable | All 6 DRS categories computing |
| EBITDA recast + addback schedule | Stable | Advisor override layer in place |
| Enterprise Value calculation | Stable | DRS-adjusted multiples from `scoring_rules.py` |
| Value gap analysis | Stable | |
| Initiative roadmap (A12) | Stable | System-generated items only |
| Buyer Q simulation (A13) | Stable | Uses Claude API |
| AI Copilot chat | Stable | Per-user monthly token budget enforced |
| DRS dashboard + confidence bands | Stable | |
| Advisor report generation (A14) | Stable | PDF/DOCX via `/api/reports/generate` |
| Multi-tenancy isolation | Stable | All routes use `get_company_scope` |
| Clerk auth (dev HS256 + prod JWKS) | Stable | |
| Stripe billing + subscription tiers | Stable | founding · pro · team |
| Demo company seed (ABC Company Inc) | Stable | `python scripts/seed_abc_company.py` |
| Client portal | Stable | Read-only company view for business owners |
| Advisory library | Stable | Global catalog of buyer Qs, initiatives, risk flags |
| Market benchmarks (IBBA-curated) | Stable | `MarketBenchmarkRelease` / `MarketSegmentMetric` |
| Engagement timeline snapshots | Stable | DRS + EV checkpoints |
| Engagement profile intake | Stable | Owner goals, exit horizon, buyer prefs |

---

## Architecture boundaries

```
frontend/src/                  React 18 + Vite + Tailwind
  pages/                       One file per route (~30 pages)
  hooks/                       React Query wrappers
  lib/apiClient.js              Injects Clerk JWT on every request

backend/app/
  api/routes/                  FastAPI routers (one file per domain)
  ingestion/                   Blueprint I: p2_raw_storage → p11_ontology_commit
  analytics/                   Blueprint II: a1_metric_computation → a14_report_generator
  ontology/models.py            All SQLAlchemy models (see docs/DATA_MODEL.md)
  services/                    Orchestration (demo_company_seed, etc.)
  core/                        config, database, scoring_rules, confidence
  middleware/auth.py            Clerk JWT verification

backend/alembic/versions/      11 migrations; add new ones with alembic revision
backend/tests/                 5 pytest files; must all pass before merging
```

See [`docs/DATA_MODEL.md`](DATA_MODEL.md) for the full ontology reference.

---

## Known issues going into this sprint

All items are documented in [`KNOWN_ISSUES.md`](../KNOWN_ISSUES.md). The most important ones for new contributors:

| ID | Summary | Impact |
|----|---------|--------|
| KI-001 | Duplicate `0010_` migration prefix | Cosmetic; migrations still apply in correct order |
| KI-005 | `create_all` runs alongside Alembic on startup | Can mask schema drift |
| KI-006 | No application-layer rate limiting | Ingestion and Copilot endpoints are unthrottled |
| KI-007 | No graceful fallback if Anthropic API is down | Copilot and buyer-Q routes return 500 |
| KI-008 | Demo seed idempotency uses revenue count only | Partial manual ingests can block re-seed |

---

## How to get a working local environment

Refer to the **Quick Start** section in [`README.md`](../README.md) and the **Happy Path** walkthrough immediately below it.

Short version:
```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Fill in DATABASE_URL and SECRET_KEY at minimum
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Seed demo data
cd backend && python scripts/seed_abc_company.py

# Verify
curl http://localhost:8000/api/analytics/drs/1
# Expected: {"drs": 72, "tier": "INVESTMENT", ...}
```

---

## Branching and contribution workflow

Documented in [`CONTRIBUTING.md`](../CONTRIBUTING.md). Summary:

- Branch from `main`: `feature/<short-description>` or `fix/<short-description>`
- All PRs target `main`
- Tests must pass (`pytest tests/ -v`) and frontend must lint clean (`npm run lint`) before merge
- Migrations: `alembic revision --autogenerate -m "description"` — never `create_all` in production code
- One PR per logical change; keep diffs reviewable

---

## Scoring rules reference

DRS category weights (in `backend/app/core/scoring_rules.py`):

| Category | Weight |
|----------|--------|
| Revenue Quality | 25% |
| Financial Integrity | 20% |
| Operational Independence | 20% |
| Customer Risk | 15% |
| Management & Team | 10% |
| Growth Drivers | 10% |

DRS tiers: 85–100 Institutional · 70–84 Investment · 55–69 Conditional · 40–54 High Risk · <40 Pre-Diligence.

EV multiples by tier: Institutional 7–9× · Investment 5–7× · Conditional 3.5–5× · High Risk 2.5–3.5×.

---

## Key API contracts (quick reference)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/analytics/drs/{company_id}` | DRS composite + tier + confidence bands |
| `GET /api/analytics/full/{company_id}` | All 6 category scores + sub-scores |
| `GET /api/analytics/ebitda/{company_id}` | EBITDA recast with addback schedule |
| `GET /api/analytics/ev/{company_id}` | Enterprise value range |
| `POST /api/ingestion/upload` | Upload CSV/Excel for a company |
| `GET /api/ingestion/status/{ingestion_id}` | Pipeline phase status |
| `GET /api/companies` | List companies for current user |
| `POST /api/copilot/chat` | AI Copilot message |
| `POST /api/reports/generate` | Generate advisor report |
| `GET /health` | Liveness |
| `GET /health/ready` | Readiness (DB check) |

Full OpenAPI spec: `http://localhost:8000/docs` (Swagger UI) or `http://localhost:8000/redoc`.

---

## Third-party service dependencies

| Service | Required for | Local dev without it |
|---------|-------------|----------------------|
| PostgreSQL 16 | Everything | Docker: `docker compose up db` |
| Clerk | Auth in production | Dev uses HS256 fallback (no Clerk needed) |
| Anthropic Claude API | AI Copilot, buyer-Q sim, column mapping | Those routes return 500; rest of app works |
| Stripe | Billing / subscriptions | Billing routes disabled; rest of app works |
| PostHog | Analytics events | Events silently dropped; no impact |

---

## What a successful sprint looks like

Before marking a sprint complete, the following must all be true:

- [ ] `pytest tests/ -v` — all tests pass
- [ ] `npm run lint` in `frontend/` — no errors
- [ ] `alembic check` — no unapplied model changes
- [ ] `curl http://localhost:8000/api/analytics/drs/1` returns DRS=72 on a clean seed
- [ ] No new secrets committed to `.env` files or source code
- [ ] All new routes use `Depends(get_company_scope)`
- [ ] New DB columns have a corresponding Alembic migration
- [ ] PR description references the relevant known issue (if fixing one)
