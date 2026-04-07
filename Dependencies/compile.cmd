@echo off
setlocal EnableExtensions

set "SKIP_INSTALL=0"
set "SKIP_BUILD=0"
set "REPO_ROOT="

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="-SkipDependencyInstall" (
    set "SKIP_INSTALL=1"
    shift
    goto parse_args
)
if /I "%~1"=="/SkipDependencyInstall" (
    set "SKIP_INSTALL=1"
    shift
    goto parse_args
)
if /I "%~1"=="-SkipBuild" (
    set "SKIP_BUILD=1"
    shift
    goto parse_args
)
if /I "%~1"=="/SkipBuild" (
    set "SKIP_BUILD=1"
    shift
    goto parse_args
)
if /I "%~1"=="/?" goto usage
if /I "%~1"=="-h" goto usage
if /I "%~1"=="--help" goto usage

echo ERROR: Unknown argument "%~1".
goto usage_error

:args_done
if exist "%CD%\package.json" (
    set "REPO_ROOT=%CD%"
)
if not defined REPO_ROOT if exist "%~dp0..\package.json" (
    for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
)
if not defined REPO_ROOT if exist "%~dp0package.json" (
    for %%I in ("%~dp0") do set "REPO_ROOT=%%~fI"
)
if not defined REPO_ROOT (
    echo ERROR: package.json not found. Run this script from inside the TSAAT repository.
    exit /b 1
)

cd /d "%REPO_ROOT%" >nul 2>nul
if errorlevel 1 (
    echo ERROR: Unable to access repository root.
    exit /b 1
)

echo [INFO] Checking required commands...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Required command "node" was not found in PATH.
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: Required command "npm" was not found in PATH.
    exit /b 1
)

for /f "usebackq delims=" %%I in (`node --version 2^>nul`) do set "NODE_VERSION_TEXT=%%I"
for /f "usebackq delims=" %%I in (`npm --version 2^>nul`) do set "NPM_VERSION_TEXT=%%I"

if not defined NODE_VERSION_TEXT (
    echo ERROR: Unable to read Node.js version.
    exit /b 1
)
if not defined NPM_VERSION_TEXT (
    echo ERROR: Unable to read npm version.
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
    echo ERROR: Node.js version %NODE_VERSION_TEXT% is below minimum 18.17.0.
    exit /b 1
)
if %NODE_MAJ% EQU 18 if %NODE_MIN% LSS 17 (
    echo ERROR: Node.js version %NODE_VERSION_TEXT% is below minimum 18.17.0.
    exit /b 1
)
if %NODE_MAJ% EQU 18 if %NODE_MIN% EQU 17 if %NODE_PATCH% LSS 0 (
    echo ERROR: Node.js version %NODE_VERSION_TEXT% is below minimum 18.17.0.
    exit /b 1
)

if %NPM_MAJ% LSS 8 (
    echo ERROR: npm version %NPM_VERSION_TEXT% is below minimum 8.0.0.
    exit /b 1
)

echo Node.js: %NODE_VERSION_TEXT%
echo npm:     %NPM_VERSION_TEXT%

if "%SKIP_INSTALL%"=="1" (
    echo [INFO] Skipping dependency install ^(requested^).
) else (
    echo [INFO] Installing npm dependencies...
    if exist "package-lock.json" (
        npm ci --legacy-peer-deps
        if errorlevel 1 (
            echo WARNING: npm ci failed. Retrying with npm install --legacy-peer-deps.
            npm install --legacy-peer-deps
            if errorlevel 1 (
                echo ERROR: Dependency install failed.
                echo If you saw EPERM or "operation not permitted", close running Node.js/Next.js processes and retry.
                echo Example: taskkill /F /IM node.exe
                exit /b 1
            )
        )
    ) else (
        npm install --legacy-peer-deps
        if errorlevel 1 (
            echo ERROR: Dependency install failed.
            echo If you saw EPERM or "operation not permitted", close running Node.js/Next.js processes and retry.
            echo Example: taskkill /F /IM node.exe
            exit /b 1
        )
    )
)

if "%SKIP_BUILD%"=="1" (
    echo [INFO] Skipping source compilation ^(requested^).
) else (
    echo [INFO] Compiling source code ^(npm run build^)...
    npm run build
    if errorlevel 1 (
        exit /b 1
    )
)

echo [INFO] Compilation workflow completed successfully.
exit /b 0

:usage
echo Usage:
echo   Dependencies\compile.cmd [-SkipDependencyInstall] [-SkipBuild]
exit /b 0

:usage_error
echo Usage:
echo   Dependencies\compile.cmd [-SkipDependencyInstall] [-SkipBuild]
exit /b 1

