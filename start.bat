@echo off
:: Fracture Pre-Diligence Platform — startup launcher
:: Double-click to start. Access at: http://localhost:8000

title Pre-Diligence Platform

:: Kill anything already on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000 " ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo  Starting Pre-Diligence Platform...
echo  http://localhost:8000
echo.

cd /d "%~dp0backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
