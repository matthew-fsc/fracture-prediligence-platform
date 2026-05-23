#!/usr/bin/env sh
# Local smoke test: same Docker image Railway builds — dynamic PORT and GET /health.
# Run from repo root: the directory that contains Dockerfile, frontend/, backend/

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Install Docker and ensure it is on PATH." >&2
  exit 1
fi

echo "Building image prediligence:smoke ..."
docker build -t prediligence:smoke .

LISTEN=18080
echo "Starting container on PORT=$LISTEN ..."
docker run -d --name prediligence-smoke \
  -e "PORT=$LISTEN" \
  -e "DATABASE_URL=sqlite:////tmp/smoke.db" \
  -e "RUN_MIGRATIONS=false" \
  -p "${LISTEN}:${LISTEN}" \
  prediligence:smoke

cleanup() { docker rm -f prediligence-smoke 2>/dev/null || true; }
trap cleanup EXIT

sleep 6
echo "GET http://127.0.0.1:${LISTEN}/health"
curl -sf "http://127.0.0.1:${LISTEN}/health"
echo ""
echo "Smoke OK: /health returned 200."
