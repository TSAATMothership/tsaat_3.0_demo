[CmdletBinding()]
param(
  [string]$ServerInstance = 'localhost\SQLEXPRESS',
  [string]$AdminDatabase = 'master',
  [string]$DatabaseName
)

$ErrorActionPreference = 'Stop'

function Invoke-SqlText {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$SqlText
  )

  & sqlcmd -S $Server -d $Database -E -Q $SqlText -b
  if ($LASTEXITCODE -ne 0) {
    throw "sqlcmd failed for inline query against [$Database]."
  }
}

function Invoke-SqlFile {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$File,
    [hashtable]$Variables
  )

  if (-not (Test-Path -LiteralPath $File)) {
    throw "SQL file not found: $File"
  }

  $args = @('-S', $Server, '-d', $Database, '-E', '-i', $File, '-b')
  if ($Variables) {
    $args += '-v'
    foreach ($key in $Variables.Keys) {
      $value = [string]$Variables[$key]
      $args += ("{0}=""{1}""" -f $key, $value)
    }
  }

  & sqlcmd @args
  if ($LASTEXITCODE -ne 0) {
    throw "sqlcmd failed for file: $File"
  }
}

$sqlcmdPath = (Get-Command sqlcmd -ErrorAction SilentlyContinue)
if ($null -eq $sqlcmdPath) {
  throw 'sqlcmd is required but not installed or not in PATH.'
}

$loaderDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageRoot = Split-Path -Parent $loaderDir
$repoRoot = Split-Path -Parent $packageRoot

$schemaFile = Join-Path $packageRoot 'database-schema.sql'
$migrationsDir = Join-Path $packageRoot 'migrations'
$packageDataRoot = Join-Path $packageRoot 'data'
$manifestPath = Join-Path $packageDataRoot 'database-build-manifest.json'
$loadDataSql = Join-Path $loaderDir 'load-data.sql'
$validateSql = Join-Path $loaderDir 'validate-database.sql'

if (-not (Test-Path -LiteralPath $schemaFile)) {
  throw "Schema file missing: $schemaFile"
}
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Manifest missing: $manifestPath"
}
if (-not (Test-Path -LiteralPath $loadDataSql)) {
  throw "Loader SQL missing: $loadDataSql"
}
if (-not (Test-Path -LiteralPath $validateSql)) {
  throw "Validation SQL missing: $validateSql"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  if ($manifest.applicationDatabaseName) {
    $DatabaseName = [string]$manifest.applicationDatabaseName
  }
}

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  $schemaContent = Get-Content -LiteralPath $schemaFile -Raw
  $match = [regex]::Match($schemaContent, 'CREATE\s+SCHEMA\s+\[(?<schema>[^\]]+)\]', 'IgnoreCase')
  if ($match.Success) {
    $DatabaseName = $match.Groups['schema'].Value.ToUpperInvariant()
  }
}

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  throw 'Could not discover application database name from repository artefacts.'
}

$snapshotsRoot = Join-Path $repoRoot 'data\snapshots'
if ($manifest.snapshotSourceDirectory) {
  $candidate = Join-Path $packageRoot ([string]$manifest.snapshotSourceDirectory)
  $candidateResolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue
  if ($candidateResolved) {
    $snapshotsRoot = $candidateResolved.Path
  }
}

$requiredPackageData = @(
  (Join-Path $packageDataRoot 'spi-definitions.json'),
  (Join-Path $packageDataRoot 'discovery-tools-settings.json'),
  (Join-Path $packageDataRoot 'measures-settings.json'),
  (Join-Path $packageDataRoot 'reference-versions.json')
)

foreach ($file in $requiredPackageData) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Required data file missing: $file"
  }
}

if (-not (Test-Path -LiteralPath $snapshotsRoot)) {
  throw "Snapshots directory missing: $snapshotsRoot"
}

foreach ($snapshotFile in $manifest.snapshotFiles) {
  $snapshotPath = Join-Path $snapshotsRoot ([string]$snapshotFile)
  if (-not (Test-Path -LiteralPath $snapshotPath)) {
    throw "Snapshot file missing: $snapshotPath"
  }
}

Write-Host "Discovered application database name: $DatabaseName"
Write-Host "Server: $ServerInstance"
Write-Host "Admin database: $AdminDatabase"
Write-Host "Package root: $packageRoot"
Write-Host "Snapshots root: $snapshotsRoot"

$dbNameEscaped = $DatabaseName.Replace("'", "''")
$createDbSql = @"
IF DB_ID(N'$dbNameEscaped') IS NULL
BEGIN
  PRINT 'Creating database [$DatabaseName]';
  CREATE DATABASE [$DatabaseName];
END
ELSE
BEGIN
  PRINT 'Database [$DatabaseName] already exists';
END
"@
Invoke-SqlText -Server $ServerInstance -Database $AdminDatabase -SqlText $createDbSql

Write-Host 'Applying base schema...'
Invoke-SqlFile -Server $ServerInstance -Database $DatabaseName -File $schemaFile

Write-Host 'Applying migrations (if any)...'
$migrationFiles = @()
if (Test-Path -LiteralPath $migrationsDir) {
  $migrationFiles = Get-ChildItem -LiteralPath $migrationsDir -Filter '*.sql' -File | Sort-Object Name
}

if ($migrationFiles.Count -eq 0) {
  Write-Host 'No migration scripts found.'
} else {
  foreach ($migration in $migrationFiles) {
    Write-Host "Applying migration: $($migration.Name)"
    Invoke-SqlFile -Server $ServerInstance -Database $DatabaseName -File $migration.FullName
  }
}

Write-Host 'Loading seed/reference/application data...'
Invoke-SqlFile -Server $ServerInstance -Database $DatabaseName -File $loadDataSql -Variables @{
  PackageDataRoot = $packageDataRoot
  SnapshotsRoot = $snapshotsRoot
}

Write-Host 'Running validation checks...'
Invoke-SqlFile -Server $ServerInstance -Database $DatabaseName -File $validateSql

$summarySql = @"
SET NOCOUNT ON;
SELECT
  s.name + N'.' + t.name AS table_name,
  SUM(p.rows) AS row_count
FROM sys.tables t
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
INNER JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE s.name = N'tsaat'
GROUP BY s.name, t.name
ORDER BY s.name, t.name;
"@

$summaryOutput = & sqlcmd -S $ServerInstance -d $DatabaseName -E -Q $summarySql -W -s '|' -h -1
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to collect final summary row counts.'
}

$summaryFile = Join-Path $loaderDir 'last-build-summary.txt'
$summaryOutput | Set-Content -LiteralPath $summaryFile -Encoding UTF8

Write-Host 'Database build and load completed successfully.'
Write-Host "Summary written to: $summaryFile"
