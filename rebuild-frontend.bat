@echo off
:: Rebuilds the React frontend after code changes.
:: Run this after editing any frontend files.

title Rebuild Frontend

:: Ensure node is on PATH regardless of shell state
set PATH=C:\Users\mtbaj\AppData\Local\Programs\nodejs;%PATH%

cd /d "%~dp0frontend"
echo Rebuilding frontend...
call npm run build
echo.
echo Done. Restart start.bat if the server is running.
pause
