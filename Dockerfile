# Multi-stage: build Vite SPA, then run FastAPI + static dist (same-origin).
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

# Vite bakes these into the static bundle at build time (not runtime).
# Same-origin Docker: leave VITE_API_BASE_URL empty so /api is relative to the browser origin.
# Clerk publishable key is safe to embed (public); must match backend CLERK_JWKS_URL instance.
ARG VITE_CLERK_PUBLISHABLE_KEY=
ARG VITE_API_BASE_URL=
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY --from=frontend-build /build/dist /app/frontend/dist

COPY backend/docker-entrypoint.sh /app/backend/docker-entrypoint.sh
RUN chmod +x /app/backend/docker-entrypoint.sh

ENV PYTHONPATH=/app/backend
WORKDIR /app/backend
# Do not set PORT here — Railway (and other hosts) inject PORT at runtime; uvicorn must bind to that value.
EXPOSE 8000

# DEPLOY-4: Container health check — orchestrators use this to detect unhealthy replicas.
# Uses /health (liveness, no DB) so the container is not killed during a slow DB migration.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

ENTRYPOINT ["/app/backend/docker-entrypoint.sh"]
# Explicit empty CMD: some hosts pass a start command as container args; keep entrypoint in control.
CMD []
