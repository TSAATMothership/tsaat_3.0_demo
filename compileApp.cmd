@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "REPO_ROOT=%%~fI"
set "DEPS_DIR=%REPO_ROOT%\Dependencies"
set "EXTERNAL_DEPS_DIR=%DEPS_DIR%\external"
set "VENDORED_NODE_RUNTIME_DIR=%DEPS_DIR%\runtime\nodejs\win-x64"
set "VENDORED_NODE_EXE=%VENDORED_NODE_RUNTIME_DIR%\node.exe"
set "VENDORED_NPM_CMD=%VENDORED_NODE_RUNTIME_DIR%\npm.cmd"
set "VENDORED_NPM_CLI_JS=%VENDORED_NODE_RUNTIME_DIR%\node_modules\npm\bin\npm-cli.js"
set "VENDORED_NODE_MODULES=%DEPS_DIR%\node_modules"
set "VENDORED_NEXT_PACKAGE=%VENDORED_NODE_MODULES%\next\package.json"
set "VENDORED_SWC_BINARY=%VENDORED_NODE_MODULES%\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node"
set "STAGED_SWC_BINARY=%EXTERNAL_DEPS_DIR%\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node"
set "RESTORED_SWC_PACKAGE_BINARY=%REPO_ROOT%\node_modules\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node"
set "RESTORED_SWC_FALLBACK_BINARY=%REPO_ROOT%\node_modules\next\next-swc-fallback\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node"
set "BUNDLED_SWC_TARBALL=%DEPS_DIR%\offline-artifacts\@next\swc-win32-x64-msvc-14.2.33.tgz"
set "BUNDLED_SWC_EXTRACT_DIR=%EXTERNAL_DEPS_DIR%\cache\swc-win32-x64-msvc-14.2.33"
set "BUNDLED_SWC_EXTRACTED_BINARY=%BUNDLED_SWC_EXTRACT_DIR%\package\next-swc.win32-x64-msvc.node"
set "MAX_REPO_FILE_BYTES=104857600"
set "REQUIRED_SWC_PACKAGE_NAME=@next/swc-win32-x64-msvc"
set "REQUIRED_SWC_PACKAGE_VERSION=14.2.33"
set "REQUIRED_SWC_BINARY_SIZE_BYTES=135864320"
set "REQUIRED_SWC_BINARY_SHA256=2CDDED4F290711FBD6911D880AA1A653519AF42C6139B9AE07C4D408A42B9B1B"
set "REQUIRED_SWC_TARBALL_SIZE_BYTES=41491235"
set "REQUIRED_SWC_TARBALL_SHA256=AB5D8BC3837EF28228FEBBED8AC51CB9E5E460B351ADCCF169B7EC7888127382"
set "REQUIRED_SWC_DOWNLOAD_URL=https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz"
set "VENDORED_PACKAGE=%DEPS_DIR%\package.json"
set "VENDORED_LOCK=%DEPS_DIR%\package-lock.json"
set "DEPENDENCY_MANIFEST=%DEPS_DIR%\application dependencies.txt"
set "SQLCMD_HELPER_SCRIPT=%REPO_ROOT%\scripts\ensure-sqlcmd-offline.ps1"
set "BUNDLED_SQLCMD_EXE="
set "BUNDLED_SQLCMD_DIR="
set "DB_CONFIG_FILE=%REPO_ROOT%\DB_config"
set "DB_CONF_SERVER="
set "DB_CONF_DATABASE="
set "DB_CONF_USER_ID="
set "DB_CONF_PASSWORD="
set "DB_CONF_TRUSTED_CONNECTION="
set "DB_CONF_ENCRYPT="
set "DB_CONF_TRUST_SERVER_CERTIFICATE="
set "TSAAT_SQL_AUTH_MODE="
set "TSAAT_SQL_ENCRYPT="
set "TSAAT_SQL_TRUST_SERVER_CERTIFICATE="
set "TSAAT_SQL_SSL_TYPE=disabled"
set "TSAAT_SQL_SSL_ARGS="
set "TSAAT_SQL_SERVER_TARGET="

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
if not exist "%VENDORED_NPM_CLI_JS%" (
    echo [ERROR] Missing vendored npm CLI payload: %VENDORED_NPM_CLI_JS%
    echo [ERROR] Refresh Dependencies\runtime\nodejs\win-x64 from an official Node.js Windows x64 bundle.
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
if not exist "%SQLCMD_HELPER_SCRIPT%" (
    echo [ERROR] Missing sqlcmd helper script: %SQLCMD_HELPER_SCRIPT%
    exit /b 1
)
if not exist "%VENDORED_NODE_MODULES%\" (
    echo [ERROR] Missing vendored dependency tree: %VENDORED_NODE_MODULES%
    exit /b 1
)
if not exist "%VENDORED_NEXT_PACKAGE%" (
    echo [ERROR] Missing vendored Next.js package metadata: %VENDORED_NEXT_PACKAGE%
    exit /b 1
)
if not exist "%BUNDLED_SWC_TARBALL%" (
    echo [ERROR] Missing bundled SWC artifact archive: %BUNDLED_SWC_TARBALL%
    echo [ERROR] Restore Dependencies\offline-artifacts to keep offline build self-contained.
    exit /b 1
)
if exist "%VENDORED_SWC_BINARY%" (
    for %%I in ("%VENDORED_SWC_BINARY%") do if %%~zI GTR %MAX_REPO_FILE_BYTES% (
        echo [ERROR] Large SWC binary detected in Dependencies\node_modules: %VENDORED_SWC_BINARY%
        echo [ERROR] Files over 100 MB must not be stored in repository dependency bundles.
        echo [ERROR] Move it to pre-staged external path: %STAGED_SWC_BINARY%
        exit /b 1
    )
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
where powershell >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Required command not found in PATH: powershell
    exit /b 1
)

echo [INFO] Resolving bundled sqlcmd executable...
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

if not exist "%DB_CONFIG_FILE%" (
    echo [ERROR] Missing DB config file: %DB_CONFIG_FILE%
    exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$line = Get-Content -LiteralPath '%DB_CONFIG_FILE%' | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } | Select-Object -First 1; if(-not $line){ throw 'DB_config is empty.' }; $map = @{}; foreach($segment in ($line -split ';')){ if($segment -match '^\s*([^=]+?)\s*=\s*(.*?)\s*$'){ $key = ($matches[1].Trim().ToLowerInvariant() -replace '[\s_]+',''); $map[$key] = $matches[2].Trim() } }; function Convert-Bool([string]$value, [string]$name){ if([string]::IsNullOrWhiteSpace($value)){ return $null }; $normalized = $value.Trim().ToLowerInvariant(); if($normalized -in @('true','1','yes','y','sspi')){ return $true }; if($normalized -in @('false','0','no','n')){ return $false }; throw ('DB_config ' + $name + ' value is invalid.') }; $server = $map['server']; $database = $map['database']; $userId = $map['userid']; if(-not $userId){ $userId = $map['uid'] }; $password = $map['password']; if(-not $password){ $password = $map['pwd'] }; $trusted = Convert-Bool $map['trustedconnection'] 'Trusted_Connection'; $encrypt = Convert-Bool $map['encrypt'] 'Encrypt'; $trustCert = Convert-Bool $map['trustservercertificate'] 'TrustServerCertificate'; if($trustCert -eq $true){ $encrypt = $true }; if(-not $server){ throw 'DB_config connection string missing Server=...'; }; if(-not $database){ throw 'DB_config connection string missing Database=...'; }; if([string]::IsNullOrWhiteSpace($userId) -xor [string]::IsNullOrWhiteSpace($password)){ throw 'DB_config requires both User Id and Password when SQL authentication is used.'; }; Write-Output ('set DB_CONF_SERVER=' + $server); Write-Output ('set DB_CONF_DATABASE=' + $database); if(-not [string]::IsNullOrWhiteSpace($userId)){ Write-Output ('set DB_CONF_USER_ID=' + $userId); Write-Output ('set DB_CONF_PASSWORD=' + $password) }; if($trusted -ne $null){ Write-Output ('set DB_CONF_TRUSTED_CONNECTION=' + ([string]$trusted).ToLowerInvariant()) }; if($encrypt -ne $null){ Write-Output ('set DB_CONF_ENCRYPT=' + ([string]$encrypt).ToLowerInvariant()) }; if($trustCert -ne $null){ Write-Output ('set DB_CONF_TRUST_SERVER_CERTIFICATE=' + ([string]$trustCert).ToLowerInvariant()) }"`) do %%I
if errorlevel 1 (
    echo [ERROR] Unable to parse DB_config.
    exit /b 1
)

if "%TSAAT_SQL_SERVER%"=="" set "TSAAT_SQL_SERVER=%DB_CONF_SERVER%"
if "%TSAAT_APP_DATABASE%"=="" set "TSAAT_APP_DATABASE=%DB_CONF_DATABASE%"
if "%TSAAT_SQL_USER%"=="" if /I not "%DB_CONF_TRUSTED_CONNECTION%"=="true" set "TSAAT_SQL_USER=%DB_CONF_USER_ID%"
if "%TSAAT_SQL_PASSWORD%"=="" if /I not "%DB_CONF_TRUSTED_CONNECTION%"=="true" set "TSAAT_SQL_PASSWORD=%DB_CONF_PASSWORD%"
if "%TSAAT_SQL_ENCRYPT%"=="" if not "%DB_CONF_ENCRYPT%"=="" set "TSAAT_SQL_ENCRYPT=%DB_CONF_ENCRYPT%"
if "%TSAAT_SQL_TRUST_SERVER_CERTIFICATE%"=="" if not "%DB_CONF_TRUST_SERVER_CERTIFICATE%"=="" set "TSAAT_SQL_TRUST_SERVER_CERTIFICATE=%DB_CONF_TRUST_SERVER_CERTIFICATE%"

if /I "%TSAAT_SQL_TRUSTED_CONNECTION%"=="true" (
    set "TSAAT_SQL_AUTH_MODE=trusted"
    set "TSAAT_SQL_USER="
    set "TSAAT_SQL_PASSWORD="
) else (
    if not "%TSAAT_SQL_USER%"=="" (
        if "%TSAAT_SQL_PASSWORD%"=="" (
            echo [ERROR] SQL authentication requires both TSAAT_SQL_USER and TSAAT_SQL_PASSWORD.
            exit /b 1
        )
        set "TSAAT_SQL_AUTH_MODE=sql"
    ) else (
        if not "%TSAAT_SQL_PASSWORD%"=="" (
            echo [ERROR] SQL authentication requires both TSAAT_SQL_USER and TSAAT_SQL_PASSWORD.
            exit /b 1
        )
        set "TSAAT_SQL_AUTH_MODE=trusted"
        if /I not "%DB_CONF_TRUSTED_CONNECTION%"=="true" (
            if "%DB_CONF_USER_ID%"=="" (
                echo [ERROR] No SQL credentials found in DB_config or environment.
                exit /b 1
            )
        )
    )
)

if "%TSAAT_SQL_SERVER%"=="" set "TSAAT_SQL_SERVER=localhost\SQLEXPRESS"
if "%TSAAT_APP_DATABASE%"=="" set "TSAAT_APP_DATABASE=TSAAT"
if /I "%TSAAT_SQL_TRUST_SERVER_CERTIFICATE%"=="true" set "TSAAT_SQL_ENCRYPT=true"
if /I not "%TSAAT_SQL_ENCRYPT%"=="true" set "TSAAT_SQL_TRUST_SERVER_CERTIFICATE=false"
if "%TSAAT_SQL_ENCRYPT%"=="" set "TSAAT_SQL_ENCRYPT=false"
if "%TSAAT_SQL_TRUST_SERVER_CERTIFICATE%"=="" set "TSAAT_SQL_TRUST_SERVER_CERTIFICATE=false"
if /I "%TSAAT_SQL_ENCRYPT%"=="true" (
    if /I "%TSAAT_SQL_TRUST_SERVER_CERTIFICATE%"=="true" (
        set "TSAAT_SQL_SSL_TYPE=trust-server-certificate"
        set "TSAAT_SQL_SSL_ARGS=-N -C"
    ) else (
        set "TSAAT_SQL_SSL_TYPE=strict"
        set "TSAAT_SQL_SSL_ARGS=-N"
    )
)
call :resolveSqlcmdServerTarget "%TSAAT_SQL_SERVER%" TSAAT_SQL_SERVER_TARGET
if errorlevel 1 (
    echo [ERROR] Unable to normalize SQL Server target for sqlcmd.
    exit /b 1
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
echo [INFO] Vendored dependency source: %VENDORED_NODE_MODULES%
echo [INFO] Required SWC package: %REQUIRED_SWC_PACKAGE_NAME%@%REQUIRED_SWC_PACKAGE_VERSION%
echo [INFO] Bundled SWC archive path: %BUNDLED_SWC_TARBALL%
echo [INFO] External staged SWC binary path (if needed): %STAGED_SWC_BINARY%
echo [INFO] Bundled sqlcmd path: %BUNDLED_SQLCMD_EXE%
echo [INFO] SQL Server instance: %TSAAT_SQL_SERVER%
echo [INFO] SQL Server target for sqlcmd: %TSAAT_SQL_SERVER_TARGET%
echo [INFO] SQL Server database: %TSAAT_APP_DATABASE%
echo [INFO] SQL authentication mode: %TSAAT_SQL_AUTH_MODE%
echo [INFO] SQL SSL mode: %TSAAT_SQL_SSL_TYPE%

echo [INFO] Validating SQL connectivity and required seeded tables...
if /I "%TSAAT_SQL_AUTH_MODE%"=="sql" (
    "%BUNDLED_SQLCMD_EXE%" -S "%TSAAT_SQL_SERVER_TARGET%" -d "%TSAAT_APP_DATABASE%" %TSAAT_SQL_SSL_ARGS% -U "%TSAAT_SQL_USER%" -P "%TSAAT_SQL_PASSWORD%" -b -Q "SET NOCOUNT ON; IF OBJECT_ID(N'tsaat.dataset_snapshot', N'U') IS NULL THROW 51000, N'Missing required table tsaat.dataset_snapshot.', 1; IF NOT EXISTS (SELECT 1 FROM tsaat.dataset_snapshot) THROW 51000, N'tsaat.dataset_snapshot is empty. Run database load before compile.', 1; SELECT 1;" >nul 2>nul
) else (
    "%BUNDLED_SQLCMD_EXE%" -S "%TSAAT_SQL_SERVER_TARGET%" -d "%TSAAT_APP_DATABASE%" %TSAAT_SQL_SSL_ARGS% -E -b -Q "SET NOCOUNT ON; IF OBJECT_ID(N'tsaat.dataset_snapshot', N'U') IS NULL THROW 51000, N'Missing required table tsaat.dataset_snapshot.', 1; IF NOT EXISTS (SELECT 1 FROM tsaat.dataset_snapshot) THROW 51000, N'tsaat.dataset_snapshot is empty. Run database load before compile.', 1; SELECT 1;" >nul 2>nul
)
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
if not exist "%REPO_ROOT%\node_modules\" mkdir "%REPO_ROOT%\node_modules" >nul 2>nul
robocopy "%VENDORED_NODE_MODULES%" "%REPO_ROOT%\node_modules" /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS >nul
if errorlevel 8 (
    echo [ERROR] robocopy failed while restoring dependencies from Dependencies\node_modules.
    exit /b 1
)
if not exist "%REPO_ROOT%\node_modules\next\package.json" (
    echo [ERROR] Restored dependency tree is missing Next.js package metadata at %REPO_ROOT%\node_modules\next\package.json.
    exit /b 1
)
if not exist "%STAGED_SWC_BINARY%" (
    call :extractBundledSwcArtifact
    if errorlevel 1 (
        exit /b 1
    )
)
if not exist "%RESTORED_SWC_PACKAGE_BINARY%" (
    if not exist "%RESTORED_SWC_FALLBACK_BINARY%" (
        if exist "%STAGED_SWC_BINARY%" (
            if not exist "%REPO_ROOT%\node_modules\@next\swc-win32-x64-msvc\" mkdir "%REPO_ROOT%\node_modules\@next\swc-win32-x64-msvc" >nul 2>nul
            copy /y "%STAGED_SWC_BINARY%" "%RESTORED_SWC_PACKAGE_BINARY%" >nul
            if errorlevel 1 (
                echo [ERROR] Failed to copy SWC binary from %STAGED_SWC_BINARY%.
                exit /b 1
            )
        )
    )
)
if not exist "%RESTORED_SWC_PACKAGE_BINARY%" (
    if not exist "%RESTORED_SWC_FALLBACK_BINARY%" (
        echo [ERROR] Missing required Next.js SWC binary for win32-x64.
        echo [ERROR] Expected either %RESTORED_SWC_PACKAGE_BINARY% or %RESTORED_SWC_FALLBACK_BINARY%.
        echo [ERROR] Pre-stage %STAGED_SWC_BINARY% before running compileApp.cmd.
        echo [ERROR] See README.md ^> Offline Build and Database Setup ^(Windows^) ^> Step 0.
        exit /b 1
    )
)
set "ACTIVE_SWC_BINARY="
set "ACTIVE_SWC_BINARY_SIZE="
set "ACTIVE_SWC_BINARY_SHA256="
if exist "%RESTORED_SWC_PACKAGE_BINARY%" (
    set "ACTIVE_SWC_BINARY=%RESTORED_SWC_PACKAGE_BINARY%"
) else (
    set "ACTIVE_SWC_BINARY=%RESTORED_SWC_FALLBACK_BINARY%"
)
for %%I in ("%ACTIVE_SWC_BINARY%") do set "ACTIVE_SWC_BINARY_SIZE=%%~zI"
if not "%ACTIVE_SWC_BINARY_SIZE%"=="%REQUIRED_SWC_BINARY_SIZE_BYTES%" (
    echo [ERROR] Unexpected Next.js SWC binary size at %ACTIVE_SWC_BINARY%.
    echo [ERROR] Expected %REQUIRED_SWC_BINARY_SIZE_BYTES% bytes for %REQUIRED_SWC_PACKAGE_NAME%@%REQUIRED_SWC_PACKAGE_VERSION%; found %ACTIVE_SWC_BINARY_SIZE% bytes.
    echo [ERROR] Re-stage the exact artifact from: %REQUIRED_SWC_DOWNLOAD_URL%
    exit /b 1
)
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-FileHash -LiteralPath '%ACTIVE_SWC_BINARY%' -Algorithm SHA256).Hash.ToUpperInvariant()"`) do set "ACTIVE_SWC_BINARY_SHA256=%%I"
if errorlevel 1 (
    echo [ERROR] Unable to compute SWC binary hash at %ACTIVE_SWC_BINARY%.
    exit /b 1
)
if /I not "%ACTIVE_SWC_BINARY_SHA256%"=="%REQUIRED_SWC_BINARY_SHA256%" (
    echo [ERROR] Unexpected Next.js SWC binary hash at %ACTIVE_SWC_BINARY%.
    echo [ERROR] Expected SHA-256: %REQUIRED_SWC_BINARY_SHA256%
    echo [ERROR] Actual SHA-256:   %ACTIVE_SWC_BINARY_SHA256%
    echo [ERROR] Re-stage the exact artifact from: %REQUIRED_SWC_DOWNLOAD_URL%
    exit /b 1
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

:resolveSqlcmdServerTarget
setlocal EnableDelayedExpansion
set "RAW_SERVER=%~1"
set "SERVER_TARGET=%RAW_SERVER%"
if /I "!SERVER_TARGET:~0,4!"=="tcp:" goto resolve_done
if /I "!SERVER_TARGET:~0,3!"=="np:" goto resolve_done
if /I "!SERVER_TARGET:~0,4!"=="lpc:" goto resolve_done

set "IS_LOCAL=false"
if /I "!SERVER_TARGET!"=="localhost" set "IS_LOCAL=true"
if /I "!SERVER_TARGET!"=="." set "IS_LOCAL=true"
if /I "!SERVER_TARGET!"=="(local)" set "IS_LOCAL=true"
if /I "!SERVER_TARGET:~0,10!"=="localhost\" set "IS_LOCAL=true"
if /I "!SERVER_TARGET:~0,2!"==".\" set "IS_LOCAL=true"
if /I "!SERVER_TARGET:~0,8!"=="(local)\" set "IS_LOCAL=true"
if /I "!IS_LOCAL!"=="true" set "SERVER_TARGET=lpc:!SERVER_TARGET!"

:resolve_done
endlocal & set "%~2=%SERVER_TARGET%"
exit /b 0

:extractBundledSwcArtifact
echo [INFO] Staged SWC binary not found. Extracting from bundled archive...
if not exist "%BUNDLED_SWC_TARBALL%" (
    echo [ERROR] Missing bundled SWC artifact archive: %BUNDLED_SWC_TARBALL%
    exit /b 1
)
set "BUNDLED_SWC_TARBALL_SIZE="
for %%I in ("%BUNDLED_SWC_TARBALL%") do set "BUNDLED_SWC_TARBALL_SIZE=%%~zI"
if not "%BUNDLED_SWC_TARBALL_SIZE%"=="%REQUIRED_SWC_TARBALL_SIZE_BYTES%" (
    echo [ERROR] Unexpected bundled SWC archive size at %BUNDLED_SWC_TARBALL%.
    echo [ERROR] Expected %REQUIRED_SWC_TARBALL_SIZE_BYTES% bytes; found %BUNDLED_SWC_TARBALL_SIZE% bytes.
    echo [ERROR] Re-acquire archive from: %REQUIRED_SWC_DOWNLOAD_URL%
    exit /b 1
)
set "BUNDLED_SWC_TARBALL_SHA256="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-FileHash -LiteralPath '%BUNDLED_SWC_TARBALL%' -Algorithm SHA256).Hash.ToUpperInvariant()"`) do set "BUNDLED_SWC_TARBALL_SHA256=%%I"
if errorlevel 1 (
    echo [ERROR] Unable to compute bundled SWC archive hash at %BUNDLED_SWC_TARBALL%.
    exit /b 1
)
if /I not "%BUNDLED_SWC_TARBALL_SHA256%"=="%REQUIRED_SWC_TARBALL_SHA256%" (
    echo [ERROR] Unexpected bundled SWC archive hash at %BUNDLED_SWC_TARBALL%.
    echo [ERROR] Expected SHA-256: %REQUIRED_SWC_TARBALL_SHA256%
    echo [ERROR] Actual SHA-256:   %BUNDLED_SWC_TARBALL_SHA256%
    echo [ERROR] Re-acquire archive from: %REQUIRED_SWC_DOWNLOAD_URL%
    exit /b 1
)
where tar >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Required command not found in PATH: tar
    echo [ERROR] Install Windows tar support or pre-stage %STAGED_SWC_BINARY%.
    exit /b 1
)
if not exist "%BUNDLED_SWC_EXTRACT_DIR%\" mkdir "%BUNDLED_SWC_EXTRACT_DIR%" >nul 2>nul
tar -xf "%BUNDLED_SWC_TARBALL%" -C "%BUNDLED_SWC_EXTRACT_DIR%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to extract bundled SWC archive: %BUNDLED_SWC_TARBALL%
    exit /b 1
)
if not exist "%BUNDLED_SWC_EXTRACTED_BINARY%" (
    echo [ERROR] Bundled SWC archive did not contain expected binary: %BUNDLED_SWC_EXTRACTED_BINARY%
    exit /b 1
)
if not exist "%EXTERNAL_DEPS_DIR%\@next\swc-win32-x64-msvc\" mkdir "%EXTERNAL_DEPS_DIR%\@next\swc-win32-x64-msvc" >nul 2>nul
copy /y "%BUNDLED_SWC_EXTRACTED_BINARY%" "%STAGED_SWC_BINARY%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to stage SWC binary from bundled archive.
    exit /b 1
)
exit /b 0
