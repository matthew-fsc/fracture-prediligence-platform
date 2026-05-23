# Known Issues

Tracked issues for incoming contributors. Items marked **[BLOCKER]** must be resolved before merging new work in the affected area. Items marked **[WARN]** are safe to work around but should be fixed in a dedicated PR.

---

## KI-001 — Duplicate Alembic migration prefix `0010` [WARN]

**File:** `backend/alembic/versions/`
**Symptoms:** Two migration files share the `0010_` prefix:
- `0010_client_advisor_attribution.py`
- `0010_user_roles_client_access.py`

Alembic uses the `down_revision` chain, not filenames, so migrations still apply correctly in sequence. However, the filename collision is confusing and will cause CI tools that sort by filename to process them in non-deterministic order.

**Fix:** Rename `0010_client_advisor_attribution.py` to `0009b_client_advisor_attribution.py` (or the next available prefix) and verify `alembic history` still shows a clean linear chain.

---

## KI-002 — Stale Clerk public key committed in `backend/.env.example` [WARN]

**File:** `backend/.env.example`, line 33
**Symptoms:** `CLERK_SECRET_KEY` contains a real RSA public key block rather than a placeholder. This is not a private key and poses no direct secret-exposure risk, but it will mislead developers who copy the example verbatim into a production environment against the wrong Clerk instance.

**Fix (applied in this branch):** Replaced with a clearly annotated placeholder string. Engineers must substitute their own Clerk instance key.

---

## KI-003 — `backend/.env.example` defaults to production Railway URL [WARN]

**File:** `backend/.env.example`, lines 19–22
**Symptoms:** `CORS_ORIGINS` and `FRONTEND_URL` default to `https://fracture-prediligence-platform-production.up.railway.app/` — an active production URL with a trailing slash. Developers who copy-paste without editing will:
1. Get CORS errors in local dev (browser origin is `http://localhost:5173`).
2. Accidentally point Stripe redirects at production from a local machine.

**Fix (applied in this branch):** Replaced defaults with `http://localhost:5173` and added inline comments.

---

## KI-004 — README documented wrong Vite dev proxy port [WARN]

**File:** `README.md` (Quick Start section)
**Symptoms:** The README previously told developers to run uvicorn on port **8004**, but `frontend/vite.config.js` proxies `/api` to `http://127.0.0.1:8000`. Running on 8004 caused all API calls to fail with connection refused.

**Fix (applied in this branch):** README corrected to port 8000.

---

## KI-005 — `app.main` startup runs `create_all` alongside Alembic [WARN]

**File:** `backend/app/main.py` (lifespan block)
**Symptoms:** On startup, the app calls `Base.metadata.create_all()` as a bootstrap fallback, in addition to relying on Alembic migrations. This can silently create tables that Alembic does not know about, causing schema drift and confusing `alembic check`.

**Fix:** Remove the `create_all` call from the lifespan. All schema changes should go through `alembic revision --autogenerate`. The bootstrap logic currently also runs small additive `ALTER` statements — migrate those to a proper Alembic revision.

---

## KI-006 — No rate limiting enforced by the application layer [WARN]

**File:** `backend/app/main.py`, all ingestion routes
**Symptoms:** The API does not enforce per-user or per-IP rate limits in application code. The `deploy/nginx.example.conf` documents `limit_req` config but this is opt-in at the infrastructure layer. A misconfigured deploy (no nginx/CDN in front) has no throttling.

**Fix:** Add `slowapi` or equivalent middleware with per-user limits on `/api/ingestion/upload` and `/api/copilot/chat` as a minimum.

---

## KI-007 — AI Copilot and buyer-Q routes have no model fallback [WARN]

**Files:** `backend/app/api/routes/copilot.py`, `backend/app/analytics/a13_buyer_questions.py`
**Symptoms:** Both routes call the Anthropic API without a timeout or graceful degradation path. If `ANTHROPIC_API_KEY` is absent or the API is unavailable, the request hangs until the HTTP client default timeout is hit, returning a 500 with no user-friendly message.

**Fix:** Wrap Anthropic calls in `try/except anthropic.APIError` with a structured error response; log and return a 503 with a retry-after hint.

---

## KI-008 — Demo seed idempotency check uses revenue count only [WARN]

**File:** `backend/app/services/demo_company_seed.py`
**Symptoms:** The startup seed guard skips re-seeding if `revenue_streams` for `company_id=1` is non-empty. If a developer ran a partial manual ingest against company 1 (e.g., imported one CSV), the guard fires and the canonical ABC fixture is never loaded, causing analytics to produce wrong DRS results.

**Fix:** Add a secondary check on `DEMO_INGESTION_ID` (`seed-demo-abc-qb-pl-v1`) presence in `ingestion_jobs` table. If that specific job is absent, wipe and re-seed regardless of row count.

---

## KI-009 — `company_engagement_billing` has no cascade delete [WARN]

**File:** `backend/app/ontology/models.py`, `CompanyEngagementBilling`
**Symptoms:** If a company record is deleted directly (e.g., via admin cleanup), the `company_engagement_billing` row orphans because there is no `ondelete="CASCADE"` on the foreign key. The orphan will cause FK constraint violations if the `company_id` is reused.

**Fix:** Add `ForeignKey("companies.id", ondelete="CASCADE")` and a corresponding Alembic migration.

---

## KI-010 — Stripe webhook allows unsigned events in dev but flag is not enforced in prod check [WARN]

**File:** `backend/app/api/routes/webhooks.py`, `backend/.env.example`
**Symptoms:** `ALLOW_UNSIGNED_STRIPE_WEBHOOKS=true` bypasses signature verification. The env example sets it to `false` but the comment says "for local Stripe CLI only" without a hard guard that prevents it from being set in `APP_ENV=production`.

**Fix:** In the webhook handler, assert `ALLOW_UNSIGNED_STRIPE_WEBHOOKS` is `false` when `APP_ENV=production` and raise a startup error if not.

---

_Last updated: 2026-04-09. Add new issues here; do not remove resolved items — mark them with **(resolved in `<branch>`)** instead._
