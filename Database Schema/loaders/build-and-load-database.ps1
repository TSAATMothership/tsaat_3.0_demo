[CmdletBinding()]
param(
  [string]$ServerInstance = 'localhost\SQLEXPRESS',
  [string]$AdminDatabase = 'master',
  [string]$DatabaseName,
  [string]$SqlUser,
  [string]$SqlPassword,
  [switch]$UseTrustedConnection,
  [switch]$EncryptConnection,
  [switch]$TrustServerCertificate
)

$ErrorActionPreference = 'Stop'

$hasSqlUser = -not [string]::IsNullOrWhiteSpace($SqlUser)
$hasSqlPassword = -not [string]::IsNullOrWhiteSpace($SqlPassword)

if ($hasSqlUser -xor $hasSqlPassword) {
  throw 'Both SqlUser and SqlPassword must be provided for SQL authentication.'
}

[string[]]$sqlAuthArgs = @()
$sqlAuthMode = 'trusted'
if ($hasSqlUser -and $hasSqlPassword) {
  $sqlAuthMode = 'sql'
  $sqlAuthArgs = @('-U', $SqlUser, '-P', $SqlPassword)
} elseif ($UseTrustedConnection.IsPresent -or (-not $hasSqlUser -and -not $hasSqlPassword)) {
  $sqlAuthMode = 'trusted'
  $sqlAuthArgs = @('-E')
}

[string[]]$sqlSecurityArgs = @()
$sqlSslMode = 'disabled'
if ($EncryptConnection.IsPresent -or $TrustServerCertificate.IsPresent) {
  $sqlSecurityArgs += '-N'
  $sqlSslMode = 'strict'
  if ($TrustServerCertificate.IsPresent) {
    $sqlSecurityArgs += '-C'
    $sqlSslMode = 'trust-server-certificate'
  }
}

$loaderDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageRoot = Split-Path -Parent $loaderDir
$repoRoot = Split-Path -Parent $packageRoot

function Resolve-SqlcmdExecutable {
  $fromEnv = $env:SQLCMD_PATH
  if (-not [string]::IsNullOrWhiteSpace($fromEnv)) {
    $resolvedFromEnv = Resolve-Path -LiteralPath $fromEnv -ErrorAction SilentlyContinue
    if ($null -eq $resolvedFromEnv) {
      throw "SQLCMD_PATH is set but executable was not found: $fromEnv"
    }
    return $resolvedFromEnv.Path
  }

  $bundledCandidate = Join-Path $repoRoot 'Dependencies\external\sqlcmd\win-x64\sqlcmd.exe'
  if (Test-Path -LiteralPath $bundledCandidate) {
    return (Resolve-Path -LiteralPath $bundledCandidate).Path
  }

  $sqlcmdCommand = Get-Command sqlcmd -ErrorAction SilentlyContinue
  if ($null -ne $sqlcmdCommand) {
    return $sqlcmdCommand.Source
  }

  throw 'sqlcmd is required but was not found. Run CreateDB.cmd or compileApp.cmd to stage bundled sqlcmd, or set SQLCMD_PATH to a valid sqlcmd executable.'
}

function Resolve-SqlcmdServerTarget {
  param(
    [Parameter(Mandatory = $true)][string]$Server
  )

  if ([string]::IsNullOrWhiteSpace($Server)) {
    return $Server
  }

  $normalized = $Server.Trim()
  if ($normalized -match '^(?i)(tcp|np|lpc):') {
    return $normalized
  }

  $isLocalTarget =
    $normalized -ieq 'localhost' -or
    $normalized -ieq '.' -or
    $normalized -ieq '(local)' -or
    $normalized.StartsWith('localhost\', [System.StringComparison]::OrdinalIgnoreCase) -or
    $normalized.StartsWith('.\', [System.StringComparison]::OrdinalIgnoreCase) -or
    $normalized.StartsWith('(local)\', [System.StringComparison]::OrdinalIgnoreCase)

  if ($isLocalTarget) {
    return "lpc:$normalized"
  }

  return $normalized
}

function Invoke-SqlText {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$SqlText,
    [Parameter(Mandatory = $true)][string[]]$AuthArgs,
    [string[]]$SecurityArgs
  )

  $args = @('-S', $Server, '-d', $Database) + $AuthArgs + $SecurityArgs + @('-Q', $SqlText, '-b')
  & $script:SqlcmdExecutable @args
  if ($LASTEXITCODE -ne 0) {
    throw "sqlcmd failed for inline query against [$Database]."
  }
}

function Invoke-SqlFile {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string[]]$AuthArgs,
    [string[]]$SecurityArgs,
    [hashtable]$Variables
  )

  if (-not (Test-Path -LiteralPath $File)) {
    throw "SQL file not found: $File"
  }

  $args = @('-S', $Server, '-d', $Database) + $AuthArgs + $SecurityArgs + @('-i', $File, '-b')
  if ($Variables) {
    $args += '-v'
    foreach ($key in $Variables.Keys) {
      $value = [string]$Variables[$key]
      $args += ("{0}=""{1}""" -f $key, $value)
    }
  }

  & $script:SqlcmdExecutable @args
  if ($LASTEXITCODE -ne 0) {
    throw "sqlcmd failed for file: $File"
  }
}

$script:SqlcmdExecutable = Resolve-SqlcmdExecutable
$sqlcmdServerInstance = Resolve-SqlcmdServerTarget -Server $ServerInstance

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
Write-Host "SQL Server target for sqlcmd: $sqlcmdServerInstance"
Write-Host "Admin database: $AdminDatabase"
Write-Host "Authentication mode: $sqlAuthMode"
Write-Host "SSL mode: $sqlSslMode"
Write-Host "sqlcmd executable: $script:SqlcmdExecutable"
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
Invoke-SqlText -Server $sqlcmdServerInstance -Database $AdminDatabase -SqlText $createDbSql -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs

Write-Host 'Applying base schema...'
Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $schemaFile -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs

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
    Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $migration.FullName -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs
  }
}

Write-Host 'Loading seed/reference/application data...'
Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $loadDataSql -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs -Variables @{
  PackageDataRoot = $packageDataRoot
  SnapshotsRoot = $snapshotsRoot
}

Write-Host 'Running validation checks...'
Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $validateSql -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs

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

$summaryArgs = @('-S', $sqlcmdServerInstance, '-d', $DatabaseName) + $sqlAuthArgs + $sqlSecurityArgs + @('-Q', $summarySql, '-W', '-s', '|', '-h', '-1')
$summaryOutput = & $script:SqlcmdExecutable @summaryArgs
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to collect final summary row counts.'
}

$summaryFile = Join-Path $loaderDir 'last-build-summary.txt'
$summaryOutput | Set-Content -LiteralPath $summaryFile -Encoding UTF8

Write-Host 'Database build and load completed successfully.'
Write-Host "Summary written to: $summaryFile"
