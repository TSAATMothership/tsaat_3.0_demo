[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ServerInstance,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z][A-Za-z0-9_]{0,100}$')][string]$DatabaseName,
  [switch]$Apply,
  [string]$SampleDatabaseAcknowledgement,
  [bool]$EncryptConnection = $false,
  [bool]$TrustServerCertificate = $false,
  [string]$ReportPath
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if ($DatabaseName -in @('master', 'model', 'msdb', 'tempdb')) { throw 'System databases are not sample targets.' }
if ($Apply -and $SampleDatabaseAcknowledgement -cne $DatabaseName) { throw 'Applying sample evidence requires the exact database name in -SampleDatabaseAcknowledgement.' }
Push-Location $root
try { & node --import tsx scripts/check-sample-evidence.ts; if ($LASTEXITCODE -ne 0) { throw 'Sample evidence audit failed.' } } finally { Pop-Location }
$loader = [IO.File]::ReadAllText((Join-Path $root 'Database Schema/loaders/load-data.sql'))
$matches = [regex]::Matches($loader, '(?s)-- BEGIN SHARED SNAPSHOT IMPORT\s*(.*?)\s*-- END SHARED SNAPSHOT IMPORT')
if ($matches.Count -ne 1) { throw 'Expected exactly one reviewed shared snapshot import block.' }
$importSql = $matches[0].Groups[1].Value
$snapshotInputs = @(Get-ChildItem -LiteralPath (Join-Path $root 'data/snapshots') -Filter 'week-*.json' | Sort-Object Name | ForEach-Object {
  $payload = [IO.File]::ReadAllText($_.FullName)
  $date = [regex]::Match($payload, '"snapshotDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"').Groups[1].Value
  if (-not $date) { throw 'Missing audited snapshot date.' }
  [pscustomobject]@{ date = $date; file = $_.FullName; hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
})
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = $ServerInstance; $builder['Initial Catalog'] = $DatabaseName; $builder['Integrated Security'] = $true
$builder['Encrypt'] = $EncryptConnection; $builder['TrustServerCertificate'] = $TrustServerCertificate; $builder['Application Name'] = 'TSAAT sample evidence append'
$connection = New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
$transaction = $null
function Command([string]$sql) {
  $cmd = $connection.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 300
  if ($transaction) { $cmd.Transaction = $transaction }
  return $cmd
}
function Catalogue {
  $cmd = Command 'SELECT snapshot_id, CONVERT(char(10), snapshot_date, 23) FROM tsaat.dataset_snapshot ORDER BY snapshot_date;'
  $reader = $cmd.ExecuteReader(); $rows = @()
  try { while ($reader.Read()) { $rows += [pscustomobject]@{ id = [long]$reader.GetValue(0); date = $reader.GetString(1) } } } finally { $reader.Dispose(); $cmd.Dispose() }
  return $rows
}
try {
  $connection.Open()
  $existing = @(Catalogue)
  $pending = @($snapshotInputs | Where-Object { $_.date -notin $existing.date })
  $report = [ordered]@{ database = $DatabaseName; applied = $false; appended = $pending.Count; backup = $null; snapshots = $existing }
  if ($Apply -and $pending.Count) {
    # A verified native backup precedes any write. This script never runs base schema or the seed loader.
    $cmd = Command "SELECT CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultBackupPath'));"
    try { $backupRoot = [string]$cmd.ExecuteScalar() } finally { $cmd.Dispose() }
    if (-not $backupRoot) { throw 'SQL Server has no default backup directory.' }
    $backup = $backupRoot.TrimEnd('\', '/') + '\' + $DatabaseName + '_evidence_' + [guid]::NewGuid().ToString('N') + '.bak'
    $cmd = Command "BACKUP DATABASE [$DatabaseName] TO DISK = @backup WITH COPY_ONLY, CHECKSUM; RESTORE VERIFYONLY FROM DISK = @backup WITH CHECKSUM;"
    [void]$cmd.Parameters.Add('@backup', [Data.SqlDbType]::NVarChar, 4000); $cmd.Parameters['@backup'].Value = $backup
    try { [void]$cmd.ExecuteNonQuery() } finally { $cmd.Dispose() }
    $report.backup = $backup
    $transaction = $connection.BeginTransaction([Data.IsolationLevel]::Serializable)
    $cmd = Command "SET XACT_ABORT ON; DECLARE @result int; EXEC @result = sys.sp_getapplock @Resource=N'TSAAT sample evidence append', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @result < 0 THROW 51000, 'Sample import is busy.', 1; SET IDENTITY_INSERT tsaat.dataset_snapshot ON;"
    try { [void]$cmd.ExecuteNonQuery() } finally { $cmd.Dispose() }
    $existing = @(Catalogue)
    $nextId = [long](($existing | Measure-Object -Property id -Maximum).Maximum)
    foreach ($entry in $snapshotInputs) {
      if ($entry.date -in $existing.date) { continue }
      if ((Get-FileHash -LiteralPath $entry.file -Algorithm SHA256).Hash -ne $entry.hash) { throw 'Sample evidence changed after validation.' }
      $nextId++
      $cmd = Command $importSql
      [void]$cmd.Parameters.Add('@SnapshotId', [Data.SqlDbType]::BigInt); $cmd.Parameters['@SnapshotId'].Value = $nextId
      [void]$cmd.Parameters.Add('@SnapshotFile', [Data.SqlDbType]::NVarChar, 4000); $cmd.Parameters['@SnapshotFile'].Value = 'sample-evidence/' + [IO.Path]::GetFileName($entry.file)
      [void]$cmd.Parameters.Add('@Json', [Data.SqlDbType]::NVarChar, -1); $cmd.Parameters['@Json'].Value = [IO.File]::ReadAllText($entry.file)
      try { [void]$cmd.ExecuteNonQuery() } finally { $cmd.Dispose() }
    }
    $cmd = Command 'SET IDENTITY_INSERT tsaat.dataset_snapshot OFF;'
    try { [void]$cmd.ExecuteNonQuery() } finally { $cmd.Dispose() }
    $transaction.Commit(); $transaction.Dispose(); $transaction = $null
    $report.applied = $true; $report.snapshots = @(Catalogue)
  }
  $json = $report | ConvertTo-Json -Depth 5
  if ($ReportPath) { [IO.File]::WriteAllText([IO.Path]::GetFullPath($ReportPath), $json, (New-Object Text.UTF8Encoding $false)) }
  Write-Output $json
} catch {
  if ($transaction) { $transaction.Rollback(); $transaction.Dispose(); $transaction = $null }
  throw
} finally { $connection.Dispose() }
