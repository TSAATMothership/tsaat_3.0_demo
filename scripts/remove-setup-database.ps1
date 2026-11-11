[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][object]$Settings,
  [Parameter(Mandatory = $true)][object]$Administrator,
  [Parameter(Mandatory = $true)][string]$ExpectedIdentity
)
$ErrorActionPreference = 'Stop'
if ($Settings.database -notmatch '^[A-Za-z][A-Za-z0-9_]{0,127}$' -or $Settings.database -in @('master', 'model', 'msdb', 'tempdb')) {
  throw 'Database replacement requires a valid application database name. System databases cannot be replaced.'
}
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = $Settings.server
$builder['Initial Catalog'] = 'master'
$builder['Connect Timeout'] = 15
$builder['Encrypt'] = $false
$builder['Integrated Security'] = $Administrator.authMode -eq 'trusted'
if ($Administrator.authMode -eq 'sql') {
  $builder['User ID'] = $Administrator.userId
  $builder['Password'] = $Administrator.password
}
$connection = New-Object System.Data.SqlClient.SqlConnection -ArgumentList $builder.ConnectionString
try {
  $connection.Open()
  $command = $connection.CreateCommand()
  $command.CommandTimeout = 60
  $null = $command.Parameters.Add('@name', [System.Data.SqlDbType]::NVarChar, 128)
  $command.Parameters['@name'].Value = $Settings.database
  $null = $command.Parameters.Add('@identity', [System.Data.SqlDbType]::NVarChar, 40)
  $command.Parameters['@identity'].Value = $ExpectedIdentity
  # Recheck the observed identity before deletion. The bootstrap still refuses
  # any database created by another process between this DROP and its CREATE.
  $command.CommandText = @'
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = @name AND database_id > 4
  AND CONVERT(nvarchar(10), database_id) + N'|' + CONVERT(nvarchar(23), create_date, 121) = @identity)
  THROW 51010, 'The selected database changed after preflight. Rerun setup to confirm the current target.', 1;
DECLARE @drop nvarchar(max) = N'ALTER DATABASE ' + QUOTENAME(@name)
  + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ' + QUOTENAME(@name) + N';';
BEGIN TRY
  EXEC sys.sp_executesql @drop;
END TRY
BEGIN CATCH
  IF EXISTS (SELECT 1 FROM sys.databases WHERE name = @name AND database_id > 4
    AND CONVERT(nvarchar(10), database_id) + N'|' + CONVERT(nvarchar(23), create_date, 121) = @identity)
  BEGIN
    DECLARE @restoreAccess nvarchar(max) = N'ALTER DATABASE ' + QUOTENAME(@name) + N' SET MULTI_USER;';
    EXEC sys.sp_executesql @restoreAccess;
  END;
  THROW;
END CATCH;
'@
  $null = $command.ExecuteNonQuery()
  Write-Host "Removed database '$($Settings.database)'. Creating its replacement now."
} catch {
  $failure = $_.Exception.GetBaseException()
  if ($failure.Number -eq 51010) { throw $failure.Message }
  throw 'Could not remove the selected database. Replacement stopped and DB_config was not saved. Check server permissions and the database state before retrying.'
} finally { $connection.Dispose() }
