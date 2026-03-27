#!/bin/sh
set -e
# Railway injects PORT; the app must listen on 0.0.0.0:$PORT or the edge proxy returns 502.
LISTEN_PORT="${PORT:-8000}"
echo "[entrypoint] cwd=$(pwd) PORT=${LISTEN_PORT} RUN_MIGRATIONS=${RUN_MIGRATIONS:-}"

if [ "${RUN_MIGRATIONS:-}" = "true" ]; then
  echo "[entrypoint] alembic upgrade head"
  alembic upgrade head || {
    echo "[entrypoint] ERROR: alembic failed — fix DB/migrations or set RUN_MIGRATIONS=false" >&2
    exit 1
  }
  echo "[entrypoint] migrations ok"
fi

echo "[entrypoint] starting uvicorn on 0.0.0.0:${LISTEN_PORT}"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${LISTEN_PORT}" \
  --proxy-headers \
  --forwarded-allow-ips='*'
