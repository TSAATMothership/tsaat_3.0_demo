@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "REPO_ROOT=%%~fI"
set "DB_CONFIG_FILE=%REPO_ROOT%\DB_config"
set "BUILD_DATABASE_CMD=%REPO_ROOT%\buildDatabase.cmd"

set "DB_SERVER="
set "DB_ADMIN_DATABASE="
set "DB_TRUSTED_CONNECTION="
set "DB_APP_DATABASE="

echo [INFO] Offline database build started.
echo [INFO] Repository root: %REPO_ROOT%
echo [INFO] DB config file: %DB_CONFIG_FILE%

if not exist "%DB_CONFIG_FILE%" (
  call :fail "Missing DB config file: %DB_CONFIG_FILE%"
  exit /b 1
)
if not exist "%BUILD_DATABASE_CMD%" (
  call :fail "Missing database build entrypoint: %BUILD_DATABASE_CMD%"
  exit /b 1
)

where powershell >nul 2>nul
if errorlevel 1 (
  call :fail "Required command not found in PATH: powershell"
  exit /b 1
)
where sqlcmd >nul 2>nul
if errorlevel 1 (
  call :fail "Required command not found in PATH: sqlcmd"
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$line = Get-Content -LiteralPath '%DB_CONFIG_FILE%' | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } | Select-Object -First 1; if(-not $line){ throw 'DB_config is empty.' }; $map = @{}; foreach($segment in ($line -split ';')){ if($segment -match '^\s*([^=]+?)\s*=\s*(.*?)\s*$'){ $map[$matches[1].Trim().ToLowerInvariant()] = $matches[2].Trim() } }; if(-not $map['server']){ throw 'DB_config connection string missing Server=...'; }; if(-not $map['database']){ throw 'DB_config connection string missing Database=...'; }; if(-not $map['trusted_connection']){ throw 'DB_config connection string missing Trusted_Connection=...'; }; Write-Output ('set DB_SERVER=' + $map['server']); Write-Output ('set DB_ADMIN_DATABASE=' + $map['database']); Write-Output ('set DB_TRUSTED_CONNECTION=' + $map['trusted_connection']);"`) do %%I
if errorlevel 1 (
  call :fail "Unable to parse DB_config connection string."
  exit /b 1
)

if not defined DB_SERVER (
  call :fail "DB_config parsing did not produce DB_SERVER."
  exit /b 1
)
if not defined DB_ADMIN_DATABASE (
  call :fail "DB_config parsing did not produce DB_ADMIN_DATABASE."
  exit /b 1
)
if not defined DB_TRUSTED_CONNECTION (
  call :fail "DB_config parsing did not produce DB_TRUSTED_CONNECTION."
  exit /b 1
)
if /I not "%DB_TRUSTED_CONNECTION%"=="True" (
  call :fail "DB_config requires Trusted_Connection=True."
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$extra = Get-Content -LiteralPath '%DB_CONFIG_FILE%' | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } | Select-Object -Skip 1; foreach($line in $extra){ if($line -match '^(?<k>APP_DATABASE|APPLICATION_DATABASE|TSAAT_APP_DATABASE)\s*=\s*(?<v>.+)$'){ Write-Output ($matches['k'] + '=' + $matches['v'].Trim()) } }"`) do set "%%A=%%B"

if defined APP_DATABASE set "DB_APP_DATABASE=%APP_DATABASE%"
if defined APPLICATION_DATABASE set "DB_APP_DATABASE=%APPLICATION_DATABASE%"
if defined TSAAT_APP_DATABASE set "DB_APP_DATABASE=%TSAAT_APP_DATABASE%"

echo [INFO] SQL Server instance: %DB_SERVER%
echo [INFO] SQL admin database: %DB_ADMIN_DATABASE%
if defined DB_APP_DATABASE (
  echo [INFO] Application database override: %DB_APP_DATABASE%
) else (
  echo [INFO] Application database override: ^(not set, auto-discover from repository manifest^)
)

echo [INFO] Building schema and loading data...
if defined DB_APP_DATABASE (
  call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "%DB_ADMIN_DATABASE%" -DatabaseName "%DB_APP_DATABASE%"
) else (
  call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "%DB_ADMIN_DATABASE%"
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
