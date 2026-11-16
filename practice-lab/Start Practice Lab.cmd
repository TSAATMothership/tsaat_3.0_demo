@echo off
setlocal
cd /d "%~dp0"
if not exist "runtime\node.exe" (
  echo Extract the complete TSAAT Practice Lab ZIP before starting.
  pause
  exit /b 1
)
"runtime\node.exe" "lab-host.cjs"
if errorlevel 1 pause

