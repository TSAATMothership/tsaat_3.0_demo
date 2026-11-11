[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z][A-Za-z0-9_]{0,127}$')][string]$DatabaseName,
  [string]$ServerInstance = 'localhost\SQLEXPRESS',
  [switch]$EncryptConnection = $true,
  [switch]$TrustServerCertificate = $true,
  [string]$SqlUser,
  [string]$SqlPassword
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if ($DatabaseName -in @('master', 'model', 'msdb', 'tempdb')) { throw 'Select a new application database, not a system database.' }
if ([string]::IsNullOrWhiteSpace($SqlUser) -xor [string]::IsNullOrWhiteSpace($SqlPassword)) { throw 'Both SqlUser and SqlPassword are required for SQL authentication.' }
$sqlcmd = if ($env:SQLCMD_PATH) { (Resolve-Path -LiteralPath $env:SQLCMD_PATH).Path } else { (Get-Command sqlcmd -ErrorAction Stop).Source }
$target = $ServerInstance
if ($EncryptConnection -or $TrustServerCertificate) {
  if ($target -match '^(?i)(lpc|np):') { throw 'SSL requires TCP/IP. Use tcp:server,port.' }
  if ($target -notmatch '^(?i)tcp:') { $target = "tcp:$target" }
} elseif ($target -match '^(localhost|\.|\(local\))(\\|$)') { $target = "lpc:$target" }
$connection = @('-S', $target, '-b', '-l', '15')
if ($SqlUser) { $connection += @('-U', $SqlUser) } else { $connection += '-E' }
if ($EncryptConnection -or $TrustServerCertificate) { $connection += '-N' }
if ($TrustServerCertificate) { $connection += '-C' }
$previousPassword = $env:SQLCMDPASSWORD
try {
if ($SqlUser) { $env:SQLCMDPASSWORD = $SqlPassword }
# This entrypoint only provisions a NEW demo database. Existing data is never reloaded here.
$query = "SET NOCOUNT ON; IF DB_ID(N'$DatabaseName') IS NOT NULL THROW 51000, 'Database already exists. Choose a new demo database name. Use reviewed migrations for an existing database.', 1;"
& $sqlcmd @connection '-d' 'master' '-Q' $query
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; database provisioning was not started.' }
& (Join-Path $repoRoot 'Database Schema/loaders/build-and-load-database.ps1') -DatabaseName $DatabaseName -ServerInstance $target -SqlUser $SqlUser -SqlPassword $SqlPassword -EncryptConnection:($EncryptConnection -or $TrustServerCertificate) -TrustServerCertificate:$TrustServerCertificate -DataLoadMode ClientPayload -RequireNewDatabase
if ($LASTEXITCODE -ne 0) { throw 'Demo database provisioning failed.' }
# This demonstration-only backfill must run after snapshot import.
& $sqlcmd @connection '-d' $DatabaseName '-i' (Join-Path $repoRoot 'Database Schema/migrations/026_populate_demo_entity_panel_details.sql')
if ($LASTEXITCODE -ne 0) { throw 'Demo contact backfill failed.' }
# The guarded bootstrap has created a NEW disposable sample database. Populate
# the same reviewed CVE inventory examples used by fresh JSON stores.
function Invoke-SamplePopulation {
  param([string]$FileName, [string]$SessionKey)
  # Embedded JSON quotes must reach SQL unchanged on Windows. A SQL input file
  # avoids native command-line quote stripping and command length limits.
  $temporarySql = [IO.Path]::GetTempFileName()
  try {
    $populationSql = Get-Content -LiteralPath (Join-Path $repoRoot "Database Schema/loaders/$FileName") -Raw
    ("EXEC sys.sp_set_session_context @key=N'$SessionKey', @value=1;`r`nGO`r`n" + $populationSql) | Set-Content -LiteralPath $temporarySql -Encoding UTF8
    & $sqlcmd @connection '-d' $DatabaseName '-i' $temporarySql
    if ($LASTEXITCODE -ne 0) { throw "Sample population failed: $FileName" }
  } finally { Remove-Item -LiteralPath $temporarySql -Force -ErrorAction SilentlyContinue }
}
Invoke-SamplePopulation -FileName 'populate-sample-cve-metadata.sql' -SessionKey 'TSAAT_SAMPLE_CVE_METADATA'
Write-Host "Database '$DatabaseName' schema and bundled sample data are ready."
} finally { $env:SQLCMDPASSWORD = $previousPassword }
