# Production Readiness Audit
## Fracture Pre-Diligence Platform

**Audit Date:** 2026-04-10  
**Verdict: NOT PRODUCTION READY — 13 high-severity, 40 medium-severity issues found**

---

## Risk Scorecard

| Dimension | High | Medium | Low | Status |
|---|---|---|---|---|
| Security | 4 | 3 | 0 | CRITICAL |
| Error Handling | 0 | 5 | 0 | HIGH |
| Observability | 0 | 5 | 0 | HIGH |
| Database | 3 | 5 | 0 | CRITICAL |
| API Completeness | 0 | 4 | 2 | MEDIUM |
| Testing | 2 | 4 | 0 | CRITICAL |
| Configuration | 1 | 4 | 1 | HIGH |
| Frontend | 0 | 5 | 4 | HIGH |
| Performance | 1 | 4 | 2 | HIGH |
| Deployment | 2 | 5 | 2 | HIGH |
| **TOTAL** | **13** | **40** | **11** | |

---

## P0 — Must Fix Before Production

### SEC-1: Unsigned Stripe Webhook Guard Missing [CRITICAL]
- **File:** `backend/app/api/routes/webhooks.py:151-155`
- **Issue:** `ALLOW_UNSIGNED_STRIPE_WEBHOOKS=true` emits only a warning with no production hard-guard. A misconfigured environment will accept forged Stripe events.
- **Fix:** Add to startup:
  ```python
  if settings.APP_ENV == "production" and settings.ALLOW_UNSIGNED_STRIPE_WEBHOOKS:
      raise RuntimeError("ALLOW_UNSIGNED_STRIPE_WEBHOOKS must be false in production")
  ```

### SEC-2: Default SECRET_KEY Not Rejected in Production [HIGH]
- **File:** `backend/app/main.py:88-91`, `backend/app/core/config.py:10`
- **Issue:** App logs a warning but starts successfully with `SECRET_KEY=change-me-in-production`.
- **Fix:** Raise `RuntimeError` instead of logging a warning.

### SEC-3: No Rate Limiting [HIGH] (see also KI-006)
- **Files:** `backend/app/api/routes/ingestion.py`, `backend/app/api/routes/copilot.py`
- **Issue:** No per-user or per-IP rate limiting on upload and AI copilot endpoints.
- **Fix:** Integrate `slowapi` with limits such as 10 uploads/hour and 100 copilot requests/hour.

### SEC-4: Overly Permissive CORS [HIGH]
- **File:** `backend/app/main.py:115-121`
- **Issue:** `allow_methods=["*"]` and `allow_headers=["*"]` on all configured origins.
- **Fix:** Restrict to `["GET", "POST", "PATCH", "DELETE"]` and only required headers.

### DB-1: No Connection Pool Configuration [HIGH]
- **File:** `backend/app/core/database.py:8-9`
- **Issue:** `create_engine()` uses default pool of 5 connections with no `pool_pre_ping`, `pool_recycle`, or `max_overflow`. Will exhaust under load.
- **Fix:**
  ```python
  engine = create_engine(
      settings.DATABASE_URL,
      pool_size=20, max_overflow=40,
      pool_recycle=3600, pool_pre_ping=True,
  )
  ```

### DB-2: `Base.metadata.create_all()` Bypasses Alembic [HIGH] (see also KI-005)
- **File:** `backend/app/main.py:31-32`
- **Issue:** Dev mode calls `create_all()` alongside Alembic, causing schema drift that makes `alembic check` unreliable.
- **Fix:** Remove `create_all()` entirely; all schema changes must go through Alembic migrations.

### DB-3: Missing Cascade Delete on Billing FK [HIGH] (see also KI-009)
- **File:** `backend/app/ontology/models.py` (`CompanyEngagementBilling`)
- **Issue:** No `ondelete="CASCADE"` on the FK to `companies.id` — deleting a company orphans billing records.
- **Fix:** Add a migration adding `ON DELETE CASCADE` to that foreign key.

### CFG-1: Required Env Vars Not Validated at Startup [HIGH]
- **File:** `backend/app/core/config.py:14,16,18,19`
- **Issue:** `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` all default to `""`. App starts and silently fails at runtime.
- **Fix:** Add a startup check that raises `RuntimeError` for any empty critical var when `APP_ENV=production`.

### TEST-1: Critically Low Test Coverage [HIGH]
- **Files:** `backend/tests/` (5 files, ~10% coverage)
- **Issue:** Ingestion pipeline (P2-P11), all analytics modules (A1-A14), all API routes, and webhooks have zero test coverage.
- **Fix:** Target 70%+ coverage. Priority areas: ingestion pipeline, analytics computation, Stripe webhook handler, and auth/authorization paths.

### ERR-1: Silent `except Exception: pass` in Critical Paths [HIGH]
- **Files:**
  - `backend/app/api/routes/analytics.py:509-510`
  - `backend/app/api/routes/copilot.py:180-183`
  - `backend/app/main.py:59-60,69-73,80-81`
- **Issue:** Bare `except/pass` blocks swallow errors silently, making production debugging nearly impossible.
- **Fix:** Log at `ERROR` level with `exc_info=True` before suppressing; raise where recovery is not possible.

### DEPLOY-1: No Startup Dependency Validation [HIGH]
- **File:** `backend/app/main.py`
- **Issue:** App starts even if Clerk JWKS URL is absent, database migrations are behind, or S3 bucket is inaccessible.
- **Fix:** Add `_startup_checks()` called during `lifespan` that validates all external service connectivity in production.

---

## P1 — High Impact, Should Fix Before Launch

### OBS-1: No HTTP Request Logging Middleware
- **Fix:** Add middleware logging method, path, status code, and latency for every request.

### OBS-2: No Structured Log Format
- **Issue:** Plain-text Python logging is not parseable by CloudWatch, Datadog, etc.
- **Fix:** Configure `pythonjsonlogger` JSON formatter.

### OBS-3: No Request Tracing
- **Issue:** No `X-Request-ID` propagation — cannot correlate multi-step ingestion operations in logs.

### PERF-1: No Caching on Analytics Endpoints [HIGH]
- **Issue:** DRS, EV, and value gap are recomputed from scratch on every request (2-5s load time).
- **Fix:** Redis cache with 5-minute TTL; invalidate on data mutation.

### PERF-2: N+1 Queries in Analytics Routes
- **File:** `backend/app/api/routes/analytics.py:400+`
- **Issue:** Separate queries for `AdvisorOverride`, `QualitativeInputs`, `EngagementProfile`, etc.
- **Fix:** Use `joinedload()` or batch via CTE.

### PERF-3: No Background Job Queue
- **Issue:** PDF report generation blocks HTTP request for 30-60s.
- **Fix:** Use Celery + Redis; return `202 Accepted` with a task ID.

### FE-1: Missing Loading and Error States on Async Operations
- **Issue:** File upload (up to 30s) and analytics pages have no visual feedback or error recovery UI.

### FE-2: Admin Key Stored in localStorage
- **File:** `frontend/src/lib/apiClient.js:18-25`
- **Issue:** XSS vulnerability — admin key in plaintext localStorage.
- **Fix:** Use `sessionStorage`; clear on logout.

### DEPLOY-2: No Graceful Shutdown Handler
- **Issue:** SIGTERM abruptly closes in-flight requests and database connections.
- **Fix:** Add `@app.on_event("shutdown")` to drain connections and cancel pending tasks.

### DEPLOY-3: Extended Health Checks Missing
- **File:** `backend/app/main.py` (`/health/ready`)
- **Issue:** Readiness check only verifies database; does not check Anthropic, Stripe, or migration status.

### DEPLOY-4: No Secret Scanning in CI
- **File:** `.github/workflows/ci.yml`
- **Fix:** Add `gitleaks/gitleaks-action@v2` to the CI pipeline.

### API-1: No Pagination on List Endpoints
- **Files:** `backend/app/api/routes/companies.py:77`, `backend/app/api/routes/ingestion.py:98`, and others.
- **Issue:** Unbounded queries return entire result sets; will cause memory/latency spikes at scale.

### ERR-2: Copilot Has No API Timeout (see also KI-007)
- **File:** `backend/app/api/routes/copilot.py:286-292`
- **Fix:** Pass `timeout=10.0` to the Anthropic `messages.create()` call.

---

## P2 — Nice to Have

- Migrate frontend from JavaScript to TypeScript
- Add API versioning (`/api/v1/`)
- Add database index migration for `company_id` columns on `ingestion_jobs`, `company_initiatives`, `buyer_question_states`
- Add cursor/offset pagination on all list endpoints
- Add Prometheus metrics via `prometheus-fastapi-instrumentator`
- Add load testing suite (locust or pytest-benchmark)
- Rename duplicate `0010_` Alembic migration prefix (KI-001)
- Implement route-based code splitting (lazy imports) in the React frontend
- Add blue-green deployment documentation for backward-incompatible migrations
- Add Docker layer caching to CI (`type=gha`)

---

## What Is Working Well

- Clerk JWT auth with JWKS caching and HS256 dev fallback
- Company-scoped multi-tenancy enforced via `Depends(get_company_scope)` on all routes
- Stripe webhook HMAC signature verification
- Pydantic input validation on all major routes
- Alembic migration history (10 migrations)
- Multi-stage Docker build producing a single deployable image
- Liveness + readiness health check endpoints
- PostHog analytics event emission on key actions
- File upload size enforcement (25 MiB)
- Top-level React `ErrorBoundary`
- Per-user copilot token budget enforcement

---

## Suitability Assessment

| Environment | Ready? |
|---|---|
| Internal demo / PoC | Yes |
| Private beta (known advisors) | Yes, with P0 SEC items fixed |
| Public production deployment | No — P0 items must be resolved first |
