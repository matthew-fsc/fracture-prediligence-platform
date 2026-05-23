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

1. **New Project → Deploy from GitHub**; uses [`railway.toml`](../railway.toml) + root [`Dockerfile`](../Dockerfile).
2. **Service root directory:** The build context must be the directory that **contains** `Dockerfile`, `frontend/`, and `backend/`. If your Git repo wraps this app in an extra folder (e.g. only `fracture-prediligence-platform/` holds those paths), set **Service → Settings → Root Directory** to that inner path. If Root Directory is wrong, builds fail or deploy the wrong tree.
3. Add **PostgreSQL** (or provision an external DB) and wire **`DATABASE_URL`** into this service (Railway: reference the plugin variable, e.g. `${{ Postgres.DATABASE_URL }}`). The default in code points at `localhost` and will not work in the container until this is set. Use the URL Railway provides (often includes `sslmode=require` for managed Postgres). **[`railway.toml`](../railway.toml) runs `alembic upgrade head` as a pre-deploy command** so the web container can start uvicorn immediately (healthchecks probe `GET /health` while `RUN_MIGRATIONS=true` in the entrypoint would block on Alembic and often fail the deploy). Set service variable **`RUN_MIGRATIONS=false`** so migrations are not run a second time before uvicorn. If you disable pre-deploy in the dashboard, set **`RUN_MIGRATIONS=true`** again so migrations still run at container start (see `backend/docker-entrypoint.sh`).
4. Under **Variables**, add the same vars as in `backend/.env.example`, plus **`VITE_CLERK_PUBLISHABLE_KEY`** (and optional `VITE_API_BASE_URL`) so the Docker build receives them.
5. Deploy; set `CORS_ORIGINS` / `FRONTEND_URL` to the generated public URL or custom domain.
6. **Healthcheck:** Railway probes `GET /health` (liveness). `/health/ready` checks the database. If the deploy fails with “healthcheck failed” but the build succeeded: confirm **`RUN_MIGRATIONS=false`** when using pre-deploy (so uvicorn starts before the healthcheck window); check **Deploy Logs** for DB errors, failed **pre-deploy** (Alembic), or no line `[entrypoint] starting uvicorn`; confirm **`DATABASE_URL`** and Postgres reachability.

### Port and 502 Bad Gateway

The container listens on **`0.0.0.0:$PORT`** (`docker-entrypoint.sh`); Railway injects **`PORT`**. Do **not** pin a conflicting `PORT` in variables unless it matches both what uvicorn logs on startup and what **Networking → Public** targets. A **502** from the edge usually means the proxy could not reach the process (wrong public port, crash, or nothing listening)—not an HTTP error from FastAPI. Confirm deploy logs show `[entrypoint] starting uvicorn on 0.0.0.0:<port>` and that `<port>` matches public networking.

**Edge logs showing `connection refused` and empty `upstreamAddress`:** the load balancer could not open a TCP connection to your replica at all (process not listening, exited, or wrong target port). This is **not** a response from FastAPI. Fix:

1. **Service → Settings → Deploy → Custom Start Command** must be **empty** so Railway uses the image **`ENTRYPOINT`** (`docker-entrypoint.sh`). If you set e.g. `uvicorn` manually without `cd /app/backend` and `PYTHONPATH`, the process can exit immediately → connection refused.
2. **Networking →** your **public port** must match the **`PORT`** value Railway injects (and the port in the deploy log line `starting uvicorn on 0.0.0.0:<port>`). Use **Generate Domain** / default wiring unless you know you need a custom mapping.
3. Open **Deployments →** latest deploy → **Deploy Logs** (not build logs): confirm **`[entrypoint] starting uvicorn`** appears and there is no exit right after (migration failure, import error, OOM). If the container restarts in a loop, fix the crash first.

### Debugging: what to look for in logs

| Symptom | Where to look |
|--------|----------------|
| Edge `connection refused` / empty upstream | **Custom Start Command** set (clear it), or crash before listen — **Deploy Logs** |
| Migrations fail on boot | `[entrypoint] ERROR: alembic failed` when `RUN_MIGRATIONS=true` |
| DB unreachable | `readiness check failed` (runtime) or connection errors near `alembic upgrade` |
| Wrong listen port | No `starting uvicorn` line, or port mismatch vs **Networking** |
| OOM / restarts | Exit code / restart loops in **Deployments** |

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

### Same image as Railway (smoke test)

From repo root (directory with `Dockerfile`):

```bash
docker build -t prediligence:test .
docker run --rm -e PORT=8080 -e DATABASE_URL="sqlite:////tmp/smoke.db" -e RUN_MIGRATIONS=false -p 8080:8080 prediligence:test
# In another shell:
curl -s http://127.0.0.1:8080/health
```

You should see JSON with `"status":"ok"`. If `PORT` is not `8000` and `/health` still returns 200, the image matches Railway’s dynamic port behavior.

Repeatable scripts (Docker on PATH): [`smoke-docker.ps1`](smoke-docker.ps1) (Windows) or [`smoke-docker.sh`](smoke-docker.sh) (Unix).

---

## CI deploy (optional)

`.github/workflows/deploy-fly.yml` runs on **workflow_dispatch** if `FLY_API_TOKEN` is set. Add repository secrets `VITE_CLERK_PUBLISHABLE_KEY` (and optionally extend the workflow to pass `--build-arg` from secrets) so production builds are not missing the Clerk key.

---

## TLS at your own edge

Use `nginx.example.conf` or `Caddyfile.example` when terminating TLS on a VM in front of Docker. Ensure `proxy_set_header X-Forwarded-Proto $scheme` (already in examples); uvicorn runs with `--proxy-headers`.
