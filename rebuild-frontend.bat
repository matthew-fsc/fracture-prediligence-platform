@echo off
:: Rebuilds the React frontend after code changes.
:: Run this after editing any frontend files.

title Rebuild Frontend

cd /d "%~dp0frontend"
echo Rebuilding frontend...
call npm run build
echo.
echo Done. Restart start.bat if the server is running ^(http://localhost:8000^).
pause
