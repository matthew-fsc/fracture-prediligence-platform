# Exit Blueprint — Capability Audit (Dashboard & Infrastructure Repo)

> **Session S0.5-B** · Repo `fracture-prediligence-platform` · branch `claude/exit-blueprint-audit-j6ivz2` · HEAD `39ab5c46` · audit date 2026-07-11.
> Read-only consolidation audit. **No application code was modified.** This single document combines all four audit deliverables.

## Contents
1. [Capability Inventory](#part-1--capability-inventory)
2. [Schema](#part-2--schema)
3. [Architecture Decisions](#part-3--architecture-decisions)
4. [Survivor Assessment](#part-4--survivor-assessment)

---

# Part 1 — Capability Inventory


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


---

# Part 2 — Schema


**Source of truth:** SQLAlchemy models in `backend/app/ontology/models.py` and `backend/app/ontology/ingestion_models.py`, mirrored by Alembic migrations `0001…0022` (`target_metadata = Base.metadata`). Column types below are as declared in the ORM. There are **no Postgres RLS policies** (see commentary). 38 tables total.

Conventions:
- All PKs are `Integer autoincrement` unless noted.
- "Clerk sub" = external Clerk user id stored as `String(256)`.
- `LineageMixin` (on the six ontology entities) adds: `source_file String(512)`, `ingestion_id String(128)`, `confidence_level String(16)="MEDIUM"`, `ingested_at DateTime=now()`, `reviewer_sign_off String(128)`.

---

## A. Ontology entities (Blueprint I output — carry `LineageMixin`)

### `companies` — the tenant root & unit of everything
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| name | String(256) | |
| owner_user_id | String(256), nullable, **indexed** | Clerk sub. **NULL = unowned/demo (world-readable).** Tenant boundary. |
| industry | String(128) | |
| founded | Integer | |
| ein | String(32) | |
| state | String(2) | |
| entity_type | String(32) | LLC / S-Corp / C-Corp |
| total_headcount | Integer, nullable | advisor override |
| market_rate_replacement_annual | Numeric(14,2), nullable | normalization input |
| depreciation_amortization_ttm | Numeric(14,2), nullable | |
| interest_expense_ttm | Numeric(14,2), nullable | |
| income_tax_expense_ttm | Numeric(14,2), nullable | |
| naics_code | String(8), nullable | |
| sic_code | String(4), nullable | |
| report_firm_name | String(256), nullable | **white-label (per company)** |
| report_cover_blurb | Text, nullable | |
| report_logo_url | String(512), nullable | **white-label (per company)** |
| owner_onboarding_completed_at | DateTime, nullable | |

Relationships: `revenue_streams`, `customers`, `employees`, `expenses`, `contracts`.
**No FK to any firm/advisor/engagement.** Ownership is a bare string column.

### `revenue_streams`
`id` PK · `company_id` FK→companies · `customer_id` FK→customers (nullable) · `revenue_gross Numeric(14,2)` · `revenue_type String(32)` · `recurring_flag Boolean=false` · `revenue_period Date` · `description Text` · +lineage.

### `customers`
`id` PK · `company_id` FK→companies · `name String(256)` · `tenure_start Date` · `industry String(128)` · `owner_contact String(256)` · `is_active Boolean=true` · +lineage.

### `employees`
`id` PK · `company_id` FK→companies · `name` · `role` · `department` · `hire_date Date` · `status String(16)=ACTIVE` · `comp_annual Numeric(12,2)` · `is_owner Boolean` · `is_key_person Boolean` · `management_level Integer` (0=owner,1=VP,2=mgr) · +lineage.

### `expenses`
`id` PK · `company_id` FK→companies · `amount Numeric(14,2)` · `category String(32)` (COGS/OPEX/OWNER/PERSONAL/ONE_TIME/RELATED_PARTY) · `description Text` · `period Date` · `vendor String(256)` · `is_recurring Boolean=true` · +lineage.

### `contracts`
`id` PK · `company_id` FK→companies · `customer_id` FK→customers (nullable) · `start_date Date` · `end_date Date` · `annual_value Numeric(14,2)` · `contract_type String(64)` · `is_active Boolean=true` · `renewal_confirmed Boolean=false` · `document_path String(512)` · +lineage.

---

## B. Ingestion tracking

### `ingestion_jobs`
`id` PK · `company_id` FK→companies · `ingestion_id String(128) unique idx` · `filename String(512)` · `source_type String(64)` · `file_path String(1024)` · `file_hash String(64)` (SHA-256) · `file_size Integer` · `current_phase String(32)=P1_INTAKE` · `current_status String(32)=PENDING` · `validation_report JSON` · `schema_profile JSON` · `column_mappings JSON` · `extraction_errors JSON` · `row_count/mapped_count/error_count Integer` · `created_at/updated_at/completed_at DateTime`.

---

## C. Scoring / advisory layer (per company, 1:1 or 1:N)

### `advisor_overrides`
`id` PK · `company_id` FK (idx) · `category String(64)` · `adjustment Numeric(6,2)` (-20..+20) · `rationale Text` · `advisor_id String(256)` · `created_at/updated_at`.

### `qualitative_inputs` — **single row per company** (`company_id unique idx`)
~20 interview fields: `owner_hours_per_week`, `sop_pct`, `automation_pct`, `mgmt_qualified`, `mgmt_total_functions`, `pipeline_value`, `market_positioning`, `repeatability_pct`, `contract_pct`, `customer_contract_type`, `key_person_revenue_pct`, `mgmt_covered_functions`, `has_crm_pipeline`, `non_compete_pct`, `voluntary_turnover`, `comp_vs_market`, `updated_at`. **Overwritten in place** (no versioning here — history captured separately in `qualitative_input_audits`).

### `qualitative_input_audits` — append-only
`id` PK · `company_id` FK (idx) · `advisor_id String(256)` · `snapshot_json Text` · `created_at`.

### `addback_overrides`
`id` PK · `company_id` FK (idx) · `addback_key String(128)` · `description` · `amount Numeric(14,2)` · `challenge String(32)` (LOW/MEDIUM/HIGH/NOT_DEFENSIBLE) · `category` · `documented Boolean` · `notes/rationale Text` · `advisor_id` · `is_custom Boolean` · `updated_at`.

### `engagement_snapshots` — timeline checkpoints
`id` PK · `company_id` FK (idx) · `milestone String(256)` · `date String(64)` (display string!) · `stage String(64)` · `status String(32)` (complete/current/projected) · `drs/drs_tier` · `ebitda` · `ev_floor/ceiling/midpoint` · `multiple_floor/ceiling` · `notes` · `sort_order` · `created_at`.

### `score_snapshots` — append-only DRS/EV history
`id` PK · `company_id` FK (idx) · `drs_score Numeric(6,2)` · `ev_estimate Numeric(16,2)` · `trigger String(64)` (manual/override/report) · `category_scores_json Text` · `created_at (indexed)`.

### `generated_reports`
`id` PK · `company_id` FK (idx) · `template_id String(64)` · `drs_score` · `ev_at_generation` · `created_at`.

### `buyer_question_states`
`id` PK · `company_id` FK (idx) · `question_id Integer` · `status String(32)=open` · `response_text Text` · `answer_draft Text` · `ai_draft_generated_at` · `reviewed_by String(256)` · `mitigating_initiative_id Integer` · `updated_at`.

### `company_initiatives` — value-creation roadmap items
`id` PK · `company_id` FK (idx) · `title String(512)` · `category` · `status String(32)=planned` · `timeline` · `cost_estimate` · `ev_impact_estimate` · `advisor_ev_override` · `depends_on_initiative_id` FK→company_initiatives (self) · `source String(32)=custom` · `created_at` · `phase Integer` (1/2/3) · `estimated_drs_impact Numeric(6,2)` · `target_completion_date/actual_completion_date Date` · `drs_category_key String(64)`.

### `engagement_profiles` — intake (1:1, `company_id unique idx`)
goals narrative, exit_timeline, target_valuation, personal_financial_gap, transaction_type, buyer_universe_notes, preferred_buyer_types_json, owner_motivations_json, post_exit_plans, non_negotiables, engagement_start_date, `advisor_id String(256)`, updated_at.

### `engagement_plans` — top-level plan (1:1, `company_id unique idx`)
`target_exit_date Date` · `target_drs Numeric(6,2)` · `current_phase Integer=1` · `created_at/updated_at`.

### `deal_outcomes` — **the "outcomes" layer** (1:1, `company_id unique idx`)
`deal_status String(32)=in_process` (in_process/closed/fallen_through/on_hold) · `close_date` · `sale_price Numeric(18,2)` · `actual_ev` · `ebitda_at_close` · `ev_multiple` · `buyer_type` · `buyer_name` · `deal_structure` · `drs_at_close` · `predicted_ev_floor/ceiling` · `days_to_close` · `advisor_notes` · `is_benchmark_eligible Boolean=true` · `created_at/updated_at`.

---

## D. Reference / curated data

### `advisory_library_items`
`id` PK · `item_type String(32) idx` (buyer_question/initiative/risk_flag) · `title String(1024)` · `description` · `category String(64) idx` · `severity` · `buyer_type` · `tags_json` · `data_needed` · `score_trigger` · `effort` · `timeline` · `ev_impact` · `source String(32)=system` · `is_active Boolean idx` · `created_at/updated_at`.

### `market_benchmark_releases`
`id` PK · `source_type String(32)` · `label` · `as_of_date Date` · `doc_ref` · `created_at`.

### `market_segment_metrics`
`id` PK · `release_id` FK→market_benchmark_releases (idx) · `industry_slug idx` · `industry_display_name` · `ebitda_band_label/min/max` · `peer_count` · medians (`revenue_growth`, `ebitda_margin`, `payroll_ratio`, `recurring_rev`, `top_customer_conc`) · `market_ebitda_multiple_floor/ceiling` · `wacc_estimate_pct` · `naics_codes String(256)`.

### `market_benchmark_cache`
`id` PK · `cache_key String(512) unique idx` · `payload_json Text` · `expires_at DateTime idx` · `created_at`.

### `buyer_universe_releases`
`id` PK · `source_type String(32)` · `label` · `as_of_date` · `created_at`.

### `active_acquirers`
`id` PK · `release_id` FK→buyer_universe_releases (idx) · `name` · `buyer_type String(16) idx` (pe/strategic/financial) · `hq_state` · `preferred_industries String(512)` · `ebitda_min_m/max_m` · `ev_min_m/max_m` · `investment_thesis` · `hold_period_years` · `portfolio_count` · `notable_platforms` · `source_note` · `is_active Boolean`.

---

## E. Identity, access, billing, growth

### `user_profiles`
`id` PK · `user_id String(256) unique idx` (Clerk sub) · `role String(32)` (ADVISOR/CLIENT) · `created_at/updated_at`.

### `client_access` — legacy invite linkage
`id` PK · `company_id` FK (idx) · `invited_by_user_id String(256)` · `invite_email String(256) idx` · `invite_token String(128) unique idx` · `client_user_id String(256) idx` (set on accept) · `status String(32)=PENDING` · `created_at/accepted_at`.

### `company_access_grants` — current sharing model
`id` PK · `company_id` FK (idx) · `user_id String(256) idx` (grantee Clerk sub) · `role String(32)` (client/associate) · `granted_by String(256)` · `is_active Boolean=true` · `granted_at`.

### `user_subscriptions`
`id` PK · `user_id String(256) unique idx` · `stripe_customer_id` · `stripe_subscription_id` · `tier String(64)` (founding/pro/team) · `status String(64)=inactive` · `billing_interval String(16)=monthly` · `max_companies Integer=10` · `created_at/updated_at`.

### `company_engagement_billing`
`id` PK · `company_id` FK (unique idx) · `user_id String(256) idx` · `billing_status String(16)=included` (included/add_on) · `stripe_subscription_item_id` · `created_at`.

### `ai_copilot_usage` — **composite PK (`user_id`, `month`)**
`user_id String(256) PK` · `month String(7) PK` (YYYY-MM) · `tokens_input/output Integer` · `request_count Integer` · `last_request_at`.

### `advisor_firms`
`id` PK · `name` · `owner_user_id String(256) unique idx` · `subscription_user_id String(256) idx` · `max_seats Integer=5` · `created_at`. **No FK to companies or advisors — association is by convention via `CompanyAccessGrant`.**

### `referral_codes`
`id` PK · `code String(64) unique idx` · `owner_user_id String(256) unique idx` · `total_clicks/total_conversions Integer` · `credit_balance_cents Integer` · `created_at`.

### `referral_conversions`
`id` PK · `referral_code String(64) idx` · `converted_user_id String(256) idx` · `converted_at` · `credited_amount_cents` · `stripe_credit_applied Boolean`.

### `channel_partners`
`id` PK · `slug String(64) unique idx` · `name` · `logo_url` · `discount_pct Integer` · `stripe_coupon_id` · `is_active Boolean` · `created_at`.

### `qb_tokens` — **plaintext OAuth tokens**
`id` PK · `company_id` FK (unique idx) · `realm_id String(128)` · `access_token Text` · `refresh_token Text` · `expires_at` · `created_at/updated_at`.

### `demo_links`
`id` PK · `slug String(128) unique idx` · `recipient_name/firm/email` · `sender_note` · `created_at` · `visit_count` · `first_visited_at/last_visited_at` · `converted Boolean` · `ref_code` · `sections_viewed Text` (JSON).

### `app_settings`
`key String(128) PK` · `value Text`. K/V store (e.g. `spots_remaining`).

---

## Indexes (summary)
Explicit indexes on: `companies.owner_user_id`; every `company_id` FK column that declares `index=True` (most satellite tables); `ingestion_jobs.ingestion_id` (unique); unique keys on `user_profiles.user_id`, `user_subscriptions.user_id`, `client_access.invite_token`, `referral_codes.code`/`owner_user_id`, `advisor_firms.owner_user_id`, `channel_partners.slug`, `advisory_library_items.item_type`/`category`/`is_active`, `active_acquirers.buyer_type`, `score_snapshots.created_at`, `market_benchmark_cache.cache_key`/`expires_at`. Composite PK on `ai_copilot_usage(user_id, month)`.

## RLS policies
**None.** There is no Supabase and no Postgres row-level security. All tenant isolation is enforced in application code by `get_company_scope` / `get_company_write_scope` (`api/deps.py`). The database will happily return any row to any query that forgets the scope dependency.

---

## Commentary — fit against the engagement-centric spine

Target spine: **firm → advisor → client → engagement → assessment versions → outcomes.**
This schema is **company-centric and flat.** Mapping:

| Spine node | This repo | Verdict |
|---|---|---|
| **firm** | `advisor_firms` (billing-only; no FK to companies/advisors) | **Weak.** Exists but not load-bearing; firm membership is inferred from `CompanyAccessGrant.role='associate'`, not a firm FK. |
| **advisor** | Clerk sub in `Company.owner_user_id` + `advisor_id` string columns scattered on `engagement_profiles`, `advisor_overrides`, etc. | **Absent as an entity.** Advisors are bare strings, not rows. No `advisors` table. |
| **client** | `Company` (conflated) | **Conflated.** A client business = a `Company`. A person-client is a Clerk user via `client_access`/`company_access_grants`. The business-vs-relationship distinction doesn't exist. |
| **engagement** | `Company` + `engagement_plans`/`engagement_profiles` satellites | **Conflated.** There is exactly one engagement per company; you cannot model two engagements (e.g. 2024 baseline + 2027 re-engagement) for the same business without cloning the company. |
| **assessment versions** | **Missing.** Scores computed on read; `score_snapshots`/`engagement_snapshots` are trend logs, not immutable versioned assessments | **Absent.** No `assessment` entity, no version number, no supersede/correction semantics, no byte-stable stored result to diff. |
| **outcomes** | `deal_outcomes` (1:1 per company, append-ish) | **Present and decent.** Closest clean match; captures actual vs predicted. Still 1:1 to company, so multi-engagement outcomes collide. |

### What the schema *helps* with
- The **six ontology entities + lineage mixin** are a genuinely good normalized substrate for financial facts, with audit columns (`source_file`, `ingestion_id`, `confidence_level`) already present — exactly what an assessment engine wants to read.
- `deal_outcomes` already models the outcome-capture requirement.
- `score_snapshots` / `engagement_snapshots` prove the team *intends* longitudinal tracking; the plumbing (trigger tags, category JSON, EV bands) is a head-start.
- `advisory_library_items` gives a reusable catalog spine for questions/initiatives/risks.

### Where it *conflicts*
- **`company_id` is the universal foreign key.** ~25 tables hang off `companies.id`. The spine needs them to hang off `engagement_id` (and often `assessment_version_id`). Every one of those FKs is a migration.
- **No versioning primitive.** Cross-version deltas (a stated architectural requirement) have nothing to diff against — scores aren't persisted as versions, and `qualitative_inputs` is overwritten in place.
- **Ownership is a string, not a relationship.** `owner_user_id` can't express firm/advisor hierarchy, reassignment, or co-advisors cleanly (the `CompanyAccessGrant` bolt-on partially covers this).
- **`date` stored as display string** in `engagement_snapshots.date` (`String(64)`, "Mar 27, 2025") — a data-quality landmine for any delta/timeline computed server-side.

### What a migration to the spine would require (sketch)
1. Introduce real entities: `firms`, `advisors` (or reuse Clerk + a profile table with a firm FK), `clients` (the business), `engagements` (FK client, advisor, firm), `assessment_versions` (FK engagement, with version no. + immutable computed payload + supersede pointer).
2. Add `engagement_id` (and where relevant `assessment_version_id`) to all ~25 company-scoped satellites; backfill one engagement per existing company.
3. Repoint `deal_outcomes`, `score_snapshots`, `engagement_snapshots`, `qualitative_inputs`, `company_initiatives`, `buyer_question_states` from `company_id` to `engagement_id`.
4. Replace compute-on-read scoring with a **persist-on-assess** step that writes an immutable `assessment_version` row (prerequisite for byte-identical regression fixtures from the donor engine).
5. Add an `engagement_activity_log` table (absent today) for the WM activity-log requirement.
6. Introduce a real branding entity (firm/advisor level) to replace per-company `report_firm_name`/`report_logo_url`.

This is a **moderate-to-large migration** — the ORM is clean and Alembic is healthy, so it's mechanical, but it touches nearly every table and forces a scoring-persistence rearchitecture that the current compute-on-read design does not have.
</content>


---

# Part 3 — Architecture Decisions


Every silent decision this prototype has committed to, made explicit. For each: **what** it is, **where** it lives, whether it **helps or constrains** the target (engagement-centric, Supabase/Postgres + React + Claude + n8n, with a WM strategic layer), and **cost to reverse** (Low = hours, Medium = days, High = weeks / touches many files, Very High = foundational rewrite).

---

### AD-1 — The `Company` row is the universal unit (client = engagement = tenant)
- **What:** Everything scopes to `companies.id`. There is no client, engagement, or advisor entity. One company = one client business = one exit-planning engagement.
- **Where:** `ontology/models.py` (Company + ~25 satellites), `api/deps.py` (`company_id` is the scope key), every route signature (`/{company_id}` in the path).
- **Help/constrain:** **Constrains hard.** The target's unit is the multi-assessment engagement. This assumption is threaded through the DB, the API URL structure, the frontend `CompanyContext`, and React Query keys (`['company', companyId]`). It blocks two engagements per business and cross-version deltas.
- **Cost to reverse:** **Very High.** Schema migration (AD-9) + API path redesign + frontend context refactor. It is *the* central decision.

### AD-2 — Tenant isolation is app-layer, not database-enforced
- **What:** No RLS, no Supabase. Isolation = every route remembering `Depends(get_company_scope)`. `owner_user_id IS NULL` means world-readable (for demo).
- **Where:** `api/deps.py`, enforced by convention in all 21 routers.
- **Help/constrain:** **Constrains.** Target stack is Supabase/Postgres where RLS is idiomatic and safer. Current model is one forgotten dependency away from a cross-tenant leak, and the "NULL owner = public" rule is a foot-gun if ported naively.
- **Cost to reverse:** **High.** Re-expressing access tiers (owner/associate/client/legacy) as RLS policies + moving auth identity into Postgres (`auth.uid()`), or keeping app-layer and hardening it. Either way touches every table's access story.

### AD-3 — Auth is Clerk, identity is an opaque string
- **What:** Users are Clerk subs (`String(256)`) stored directly on rows (`owner_user_id`, `advisor_id`, `invited_by_user_id`, …). Prod RS256/JWKS, dev HS256 fallback.
- **Where:** `middleware/auth.py`, `ontology/models.py` (string user columns everywhere), `frontend/.../ClerkAuthBridge.jsx`.
- **Help/constrain:** **Mixed.** Clerk is solid and the dev/prod split is clean. But identity-as-string (no `users`/`advisors` table) means no referential integrity on people, no easy firm hierarchy, and a migration off Clerk (Supabase Auth is the target's natural choice) would require rewriting `middleware/auth.py` and reconciling every string user column.
- **Cost to reverse (Clerk→Supabase Auth):** **High.** Token verification swap is Medium; the identity-model cleanup is what makes it High.

### AD-4 — Scores are computed on read, never persisted as versions
- **What:** DRS/EV/category scores are recomputed live from ingested data + `qualitative_inputs` + overrides on every request (`analytics_service.compute_category_modules` → `compute_drs`). Only opportunistic snapshots (`score_snapshots`, `engagement_snapshots`) are stored, as a trend log.
- **Where:** `analytics/a1…a14`, `services/analytics_service.py`, `routes/analytics.py`, `routes/reports.py`.
- **Help/constrain:** **Constrains** the versioning + regression-fixture requirement. Byte-identical fixtures presuppose a *stored, immutable* assessment payload; compute-on-read gives a different answer whenever inputs, weights, or code change. Also makes cross-version deltas impossible without reconstructing past inputs.
- **Cost to reverse:** **High.** Add a persist-on-assess step writing immutable `assessment_version` rows; rework the frontend to read stored versions instead of always recomputing.

### AD-5 — This repo owns a competing scoring engine
- **What:** A full 6-category DRS engine with weights, tiers, EV multiples, buyer-profile reweighting, and confidence bands lives here (`scoring_rules.py`, `a9_drs_composite.py`, `a1…a14`). The donor repo's canonical engine (32 sub-scores, 3 fixtures) is a *different* implementation of the same concept.
- **Where:** `backend/app/analytics/`, `backend/app/core/scoring_rules.py`, `backend/app/core/confidence.py`.
- **Help/constrain:** **Both.** Helps: the *contract* around scoring (a `CategoryScores` dataclass of 6 floats → `DRSResult`) is clean and centralized, so a replacement engine has an obvious seam. Constrains: the whole UI + PDF + copilot + value-gap + buyer-questions stack is hardwired to **six categories** and the `.composite`/`.details`/`.data_confidence` module shape. A 32-sub-score engine that rolls up to 6 dimensions slots in; one that doesn't roll up to these exact 6 forces UI rework.
- **Cost to reverse (displace with donor engine):** **Medium–High.** Contained if the donor engine exposes a 6-dimension rollup; High if the dimension taxonomy differs.

### AD-6 — Frontend/backend contract: REST, per-company URLs, JWT-in-header, FastAPI `detail` errors
- **What:** SPA calls `/api/<domain>/<company_id>/…`; `apiClient` injects Clerk JWT and unwraps `{detail}` into typed `ApiError`; React Query owns caching.
- **Where:** `frontend/src/lib/apiClient.js`, all pages.
- **Help/constrain:** **Neutral-to-helpful.** A conventional, portable contract. The only coupling is the `company_id`-in-path convention (see AD-1) and same-origin static serving.
- **Cost to reverse:** **Low–Medium** (mostly find/replace of the id key if AD-1 changes).

### AD-7 — Dashboard views assume a specific score shape (6 categories, band triplet, tiers)
- **What:** Pages, radar charts, PDF score bars, and value-gap all expect exactly: `revenue_quality, financial_integrity, operational_independence, customer_risk, management_team, growth_drivers`, each 0–100, plus a `{conservative, base, optimistic}` band and a 5-tier label (Foundation→Institutional).
- **Where:** `lib/drsCategoryColors.js`, `Readiness.jsx`, `ValueGap.jsx`, `BuyerLens.jsx`, `a14_report_generator.py`, `a11_value_gap.py`, `a9_drs_composite.py`.
- **Help/constrain:** **Constrains** integration of any engine whose output isn't these 6 dimensions + band + these tiers. This is the concrete answer to "would the DRS engine's output slot in?": **yes if it emits these 6 rolled-up dimensions and a base/low/high band; otherwise the dashboard and PDF need reshaping.**
- **Cost to reverse:** **Medium** (category list + colors + chart configs + PDF bars are enumerable but spread across ~8 files).

### AD-8 — Orchestration is in-process FastAPI, not n8n / queue / cron
- **What:** Async work = `BackgroundTasks` (ingestion P3–P11) + a lifespan bootstrap thread. No queue, no scheduler, no n8n. QuickBooks OAuth CSRF state is an in-process dict.
- **Where:** `routes/ingestion.py`, `main.py` lifespan, `integrations/quickbooks/auth.py` (`_OAUTH_STATE`).
- **Help/constrain:** **Constrains** the target's n8n-centric automation and the WM cadence-trigger requirement (which wants event-driven, out-of-band workflows). Also a scaling constraint: in-process state breaks under multiple workers.
- **Cost to reverse (add n8n + eventing):** **Medium** — additive (emit webhooks/events from key state transitions), no teardown required, but there are currently **zero** emission points to build on.

### AD-9 — Alembic is the schema authority; migrations are healthy but the model is flat
- **What:** Linear Alembic chain `0001→0022`, `target_metadata=Base.metadata`, idempotent `if_not_exists`. History shows past drift (`0009_former_runtime_bootstrap`, `0015_missing_tables`) now reconciled.
- **Where:** `backend/alembic/`.
- **Help/constrain:** **Helps** — a clean, working migration surface makes the spine migration mechanical rather than risky.
- **Cost to reverse:** N/A (this is an asset). The *content* migration to the spine is High (see SCHEMA.md), but the *tooling* is ready.

### AD-10 — White-labeling is per-company, single-brand frontend
- **What:** Report branding = `Company.report_firm_name` + `report_logo_url` + a per-company logo file; frontend UI is one fixed brand.
- **Where:** `a14_report_generator.py` header, `services/company_logo_storage.py`, `Company` columns.
- **Help/constrain:** **Partially helps, mostly constrains** the WM branded-report requirement. The *plumbing* to stamp a logo + firm name onto a PDF exists (real asset). But branding lives on the *client* record, not on a firm/advisor — a WM branding 20 clients sets it 20×, and there is no per-firm theme for the on-screen app.
- **Cost to reverse:** **Medium** — introduce a firm/advisor brand entity and resolve branding from there.

### AD-11 — Reports are server-rendered fpdf2, Latin-1, hand-laid-out
- **What:** PDFs drawn imperatively with fpdf2; non-Latin-1 chars transliterated (`_safe`); no HTML/CSS report path; no diff/delta report type.
- **Where:** `analytics/a14_report_generator.py`.
- **Help/constrain:** **Mixed.** Helps: fully working server-side PDF with branding, KPI boxes, score bars, tables — a real starting point for the branded delta report. Constrains: fpdf2's manual layout is laborious for polished client-facing design; a "polished PDF" WM deliverable may want an HTML→PDF pipeline (Playwright/weasyprint) instead, and Latin-1 will mangle any non-Western client names.
- **Cost to reverse (to HTML→PDF):** **Medium**; adding a delta builder within fpdf2 is **Low–Medium**.

### AD-12 — Demo system is a frozen parallel surface baked into routing
- **What:** `/demo` + `/demo/:slug` reuse advisor page components through `DemoShell`, hardwired to company id=1, unauthenticated, seeded on startup.
- **Where:** `App.jsx` (two large route blocks), `layout/DemoShell.jsx`, `routes/demo.py`, `seed_abc_company.py`.
- **Help/constrain:** **Neutral, some drag.** Demonstrates the presentation layer works end-to-end (a plus), but doubles the routing surface and bakes "company 1 is special / NULL-owner is public" into both DB and UI. Carrying it into the survivor adds dead weight if not pruned.
- **Cost to reverse (remove):** **Low–Medium.**

### AD-13 — Billing/growth machinery is deeply integrated (Stripe, referrals, firms, partners)
- **What:** Full Stripe checkout + webhook lifecycle, founding-spot scarcity, per-engagement overage billing, referral credits, channel partners, firm seats.
- **Where:** `routes/payments.py`, `routes/webhooks.py`, `routes/referrals.py`, `routes/firms.py`, `routes/partners.py`, `core/db_functions.py`, ~6 tables.
- **Help/constrain:** **Mixed.** Helps if the survivor keeps this commercial model (it's real, tested — 27 webhook tests). Constrains if the target's go-to-market differs (WM/advisor channel), since it's woven into the tenant model (`user_subscriptions.max_companies`, `company_engagement_billing`).
- **Cost to reverse:** **Medium** (self-contained routers, but the tenant/plan coupling leaks into company creation limits).

### AD-14 — Config is env-var + pydantic-settings with fail-fast prod validation
- **What:** ~90 typed settings; production startup rejects insecure/missing config; self-heals Railway secret placeholders.
- **Where:** `core/config.py`, `main.py` (`_validate_production_config`, `_check_db_connectivity`).
- **Help/constrain:** **Helps.** Portable, safe, no vault dependency. Directly reusable in any survivor.
- **Cost to reverse:** N/A (asset).

### AD-15 — Tests run against stubbed deps and mock DBs
- **What:** `conftest.py` stubs absent libraries and the DB layer so `pytest` runs "minimal"; tests exercise pure logic, not a live Postgres.
- **Where:** `backend/tests/conftest.py`, all test files.
- **Help/constrain:** **Constrains confidence.** 140 green tests look reassuring but prove almost nothing about DB behavior, RLS, migrations applying, or multi-tenant isolation under a real engine. Any survivor decision leaning on "it's well-tested" should discount accordingly.
- **Cost to reverse (add real integration tests):** **Medium.**

---

## Hardcoded values worth surfacing
- **Company id = 1** ("ABC Company Inc") is special-cased in bootstrap, demo, and valuation (`DEMO_CANONICAL_VALUATION`).
- **Six category keys + weights** hardcoded in `scoring_rules.py` and echoed in frontend `drsCategoryColors.js` (two sources of truth for the category taxonomy).
- **Brand fallbacks** "FRACTURE SYSTEMS" / "Exit Blueprint" / "Pre-Diligence Platform API" — three names across layers.
- **EV snapshot multiple 4.5×** hardcoded in `reports.py` `_snapshot_ev`.
- **`engagement_snapshots.date`** stored as a human display string, not a date.
- **QuickBooks tokens** stored plaintext; **CSRF state** in-process only.
</content>


---

# Part 4 — Survivor Assessment


**Position (stated up front):** This repo should be the **survivor**, and the donor's scoring engine should be **ported in**. This repo is a working, deployed, full-stack product with the two things that are expensive to rebuild — a real presentation/reporting layer and a real operational spine (auth, billing, ingestion, migrations, CI, deploy). Its central weakness (a flat, company-centric data model with no assessment versioning) is a **known, mechanical migration** on healthy Alembic tooling, whereas the donor's presumed strength (a rigorous scoring engine) is a **library-shaped, well-bounded import**. It is cheaper to move a scoring engine into a working product than to rebuild a working product around a scoring engine.

This is a judgment made **without** having read the donor repo; it rests on the task's description of the donor (Python reference engine + 3 fixtures) and on what is verifiably present here. If the donor turns out to also carry a mature app shell, revisit — but the burden of proof shifts to *it*, because this repo's shell is confirmed working (140 tests green, frontend builds, deploy configs live).

---

## Case FOR this repo as survivor

1. **The presentation + reporting layer already exists and works.** 30+ advisor pages, 6 chart types wired through Recharts, React Query data layer, typed API client, *and* a server-side branded PDF generator with 5 report types. Rebuilding this from a scoring engine outward is weeks-to-months of UI work. `SURVIVOR` value concentrates here.
2. **The operational spine is real and tested, not scaffolding.** Clerk auth (prod JWKS + dev fallback), Stripe billing with a 27-test webhook suite, QuickBooks OAuth, a centralized guardrailed Claude client, fail-fast prod config validation, health/readiness probes, and multi-platform deploy manifests (Railway/Render/Fly + Docker). 140 backend tests pass.
3. **Migrations are healthy.** Linear Alembic `0001→0022` against `Base.metadata`, idempotent, with past drift already reconciled. The spine migration is large but *mechanical* on this foundation — low execution risk.
4. **The scoring seam is clean and centralized.** All scoring flows through `compute_category_modules` → `CategoryScores` (6 floats) → `compute_drs` → `DRSResult`. A replacement engine has one obvious insertion point, not a hundred.
5. **The outcome-capture and longitudinal intent already exist in miniature.** `deal_outcomes`, `score_snapshots`, `engagement_snapshots` show the team already reaches for outcomes + trends — the spine formalizes what's already gestating rather than introducing an alien concept.

## Case AGAINST this repo as survivor

1. **The data model is the wrong shape.** Company = client = engagement, with no assessment-version entity and scores computed on read. The engagement-centric spine (with versions, deltas, supersede) is a near-every-table migration and forces a *scoring-persistence rearchitecture* the current design lacks (AD-4). This is the single biggest cost.
2. **It carries a competing scoring engine that must be displaced.** Keeping the survivor means ripping out `a1…a14` + `scoring_rules.py` (or reducing them to a thin adapter) and re-pointing the UI/PDF/copilot at the donor engine. Risk of subtle behavioral divergence during the swap.
3. **Isolation is app-layer with a "NULL-owner = public" rule** — the opposite of the target's Supabase/RLS idiom, and a latent leak vector (AD-2). Moving to RLS is High-cost.
4. **The WM strategic layer has almost no substrate here.** No activity log, no event/cadence triggers, no n8n, per-company (not per-firm) branding. Three of the four WM features need schema or architecture work (below).
5. **"Well-tested" is partly an illusion.** Tests run on stubbed deps and mock DBs (AD-15); they validate logic, not persistence, isolation, or migrations. Confidence in the *shell* is high from build/deploy evidence, but not from the test suite alone.

---

## What must be ported IN if this repo wins — the scoring engine

**How cleanly can an external Python engine + fixtures integrate?** Cleanly, with one important condition.

- **Where it lives:** `backend/app/analytics/` is already a package of standalone, dependency-light modules. Drop the donor engine in as `backend/app/scoring/` (or replace `a1…a9`) with its fixtures under `backend/tests/fixtures/`. The engine is pure-Python and reads normalized facts — it does not need the web framework.
- **The integration seam:** a single function, `services/analytics_service.compute_category_modules(company_id, db)`, is the choke point every consumer (scores API, reports, copilot, value-gap, engagement re-score) calls. Reimplement that one function to (a) load facts from the ontology tables, (b) call the donor engine, (c) return objects exposing `.composite` / `.details` / `.data_confidence`. Everything downstream keeps working unchanged.
- **The condition (the risk):** the donor engine's **32 sub-scores must roll up to these exact 6 dimensions** (`revenue_quality, financial_integrity, operational_independence, customer_risk, management_team, growth_drivers`) and emit a base/conservative/optimistic band, because the UI, the radar chart, the PDF score bars, and value-gap are hardwired to that taxonomy (AD-7). If the donor's dimensions differ, add a rollup adapter (Medium) or reshape the dashboard (Medium–High).
- **Fixture fidelity:** byte-identical regression requires **persisting** the engine's output as an immutable assessment version (this repo currently recomputes on read — AD-4). So porting the engine *also* forces the persist-on-assess change. Budget for both together; they are the same work item.
- **Weights authority:** `core/scoring_rules.py` is the current single source for weights/tiers. Either the donor engine owns weights (retire `scoring_rules.py`) or it reads them from here — decide explicitly to avoid two sources of truth.

**Net:** engine import is **Medium**; the coupled persist-on-assess + 6-dimension-rollup requirements are what push the *combined* task to Medium–High. Still far cheaper than rebuilding the shell.

## What must be ported OUT if this repo loses — extractable assets

Ranked by value × extraction-cleanliness:

| Asset | Where | Entanglement | Extractability |
|---|---|---|---|
| **PDF report generator** | `a14_report_generator.py` | Low — pure fpdf2, only depends on analytics outputs + `Company` branding fields | **Clean.** Lift with its input contract; swap data source. Best single donation. |
| **Claude client** | `core/ai_client.py` | Low — self-contained (retry, caching, guardrails, cost) | **Clean.** Copy as-is. |
| **Ingestion pipeline P2–P11** | `ingestion/`, `p5` Claude mapping | Medium — writes to ontology tables, uses `IngestionJob` | **Moderate.** Portable if the target keeps a similar fact schema; the phase framework is decoupled from the web layer. |
| **QuickBooks OAuth + normalizer** | `integrations/quickbooks/` | Medium — depends on `qb_tokens` table + config | **Moderate.** Self-contained module; needs the token table + fix the in-process CSRF state. |
| **Auth middleware** | `middleware/auth.py` | Low–Medium — Clerk-specific | **Clean if staying on Clerk;** rewrite if moving to Supabase Auth. |
| **Dashboard shells + chart pages** | `frontend/src/components/layout/*`, `pages/*` | **High** — coupled to React Router, Clerk, `CompanyContext`, React Query keys, the 6-category taxonomy, Tailwind | **Entangled.** Individual chart pages are liftable as patterns, but wholesale reuse drags the whole frontend framework choice with them. This is the reason *not* to make this repo the donor. |
| **Stripe billing + webhooks** | `routes/payments.py`, `routes/webhooks.py` | Medium — tied to `user_subscriptions`/tenant model | **Moderate.** Routers are self-contained; the plan↔company-limit coupling leaks. |
| **Alembic migration framework** | `backend/alembic/` | Low | **Clean** as a pattern, but migrations are model-specific — you port the *approach*, not the files. |

**The dashboard/frontend is the crown jewel and the most entangled** — which is precisely why losing this repo is the expensive outcome. You can cherry-pick the PDF generator and the Claude client cheaply, but you cannot cheaply extract "the dashboard."

---

## Readiness for the WM strategic layer

| WM feature | Rating | Why (one sentence) |
|---|---|---|
| **Branded client-facing delta report** | **NEEDS SCHEMA CHANGE** | The PDF generator + per-company logo/firm plumbing exist and work, but there is no delta/diff report type and no assessment-version pair to diff, and branding must move from the client record to a firm/advisor entity. |
| **Dual-milestone roadmap** (business + personal timeline) | **NEEDS SCHEMA CHANGE** | `company_initiatives` (phases, target/actual dates, DRS impact) already models business milestones on a timeline; adding advisor-entered *personal planning* milestones is a new milestone type/table plus a combined timeline view — additive, not structural. |
| **Touch-cadence event triggers** | **NEEDS REARCHITECTURE** | There is no eventing, no n8n, no scheduler, and zero emission points for "score moved" / "task completed"; `mark_initiative_complete` re-scores inline but emits nothing — this requires introducing an event bus + n8n integration from scratch. |
| **Engagement activity log** | **NEEDS SCHEMA CHANGE** | Fragments of append-only history exist (`qualitative_input_audits`, `score_snapshots`, `generated_reports`) but no unified activity table and no capture of touches/artifacts/views — a new `engagement_activity_log` table plus write-hooks on key actions. |

**Summary:** one of four WM features (cadence triggers) needs genuine new architecture; the other three are schema additions on top of surfaces that already exist. None is blocked by a fundamental limitation of this repo — they are blocked by the *absence* of the engagement/version spine, which is the same migration the core consolidation already requires. In other words, **doing the spine migration unlocks most of the WM layer as a side effect.**

---

## Recommended sequence if this repo is chosen
1. Land the engagement/assessment-version spine migration (SCHEMA.md sketch) — this is the gating item and also unblocks the WM layer.
2. Port the donor engine behind `compute_category_modules`, with persist-on-assess writing immutable version rows; validate the 3 fixtures against stored output.
3. Displace `a1…a9` / `scoring_rules.py`; keep `a10…a14` (EV, value-gap, reports) reading the new engine's rollup.
4. Add `engagement_activity_log` + a firm/advisor branding entity; build the delta-report builder in fpdf2 (or move to HTML→PDF).
5. Introduce n8n + event emission on score/task transitions for cadence triggers.
6. Fix the confirmed `engagement.py` DRS-attribute bug and add real DB-integration tests (the current suite won't catch spine regressions).

## The one confirmed defect found during audit (not fixed — out of scope)
`POST /api/engagement/initiatives/{company_id}/{initiative_id}/complete` will 500: it reads `drs_result.base/.conservative/.optimistic` but `DRSResult` exposes `base_drs/conservative_drs/optimistic_drs` (`engagement.py:365-367` vs `a9_drs_composite.py:69-71`). Flagged for the survivor's backlog.
</content>
