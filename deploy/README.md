# Hosting setup

The app supports **same-origin** (Docker image serves API + built SPA) and **split** (static frontend + API elsewhere). Repo root contains the `Dockerfile` (same-origin).

## Same-origin — Fly.io

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/), run `fly auth login`.
2. From repo root: `fly launch --no-deploy` (uses `fly.toml`; rename `app` in `fly.toml` if needed).
3. Create Postgres: `fly postgres create` or attach Neon/other and set `DATABASE_URL`:
   `fly secrets set DATABASE_URL="postgresql://..."`
4. Set remaining secrets (see README “Production deployment”):
   `fly secrets set APP_ENV=production SECRET_KEY="..." CORS_ORIGINS="https://your-app.fly.dev" FRONTEND_URL="https://your-app.fly.dev" CLERK_JWKS_URL="..." ...`
5. Deploy: `fly deploy`.
6. Optional first boot: `fly secrets set RUN_MIGRATIONS=true` then deploy once; then remove or set `false`.

Health checks: `GET /health` (liveness), `GET /health/ready` (DB).

## Same-origin — Render

1. Push this repo to GitHub/GitLab.
2. In Render: **New → Blueprint**, connect repo; select `render.yaml`.
3. Adjust service/database **names** and **plans** in `render.yaml` to match your account.
4. Add **secret** env vars in the Render dashboard (Render does not commit secrets): `SECRET_KEY`, `CLERK_*`, `STRIPE_*`, etc.
5. Ensure `DATABASE_URL` is wired from the Blueprint database or paste a managed URL.

## Same-origin — Railway

1. **New Project → Deploy from GitHub**, select repo; Railway detects `Dockerfile` / `railway.toml`.
2. Add **PostgreSQL** plugin or use external DB; set `DATABASE_URL`.
3. Set env vars in Railway UI (Variables tab).
4. Deploy; use generated public URL for `CORS_ORIGINS` and `FRONTEND_URL`.

## Split — Frontend on Vercel

1. Import repo in Vercel; set **Root Directory** to `frontend`.
2. Environment variables: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL=https://api.yourdomain.com` (your API origin, no trailing slash).
3. `frontend/vercel.json` provides SPA rewrites for client-side routes.
4. On the **API** host, set `CORS_ORIGINS` to your Vercel URL (e.g. `https://your-app.vercel.app`).

## CI deploy (optional)

`.github/workflows/deploy-fly.yml` runs on **workflow_dispatch** if `FLY_API_TOKEN` is configured in repository secrets.

## TLS at your own edge

Use `nginx.example.conf` or `Caddyfile.example` in this folder when terminating TLS on a VM in front of any PaaS or raw Docker.
