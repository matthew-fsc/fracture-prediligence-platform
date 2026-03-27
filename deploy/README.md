# Hosting setup

The app supports **same-origin** (one Docker image: FastAPI + built SPA on one port) and **split** (static frontend + API on another host). The repo root `Dockerfile` is the same-origin path.

## Wiring frontend ↔ backend

| Mode | Browser calls API via | Backend `CORS_ORIGINS` | Vite build (`Dockerfile` / CI) |
|------|------------------------|-------------------------|----------------------------------|
| **Same-origin** | Relative `/api/...` (default) | Your public `https://…` origin (same as SPA) | `VITE_API_BASE_URL` **empty**; set `VITE_CLERK_PUBLISHABLE_KEY` |
| **Split** | `VITE_API_BASE_URL` (e.g. `https://api.example.com`) | SPA origin only (e.g. `https://app.example.com`) | Set both `VITE_*` at **build** time |

Important: **Vite inlines `VITE_*` when `npm run build` runs.** Changing env on the server after deploy does not change the SPA. Rebuild the image when Clerk or API URL changes.

Backend must know the public app URL: **`FRONTEND_URL`**, **`CORS_ORIGINS`** (comma-separated, no trailing slashes), and for auth **`CLERK_JWKS_URL`** (same Clerk instance as the publishable key). Register Stripe webhooks on **`https://<your-public-api-host>/api/webhooks/stripe`**.

---

## Same-origin — Fly.io

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/), run `fly auth login`.
2. From repo root: `fly launch --no-deploy` (uses `fly.toml`; rename `app` in `fly.toml` if needed).
3. Set **build-time** Clerk publishable key (either edit `fly.toml` `[build.args]` or deploy with):
   `fly deploy --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
4. Postgres: `fly postgres create` or attach Neon; set `fly secrets set DATABASE_URL="postgresql://..."`.
5. Set **runtime** secrets, e.g.:
   `fly secrets set APP_ENV=production SECRET_KEY="..." CORS_ORIGINS="https://your-app.fly.dev" FRONTEND_URL="https://your-app.fly.dev" CLERK_JWKS_URL="https://<instance>.clerk.accounts.dev/.well-known/jwks.json"`
6. Deploy: `fly deploy`.
7. Optional first boot: `fly secrets set RUN_MIGRATIONS=true` then deploy once; then set `false` or remove.

Health: `GET /health` (liveness), `GET /health/ready` (DB).

---

## Same-origin — Render

1. Push repo to GitHub/GitLab.
2. **New → Blueprint** → select `render.yaml`.
3. In the dashboard, set secret env vars: `DATABASE_URL`, `SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_JWKS_URL`, Stripe keys, etc. Render passes service env vars into the **Docker build** when `Dockerfile` declares matching `ARG` names (see root `Dockerfile`).
4. Set `CORS_ORIGINS` and `FRONTEND_URL` to your Render HTTPS URL (adjust when you add a custom domain).

---

## Same-origin — Railway

1. **New Project → Deploy from GitHub**, repo root; uses `railway.toml` + `Dockerfile`.
2. Add **PostgreSQL** (or provision an external DB) and wire **`DATABASE_URL`** into this service (Railway: reference the plugin variable, e.g. `${{ Postgres.DATABASE_URL }}`). The default in code points at `localhost` and will not work in the container until this is set.
3. Under **Variables**, add the same vars as in `backend/.env.example`, plus **`VITE_CLERK_PUBLISHABLE_KEY`** (and optional `VITE_API_BASE_URL`) so the Docker build receives them.
4. Deploy; set `CORS_ORIGINS` / `FRONTEND_URL` to the generated public URL or custom domain.
5. **Healthcheck:** Railway probes `GET /health` (liveness). `/health/ready` checks the database; if the deploy fails with “healthcheck failed” but the build succeeded, open **Deploy Logs** for DB connection errors and confirm `DATABASE_URL` and network access to Postgres.

---

## Split — Frontend on Vercel

1. Import repo; **Root Directory** = `frontend`.
2. Build env: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL=https://api.yourdomain.com` (no trailing slash).
3. `frontend/vercel.json` rewrites client routes to `index.html`.
4. On the **API** host: `CORS_ORIGINS=https://your-app.vercel.app` (or custom domain).

---

## Local production-like stack

From repo root:

```bash
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
docker compose up --build
# → http://localhost:8000
```

---

## CI deploy (optional)

`.github/workflows/deploy-fly.yml` runs on **workflow_dispatch** if `FLY_API_TOKEN` is set. Add repository secrets `VITE_CLERK_PUBLISHABLE_KEY` (and optionally extend the workflow to pass `--build-arg` from secrets) so production builds are not missing the Clerk key.

---

## TLS at your own edge

Use `nginx.example.conf` or `Caddyfile.example` when terminating TLS on a VM in front of Docker. Ensure `proxy_set_header X-Forwarded-Proto $scheme` (already in examples); uvicorn runs with `--proxy-headers`.
