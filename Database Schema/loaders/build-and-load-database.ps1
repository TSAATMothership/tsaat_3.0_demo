[CmdletBinding()]
param(
  [string]$ServerInstance = 'localhost\SQLEXPRESS',
  [string]$AdminDatabase = 'master',
  [string]$DatabaseName,
  [string]$SqlUser,
  [string]$SqlPassword,
  [switch]$UseTrustedConnection,
  [switch]$EncryptConnection,
  [switch]$TrustServerCertificate,
  [string]$DataLoadMode,
  [string]$SqlServerPackageDataRoot,
  [string]$SqlServerSnapshotsRoot
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

function Normalize-DataLoadMode {
  param([AllowNull()][AllowEmptyString()][string]$Value)

  $raw = $Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    $raw = $env:TSAAT_DATA_LOAD_MODE
  }
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return 'ClientPayload'
  }

  $normalized = $raw.Trim().ToLowerInvariant().Replace('_', '-')
  switch ($normalized) {
    '1' { return 'ClientPayload' }
    'client-payload' { return 'ClientPayload' }
    'clientpayload' { return 'ClientPayload' }
    '2' { return 'SqlServerFiles' }
    'sql-server-files' { return 'SqlServerFiles' }
    'sqlserverfiles' { return 'SqlServerFiles' }
    default {
      throw "Invalid DataLoadMode '$raw'. Use ClientPayload or SqlServerFiles."
    }
  }
}

function Resolve-TextSetting {
  param(
    [AllowNull()][AllowEmptyString()][string]$Value,
    [Parameter(Mandatory = $true)][string]$EnvironmentName
  )

  if (-not [string]::IsNullOrWhiteSpace($Value)) {
    return $Value.Trim()
  }

  $fromEnv = [Environment]::GetEnvironmentVariable($EnvironmentName)
  if (-not [string]::IsNullOrWhiteSpace($fromEnv)) {
    return $fromEnv.Trim()
  }

  return ''
}

function Join-SqlPayloadKey {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$FileName
  )

  if ($Root.EndsWith('\') -or $Root.EndsWith('/')) {
    return "$Root$FileName"
  }

  return "$Root\$FileName"
}

function Escape-SqlUnicodeLiteral {
  param([AllowNull()][AllowEmptyString()][string]$Value)

  if ($null -eq $Value) {
    return ''
  }

  return $Value.Replace("'", "''")
}

function Expand-SqlcmdVariables {
  param(
    [Parameter(Mandatory = $true)][string]$SqlText,
    [hashtable]$Variables
  )

  $expanded = $SqlText
  if ($Variables) {
    foreach ($key in $Variables.Keys) {
      $replacement = Escape-SqlUnicodeLiteral -Value ([string]$Variables[$key])
      $expanded = $expanded.Replace('$(' + $key + ')', $replacement)
    }
  }

  return $expanded
}

function New-SqlClientConnectionString {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$AuthMode,
    [AllowNull()][AllowEmptyString()][string]$User,
    [AllowNull()][AllowEmptyString()][string]$Password,
    [bool]$Encrypt,
    [bool]$TrustServerCertificate
  )

  $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
  $builder['Data Source'] = $Server
  $builder['Initial Catalog'] = $Database
  $builder['Encrypt'] = $Encrypt
  $builder['TrustServerCertificate'] = $TrustServerCertificate

  if ($AuthMode -eq 'sql') {
    $builder['Integrated Security'] = $false
    $builder['User ID'] = $User
    $builder['Password'] = $Password
  } else {
    $builder['Integrated Security'] = $true
  }

  return $builder.ConnectionString
}

function Invoke-ClientPayloadLoad {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$AuthMode,
    [string]$User,
    [string]$Password,
    [bool]$Encrypt,
    [bool]$TrustServerCertificate,
    [Parameter(Mandatory = $true)][object[]]$PayloadFiles,
    [Parameter(Mandatory = $true)][string]$LoadDataSql,
    [hashtable]$Variables
  )

  $connectionString = New-SqlClientConnectionString -Server $Server -Database $Database -AuthMode $AuthMode -User $User -Password $Password -Encrypt $Encrypt -TrustServerCertificate $TrustServerCertificate
  $connection = New-Object -TypeName System.Data.SqlClient.SqlConnection -ArgumentList $connectionString

  $currentPayloadFile = ''
  try {
    $connection.Open()

    $command = $connection.CreateCommand()
    $command.CommandTimeout = 0
    $command.CommandText = @"
IF OBJECT_ID('tempdb..#TSAAT_JsonPayload') IS NOT NULL DROP TABLE #TSAAT_JsonPayload;
CREATE TABLE #TSAAT_JsonPayload (
  [payload_key] NVARCHAR(4000) NOT NULL PRIMARY KEY,
  [json_payload] NVARCHAR(MAX) NOT NULL
);
"@
    [void]$command.ExecuteNonQuery()

    foreach ($payloadFile in $PayloadFiles) {
      $sourceFile = [string]$payloadFile.SourceFile
      $currentPayloadFile = $sourceFile
      if (-not (Test-Path -LiteralPath $sourceFile)) {
        throw "JSON payload file missing: $sourceFile"
      }

      Write-Host "Staging JSON payload: $(Split-Path -Leaf $sourceFile)"
      $json = [System.IO.File]::ReadAllText($sourceFile, [System.Text.Encoding]::UTF8)

      $insert = $connection.CreateCommand()
      $insert.CommandTimeout = 0
      $insert.CommandText = 'INSERT INTO #TSAAT_JsonPayload ([payload_key], [json_payload]) VALUES (@payload_key, @json_payload);'
      [void]$insert.Parameters.Add('@payload_key', [System.Data.SqlDbType]::NVarChar, 4000)
      [void]$insert.Parameters.Add('@json_payload', [System.Data.SqlDbType]::NVarChar, -1)
      $insert.Parameters['@payload_key'].Value = [string]$payloadFile.PayloadKey
      $insert.Parameters['@json_payload'].Value = $json
      [void]$insert.ExecuteNonQuery()
    }

    Write-Host 'Running SQL JSON mapping from client payloads...'
    $loadSql = Expand-SqlcmdVariables -SqlText (Get-Content -LiteralPath $LoadDataSql -Raw) -Variables $Variables
    $loadCommand = $connection.CreateCommand()
    $loadCommand.CommandTimeout = 0
    $loadCommand.CommandText = $loadSql
    [void]$loadCommand.ExecuteNonQuery()
  } catch {
    $payloadContext = if ([string]::IsNullOrWhiteSpace($currentPayloadFile)) { '' } else { " Current payload file: $currentPayloadFile." }
    throw "ClientPayload data load failed while streaming local JSON through the SQL connection.$payloadContext $($_.Exception.Message)"
  } finally {
    $connection.Dispose()
  }
}

function Invoke-DatabaseBuildStage {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$ScriptBlock
  )

  Write-Host "[STAGE] $Name"
  try {
    & $ScriptBlock
  } catch {
    throw "Database build stage failed: $Name. Server='$sqlcmdServerInstance'; Database='$DatabaseName'; DataLoadMode='$normalizedDataLoadMode'. $($_.Exception.Message)"
  }
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
    throw "sqlcmd failed for inline query against database '$Database' on server '$Server'."
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
    throw "sqlcmd failed for file '$File' against database '$Database' on server '$Server'."
  }
}

function Test-SqlServerBulkRead {
  param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$AuthArgs,
    [string[]]$SecurityArgs
  )

  $escapedPath = Escape-SqlUnicodeLiteral -Value $FilePath
  $sql = @"
SET NOCOUNT ON;
DECLARE @Payload NVARCHAR(MAX);
DECLARE @ReadSql NVARCHAR(MAX) = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''$escapedPath'', SINGLE_CLOB) src;';

BEGIN TRY
  EXEC sp_executesql @ReadSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Payload OUTPUT;
END TRY
BEGIN CATCH
  DECLARE @ReadError NVARCHAR(2048) =
    N'SQL Server cannot read staged file via OPENROWSET(BULK): $escapedPath. Confirm the UNC path is reachable from the SQL Server host, the SQL Server service account has share and NTFS read permission, and the SQL login has permission to perform bulk file reads. Underlying SQL error: ' + ERROR_MESSAGE();
  THROW 51000, @ReadError, 1;
END CATCH;

IF @Payload IS NULL OR DATALENGTH(@Payload) = 0
BEGIN
  DECLARE @EmptyError NVARCHAR(2048) = N'SQL Server read an empty staged file via OPENROWSET(BULK): $escapedPath.';
  THROW 51000, @EmptyError, 1;
END;
"@

  Invoke-SqlText -Server $Server -Database $Database -SqlText $sql -AuthArgs $AuthArgs -SecurityArgs $SecurityArgs
}

$script:SqlcmdExecutable = Resolve-SqlcmdExecutable
$sqlcmdServerInstance = Resolve-SqlcmdServerTarget -Server $ServerInstance
$normalizedDataLoadMode = Normalize-DataLoadMode -Value $DataLoadMode

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
  (Join-Path $packageDataRoot 'reference-versions.json'),
  (Join-Path $packageDataRoot 'spi-definitions.json'),
  (Join-Path $packageDataRoot 'discovery-tools-settings.json'),
  (Join-Path $packageDataRoot 'measures-settings.json')
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

$effectivePackageDataRoot = $packageDataRoot
$effectiveSnapshotsRoot = $snapshotsRoot
$sqlServerPackageDataRoot = Resolve-TextSetting -Value $SqlServerPackageDataRoot -EnvironmentName 'TSAAT_SQL_SERVER_PACKAGE_DATA_ROOT'
$sqlServerSnapshotsRoot = Resolve-TextSetting -Value $SqlServerSnapshotsRoot -EnvironmentName 'TSAAT_SQL_SERVER_SNAPSHOTS_ROOT'

if ($normalizedDataLoadMode -eq 'SqlServerFiles') {
  if ([string]::IsNullOrWhiteSpace($sqlServerPackageDataRoot)) {
    throw 'SqlServerFiles data load mode requires -SqlServerPackageDataRoot or TSAAT_SQL_SERVER_PACKAGE_DATA_ROOT.'
  }
  if ([string]::IsNullOrWhiteSpace($sqlServerSnapshotsRoot)) {
    throw 'SqlServerFiles data load mode requires -SqlServerSnapshotsRoot or TSAAT_SQL_SERVER_SNAPSHOTS_ROOT.'
  }

  $effectivePackageDataRoot = $sqlServerPackageDataRoot
  $effectiveSnapshotsRoot = $sqlServerSnapshotsRoot
}

$payloadFiles = @()
foreach ($file in $requiredPackageData) {
  $payloadFiles += [pscustomobject]@{
    PayloadKey = Join-SqlPayloadKey -Root $effectivePackageDataRoot -FileName (Split-Path -Leaf $file)
    SourceFile = $file
  }
}
foreach ($snapshotFile in $manifest.snapshotFiles) {
  $snapshotFileName = [string]$snapshotFile
  $payloadFiles += [pscustomobject]@{
    PayloadKey = Join-SqlPayloadKey -Root $effectiveSnapshotsRoot -FileName $snapshotFileName
    SourceFile = Join-Path $snapshotsRoot $snapshotFileName
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
Write-Host "Data load mode: $normalizedDataLoadMode"
if ($normalizedDataLoadMode -eq 'SqlServerFiles') {
  Write-Host "SQL Server package data root: $effectivePackageDataRoot"
  Write-Host "SQL Server snapshots root: $effectiveSnapshotsRoot"
} else {
  Write-Host 'Client payload mode will stream local JSON through the SQL connection.'
}

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
Invoke-DatabaseBuildStage -Name 'connection' -ScriptBlock {
  Invoke-SqlText -Server $sqlcmdServerInstance -Database $AdminDatabase -SqlText 'SET NOCOUNT ON; SELECT 1;' -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs
}

Invoke-DatabaseBuildStage -Name 'database create' -ScriptBlock {
  Invoke-SqlText -Server $sqlcmdServerInstance -Database $AdminDatabase -SqlText $createDbSql -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs
}

if ($normalizedDataLoadMode -eq 'SqlServerFiles') {
  Invoke-DatabaseBuildStage -Name 'SqlServerFiles SQL Server file-read preflight' -ScriptBlock {
    $packageProbePath = Join-SqlPayloadKey -Root $effectivePackageDataRoot -FileName 'reference-versions.json'
    $firstSnapshotFile = [string]($manifest.snapshotFiles | Select-Object -First 1)
    $snapshotProbePath = Join-SqlPayloadKey -Root $effectiveSnapshotsRoot -FileName $firstSnapshotFile

    Write-Host "Validating SQL Server can read package staged file: $packageProbePath"
    Test-SqlServerBulkRead -Server $sqlcmdServerInstance -Database $DatabaseName -FilePath $packageProbePath -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs

    Write-Host "Validating SQL Server can read snapshot staged file: $snapshotProbePath"
    Test-SqlServerBulkRead -Server $sqlcmdServerInstance -Database $DatabaseName -FilePath $snapshotProbePath -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs
  }
}

Write-Host 'Applying base schema...'
Invoke-DatabaseBuildStage -Name 'schema' -ScriptBlock {
  Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $schemaFile -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs
}

Write-Host 'Applying migrations (if any)...'
$migrationFiles = @()
if (Test-Path -LiteralPath $migrationsDir) {
  $migrationFiles = Get-ChildItem -LiteralPath $migrationsDir -Filter '*.sql' -File | Sort-Object Name
}

if ($migrationFiles.Count -eq 0) {
  Write-Host 'No migration scripts found.'
} else {
  foreach ($migration in $migrationFiles) {
    Invoke-DatabaseBuildStage -Name "migration $($migration.Name)" -ScriptBlock {
      Write-Host "Applying migration: $($migration.Name)"
      Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $migration.FullName -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs
    }
  }
}

Write-Host 'Loading seed/reference/application data...'
$loadVariables = @{
  DataLoadMode = $normalizedDataLoadMode
  PackageDataRoot = $effectivePackageDataRoot
  SnapshotsRoot = $effectiveSnapshotsRoot
}

if ($normalizedDataLoadMode -eq 'ClientPayload') {
  Invoke-DatabaseBuildStage -Name 'data load ClientPayload' -ScriptBlock {
    Invoke-ClientPayloadLoad `
      -Server $sqlcmdServerInstance `
      -Database $DatabaseName `
      -AuthMode $sqlAuthMode `
      -User $SqlUser `
      -Password $SqlPassword `
      -Encrypt $EncryptConnection.IsPresent `
      -TrustServerCertificate $TrustServerCertificate.IsPresent `
      -PayloadFiles $payloadFiles `
      -LoadDataSql $loadDataSql `
      -Variables $loadVariables
  }
} else {
  Invoke-DatabaseBuildStage -Name 'data load SqlServerFiles' -ScriptBlock {
    Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $loadDataSql -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs -Variables $loadVariables
  }
}

Write-Host 'Running validation checks...'
Invoke-DatabaseBuildStage -Name 'validation' -ScriptBlock {
  Invoke-SqlFile -Server $sqlcmdServerInstance -Database $DatabaseName -File $validateSql -AuthArgs $sqlAuthArgs -SecurityArgs $sqlSecurityArgs
}

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
Invoke-DatabaseBuildStage -Name 'summary' -ScriptBlock {
  $script:summaryOutput = & $script:SqlcmdExecutable @summaryArgs
  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to collect final summary row counts.'
  }
}

$summaryFile = Join-Path $loaderDir 'last-build-summary.txt'
$script:summaryOutput | Set-Content -LiteralPath $summaryFile -Encoding UTF8

Write-Host 'Database build and load completed successfully.'
Write-Host "Summary written to: $summaryFile"
