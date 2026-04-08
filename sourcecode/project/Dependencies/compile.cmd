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
where robocopy >nul 2>nul
if errorlevel 1 (
    echo ERROR: Required command "robocopy" was not found in PATH.
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

set "SOURCECODE_ROOT=%REPO_ROOT%\sourcecode"
set "SOURCECODE_PROJECT=%SOURCECODE_ROOT%\project"
set "SOURCECODE_NODE_MODULES=%SOURCECODE_ROOT%\node_modules"

if "%SKIP_INSTALL%"=="1" (
    echo [INFO] Skipping dependency restore ^(requested^).
) else (
    if not exist "%SOURCECODE_ROOT%\" (
        echo ERROR: Offline source mirror was not found at "%SOURCECODE_ROOT%".
        echo Run Dependencies\sync-sourcecode.ps1 on a connected machine first.
        exit /b 1
    )
    if not exist "%SOURCECODE_PROJECT%\" (
        echo ERROR: Offline project source was not found at "%SOURCECODE_PROJECT%".
        echo Regenerate the mirror with Dependencies\sync-sourcecode.ps1.
        exit /b 1
    )
    if not exist "%SOURCECODE_PROJECT%\package.json" (
        echo ERROR: Offline project source is incomplete. Missing "%SOURCECODE_PROJECT%\package.json".
        exit /b 1
    )
    if not exist "%SOURCECODE_NODE_MODULES%\" (
        echo ERROR: Offline dependency source was not found at "%SOURCECODE_NODE_MODULES%".
        echo Regenerate the mirror with Dependencies\sync-sourcecode.ps1.
        exit /b 1
    )

    if not exist "%REPO_ROOT%\node_modules\" mkdir "%REPO_ROOT%\node_modules" >nul 2>nul
    echo [INFO] Restoring npm dependencies from sourcecode\node_modules...
    robocopy "%SOURCECODE_NODE_MODULES%" "%REPO_ROOT%\node_modules" /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS >nul
    if errorlevel 8 (
        echo ERROR: Failed to sync offline dependencies from sourcecode\node_modules.
        exit /b 1
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
