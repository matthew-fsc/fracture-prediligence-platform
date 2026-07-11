# Capability Inventory — Dashboard & Infrastructure Repo

**Repo:** `fracture-prediligence-platform` (branch `claude/exit-blueprint-audit-j6ivz2`, HEAD `39ab5c46`)
**Audit date:** 2026-07-11
**Auditor scope:** read-only inventory. No application code was modified.

Status legend: `WORKING` (functional, tested or verifiable) · `PARTIAL` (functional but incomplete) · `STUB` (scaffolded, no real logic) · `ABSENT`.
Quality legend: `production-leaning` / `prototype` / `throwaway`.

> **Read this first.** This repo is *not* a thin dashboard shell. It is a full FastAPI + React product with its **own** 6-category / DRS scoring engine (`backend/app/analytics/a1…a14`), its own ingestion pipeline (`p2…p11`), Stripe billing, Clerk auth, QuickBooks OAuth, and a Claude-backed copilot. The consolidation premise ("dashboards presumed to be this repo's strength; scoring engine lives in the other repo") is only half right: the dashboards *are* strong, but this repo also carries a competing scoring engine that would have to be **displaced**, not merely fed. See `SURVIVOR_ASSESSMENT.md`.

---

## Infrastructure & Application Shell

| Capability | Status | Location | Quality | Notes |
|---|---|---|---|---|
| Auth & session handling | **WORKING** | `backend/app/middleware/auth.py`, `frontend/src/components/auth/*`, `context/UserRoleContext.jsx` | production-leaning | Clerk. Prod = RS256 via JWKS (in-memory cache, 1h TTL, graceful stale-key fallback). Dev = HS256 with `SECRET_KEY` when `CLERK_JWKS_URL` empty. Token injected client-side by `ClerkAuthBridge` → `apiClient`. Sessions are stateless JWT; no server session store. |
| Role / permission model | **PARTIAL** | `ontology/models.py` (`UserProfile`, `CompanyAccessGrant`, `ClientAccess`), `api/deps.py` | prototype | Three overlapping mechanisms: `UserProfile.role` (ADVISOR/CLIENT), `CompanyAccessGrant.role` (owner/associate/client), legacy `ClientAccess` (ACCEPTED). Maps *loosely* to firm-admin/advisor/client but **firm-admin is not a real role** — `AdvisorFirm.owner_user_id` is billing-only. "Associate" ≈ firm colleague; "client" ≈ read-only owner. Precedence resolved in `ensure_company_access`. |
| Multi-tenancy / isolation | **PARTIAL** | `api/deps.py` `get_company_scope` / `get_company_write_scope` | prototype | **App-layer only. No Postgres RLS, no Supabase.** Tenant boundary = `Company.owner_user_id` (Clerk sub). Every route must declare `Depends(get_company_scope)`; enforcement is by convention, not by the database. Unowned companies (`owner_user_id IS NULL`) are world-readable by design (demo). A missing dependency on any new route silently leaks cross-tenant data. |
| API surface | **WORKING** | `backend/app/api/routes/*` (21 routers) | production-leaning | ~110 endpoints. Full list below. All JSON via FastAPI/Pydantic; SPA served same-origin as static files with an `/api/*` trailing-slash redirect shim. |
| Environment / config | **WORKING** | `core/config.py` (pydantic-settings), `.env` | production-leaning | ~90 typed settings. Fail-fast production validation in `main.py` (`_validate_production_config`) rejects default `SECRET_KEY`, unsigned Stripe webhooks, missing Clerk/Stripe/Anthropic creds. Self-heals unevaluated Railway `${{…}}` secret refs by generating a runtime key. |
| Secrets management | **PARTIAL** | `core/config.py`, deploy manifests | prototype | Env-var based. No vault/KMS. QuickBooks OAuth tokens stored **plaintext** in `qb_tokens.access_token/refresh_token` (Text columns, unencrypted). |
| Error handling & logging | **PARTIAL** | throughout; `main.py` request-ID middleware | prototype | Per-request `X-Request-ID` for correlation (`OBS-2`). Otherwise stdlib `logging` with broad `try/except … logger.exception` swallowing (esp. in bootstrap, webhooks, snapshot writes). No structured logging, no Sentry/APM, no error taxonomy. `HTTPException(detail=…)` is the frontend-facing error contract (parsed by `apiClient`). |

### Full API surface (routers → endpoints)

- **ingestion** (`/api/ingestion`): `POST /upload/{company_id}` (store + background P3–P11), `GET /jobs/{company_id}`, `GET /jobs/{company_id}/{job_id}`, `PATCH /jobs/{company_id}/{job_id}/mappings`, `POST …/retry`, `DELETE …/{job_id}`.
- **analytics** (`/api/analytics`): 40+ endpoints — metrics, company-financial CRUD + logo, market-benchmarks, `GET /scores/{id}` (+ history, snapshot), per-category scores (revenue-quality, operational-independence, customer-risk, management-team, growth-drivers, financial-integrity), value-gap, advisory-workflow, library-triggered, buyer-questions (list/patch/generate-draft), initiatives CRUD, ebitda-recast, `POST /drs/{id}`, overrides CRUD, addbacks CRUD, qualitative (get/post/audit), timeline snapshots CRUD, engagement-profile (get/patch), buyer-universe. **This is the analytics monolith — 95 KB, 2000+ lines.**
- **companies** (`/api/companies`): `GET /`, `POST /`, `GET /{id}`, `PATCH /{id}`.
- **reports** (`/api/reports`): `GET /{id}/history`, `GET /{id}/generate/{report_type}` (PDF download).
- **library** (`/api/library`): item CRUD + `/meta`.
- **demo** (`/api`): demo data/access-status/verify-code, spots-remaining, create-link, slug fetch/track/mark-converted, admin demo-lock/demos.
- **payments** (`/api`): `POST /create-checkout`, `POST /add-engagement`, `GET /billing/me`, `GET /user/subscription`.
- **webhooks** (`/api`): `POST /webhooks/stripe`.
- **copilot** (`/api/copilot`): `POST /chat/{company_id}`.
- **user_profiles** (`/api`): `GET/POST /me`, invite-client, resend, list invites, accept-invite/{token}, delete invite.
- **client_portal** (`/api/portal`): invite, revoke, `GET /{id}/summary`.
- **referrals** (`/api/referrals`): my-code, stats, click.
- **firms** (`/api/firms`): create, `GET /me`, invite-member, remove member.
- **partners** (`/api/partners`): partner-by-slug, admin partner CRUD + stats.
- **admin_metrics** (`/api/admin`): `GET /unit-economics`.
- **quickbooks** (`/api/qb`): authorize, callback, refresh, status, disconnect, fetch.
- **engagement** (`/api/engagement`): plan get/patch, initiatives CRUD, populate-from-value-gap, mark-complete (+ re-score). **⚠ `…/complete` has a runtime bug — see Contradictions.**
- **owner_onboarding** (`/api`): get, patch company, complete.
- **insights** (`/api/insights`): `POST /{company_id}` (Claude narrative generation).
- **deal_outcomes** (`/api/deal-outcomes`): get/create/patch per company, `GET /aggregate/summary`.
- **health**: `GET /health` (liveness), `GET /health/ready` (DB check).

---

## Dashboard & Presentation Layer

| Capability | Status | Location | Quality | Notes |
|---|---|---|---|---|
| Pages / views | **WORKING** | `frontend/src/pages/` (55 files) | prototype→production-leaning | 30+ advisor pages (Readiness, Valuation, ValueGap, BuyerLens, RiskHeatmap, ScenarioSimulator, EBITDATimeline, MarketComps, InitiativeImpact, EngagementView, DealOutcome, AICopilot…), 6 client-portal pages, demo pages (reuse advisor components), marketing pages (Landing, Pricing, ROI, Partner), auth, owner-onboarding wizard. Advisor + demo routes share the same page components (demo just skips auth + preloads company 1). |
| Component library / design system | **PARTIAL** | `frontend/src/components/ui/` (8 primitives), `layout/` (10 shells) | prototype | Reusable primitives exist: `KpiCard`, `ProgressBar`, `StatusBadge`, `ConfidenceRange`, `PageHeader`, `SectionHeader`, `Skeleton`, `SectionDivider`. Below that line, pages are largely **one-off** compositions. Tailwind utility classes inline everywhere; no tokenized theme contract beyond `theme/marketingColors.js` + `lib/drsCategoryColors.js`. Three separate shells (AppShell / ClientShell / DemoShell) with parallel sidebars. |
| Charting / visualization | **WORKING** | Recharts across 9 page files | prototype | Recharts 2.12. Working chart types: BarChart (24 uses), LineChart (11), ComposedChart (10), AreaChart (8), RadarChart (6), plus Pie. Good coverage for DRS radar, EBITDA timeline, value-gap bridge, benchmarks. Not abstracted into reusable chart components — chart config is inline per page. |
| State management & data fetching | **WORKING** | `@tanstack/react-query` v5, `context/CompanyContext.jsx`, `lib/apiClient.js` | production-leaning | React Query for all server state (`staleTime`, `retry` set per query). `CompanyContext` holds active `companyId` (URL `?company=` ↔ localStorage). `apiClient` wraps fetch, injects Clerk JWT, parses FastAPI `detail` errors into typed `ApiError`. Clean, consistent contract. |
| Report / document generation | **WORKING** | `analytics/a14_report_generator.py`, `routes/reports.py` | prototype | Server-side **PDF via fpdf2** (`FPDF`). 5 report types: `drs_summary`, `value_gap`, `buyer_prep`, `ebitda_recast`, `company_profile`. Hand-drawn layout (KPI boxes, score bars, tables). Latin-1 only (`_safe()` transliterates smart quotes/em-dashes). No HTML/delta report. **This is the closest existing asset to the branded WM delta report** — but there is no delta/diff report and no multi-version comparison in any builder. |
| Theming / white-labeling | **PARTIAL** | `Company.report_firm_name` / `report_logo_url`, `services/company_logo_storage.py`, report header | prototype | Branding is injectable **per company**, not per firm/advisor: report header pulls `report_firm_name` + resolves a per-company logo (local FS or URL). Falls back to hardcoded "FRACTURE SYSTEMS" / "Exit Blueprint". **No firm- or advisor-level brand entity** — a wealth manager with 20 clients would set the logo 20 times. Frontend UI is single-brand (no per-tenant theming). |

---

## Data Model & Persistence

| Capability | Status | Location | Quality | Notes |
|---|---|---|---|---|
| Schema (full) | **WORKING** | `ontology/models.py`, `ontology/ingestion_models.py` | production-leaning | 38 tables. Full dump in `SCHEMA.md`. |
| Clients / engagements / assessments / scores modeling | **PARTIAL** | `Company`, `EngagementPlan`, `EngagementProfile`, `EngagementSnapshot`, `ScoreSnapshot`, `QualitativeInputs`, `DealOutcome` | prototype | **The `Company` row *is* the client *is* the engagement.** There is no separate client, engagement, or assessment-version entity. "Engagement" objects (`EngagementPlan`, `EngagementProfile`) are 1:1 satellites of a company. Scores are **computed on read**, not stored as versioned assessments. Point-in-time history exists (`ScoreSnapshot`, `EngagementSnapshot`) but is a trend log, not an immutable version chain. See `SCHEMA.md` commentary + `ARCHITECTURE_DECISIONS.md`. |
| Event / activity logging | **PARTIAL** | `QualitativeInputAudit`, `ScoreSnapshot`, `EngagementSnapshot`, `GeneratedReport`, `AdvisorOverride` | prototype | Fragments of append-only history exist per concern, but **no unified engagement activity log**. Nothing records "advisor sent report", "client viewed", "task completed" as timeline events. `demo_links` tracks visits for demo only. |
| Migrations tooling & state | **WORKING** | `backend/alembic/`, `env.py`, 23 files `0001…0022` | production-leaning | Alembic, linear chain (the two `0011_*` files are correctly chained `0011 → 0011_attr → 0012`). Head = `0022`. `target_metadata = Base.metadata`. Migrations use `if_not_exists=True` (idempotent). Migration `0015_missing_tables` (12 tables) and `0009_former_runtime_bootstrap` reveal past schema drift where `create_all()` was the de-facto authority before Alembic caught up (now resolved per `KI-005`). |
| Seed data / demo content | **WORKING** | `scripts/seed_abc_company.py`, `services/demo_company_seed.py`, `generate_sandbox_data.py`, `ingest_sandbox_data.py`, `app/data/*.json` | prototype | Company id=1 "ABC Company Inc" seeded on startup + curated market-benchmark and buyer-universe JSON seeded if tables empty. Advisory library auto-seeds. `frontend/src/lib/mockData.js` (260 lines) for pure-frontend dev. |

---

## Orchestration & Integration

| Capability | Status | Location | Quality | Notes |
|---|---|---|---|---|
| n8n integration | **ABSENT** | — | — | **No n8n anywhere** (no webhooks, triggers, callable workflows, or references). Zero grep hits across the repo. Target stack names n8n; this repo has none of it. |
| Notification / email | **PARTIAL** | `core/email.py` | prototype | SendGrid **optional** (`SENDGRID_API_KEY`); if unset, invite URLs are logged for manual sharing. Used only for client-invite emails. No transactional templates beyond invite, no digest, no cadence prompts. |
| Scheduled jobs / cron | **ABSENT** | — | — | No cron, Celery, APScheduler, or queue. The only background work is FastAPI `BackgroundTasks` (ingestion P3–P11) and a one-shot lifespan bootstrap thread. Nothing runs on a schedule. |
| Claude API integration | **WORKING** | `core/ai_client.py`, `routes/copilot.py`, `routes/insights.py`, `analytics/a13_buyer_questions.py`, `ingestion/p5_column_mapping.py` | production-leaning | Centralized `call_claude()` with retry/backoff, prompt-cache helpers (`make_cached_system`/`make_hybrid_system`), input guardrails (injection/off-topic/length), per-model cost estimation, token-budget enforcement per tier (`AICopilotUsage` with `with_for_update` locking). **Server-side only.** Model default `claude-sonnet-4-6`; Haiku for column-mapping. Well-built. |
| External APIs | **PARTIAL** | `integrations/quickbooks/`, Stripe, PostHog, PitchBook (config only) | prototype | **QuickBooks OAuth2** (auth/extractor/normalizer) — 3-legged flow, token refresh, normalizes QB objects → CSV → existing pipeline. CSRF state is **in-process dict** (breaks on multi-worker/restart). **Stripe** billing + webhooks (working). **PostHog** analytics events. **PitchBook** referenced in config + market-benchmark cache but no live client wired. |

---

## Operational

| Capability | Status | Location | Quality | Notes |
|---|---|---|---|---|
| Test coverage | **PARTIAL** | `backend/tests/` (11 files), `conftest.py` | prototype | **140 tests pass** (actual — see below). But tests run against **stubbed/mock DBs**, not a live Postgres. `conftest.py` stubs absent heavy deps so CI can run "minimal". Coverage is skewed to pure logic (scoring, webhooks, ingestion helpers). No integration tests hitting real DB, no frontend tests at all. |
| CI | **WORKING** | `.github/workflows/ci.yml` | production-leaning | On push + PR: backend `pytest -q`; frontend `npm ci && npm run build`. No lint gate in CI, no coverage gate, no deploy on merge. |
| Deployment config | **WORKING** | `Dockerfile`, `docker-compose.yml`, `railway.toml`, `render.yaml`, `fly.toml`, `deploy/`, `.github/workflows/deploy-fly.yml` | production-leaning | Multi-stage Docker (Vite build → FastAPI serves static). Railway primary; Render/Fly alt. Health/readiness endpoints wired for platform probes. `RUN_MIGRATIONS` env for auto-migrate. Manual Fly deploy workflow. |

### Actual test run output

```
$ PYTHONPATH=. python3 -m pytest -q
........................................................................ [ 51%]
....................................................................     [100%]
140 passed, 2 warnings in 1.14s
```

Per-file: `test_webhook_handler` 27 · `test_advisory_inputs` 22 · `test_engagement_plans` 20 · `test_analytics_engine` 18 · `test_ingestion_pipeline` 14 · `test_quickbooks_integration` 14 · `test_demo_data_integrity` 13 · `test_market_benchmarks` 5 · `test_company_access` 3 · `test_scoring_rules` 3 · `test_settings` 1.

**Environment caveat (not a repo defect):** the sandbox's Debian-packaged `cryptography` 41 crashed on import (`pyo3_runtime.PanicException`) during conftest; `pip install --upgrade cryptography` resolved it, after which all 140 passed. Frontend `npm run build` initially failed on a missing `@rollup/rollup-linux-x64-gnu` native binary (npm optional-deps quirk); installing it produced a clean build (`2511 modules, built in 8.16s`, **single 1.72 MB JS chunk — no code-splitting**).

---

## Contradictions between code and documentation (code trusted)

1. **`engagement.py` DRS bug (runtime error).** `POST /api/engagement/initiatives/{company_id}/{initiative_id}/complete` reads `drs_result.base`, `.conservative`, `.optimistic` (`engagement.py:365-367`), but `DRSResult` (`a9_drs_composite.py:68-73`) defines `base_drs`/`conservative_drs`/`optimistic_drs`. This raises `AttributeError` → 500 on the re-score path. `reports.py` uses the correct `.base_drs`. **Noted, not fixed (out of scope).**
2. **`CLAUDE.md` says "next migration is 0016" / "versions 0001–0015".** Actual head is `0022`. Doc is stale.
3. **`CLAUDE.md` says "No shared conftest.py — each test file sets up its own mocks".** A shared `tests/conftest.py` (268 lines of dep stubs) now exists and is central to CI. Contradiction.
4. **Brand drift.** FastAPI title is `"Pre-Diligence Platform API"`, description `"Fracture Systems — Blueprint I & II"`; report footer says `"Exit Blueprint Advisory"`; report brand fallback `"FRACTURE SYSTEMS"`; git HEAD is an "Exit Blueprint rebrand". The product name is unsettled across layers.
5. **`get_company_scope` is convention, not enforcement.** `CLAUDE.md` states "Never bypass this dependency" — but nothing in the DB or framework prevents it; correctness depends entirely on every author remembering. This is an architectural risk, not a doc error.

## Out-of-scope items noted (not acted on)

- `analytics.py` is a 95 KB / 2000-line monolith mixing 40+ endpoints, scoring orchestration, and PDF payload building — a refactor candidate.
- QuickBooks OAuth tokens stored unencrypted.
- QB OAuth CSRF `_OAUTH_STATE` is an in-process dict (won't survive multi-worker / restart).
- Frontend ships one 1.72 MB bundle (no lazy routes).
- No linting gate in CI.
</content>
</invoke>
