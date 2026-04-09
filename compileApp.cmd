@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "REPO_ROOT=%%~fI"
set "DEPS_DIR=%REPO_ROOT%\Dependencies"
set "VENDORED_NODE_RUNTIME_DIR=%DEPS_DIR%\runtime\nodejs\win-x64"
set "VENDORED_NODE_EXE=%VENDORED_NODE_RUNTIME_DIR%\node.exe"
set "VENDORED_NPM_CMD=%VENDORED_NODE_RUNTIME_DIR%\npm.cmd"
set "VENDORED_NODE_MODULES=%DEPS_DIR%\node_modules"
set "VENDORED_NEXT_PACKAGE=%VENDORED_NODE_MODULES%\next\package.json"
set "VENDORED_PACKAGE=%DEPS_DIR%\package.json"
set "VENDORED_LOCK=%DEPS_DIR%\package-lock.json"
set "DEPENDENCY_MANIFEST=%DEPS_DIR%\application dependencies.txt"
if "%TSAAT_SQL_SERVER%"=="" set "TSAAT_SQL_SERVER=localhost\SQLEXPRESS"
if "%TSAAT_APP_DATABASE%"=="" set "TSAAT_APP_DATABASE=TSAAT"

echo [INFO] Offline build started.
echo [INFO] Repository root: %REPO_ROOT%
echo [INFO] Dependency bundle: %DEPS_DIR%

if not exist "%REPO_ROOT%\package.json" call :fail "Missing repository package.json: %REPO_ROOT%\package.json"
if not exist "%REPO_ROOT%\package-lock.json" call :fail "Missing repository package-lock.json: %REPO_ROOT%\package-lock.json"
if not exist "%DEPS_DIR%\" call :fail "Missing dependency directory: %DEPS_DIR%"
if not exist "%VENDORED_NODE_RUNTIME_DIR%\" call :fail "Missing vendored Node.js runtime directory: %VENDORED_NODE_RUNTIME_DIR%"
if not exist "%VENDORED_NODE_EXE%" call :fail "Missing vendored Node.js executable: %VENDORED_NODE_EXE%"
if not exist "%VENDORED_NPM_CMD%" call :fail "Missing vendored npm command: %VENDORED_NPM_CMD%"
if not exist "%VENDORED_NODE_MODULES%\" call :fail "Missing vendored dependency tree: %VENDORED_NODE_MODULES%"
if not exist "%VENDORED_NEXT_PACKAGE%" call :fail "Missing vendored Next.js package: %VENDORED_NEXT_PACKAGE%"
if not exist "%VENDORED_PACKAGE%" call :fail "Missing vendored package snapshot: %VENDORED_PACKAGE%"
if not exist "%VENDORED_LOCK%" call :fail "Missing vendored lockfile snapshot: %VENDORED_LOCK%"
if not exist "%DEPENDENCY_MANIFEST%" call :fail "Missing dependency manifest: %DEPENDENCY_MANIFEST%"

set "PATH=%VENDORED_NODE_RUNTIME_DIR%;%PATH%"

echo [INFO] Validating required commands...
where node >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: node"
where npm >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: npm"
where robocopy >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: robocopy"
where fc >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: fc"
where sqlcmd >nul 2>nul
if errorlevel 1 call :fail "Required command not found in PATH: sqlcmd"

for /f "usebackq delims=" %%I in (`"%VENDORED_NODE_EXE%" --version 2^>nul`) do set "NODE_VERSION_TEXT=%%I"
for /f "usebackq delims=" %%I in (`"%VENDORED_NPM_CMD%" --version 2^>nul`) do set "NPM_VERSION_TEXT=%%I"

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

echo [INFO] Bundled Node runtime: %VENDORED_NODE_RUNTIME_DIR%
echo [INFO] Node.js: %NODE_VERSION_TEXT%
echo [INFO] npm:     %NPM_VERSION_TEXT%
echo [INFO] SQL Server instance: %TSAAT_SQL_SERVER%
echo [INFO] SQL Server database: %TSAAT_APP_DATABASE%

echo [INFO] Validating SQL connectivity and required seeded tables...
sqlcmd -S "%TSAAT_SQL_SERVER%" -d "%TSAAT_APP_DATABASE%" -E -b -Q "SET NOCOUNT ON; IF OBJECT_ID(N'tsaat.dataset_snapshot', N'U') IS NULL THROW 51000, N'Missing required table tsaat.dataset_snapshot.', 1; IF NOT EXISTS (SELECT 1 FROM tsaat.dataset_snapshot) THROW 51000, N'tsaat.dataset_snapshot is empty. Run database load before compile.', 1; SELECT 1;" >nul 2>nul
if errorlevel 1 call :fail "Unable to validate required database state at %TSAAT_SQL_SERVER% / %TSAAT_APP_DATABASE%. Ensure the TSAAT database schema and seed data are loaded before offline build."

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
call "%VENDORED_NPM_CMD%" rebuild --offline --no-audit --fund=false --loglevel=error
if errorlevel 1 call :fail "npm rebuild failed during offline dependency build step."

echo [INFO] Step 3/3 - Building application offline (npm run build)...
call "%VENDORED_NPM_CMD%" run build --offline --no-audit --fund=false --loglevel=error
if errorlevel 1 call :fail "npm run build failed during offline application build step."

echo [SUCCESS] Offline dependency build and application build completed successfully.
exit /b 0

:fail
echo [ERROR] %~1
exit /b 1
