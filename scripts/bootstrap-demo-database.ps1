[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z][A-Za-z0-9_]{0,127}$')][string]$DatabaseName,
  [string]$ServerInstance = 'localhost\SQLEXPRESS',
  [switch]$TrustServerCertificate
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sqlcmd = if ($env:SQLCMD_PATH) { (Resolve-Path -LiteralPath $env:SQLCMD_PATH).Path } else { (Get-Command sqlcmd -ErrorAction Stop).Source }
$target = $ServerInstance
if ($target -match '^(localhost|\.|\(local\))(\\|$)') { $target = "lpc:$target" }
$connection = @('-S', $target, '-E', '-b', '-l', '15')
if ($TrustServerCertificate) { $connection += '-C' }
# This entrypoint only provisions a NEW demo database. Existing data is never reloaded here.
$query = "SET NOCOUNT ON; IF DB_ID(N'$DatabaseName') IS NOT NULL THROW 51000, 'Database already exists. Choose a new demo database name. Use reviewed migrations for an existing database.', 1;"
& $sqlcmd @connection '-d' 'master' '-Q' $query
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; database provisioning was not started.' }
& (Join-Path $repoRoot 'Database Schema/loaders/build-and-load-database.ps1') -DatabaseName $DatabaseName -ServerInstance $ServerInstance -UseTrustedConnection -TrustServerCertificate:$TrustServerCertificate -DataLoadMode ClientPayload -RequireNewDatabase
if ($LASTEXITCODE -ne 0) { throw 'Demo database provisioning failed.' }
# This demonstration-only backfill must run after snapshot import.
& $sqlcmd @connection '-d' $DatabaseName '-i' (Join-Path $repoRoot 'Database Schema/migrations/026_populate_demo_entity_panel_details.sql')
if ($LASTEXITCODE -ne 0) { throw 'Demo contact backfill failed.' }
Write-Host "Demo database '$DatabaseName' is ready. Configure DB_config separately with npm run setup:database."
