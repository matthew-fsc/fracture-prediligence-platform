# Local smoke test: same Docker image Railway builds — dynamic PORT and GET /health.
# Prerequisite: Docker Desktop (or engine) on PATH.
# Run from repo root: the directory that contains Dockerfile, frontend/, backend/

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "docker not found on PATH. Install Docker Desktop or add the engine to PATH."
}

Write-Host "Building image prediligence:smoke ..."
docker build -t prediligence:smoke .

# SQLite + no migrations: quick liveness check only (production uses Postgres + RUN_MIGRATIONS).
$listen = 18080
Write-Host "Starting container on PORT=$listen ..."
docker run -d --name prediligence-smoke `
    -e PORT=$listen `
    -e DATABASE_URL="sqlite:////tmp/smoke.db" `
    -e RUN_MIGRATIONS=false `
    -p "${listen}:${listen}" `
    prediligence:smoke

try {
    Start-Sleep -Seconds 6
    $url = "http://127.0.0.1:$listen/health"
    Write-Host "GET $url"
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    Write-Host $r.Content
    if ($r.StatusCode -ne 200) { exit 1 }
}
finally {
    docker rm -f prediligence-smoke 2>$null
}

Write-Host "Smoke OK: /health returned 200."
