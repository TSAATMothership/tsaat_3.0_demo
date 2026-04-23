@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "SQLCMD_HELPER_SCRIPT=%REPO_ROOT%\scripts\ensure-sqlcmd-offline.ps1"
set "BUNDLED_SQLCMD_EXE="
set "BUNDLED_SQLCMD_DIR="

if not exist "%SQLCMD_HELPER_SCRIPT%" (
  echo [ERROR] Missing sqlcmd helper script: %SQLCMD_HELPER_SCRIPT%
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%SQLCMD_HELPER_SCRIPT%" -RepoRoot "%REPO_ROOT%"`) do set "BUNDLED_SQLCMD_EXE=%%I"
if errorlevel 1 (
  echo [ERROR] Failed to stage bundled sqlcmd executable.
  exit /b 1
)
if not defined BUNDLED_SQLCMD_EXE (
  echo [ERROR] Bundled sqlcmd resolver returned an empty path.
  exit /b 1
)
if not exist "%BUNDLED_SQLCMD_EXE%" (
  echo [ERROR] Bundled sqlcmd executable not found: %BUNDLED_SQLCMD_EXE%
  exit /b 1
)
for %%I in ("%BUNDLED_SQLCMD_EXE%") do set "BUNDLED_SQLCMD_DIR=%%~dpI"
if "%BUNDLED_SQLCMD_DIR%"=="" (
  echo [ERROR] Unable to resolve sqlcmd directory from: %BUNDLED_SQLCMD_EXE%
  exit /b 1
)
set "SQLCMD_PATH=%BUNDLED_SQLCMD_EXE%"
set "PATH=%BUNDLED_SQLCMD_DIR%;%PATH%"
"%BUNDLED_SQLCMD_EXE%" -? >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Bundled sqlcmd failed self-check: %BUNDLED_SQLCMD_EXE%
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%build-and-load-database.ps1" %*
if errorlevel 1 exit /b %errorlevel%
endlocal

