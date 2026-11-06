[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][object]$Settings,
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
$builder['Integrated Security'] = $Settings.authMode -eq 'trusted'
if ($Settings.authMode -eq 'sql') {
  $builder['User ID'] = $Settings.userId
  $builder['Password'] = $Settings.password
}
$connection = New-Object System.Data.SqlClient.SqlConnection -ArgumentList $builder.ConnectionString
try {
  $connection.Open()
  $command = $connection.CreateCommand()
  $command.CommandText = 'SELECT CASE WHEN DB_ID(@name) IS NULL THEN 0 ELSE 1 END;'
  $null = $command.Parameters.Add('@name', [System.Data.SqlDbType]::NVarChar, 128)
  $command.Parameters['@name'].Value = $Settings.database
  $exists = [int]$command.ExecuteScalar() -eq 1
} catch {
  throw 'Cannot connect to SQL Server. Check the server/port, TCP/IP, authentication and selected certificate policy. No database was provisioned and DB_config was not saved.'
} finally { $connection.Dispose() }

if (-not $exists) {
  Write-Host "Create new database '$($Settings.database)' on '$($Settings.server)' with the application schema, reference data and bundled sample snapshots."
  if ($Interactive) {
    $answer = Read-Host 'Continue? [Y/n]'
    if ($answer.Trim() -notin @('', 'y', 'Y', 'yes', 'YES')) { throw 'Setup cancelled. DB_config was not saved.' }
  }
  $bootstrap = @{
    DatabaseName = $Settings.database
    ServerInstance = $server
    EncryptConnection = [bool]$Settings.sslEnabled
    TrustServerCertificate = ($Settings.sslEnabled -and $Settings.sslType -eq 'trust-server-certificate')
  }
  if ($Settings.authMode -eq 'sql') {
    $bootstrap.SqlUser = $Settings.userId
    $bootstrap.SqlPassword = $Settings.password
  }
  & (Join-Path $RepoRoot 'scripts/bootstrap-demo-database.ps1') @bootstrap
} else {
  Write-Host 'Existing database selected. Validating it without applying schema, migrations or sample data.'
}

# Reuse the application's connection, TLS and current-schema diagnostics. Pass
# credentials over stdin, never command-line arguments or a plaintext file.
$previousEncoding = $OutputEncoding
$previousTsconfig = $env:TSX_TSCONFIG_PATH
try {
  $OutputEncoding = New-Object System.Text.UTF8Encoding $false
  $env:TSX_TSCONFIG_PATH = Join-Path $RepoRoot 'scripts/tsconfig.database-cli.json'
  Push-Location -LiteralPath $RepoRoot
  try {
    $Settings | ConvertTo-Json -Compress | & node --import tsx scripts/validate-database-connection.ts
    if ($LASTEXITCODE -ne 0) {
      throw 'Database validation failed. DB_config was not saved. For an existing database, apply the reviewed missing migrations/imports separately; setup never rebuilds it. For a failed new build, inspect the incomplete database or retry with a new name.'
    }
  } finally { Pop-Location }
} finally {
  $OutputEncoding = $previousEncoding
  $env:TSX_TSCONFIG_PATH = $previousTsconfig
}
