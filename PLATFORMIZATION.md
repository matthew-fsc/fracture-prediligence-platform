# Platformization roadmap

This document turns the **demo-ready** stack into a **hosted product**: clear hosting paths for frontend and backend, then a phased plan for product and operational maturity.

---

## 1. Hosting models

| Model | Frontend | Backend / API | Best when |
|-------|----------|-----------------|-----------|
| **A — Single origin (recommended first)** | Served by FastAPI from `frontend/dist` (same Docker image) | Same process + Postgres | Simplest ops, matches current `Dockerfile`. One URL for `CORS_ORIGINS` / `FRONTEND_URL`. |
| **B — Split origin** | Static host (e.g. **Vercel**, CloudFront, S3+CloudFront) | Container or PaaS (e.g. **Fly.io**, **Render**, **Railway**) | Separate scaling/CDN for UI, or team already standardized on Vercel. Set `VITE_API_BASE_URL` to the API origin; add API origin to `CORS_ORIGINS`. |

**Secrets:** inject via each platform’s secret manager (never commit `.env`). Align **Clerk** (publishable + JWKS instance) and **Stripe** webhooks with the **public** URLs you choose.

**Local Windows (Model A, same-origin):** From the repo root, run **`start.bat`** — it creates a Python venv and `backend/.env` when missing, installs deps, builds `frontend/dist` if needed, then serves the UI and API at **http://localhost:8000**. Details: **`README.md`** (Quick Start).

---

## 2. One-time checklist (any host)

1. **Postgres** — managed instance (Neon, RDS, Supabase, or PaaS-attached DB). Note `DATABASE_URL`.
2. **DNS** — point `app.example.com` (and `api.example.com` if split) at the load balancer / PaaS.
3. **TLS** — terminate HTTPS at edge (PaaS, nginx, Caddy). Examples: `deploy/nginx.example.conf`, `deploy/Caddyfile.example`.
4. **Backend env** — `APP_ENV=production`, strong `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `FRONTEND_URL`, `CLERK_*`, `STRIPE_*`, `ADMIN_API_KEY` as needed. See `backend/.env.example` and README.
5. **Frontend build env** — `VITE_CLERK_PUBLISHABLE_KEY`; for split hosting, `VITE_API_BASE_URL=https://api.example.com` (no trailing slash).
6. **Clerk** — production instance; allowed origins + redirect URLs for your SPA URL(s).
7. **Stripe** — webhook URL on public API, e.g. `https://app.example.com/api/webhooks/stripe` (same-origin) or `https://api.example.com/api/webhooks/stripe` (split).
8. **Migrations** — `RUN_MIGRATIONS=true` on first deploy or run `alembic upgrade head` in CI/release job; then prefer migration job over mutating prod on every boot.

---

## 3. Repo-provided hosting configs

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage: `npm run build` → FastAPI + static `dist` (Model A). |
| `docker-compose.yml` | Local prod-like: Postgres + app. |
| `fly.toml` | **Fly.io** — build from Dockerfile, HTTP service on port 8000. |
| `render.yaml` | **Render** Blueprint — Docker web + Postgres (adjust plans/names). |
| `railway.toml` | **Railway** — Docker build + deploy hints. |
| `frontend/vercel.json` | **Vercel** — SPA fallback for client-side routes (Model B: set project root to `frontend`). |
| `.github/workflows/deploy-fly.yml` | Optional CI: manual deploy to Fly when `FLY_API_TOKEN` is set. |

Detailed steps per vendor: **`deploy/README.md`**.

---

## 4. Phased platformization plan

### Phase 0 — Hosted MVP (week 0–1)

- Deploy **Model A** using Fly, Render, or Railway + managed Postgres.
- Configure secrets, `RUN_MIGRATIONS` or CI migration, Clerk, Stripe.
- Smoke test: sign-in, upload, report, `/health` and `/health/ready`.

### Phase 1 — Reliability & safety (weeks 2–4)

- Staging environment (same Dockerfile, different DB + secrets).
- Backup/restore drill on Postgres.
- Error tracking (e.g. Sentry) for API + optional frontend.
- Rate limits at edge (`deploy/nginx.example.conf` pattern) or WAF.

### Phase 2 — Split hosting (optional)

- Move UI to Vercel; API stays on container PaaS; `VITE_API_BASE_URL` + strict `CORS_ORIGINS`.
- Or keep single origin and add CDN in front of the same hostname.

### Phase 3 — Product platform concerns

- **File storage:** move `RAW_DATA_DIR` / `REPORTS_DIR` to S3-compatible object storage for multi-instance and durability.
- **Background work:** long-running ingestion/report jobs in a queue (RQ, Celery, Cloud Tasks) if API workers must stay stateless.
- **Multi-tenancy & billing:** enforce org/company isolation in API; Stripe customer ↔ tenant mapping; audit logs for admin actions.
- **Observability:** structured logs, request IDs, dashboards on latency/error rate, synthetic checks on `/health`.

### Phase 4 — Enterprise / scale

- SSO (SAML/OIDC) if required by buyers.
- Regional deployment or read replicas if data residency or load requires it.
- Formal SLA, incident runbooks, on-call rotation.

---

## 5. Success criteria (definition of “platform”)

- App runs **only** on non-localhost URLs with **TLS**.
- **No** default `SECRET_KEY` in production; secrets **rotatable** without code deploy where possible.
- **Database** migrated via Alembic; backups tested.
- **Auth** and **webhooks** configured for production Clerk/Stripe instances.
- **Runbook** for deploy, rollback, and restore from backup.

---

*Iterate phases based on customer and compliance needs; Phase 0 + 1 are sufficient for a credible private beta.*
