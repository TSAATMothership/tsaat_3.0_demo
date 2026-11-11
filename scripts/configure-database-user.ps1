[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][object]$Settings,
  [Parameter(Mandatory = $true)][object]$Administrator,
  [switch]$CheckOnly,
  [switch]$AllowExistingLoginForReplacement,
  [AllowNull()][byte[]]$VerifiedLoginSid
)
$ErrorActionPreference = 'Stop'
if ($AllowExistingLoginForReplacement -and -not $CheckOnly) {
  throw 'Existing-login reuse must be verified during replacement preflight.'
}

function Open-SetupConnection {
  param([object]$ConnectionSettings, [string]$Database)
  $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
  $builder['Data Source'] = $ConnectionSettings.server
  $builder['Initial Catalog'] = $Database
  $builder['Connect Timeout'] = 15
  $builder['Encrypt'] = $false
  $builder['TrustServerCertificate'] = $false
  $builder['Integrated Security'] = $ConnectionSettings.authMode -eq 'trusted'
  if ($ConnectionSettings.authMode -eq 'sql') {
    $builder['User ID'] = $ConnectionSettings.userId
    $builder['Password'] = $ConnectionSettings.password
  }
  $connection = New-Object System.Data.SqlClient.SqlConnection -ArgumentList $builder.ConnectionString
  try { $connection.Open(); return $connection }
  catch { $connection.Dispose(); throw 'Cannot authenticate the database connection. Check the supplied username/password and SQL Server authentication mode.' }
}

# Values are parameters, including the password. Only SQL Server constructs the
# quoted DDL; no credentials are written to a SQL file or process arguments.
$connection = Open-SetupConnection -ConnectionSettings $Administrator -Database 'master'
try {
  $command = $connection.CreateCommand()
  $command.CommandText = "SELECT CASE WHEN SERVERPROPERTY('IsIntegratedSecurityOnly') = 1 THEN 1 WHEN IS_SRVROLEMEMBER('sysadmin') <> 1 THEN 2 ELSE 0 END;"
  $serverState = [int]$command.ExecuteScalar()
  if ($serverState -eq 1) { throw 'SQL Server uses Windows authentication only. Enable SQL Server and Windows authentication (mixed mode) before creating a SQL login; setup does not restart or reconfigure the server.' }
  if ($serverState -eq 2) { throw 'The setup administrator must be a SQL Server sysadmin. The application login will not receive this role.' }

  $null = $command.Parameters.Add('@login', [System.Data.SqlDbType]::NVarChar, 128)
  $command.Parameters['@login'].Value = $Settings.userId
  $null = $command.Parameters.Add('@database', [System.Data.SqlDbType]::NVarChar, 128)
  $command.Parameters['@database'].Value = $Settings.database
  $null = $command.Parameters.Add('@verifiedSid', [System.Data.SqlDbType]::VarBinary, 85)
  # Assign directly: returning a byte array from a PowerShell if expression
  # enumerates it into object[], which SqlClient cannot bind as varbinary.
  if ($VerifiedLoginSid) { $command.Parameters['@verifiedSid'].Value = $VerifiedLoginSid }
  else { $command.Parameters['@verifiedSid'].Value = [DBNull]::Value }
  $null = $command.Parameters.Add('@allowExistingLogin', [System.Data.SqlDbType]::Bit)
  $command.Parameters['@allowExistingLogin'].Value = $AllowExistingLoginForReplacement.IsPresent
  # Replacement preflight may authenticate an existing SQL login even after a
  # failed bootstrap lost its user/marker. Only its verified SID can be attached
  # after replacement. Never reset passwords or remap conflicting users.
  $ownershipSql = @'
DECLARE @owned bit = 0;
IF @verifiedSid IS NOT NULL AND (SUSER_SID(@login) IS NULL OR SUSER_SID(@login) <> @verifiedSid)
  THROW 51005, 'The verified application login changed or was removed. No login was created or reattached. Rerun setup to verify the current login.', 1;
IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @login)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @login AND type = 'S')
    THROW 51001, 'The existing application login must use SQL authentication. Choose a SQL login.', 1;
  IF EXISTS (SELECT 1 FROM sys.server_role_members WHERE member_principal_id = SUSER_ID(@login))
    THROW 51002, 'The application login has a server role. Choose a dedicated login without server roles.', 1;
  IF DB_ID(@database) IS NOT NULL
  BEGIN
    IF @allowExistingLogin = 1 SET @owned = 1;
    DECLARE @lookup nvarchar(max) = N'USE ' + QUOTENAME(@database) + N';
      SELECT @owned = 1 FROM sys.database_principals p
      JOIN sys.extended_properties e ON e.class = 4 AND e.major_id = p.principal_id
      WHERE p.name = @login AND p.sid = SUSER_SID(@login) AND p.type = ''S''
        AND e.name = N''TSAAT_SETUP_LOGIN'' AND CONVERT(nvarchar(20), e.value) = N''1'';';
    EXEC sys.sp_executesql @lookup, N'@login sysname, @owned bit OUTPUT', @login, @owned OUTPUT;
  END;
  IF @owned = 0 AND @verifiedSid IS NOT NULL AND SUSER_SID(@login) = @verifiedSid SET @owned = 1;
  IF @owned = 0 THROW 51001, 'Login already exists and was not created by this setup for the selected database. Choose another database username.', 1;
END;
'@
  $command.CommandText = $ownershipSql + "`r`nSELECT CASE WHEN @owned = 1 THEN SUSER_SID(@login) ELSE NULL END;"
  try { $existingSid = $command.ExecuteScalar() }
  catch {
    $failure = $_.Exception.GetBaseException()
    if ($failure.Number -in @(51001, 51002, 51005)) { throw $failure.Message }
    throw 'Cannot verify database login ownership. No login was changed.'
  }
  $owned = $existingSid -is [byte[]]
  if ($owned) {
    $appConnection = Open-SetupConnection -ConnectionSettings $Settings -Database 'master'
    try {
      $identityCommand = $appConnection.CreateCommand()
      $identityCommand.CommandText = 'SELECT SUSER_SID();'
      $authenticatedSid = $identityCommand.ExecuteScalar()
      if ($authenticatedSid -isnot [byte[]] -or [BitConverter]::ToString($authenticatedSid) -cne [BitConverter]::ToString($existingSid)) {
        throw 'The application login changed during authentication. No database or login was changed. Retry setup.'
      }
    } finally { $appConnection.Dispose() }
  }
  if ($CheckOnly) {
    $sid = $null
    if ($owned) {
      $sid = $existingSid
      if ($AllowExistingLoginForReplacement) {
        Write-Host "Existing SQL login '$($Settings.userId)' verified for database replacement. Its password and server permissions will be preserved."
      }
    }
    return [pscustomobject]@{ LoginSid = $sid }
  }

  $null = $command.Parameters.Add('@password', [System.Data.SqlDbType]::NVarChar, 128)
  $command.Parameters['@password'].Value = $Settings.password
  $command.CommandText = @'
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @lockResult int, @resource nvarchar(255) = N'TSAAT_SETUP_LOGIN_' + @login;
  EXEC @lockResult = sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
  IF @lockResult < 0 THROW 51003, 'Another setup is configuring this login. Retry later.', 1;
'@ + "`r`n" + $ownershipSql + "`r`n" + @'
  IF @owned = 0
  BEGIN
    DECLARE @createLogin nvarchar(max) = N'CREATE LOGIN ' + QUOTENAME(@login)
      + N' WITH PASSWORD = ' + QUOTENAME(@password, '''') + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;';
    EXEC sys.sp_executesql @createLogin;
  END;
  DECLARE @access nvarchar(max) = N'USE ' + QUOTENAME(@database) + N';
    IF USER_ID(@login) IS NULL
    BEGIN
      CREATE USER ' + QUOTENAME(@login) + N' FOR LOGIN ' + QUOTENAME(@login) + N';
      EXEC sys.sp_addextendedproperty @name=N''TSAAT_SETUP_LOGIN'', @value=N''1'', @level0type=N''USER'', @level0name=@login;
    END
    ELSE IF NOT EXISTS (SELECT 1 FROM sys.database_principals p
      JOIN sys.extended_properties e ON e.class=4 AND e.major_id=p.principal_id
      WHERE p.name=@login AND p.sid=SUSER_SID(@login) AND p.type=''S''
        AND e.name=N''TSAAT_SETUP_LOGIN'' AND CONVERT(nvarchar(20),e.value)=N''1'')
      THROW 51004, ''A conflicting database user already exists. No user was remapped.'', 1;
    ALTER ROLE db_datareader ADD MEMBER ' + QUOTENAME(@login) + N';
    ALTER ROLE db_datawriter ADD MEMBER ' + QUOTENAME(@login) + N';
    GRANT EXECUTE ON SCHEMA::tsaat TO ' + QUOTENAME(@login) + N';
    GRANT VIEW DEFINITION TO ' + QUOTENAME(@login) + N';';
  EXEC sys.sp_executesql @access, N'@login sysname, @owned bit', @login, @owned;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
'@
  try { $null = $command.ExecuteNonQuery() }
  catch {
    $failure = $_.Exception.GetBaseException()
    if ($failure.Number -in @(51001, 51002, 51003, 51005)) { throw $failure.Message }
    throw 'Database user creation failed. Check the server password policy, administrator permissions, and whether the selected database already has a conflicting user. Login/user changes were rolled back; database data was retained.'
  }
  Write-Host 'Database login and application access are ready. No server administrator role was granted.'
} finally { $connection.Dispose() }
