@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "REPO_ROOT=%%~fI"
set "DEPS_DIR=%REPO_ROOT%\Dependencies"
set "VENDORED_NODE_MODULES=%DEPS_DIR%\node_modules"
set "VENDORED_PACKAGE=%DEPS_DIR%\package.json"
set "VENDORED_LOCK=%DEPS_DIR%\package-lock.json"
set "DEPENDENCY_MANIFEST=%DEPS_DIR%\application dependencies.txt"

echo [INFO] Offline build started.
echo [INFO] Repository root: %REPO_ROOT%
echo [INFO] Dependency bundle: %DEPS_DIR%

if not exist "%REPO_ROOT%\package.json" call :fail "Missing repository package.json: %REPO_ROOT%\package.json"
if not exist "%REPO_ROOT%\package-lock.json" call :fail "Missing repository package-lock.json: %REPO_ROOT%\package-lock.json"
if not exist "%DEPS_DIR%\" call :fail "Missing dependency directory: %DEPS_DIR%"
if not exist "%VENDORED_NODE_MODULES%\" call :fail "Missing vendored dependency tree: %VENDORED_NODE_MODULES%"
if not exist "%VENDORED_PACKAGE%" call :fail "Missing vendored package snapshot: %VENDORED_PACKAGE%"
if not exist "%VENDORED_LOCK%" call :fail "Missing vendored lockfile snapshot: %VENDORED_LOCK%"
if not exist "%DEPENDENCY_MANIFEST%" call :fail "Missing dependency manifest: %DEPENDENCY_MANIFEST%"

echo [INFO] Validating required commands...
where node >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: node"
where npm >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: npm"
where robocopy >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: robocopy"
where fc >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: fc"

for /f "usebackq delims=" %%I in (`node --version 2^>nul`) do set "NODE_VERSION_TEXT=%%I"
for /f "usebackq delims=" %%I in (`npm --version 2^>nul`) do set "NPM_VERSION_TEXT=%%I"

if not defined NODE_VERSION_TEXT call :fail "Unable to determine Node.js version."
if not defined NPM_VERSION_TEXT call :fail "Unable to determine npm version."

for /f "tokens=1-3 delims=v.-" %%A in ("%NODE_VERSION_TEXT%") do (
    set "NODE_MAJ=%%A"
    set "NODE_MIN=%%B"
    set "NODE_PATCH=%%C"
)
if not defined NODE_MIN set "NODE_MIN=0"
if not defined NODE_PATCH set "NODE_PATCH=0"

for /f "tokens=1-3 delims=v.-" %%A in ("%NPM_VERSION_TEXT%") do (
    set "NPM_MAJ=%%A"
    set "NPM_MIN=%%B"
    set "NPM_PATCH=%%C"
)
if not defined NPM_MIN set "NPM_MIN=0"
if not defined NPM_PATCH set "NPM_PATCH=0"

if %NODE_MAJ% LSS 18 call :fail "Node.js version %NODE_VERSION_TEXT% is below required minimum 18.17.0."
if %NODE_MAJ% EQU 18 if %NODE_MIN% LSS 17 call :fail "Node.js version %NODE_VERSION_TEXT% is below required minimum 18.17.0."
if %NPM_MAJ% LSS 8 call :fail "npm version %NPM_VERSION_TEXT% is below required minimum 8.0.0."

echo [INFO] Node.js: %NODE_VERSION_TEXT%
echo [INFO] npm:     %NPM_VERSION_TEXT%

echo [INFO] Validating vendored package snapshots match repository sources...
fc /b "%REPO_ROOT%\package.json" "%VENDORED_PACKAGE%" >nul
if errorlevel 2 call :fail "Unable to compare package.json with vendored snapshot."
if errorlevel 1 call :fail "package.json differs from Dependencies\package.json. Refresh vendored dependencies before compiling offline."

fc /b "%REPO_ROOT%\package-lock.json" "%VENDORED_LOCK%" >nul
if errorlevel 2 call :fail "Unable to compare package-lock.json with vendored snapshot."
if errorlevel 1 call :fail "package-lock.json differs from Dependencies\package-lock.json. Refresh vendored dependencies before compiling offline."

set "npm_config_offline=true"
set "npm_config_audit=false"
set "npm_config_fund=false"
set "npm_config_update_notifier=false"
set "NEXT_TELEMETRY_DISABLED=1"

echo [INFO] Step 1/3 - Restoring dependency tree from local bundle...
if not exist "%REPO_ROOT%\node_modules\" mkdir "%REPO_ROOT%\node_modules" >nul 2>nul
robocopy "%VENDORED_NODE_MODULES%" "%REPO_ROOT%\node_modules" /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS >nul
if errorlevel 8 call :fail "robocopy failed while restoring dependencies from Dependencies\node_modules."

echo [INFO] Step 2/3 - Building dependencies offline (npm rebuild)...
call npm rebuild --offline --no-audit --fund=false --loglevel=error
if errorlevel 1 call :fail "npm rebuild failed during offline dependency build step."

echo [INFO] Step 3/3 - Building application offline (npm run build)...
call npm run build --offline --no-audit --fund=false --loglevel=error
if errorlevel 1 call :fail "npm run build failed during offline application build step."

echo [SUCCESS] Offline dependency build and application build completed successfully.
exit /b 0

:fail
echo [ERROR] %~1
exit /b 1
