@echo off
setlocal
cd /d "%~dp0frontend"
where npm >nul 2>nul
if errorlevel 1 (echo Node.js/npm not found. Install Node.js from https://nodejs.org/ & pause & exit /b 1)
if not exist node_modules (
  echo Installing frontend packages...
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 exit /b 1
)
echo Starting Doneeo React at http://localhost:5173
call npm.cmd run dev -- --host localhost --port 5173 --strictPort
pause
