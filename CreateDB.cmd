@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "REPO_ROOT=%%~fI"
set "DB_CONFIG_FILE=%REPO_ROOT%\DB_config"
set "DB_CONFIG_ENSURE_SCRIPT=%REPO_ROOT%\scripts\ensure-db-config.ps1"
set "DB_CONFIG_HELPER_SCRIPT=%REPO_ROOT%\scripts\emit-db-config-env.ps1"
set "DB_LOAD_STAGING_SCRIPT=%REPO_ROOT%\scripts\stage-db-load-files.ps1"
set "BUILD_DATABASE_CMD=%REPO_ROOT%\buildDatabase.cmd"
set "DEPS_DIR=%REPO_ROOT%\Dependencies"
set "VENDORED_NODE_MODULES=%DEPS_DIR%\node_modules"
set "LOCAL_NODE_MODULES=%REPO_ROOT%\node_modules"
set "SQLCMD_HELPER_SCRIPT=%REPO_ROOT%\scripts\ensure-sqlcmd-offline.ps1"
set "BUNDLED_SQLCMD_EXE="
set "BUNDLED_SQLCMD_DIR="

set "DB_SERVER="
set "DB_APP_DATABASE="
set "DB_AUTH_MODE="
set "DB_USER_ID="
set "DB_PASSWORD="
set "DB_ENCRYPT=false"
set "DB_TRUST_SERVER_CERTIFICATE=false"
set "DB_SSL_MODE=disabled"
set "DB_SERVER_TARGET="
set "DATA_LOAD_MODE_ARG="
set "SQL_SERVER_STAGING_UNC_ROOT="
set "SQL_SERVER_PACKAGE_DATA_ROOT="
set "SQL_SERVER_SNAPSHOTS_ROOT="

echo [INFO] Offline database build started.
echo [INFO] Repository root: %REPO_ROOT%
echo [INFO] DB config file: %DB_CONFIG_FILE%

if not exist "%BUILD_DATABASE_CMD%" (
  call :fail "Missing database build entrypoint: %BUILD_DATABASE_CMD%"
  exit /b 1
)
if not exist "%DEPS_DIR%\" (
  call :fail "Missing dependency directory: %DEPS_DIR%"
  exit /b 1
)
if not exist "%VENDORED_NODE_MODULES%\" (
  call :fail "Missing offline dependency bundle: %VENDORED_NODE_MODULES%"
  exit /b 1
)
if not exist "%SQLCMD_HELPER_SCRIPT%" (
  call :fail "Missing sqlcmd helper script: %SQLCMD_HELPER_SCRIPT%"
  exit /b 1
)
if not exist "%DB_CONFIG_ENSURE_SCRIPT%" (
  call :fail "Missing DB config confirmation script: %DB_CONFIG_ENSURE_SCRIPT%"
  exit /b 1
)
if not exist "%DB_CONFIG_HELPER_SCRIPT%" (
  call :fail "Missing DB config helper script: %DB_CONFIG_HELPER_SCRIPT%"
  exit /b 1
)
if not exist "%DB_LOAD_STAGING_SCRIPT%" (
  call :fail "Missing DB load staging script: %DB_LOAD_STAGING_SCRIPT%"
  exit /b 1
)

where powershell >nul 2>nul
if errorlevel 1 (
  call :fail "Required command not found in PATH: powershell"
  exit /b 1
)

echo [INFO] Resolving bundled sqlcmd executable...
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%SQLCMD_HELPER_SCRIPT%" -RepoRoot "%REPO_ROOT%"`) do set "BUNDLED_SQLCMD_EXE=%%I"
if errorlevel 1 (
  call :fail "Failed to stage bundled sqlcmd executable."
  exit /b 1
)
if not defined BUNDLED_SQLCMD_EXE (
  call :fail "Bundled sqlcmd resolver returned an empty path."
  exit /b 1
)
if not exist "%BUNDLED_SQLCMD_EXE%" (
  call :fail "Bundled sqlcmd executable not found: %BUNDLED_SQLCMD_EXE%"
  exit /b 1
)
for %%I in ("%BUNDLED_SQLCMD_EXE%") do set "BUNDLED_SQLCMD_DIR=%%~dpI"
if "%BUNDLED_SQLCMD_DIR%"=="" (
  call :fail "Unable to resolve sqlcmd directory from: %BUNDLED_SQLCMD_EXE%"
  exit /b 1
)
set "SQLCMD_PATH=%BUNDLED_SQLCMD_EXE%"
set "PATH=%BUNDLED_SQLCMD_DIR%;%PATH%"
"%BUNDLED_SQLCMD_EXE%" -? >nul 2>nul
if errorlevel 1 (
  call :fail "Bundled sqlcmd failed self-check: %BUNDLED_SQLCMD_EXE%"
  exit /b 1
)
where robocopy >nul 2>nul
if errorlevel 1 (
  call :fail "Required command not found in PATH: robocopy"
  exit /b 1
)

echo [INFO] Ensuring local node_modules exists from offline dependency bundle...
if not exist "%LOCAL_NODE_MODULES%\" mkdir "%LOCAL_NODE_MODULES%" >nul 2>nul
robocopy "%VENDORED_NODE_MODULES%" "%LOCAL_NODE_MODULES%" /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS >nul
if errorlevel 8 (
  call :fail "Failed to restore local node_modules from %VENDORED_NODE_MODULES%."
  exit /b 1
)
echo [INFO] Local node_modules is ready for offline use.

echo [INFO] Confirming encrypted DB_config settings...
powershell -NoProfile -ExecutionPolicy Bypass -File "%DB_CONFIG_ENSURE_SCRIPT%" -RepoRoot "%REPO_ROOT%" -DbConfigPath "%DB_CONFIG_FILE%"
if errorlevel 1 (
  call :fail "Unable to validate or create encrypted DB_config."
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%DB_CONFIG_HELPER_SCRIPT%" -RepoRoot "%REPO_ROOT%" -DbConfigPath "%DB_CONFIG_FILE%"`) do %%I
if errorlevel 1 (
  call :fail "Unable to parse or decrypt confirmed DB_config."
  exit /b 1
)

if /I "%DB_AUTH_MODE%"=="" (
  if not "%DB_USER_ID%"=="" (
    if not "%DB_PASSWORD%"=="" (
      set "DB_AUTH_MODE=sql"
    )
  )
)
if /I "%DB_AUTH_MODE%"=="" set "DB_AUTH_MODE=trusted"
if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" set "DB_ENCRYPT=true"
if /I not "%DB_ENCRYPT%"=="true" set "DB_TRUST_SERVER_CERTIFICATE=false"
if "%DB_ENCRYPT%"=="" set "DB_ENCRYPT=false"
if "%DB_TRUST_SERVER_CERTIFICATE%"=="" set "DB_TRUST_SERVER_CERTIFICATE=false"
if "%DB_SERVER%"=="" set "DB_SERVER=localhost\\SQLEXPRESS"
if "%DB_APP_DATABASE%"=="" set "DB_APP_DATABASE=TSAAT"
if /I "%DB_ENCRYPT%"=="true" (
  if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" (
    set "DB_SSL_MODE=trust-server-certificate"
  ) else (
    set "DB_SSL_MODE=strict"
  )
)
call :resolveSqlcmdServerTarget "%DB_SERVER%" DB_SERVER_TARGET
if errorlevel 1 (
  call :fail "Unable to normalize SQL Server target for sqlcmd."
  exit /b 1
)

if not defined DB_SERVER (
  call :fail "DB_config parsing did not produce DB_SERVER."
  exit /b 1
)
if not defined DB_APP_DATABASE (
  call :fail "DB_config parsing did not produce DB_APP_DATABASE."
  exit /b 1
)
if not defined DB_AUTH_MODE (
  call :fail "DB_config parsing did not produce DB_AUTH_MODE."
  exit /b 1
)
if /I "%DB_AUTH_MODE%"=="sql" (
  if not defined DB_USER_ID (
    call :fail "DB_config SQL authentication requires User Id."
    exit /b 1
  )
  if not defined DB_PASSWORD (
    call :fail "DB_config SQL authentication requires Password."
    exit /b 1
  )
)

call :configureDataLoadMode
if errorlevel 1 exit /b 1

echo [INFO] SQL Server instance: %DB_SERVER%
echo [INFO] SQL Server target for sqlcmd: %DB_SERVER_TARGET%
echo [INFO] Application database: %DB_APP_DATABASE%
echo [INFO] Authentication mode: %DB_AUTH_MODE%
echo [INFO] SSL mode: %DB_SSL_MODE%
echo [INFO] Data load mode: %DATA_LOAD_MODE_ARG%
if /I "%DATA_LOAD_MODE_ARG%"=="SqlServerFiles" (
  echo [INFO] SQL Server staging UNC root: %SQL_SERVER_STAGING_UNC_ROOT%
  echo [INFO] SQL Server package data root: %SQL_SERVER_PACKAGE_DATA_ROOT%
  echo [INFO] SQL Server snapshots root: %SQL_SERVER_SNAPSHOTS_ROOT%
)
echo [INFO] Bundled sqlcmd path: %BUNDLED_SQLCMD_EXE%

echo [INFO] Building schema and loading data...
if /I "%DB_AUTH_MODE%"=="sql" (
  if /I "%DB_ENCRYPT%"=="true" (
    if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" (
      call :invokeBuildDatabase -ServerInstance "%DB_SERVER_TARGET%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -SqlUser "%DB_USER_ID%" -SqlPassword "%DB_PASSWORD%" -EncryptConnection -TrustServerCertificate
    ) else (
      call :invokeBuildDatabase -ServerInstance "%DB_SERVER_TARGET%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -SqlUser "%DB_USER_ID%" -SqlPassword "%DB_PASSWORD%" -EncryptConnection
    )
  ) else (
    call :invokeBuildDatabase -ServerInstance "%DB_SERVER_TARGET%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -SqlUser "%DB_USER_ID%" -SqlPassword "%DB_PASSWORD%"
  )
) else (
  if /I "%DB_ENCRYPT%"=="true" (
    if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" (
      call :invokeBuildDatabase -ServerInstance "%DB_SERVER_TARGET%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -UseTrustedConnection -EncryptConnection -TrustServerCertificate
    ) else (
      call :invokeBuildDatabase -ServerInstance "%DB_SERVER_TARGET%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -UseTrustedConnection -EncryptConnection
    )
  ) else (
    call :invokeBuildDatabase -ServerInstance "%DB_SERVER_TARGET%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -UseTrustedConnection
  )
)
if errorlevel 1 (
  call :fail "Database build/load failed."
  exit /b 1
)

echo [SUCCESS] Database schema and data load completed successfully.
echo [INFO] Validation summary: Database Schema\loaders\last-build-summary.txt
exit /b 0

:fail
echo [ERROR] %~1
exit /b 1

:configureDataLoadMode
set "DATA_LOAD_ASSUME_YES=false"
if /I "%TSAAT_DB_CONFIG_ASSUME_YES%"=="true" set "DATA_LOAD_ASSUME_YES=true"
set "DATA_LOAD_MODE_RAW=%TSAAT_DATA_LOAD_MODE%"
if not defined DATA_LOAD_MODE_RAW (
  if /I "%DATA_LOAD_ASSUME_YES%"=="true" set "DATA_LOAD_MODE_RAW=client-payload"
)
if not defined DATA_LOAD_MODE_RAW (
  echo [INFO] Select database data load mode:
  echo [INFO]   1^) ClientPayload - read local JSON on this machine and send quoted payloads to SQL Server.
  echo [INFO]   2^) SqlServerFiles - stage JSON files to a SQL-server-visible UNC path.
  set "DATA_LOAD_CHOICE="
  set /p "DATA_LOAD_CHOICE=Enter data load mode [1]: "
  if not defined DATA_LOAD_CHOICE set "DATA_LOAD_CHOICE=1"
  call set "DATA_LOAD_MODE_RAW=%%DATA_LOAD_CHOICE%%"
)
call :normalizeDataLoadMode "%DATA_LOAD_MODE_RAW%"
if errorlevel 1 exit /b 1

if /I "%DATA_LOAD_MODE_ARG%"=="SqlServerFiles" (
  set "SQL_SERVER_STAGING_UNC_ROOT=%TSAAT_SQL_SERVER_STAGING_UNC_ROOT%"
  if not defined SQL_SERVER_STAGING_UNC_ROOT (
    if /I "%DATA_LOAD_ASSUME_YES%"=="true" (
      call :fail "SqlServerFiles mode requires TSAAT_SQL_SERVER_STAGING_UNC_ROOT in unattended mode."
      exit /b 1
    ) else (
      echo [INFO] SqlServerFiles mode requires a UNC path the app server can write and the SQL Server service account can read.
      set /p "SQL_SERVER_STAGING_UNC_ROOT=SQL Server-visible UNC staging root: "
    )
  )
  if not defined SQL_SERVER_STAGING_UNC_ROOT (
    call :fail "SqlServerFiles mode requires TSAAT_SQL_SERVER_STAGING_UNC_ROOT or an interactive UNC staging root."
    exit /b 1
  )
  call :stageSqlServerFiles
  if errorlevel 1 exit /b 1
)
exit /b 0

:stageSqlServerFiles
echo [INFO] Staging SqlServerFiles JSON payloads to UNC path...
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%DB_LOAD_STAGING_SCRIPT%" -RepoRoot "%REPO_ROOT%" -StagingRoot "%SQL_SERVER_STAGING_UNC_ROOT%"`) do %%I
if errorlevel 1 (
  call :fail "Failed to stage SqlServerFiles payloads to UNC path."
  exit /b 1
)
if not defined SQL_SERVER_PACKAGE_DATA_ROOT (
  call :fail "DB load staging script did not return SQL_SERVER_PACKAGE_DATA_ROOT."
  exit /b 1
)
if not defined SQL_SERVER_SNAPSHOTS_ROOT (
  call :fail "DB load staging script did not return SQL_SERVER_SNAPSHOTS_ROOT."
  exit /b 1
)
echo [INFO] SqlServerFiles payload staging completed.
exit /b 0

:normalizeDataLoadMode
set "MODE_TO_NORMALIZE=%~1"
if /I "%MODE_TO_NORMALIZE%"=="1" set "DATA_LOAD_MODE_ARG=ClientPayload" & exit /b 0
if /I "%MODE_TO_NORMALIZE%"=="client-payload" set "DATA_LOAD_MODE_ARG=ClientPayload" & exit /b 0
if /I "%MODE_TO_NORMALIZE%"=="clientpayload" set "DATA_LOAD_MODE_ARG=ClientPayload" & exit /b 0
if /I "%MODE_TO_NORMALIZE%"=="ClientPayload" set "DATA_LOAD_MODE_ARG=ClientPayload" & exit /b 0
if /I "%MODE_TO_NORMALIZE%"=="2" set "DATA_LOAD_MODE_ARG=SqlServerFiles" & exit /b 0
if /I "%MODE_TO_NORMALIZE%"=="sql-server-files" set "DATA_LOAD_MODE_ARG=SqlServerFiles" & exit /b 0
if /I "%MODE_TO_NORMALIZE%"=="sqlserverfiles" set "DATA_LOAD_MODE_ARG=SqlServerFiles" & exit /b 0
if /I "%MODE_TO_NORMALIZE%"=="SqlServerFiles" set "DATA_LOAD_MODE_ARG=SqlServerFiles" & exit /b 0
call :fail "Invalid TSAAT_DATA_LOAD_MODE value: %MODE_TO_NORMALIZE%. Use client-payload or sql-server-files."
exit /b 1

:invokeBuildDatabase
setlocal
if /I "%DATA_LOAD_MODE_ARG%"=="SqlServerFiles" (
  call "%BUILD_DATABASE_CMD%" %* -DataLoadMode "%DATA_LOAD_MODE_ARG%" -SqlServerPackageDataRoot "%SQL_SERVER_PACKAGE_DATA_ROOT%" -SqlServerSnapshotsRoot "%SQL_SERVER_SNAPSHOTS_ROOT%"
) else (
  call "%BUILD_DATABASE_CMD%" %* -DataLoadMode "%DATA_LOAD_MODE_ARG%"
)
set "BUILD_DATABASE_EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %BUILD_DATABASE_EXIT_CODE%

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
