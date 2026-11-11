[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][object]$Settings,
  [Parameter(Mandatory = $true)][object]$Administrator,
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [switch]$Interactive
)
$ErrorActionPreference = 'Stop'

if ($Settings.database -notmatch '^[A-Za-z][A-Za-z0-9_]{0,127}$') {
  throw 'Database name must start with a letter and contain only letters, numbers and underscores (maximum 128 characters).'
}
if ($Settings.database -in @('master', 'model', 'msdb', 'tempdb')) {
  throw 'Select an application database, not a SQL Server system database.'
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'node_modules/tsx/package.json'))) {
  throw 'Application dependencies are missing. Run npm ci --offline, then retry npm run setup:database.'
}
# Check prerequisites before creating anything. No downloads or instance changes.
$null = Get-Command node -ErrorAction Stop
if ($env:SQLCMD_PATH) { $null = Resolve-Path -LiteralPath $env:SQLCMD_PATH -ErrorAction Stop }
else { $null = Get-Command sqlcmd -ErrorAction Stop }

$server = $Settings.server.Trim()
if ($Settings.sslEnabled) {
  if ($server -match '^(?i)(lpc|np):') { throw 'SSL requires TCP/IP. Use tcp:server,port with TCP/IP enabled on SQL Server.' }
  if ($server -notmatch '^(?i)tcp:') { $server = "tcp:$server" }
}
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = $server
$builder['Initial Catalog'] = 'master'
$builder['Connect Timeout'] = 15
$builder['Encrypt'] = [bool]$Settings.sslEnabled
$builder['TrustServerCertificate'] = $Settings.sslEnabled -and $Settings.sslType -eq 'trust-server-certificate'
$builder['Integrated Security'] = $Administrator.authMode -eq 'trusted'
if ($Administrator.authMode -eq 'sql') {
  $builder['User ID'] = $Administrator.userId
  $builder['Password'] = $Administrator.password
}
$connection = New-Object System.Data.SqlClient.SqlConnection -ArgumentList $builder.ConnectionString
try {
  $connection.Open()
  $command = $connection.CreateCommand()
  $command.CommandText = "SELECT CONVERT(nvarchar(10), database_id) + N'|' + CONVERT(nvarchar(23), create_date, 121) FROM sys.databases WHERE name = @name;"
  $null = $command.Parameters.Add('@name', [System.Data.SqlDbType]::NVarChar, 128)
  $command.Parameters['@name'].Value = $Settings.database
  $existingIdentity = [string]$command.ExecuteScalar()
  $exists = -not [string]::IsNullOrWhiteSpace($existingIdentity)
} catch {
  throw "Cannot connect to SQL Server at '$server' using the administrator connection with SSL disabled. Check the administrator credentials and SQL Server authentication mode. Rerun npm run setup:database and answer n to the localhost\SQLEXPRESS endpoint question to enter an explicit endpoint (tcp:server,port). No database was provisioned and DB_config was not saved."
} finally { $connection.Dispose() }

$loginPreflight = & (Join-Path $RepoRoot 'scripts/configure-database-user.ps1') -Settings $Settings -Administrator $Administrator -CheckOnly

if ($exists) {
  Write-Host "Database '$($Settings.database)' already exists on '$server'. Replacement permanently deletes all its data and saved settings, disconnects active sessions, and loads the bundled sample data. No backup is created."
  if ($Interactive) {
    $confirmation = Read-Host "Type $($Settings.database) to delete and replace this database, or press Enter to cancel"
  } else {
    $confirmation = $env:TSAAT_DB_REPLACE_EXISTING
  }
  if ($confirmation -cne $Settings.database) {
    throw 'Database replacement cancelled. No database was removed and DB_config was not saved. Unattended replacement requires TSAAT_DB_REPLACE_EXISTING set to the exact selected database name.'
  }
  & (Join-Path $RepoRoot 'scripts/remove-setup-database.ps1') -Settings $Settings -Administrator $Administrator -ExpectedIdentity $existingIdentity
} else {
  Write-Host "Create new database '$($Settings.database)' on '$($Settings.server)' with the application schema, reference data and bundled sample snapshots."
  if ($Interactive) {
    $answer = Read-Host 'Continue? [Y/n]'
    if ($answer.Trim() -notin @('', 'y', 'Y', 'yes', 'YES')) { throw 'Setup cancelled. DB_config was not saved.' }
  }
}
$bootstrap = @{
  DatabaseName = $Settings.database
  ServerInstance = $server
  EncryptConnection = [bool]$Settings.sslEnabled
  TrustServerCertificate = ($Settings.sslEnabled -and $Settings.sslType -eq 'trust-server-certificate')
}
if ($Administrator.authMode -eq 'sql') {
  $bootstrap.SqlUser = $Administrator.userId
  $bootstrap.SqlPassword = $Administrator.password
}
& (Join-Path $RepoRoot 'scripts/bootstrap-demo-database.ps1') @bootstrap

# Reuse the application's connection, TLS and current-schema diagnostics. Pass
# credentials over stdin, never command-line arguments or a plaintext file.
$previousEncoding = $OutputEncoding
$previousTsconfig = $env:TSX_TSCONFIG_PATH
try {
  $OutputEncoding = New-Object System.Text.UTF8Encoding $false
  $env:TSX_TSCONFIG_PATH = Join-Path $RepoRoot 'scripts/tsconfig.database-cli.json'
  Push-Location -LiteralPath $RepoRoot
  try {
    $adminValidation = [pscustomobject]@{
      server = $server; database = $Settings.database; authMode = $Administrator.authMode
      userId = $Administrator.userId; password = $Administrator.password
      sslEnabled = $false; sslType = 'strict'
    }
    $adminValidation | ConvertTo-Json -Compress | & node --import tsx scripts/validate-database-connection.ts
    if ($LASTEXITCODE -ne 0) {
      throw 'Database validation failed. DB_config was not saved. Inspect the incomplete database before retrying setup. A replaced database cannot be recovered by cancelling setup; restore your own backup if needed.'
    }
    & (Join-Path $RepoRoot 'scripts/configure-database-user.ps1') -Settings $Settings -Administrator $Administrator -VerifiedLoginSid $loginPreflight.LoginSid
    $Settings | ConvertTo-Json -Compress | & node --import tsx scripts/validate-database-connection.ts
    if ($LASTEXITCODE -ne 0) { throw 'Application login validation failed. DB_config was not saved. The database and login are retained for inspection; rerun with the same username and password after correcting access.' }
  } finally { Pop-Location }
} finally {
  $OutputEncoding = $previousEncoding
  $env:TSX_TSCONFIG_PATH = $previousTsconfig
}
