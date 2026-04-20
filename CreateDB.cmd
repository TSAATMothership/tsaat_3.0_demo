@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "REPO_ROOT=%%~fI"
set "DB_CONFIG_FILE=%REPO_ROOT%\DB_config"
set "BUILD_DATABASE_CMD=%REPO_ROOT%\buildDatabase.cmd"
set "DEPS_DIR=%REPO_ROOT%\Dependencies"
set "VENDORED_NODE_MODULES=%DEPS_DIR%\node_modules"
set "LOCAL_NODE_MODULES=%REPO_ROOT%\node_modules"

set "DB_SERVER="
set "DB_APP_DATABASE="
set "DB_AUTH_MODE="
set "DB_USER_ID="
set "DB_PASSWORD="
set "DB_ENCRYPT=false"
set "DB_TRUST_SERVER_CERTIFICATE=false"
set "DB_SSL_MODE=disabled"

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
if not exist "%DEPS_DIR%\" (
  call :fail "Missing dependency directory: %DEPS_DIR%"
  exit /b 1
)
if not exist "%VENDORED_NODE_MODULES%\" (
  call :fail "Missing offline dependency bundle: %VENDORED_NODE_MODULES%"
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

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$line = Get-Content -LiteralPath '%DB_CONFIG_FILE%' | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } | Select-Object -First 1; if(-not $line){ throw 'DB_config is empty.' }; $map = @{}; foreach($segment in ($line -split ';')){ if($segment -match '^\s*([^=]+?)\s*=\s*(.*?)\s*$'){ $key = ($matches[1].Trim().ToLowerInvariant() -replace '[\s_]+',''); $map[$key] = $matches[2].Trim() } }; function Convert-Bool([string]$value, [string]$name){ if([string]::IsNullOrWhiteSpace($value)){ return $null }; $normalized = $value.Trim().ToLowerInvariant(); if($normalized -in @('true','1','yes','y','sspi')){ return $true }; if($normalized -in @('false','0','no','n')){ return $false }; throw ('DB_config ' + $name + ' value is invalid.') }; $server = $map['server']; $database = $map['database']; $userId = $map['userid']; if(-not $userId){ $userId = $map['uid'] }; $password = $map['password']; if(-not $password){ $password = $map['pwd'] }; $trusted = Convert-Bool $map['trustedconnection'] 'Trusted_Connection'; $encrypt = Convert-Bool $map['encrypt'] 'Encrypt'; $trustCert = Convert-Bool $map['trustservercertificate'] 'TrustServerCertificate'; if($trustCert -eq $true){ $encrypt = $true }; if(-not $server){ throw 'DB_config connection string missing Server=...'; }; if(-not $database){ throw 'DB_config connection string missing Database=...'; }; if([string]::IsNullOrWhiteSpace($userId) -xor [string]::IsNullOrWhiteSpace($password)){ throw 'DB_config requires both User Id and Password when SQL authentication is used.'; }; $isTrusted = $trusted -eq $true; Write-Output ('set DB_SERVER=' + $server); Write-Output ('set DB_APP_DATABASE=' + $database); if($isTrusted){ Write-Output 'set DB_AUTH_MODE=trusted' } elseif(-not [string]::IsNullOrWhiteSpace($userId)){ Write-Output 'set DB_AUTH_MODE=sql'; Write-Output ('set DB_USER_ID=' + $userId); Write-Output ('set DB_PASSWORD=' + $password) } else { throw 'DB_config must provide Trusted_Connection=True or User Id/Password.' }; if($encrypt -ne $null){ Write-Output ('set DB_ENCRYPT=' + ([string]$encrypt).ToLowerInvariant()) }; if($trustCert -ne $null){ Write-Output ('set DB_TRUST_SERVER_CERTIFICATE=' + ([string]$trustCert).ToLowerInvariant()) }"`) do %%I
if errorlevel 1 (
  call :fail "Unable to parse DB_config connection string."
  exit /b 1
)

if /I "%TSAAT_SQL_TRUSTED_CONNECTION%"=="true" (
  set "DB_AUTH_MODE=trusted"
  set "DB_USER_ID="
  set "DB_PASSWORD="
)
if not "%TSAAT_SQL_ENCRYPT%"=="" set "DB_ENCRYPT=%TSAAT_SQL_ENCRYPT%"
if not "%TSAAT_SQL_TRUST_SERVER_CERTIFICATE%"=="" set "DB_TRUST_SERVER_CERTIFICATE=%TSAAT_SQL_TRUST_SERVER_CERTIFICATE%"
if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" set "DB_ENCRYPT=true"
if /I not "%DB_ENCRYPT%"=="true" set "DB_TRUST_SERVER_CERTIFICATE=false"
if "%DB_ENCRYPT%"=="" set "DB_ENCRYPT=false"
if "%DB_TRUST_SERVER_CERTIFICATE%"=="" set "DB_TRUST_SERVER_CERTIFICATE=false"
if /I "%DB_ENCRYPT%"=="true" (
  if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" (
    set "DB_SSL_MODE=trust-server-certificate"
  ) else (
    set "DB_SSL_MODE=strict"
  )
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

echo [INFO] SQL Server instance: %DB_SERVER%
echo [INFO] Application database: %DB_APP_DATABASE%
echo [INFO] Authentication mode: %DB_AUTH_MODE%
echo [INFO] SSL mode: %DB_SSL_MODE%

echo [INFO] Building schema and loading data...
if /I "%DB_AUTH_MODE%"=="sql" (
  if /I "%DB_ENCRYPT%"=="true" (
    if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" (
      call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -SqlUser "%DB_USER_ID%" -SqlPassword "%DB_PASSWORD%" -EncryptConnection -TrustServerCertificate
    ) else (
      call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -SqlUser "%DB_USER_ID%" -SqlPassword "%DB_PASSWORD%" -EncryptConnection
    )
  ) else (
    call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -SqlUser "%DB_USER_ID%" -SqlPassword "%DB_PASSWORD%"
  )
) else (
  if /I "%DB_ENCRYPT%"=="true" (
    if /I "%DB_TRUST_SERVER_CERTIFICATE%"=="true" (
      call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -UseTrustedConnection -EncryptConnection -TrustServerCertificate
    ) else (
      call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -UseTrustedConnection -EncryptConnection
    )
  ) else (
    call "%BUILD_DATABASE_CMD%" -ServerInstance "%DB_SERVER%" -AdminDatabase "master" -DatabaseName "%DB_APP_DATABASE%" -UseTrustedConnection
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
