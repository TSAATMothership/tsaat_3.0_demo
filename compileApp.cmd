@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "REPO_ROOT=%%~fI"
set "DEPS_DIR=%REPO_ROOT%\Dependencies"
set "EXTERNAL_DEPS_DIR=%DEPS_DIR%\external"
set "VENDORED_NODE_RUNTIME_DIR=%DEPS_DIR%\runtime\nodejs\win-x64"
set "VENDORED_NODE_EXE=%VENDORED_NODE_RUNTIME_DIR%\node.exe"
set "VENDORED_NPM_CMD=%VENDORED_NODE_RUNTIME_DIR%\npm.cmd"
set "VENDORED_NODE_MODULES=%DEPS_DIR%\node_modules"
set "VENDORED_NODE_MODULES_ARCHIVE=%EXTERNAL_DEPS_DIR%\node_modules-win-x64.zip"
set "VENDORED_NEXT_PACKAGE=%VENDORED_NODE_MODULES%\next\package.json"
set "EXPECTED_SWC_PACKAGE_BINARY=%REPO_ROOT%\node_modules\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node"
set "EXPECTED_SWC_FALLBACK_BINARY=%REPO_ROOT%\node_modules\next\next-swc-fallback\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node"
set "VENDORED_PACKAGE=%DEPS_DIR%\package.json"
set "VENDORED_LOCK=%DEPS_DIR%\package-lock.json"
set "DEPENDENCY_MANIFEST=%DEPS_DIR%\application dependencies.txt"
if "%TSAAT_SQL_SERVER%"=="" set "TSAAT_SQL_SERVER=localhost\SQLEXPRESS"
if "%TSAAT_APP_DATABASE%"=="" set "TSAAT_APP_DATABASE=TSAAT"

echo [INFO] Offline build started.
echo [INFO] Repository root: %REPO_ROOT%
echo [INFO] Dependency bundle: %DEPS_DIR%

if not exist "%REPO_ROOT%\package.json" (
    echo [ERROR] Missing repository package.json: %REPO_ROOT%\package.json
    exit /b 1
)
if not exist "%REPO_ROOT%\package-lock.json" (
    echo [ERROR] Missing repository package-lock.json: %REPO_ROOT%\package-lock.json
    exit /b 1
)
if not exist "%DEPS_DIR%\" (
    echo [ERROR] Missing dependency directory: %DEPS_DIR%
    exit /b 1
)
if not exist "%VENDORED_NODE_RUNTIME_DIR%\" (
    echo [ERROR] Missing vendored Node.js runtime directory: %VENDORED_NODE_RUNTIME_DIR%
    exit /b 1
)
if not exist "%VENDORED_NODE_EXE%" (
    echo [ERROR] Missing vendored Node.js executable: %VENDORED_NODE_EXE%
    exit /b 1
)
if not exist "%VENDORED_NPM_CMD%" (
    echo [ERROR] Missing vendored npm command: %VENDORED_NPM_CMD%
    exit /b 1
)
if not exist "%VENDORED_PACKAGE%" (
    echo [ERROR] Missing vendored package snapshot: %VENDORED_PACKAGE%
    exit /b 1
)
if not exist "%VENDORED_LOCK%" (
    echo [ERROR] Missing vendored lockfile snapshot: %VENDORED_LOCK%
    exit /b 1
)
if not exist "%DEPENDENCY_MANIFEST%" (
    echo [ERROR] Missing dependency manifest: %DEPENDENCY_MANIFEST%
    exit /b 1
)

set "DEPENDENCY_SOURCE="
if exist "%VENDORED_NEXT_PACKAGE%" set "DEPENDENCY_SOURCE=folder"
if not defined DEPENDENCY_SOURCE if exist "%VENDORED_NODE_MODULES_ARCHIVE%" set "DEPENDENCY_SOURCE=archive"
if not defined DEPENDENCY_SOURCE (
    echo [ERROR] Missing vendored dependencies.
    echo [ERROR] Provide %VENDORED_NODE_MODULES% with Next.js or pre-stage %VENDORED_NODE_MODULES_ARCHIVE%.
    echo [ERROR] See README.md ^> Offline Build and Database Setup ^(Windows^) ^> Step 0.
    exit /b 1
)

set "PATH=%VENDORED_NODE_RUNTIME_DIR%;%PATH%"

echo [INFO] Validating required commands...
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Required command not found in PATH: node
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Required command not found in PATH: npm
    exit /b 1
)
where robocopy >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Required command not found in PATH: robocopy
    exit /b 1
)
where fc >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Required command not found in PATH: fc
    exit /b 1
)
where sqlcmd >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Required command not found in PATH: sqlcmd
    exit /b 1
)
if /I "%DEPENDENCY_SOURCE%"=="archive" (
    where powershell >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Required command not found in PATH: powershell
        exit /b 1
    )
)

for /f "usebackq delims=" %%I in (`"%VENDORED_NODE_EXE%" --version 2^>nul`) do set "NODE_VERSION_TEXT=%%I"
for /f "usebackq delims=" %%I in (`"%VENDORED_NPM_CMD%" --version 2^>nul`) do set "NPM_VERSION_TEXT=%%I"

if not defined NODE_VERSION_TEXT (
    echo [ERROR] Unable to determine Node.js version.
    exit /b 1
)
if not defined NPM_VERSION_TEXT (
    echo [ERROR] Unable to determine npm version.
    exit /b 1
)

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

if %NODE_MAJ% LSS 18 (
    echo [ERROR] Node.js version %NODE_VERSION_TEXT% is below required minimum 18.17.0.
    exit /b 1
)
if %NODE_MAJ% EQU 18 (
    if %NODE_MIN% LSS 17 (
        echo [ERROR] Node.js version %NODE_VERSION_TEXT% is below required minimum 18.17.0.
        exit /b 1
    )
)
if %NPM_MAJ% LSS 8 (
    echo [ERROR] npm version %NPM_VERSION_TEXT% is below required minimum 8.0.0.
    exit /b 1
)

echo [INFO] Bundled Node runtime: %VENDORED_NODE_RUNTIME_DIR%
echo [INFO] Node.js: %NODE_VERSION_TEXT%
echo [INFO] npm:     %NPM_VERSION_TEXT%
if /I "%DEPENDENCY_SOURCE%"=="folder" (
    echo [INFO] Vendored dependency source: %VENDORED_NODE_MODULES%
) else (
    echo [INFO] Vendored dependency source: %VENDORED_NODE_MODULES_ARCHIVE%
)
echo [INFO] SQL Server instance: %TSAAT_SQL_SERVER%
echo [INFO] SQL Server database: %TSAAT_APP_DATABASE%

echo [INFO] Validating SQL connectivity and required seeded tables...
sqlcmd -S "%TSAAT_SQL_SERVER%" -d "%TSAAT_APP_DATABASE%" -E -b -Q "SET NOCOUNT ON; IF OBJECT_ID(N'tsaat.dataset_snapshot', N'U') IS NULL THROW 51000, N'Missing required table tsaat.dataset_snapshot.', 1; IF NOT EXISTS (SELECT 1 FROM tsaat.dataset_snapshot) THROW 51000, N'tsaat.dataset_snapshot is empty. Run database load before compile.', 1; SELECT 1;" >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Unable to validate required database state at %TSAAT_SQL_SERVER% / %TSAAT_APP_DATABASE%. Ensure the TSAAT database schema and seed data are loaded before offline build.
    exit /b 1
)

echo [INFO] Validating vendored package snapshots match repository sources...
fc /b "%REPO_ROOT%\package.json" "%VENDORED_PACKAGE%" >nul
if errorlevel 2 (
    echo [ERROR] Unable to compare package.json with vendored snapshot.
    exit /b 1
)
if errorlevel 1 (
    echo [ERROR] package.json differs from Dependencies\package.json. Refresh vendored dependencies before compiling offline.
    exit /b 1
)

fc /b "%REPO_ROOT%\package-lock.json" "%VENDORED_LOCK%" >nul
if errorlevel 2 (
    echo [ERROR] Unable to compare package-lock.json with vendored snapshot.
    exit /b 1
)
if errorlevel 1 (
    echo [ERROR] package-lock.json differs from Dependencies\package-lock.json. Refresh vendored dependencies before compiling offline.
    exit /b 1
)

set "npm_config_offline=true"
set "npm_config_audit=false"
set "npm_config_fund=false"
set "npm_config_update_notifier=false"
set "NEXT_TELEMETRY_DISABLED=1"
set "NEXT_DISABLE_SWC_DOWNLOAD=1"
set "NEXT_SKIP_SWC_DOWNLOAD=1"

echo [INFO] Step 1/3 - Restoring dependency tree from local bundle...
if /I "%DEPENDENCY_SOURCE%"=="folder" (
    if not exist "%REPO_ROOT%\node_modules\" mkdir "%REPO_ROOT%\node_modules" >nul 2>nul
    robocopy "%VENDORED_NODE_MODULES%" "%REPO_ROOT%\node_modules" /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS >nul
    if errorlevel 8 (
        echo [ERROR] robocopy failed while restoring dependencies from Dependencies\node_modules.
        exit /b 1
    )
) else (
    if exist "%REPO_ROOT%\node_modules\" (
        rmdir /s /q "%REPO_ROOT%\node_modules"
        if exist "%REPO_ROOT%\node_modules\" (
            echo [ERROR] Unable to clean existing node_modules before archive restore.
            exit /b 1
        )
    )
    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%VENDORED_NODE_MODULES_ARCHIVE%' -DestinationPath '%REPO_ROOT%' -Force"
    if errorlevel 1 (
        echo [ERROR] Failed to extract vendored dependency archive: %VENDORED_NODE_MODULES_ARCHIVE%
        exit /b 1
    )
)
if not exist "%REPO_ROOT%\node_modules\next\package.json" (
    echo [ERROR] Restored dependency tree is missing Next.js package metadata at %REPO_ROOT%\node_modules\next\package.json.
    exit /b 1
)
if not exist "%EXPECTED_SWC_PACKAGE_BINARY%" (
    if not exist "%EXPECTED_SWC_FALLBACK_BINARY%" (
        echo [ERROR] Missing required Next.js SWC binary for win32-x64.
        echo [ERROR] Expected either %EXPECTED_SWC_PACKAGE_BINARY% or %EXPECTED_SWC_FALLBACK_BINARY%.
        echo [ERROR] Re-stage the full offline dependency bundle before running compileApp.cmd.
        exit /b 1
    )
)

echo [INFO] Step 2/3 - Building dependencies offline (npm rebuild)...
call "%VENDORED_NPM_CMD%" rebuild --offline --no-audit --fund=false --loglevel=error
if errorlevel 1 (
    echo [ERROR] npm rebuild failed during offline dependency build step.
    exit /b 1
)

echo [INFO] Step 3/3 - Building application offline (npm run build)...
call "%VENDORED_NPM_CMD%" run build --offline --no-audit --fund=false --loglevel=error
if errorlevel 1 (
    echo [ERROR] npm run build failed during offline application build step.
    exit /b 1
)

echo [SUCCESS] Offline dependency build and application build completed successfully.
exit /b 0
