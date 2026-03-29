@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Pre-Diligence Platform

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "PY=%BACKEND%\.venv\Scripts\python.exe"

call :ensure_python_cmd
if errorlevel 1 exit /b 1

if not exist "%BACKEND%\.env" (
  echo Creating backend\.env with SQLite for local development...
  (
    echo APP_ENV=development
    echo DATABASE_URL=sqlite:///./prediligence.db
    echo SECRET_KEY=dev-local-secret-change-me
    echo CORS_ORIGINS=http://localhost:8000,http://localhost:5173
    echo FRONTEND_URL=http://localhost:8000
  ) > "%BACKEND%\.env"
)

if exist "%BACKEND%\.venv\" if not exist "%PY%" (
  echo Removing incomplete backend\.venv ^(retrying clean venv^)...
  rmdir /s /q "%BACKEND%\.venv" 2>nul
)
if exist "%BACKEND%\.venv\" if not exist "%BACKEND%\.venv\Scripts\pip.exe" (
  echo Removing broken backend\.venv ^(missing pip — was likely created from the Store stub^)...
  rmdir /s /q "%BACKEND%\.venv" 2>nul
)

if not exist "%PY%" (
  echo.
  echo Creating Python virtual environment...
  echo This usually takes 30-90 seconds; antivirus scanning the folder can make it slower.
  echo.
  :: Prefer Windows "py" launcher — avoids the Microsoft Store "python" stub that can hang or open the Store.
  if defined VENV_CMD_PY (
    py -3 -m venv "%BACKEND%\.venv"
  ) else (
    python -m venv "%BACKEND%\.venv"
  )
  if errorlevel 1 (
    echo Failed to create venv.
    pause
    exit /b 1
  )
  if not exist "%PY%" (
    echo ERROR: venv did not create backend\.venv\Scripts\python.exe
    pause
    exit /b 1
  )
  echo Installing Python dependencies...
  "%BACKEND%\.venv\Scripts\pip.exe" install -r "%BACKEND%\requirements.txt"
  if errorlevel 1 (
    echo pip install failed.
    pause
    exit /b 1
  )
)

if not exist "%FRONTEND%\node_modules\" goto :need_node
if not exist "%FRONTEND%\dist\index.html" goto :need_node
goto :node_ok
:need_node
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not in PATH. Install from https://nodejs.org/ ^(needed for npm install / npm run build^).
  pause
  exit /b 1
)
:node_ok

if not exist "%FRONTEND%\node_modules\" (
  echo Installing frontend dependencies...
  pushd "%FRONTEND%"
  call npm install
  set "NPMERR=!errorlevel!"
  popd
  if not "!NPMERR!"=="0" (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist "%FRONTEND%\dist\index.html" (
  echo Building frontend ^(first run or missing dist^)...
  pushd "%FRONTEND%"
  call npm run build
  set "BUILDERR=!errorlevel!"
  popd
  if not "!BUILDERR!"=="0" (
    echo npm run build failed.
    pause
    exit /b 1
  )
)

echo.
echo Freeing port 8000 if in use...
:: Full `netstat -aon` can take a long time on busy systems; query only this port via PowerShell.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo.
echo Starting Pre-Diligence Platform...
echo  UI + API: http://localhost:8000
echo  After frontend edits, run rebuild-frontend.bat then restart this window.
echo.

cd /d "%BACKEND%"
"%PY%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
exit /b 0

:ensure_python_cmd
set "VENV_CMD_PY="
where py >nul 2>&1
if not errorlevel 1 (
  py -3 -c "import sys; assert sys.version_info[0]*100+sys.version_info[1] >= 311" >nul 2>&1
  if not errorlevel 1 (
    set "VENV_CMD_PY=1"
    exit /b 0
  )
)
where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python is not in PATH.
  echo Install Python 3.11+ from https://www.python.org/downloads/ and check "Add python.exe to PATH",
  echo or install the Python Launcher so `py -3` works.
  pause
  exit /b 1
)
set "FIRST_PY="
for /f "delims=" %%p in ('where python 2^>nul') do (
  set "FIRST_PY=%%p"
  goto :got_first_py
)
:got_first_py
echo %FIRST_PY% | findstr /i "WindowsApps" >nul
if not errorlevel 1 (
  echo ERROR: `python` points to the Microsoft Store stub ^(%FIRST_PY%^).
  echo That executable often hangs or opens the Store instead of running Python.
  echo Fix: Settings - Apps - Advanced app settings - App execution aliases: turn OFF python.exe / python3.exe,
  echo then install Python from https://www.python.org/downloads/ ^(Add to PATH^), or use `py -3` after installing the launcher.
  pause
  exit /b 1
)
exit /b 0
