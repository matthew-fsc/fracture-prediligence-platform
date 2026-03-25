@echo off
:: Fracture Pre-Diligence Platform — startup launcher
:: Starts the backend (FastAPI + React static files) on port 8002
:: Access at: http://localhost:8002

cd /d "%~dp0backend"
echo Starting Pre-Diligence Platform on http://localhost:8002 ...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
