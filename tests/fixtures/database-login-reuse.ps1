param(
  [Parameter(Mandatory=$true)][ValidatePattern('^TSAAT_SetupLoginTest_[A-Za-z0-9_]{1,60}$')][string]$DatabaseName,
  [Parameter(Mandatory=$true)][string]$ServerInstance,
  [Parameter(Mandatory=$true)][string]$ConfigureScript
)
$ErrorActionPreference = 'Stop'
$otherDatabase = $DatabaseName + '_Other'
$login = $DatabaseName + '_App'
$freshLogin = $DatabaseName + '_New'
$password = 'Aa1!' + [guid]::NewGuid().ToString('N')
$createdDatabases = @()
$createdLogin = $false
$createdFreshLogin = $false
$admin = New-Object System.Data.SqlClient.SqlConnection -ArgumentList "Data Source=$ServerInstance;Initial Catalog=master;Integrated Security=True;Encrypt=False"
$admin.Open()
$settings = [pscustomobject]@{ server=$ServerInstance; database=$DatabaseName; authMode='sql'; userId=$login; password=$password; sslEnabled=$false; sslType='strict' }
$administrator = [pscustomobject]@{ server=$ServerInstance; authMode='trusted'; sslEnabled=$false }
function Query([string]$Sql) {
  $command = $admin.CreateCommand()
  $command.CommandText = $Sql
  foreach ($entry in @{ login=$login; fresh=$freshLogin; password=$password; database=$DatabaseName; other=$otherDatabase }.GetEnumerator()) {
    $null = $command.Parameters.Add('@' + $entry.Key, [System.Data.SqlDbType]::NVarChar, 128)
    $command.Parameters['@' + $entry.Key].Value = $entry.Value
  }
  return $command.ExecuteScalar()
}
function Reject([scriptblock]$Action, [string]$Message) {
  $caught = $false
  try { & $Action | Out-Null } catch {
    $caught = $true
    if ($_.Exception.Message -notlike "*$Message*") { throw }
  }
  if (-not $caught) { throw "Expected rejection: $Message" }
}
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
try {
  Assert ((Query 'SELECT COUNT(*) FROM sys.databases WHERE name IN (@database,@other);') -eq 0) 'Choose new disposable database names.'
  Assert ((Query 'SELECT COUNT(*) FROM sys.server_principals WHERE name IN (@login,@fresh);') -eq 0) 'Choose new disposable login names.'
  foreach ($name in @($DatabaseName, $otherDatabase)) {
    $null = Query "CREATE DATABASE [$name];"
    $createdDatabases += $name
  }
  $null = Query "DECLARE @sql nvarchar(max)=N'CREATE LOGIN '+QUOTENAME(@login)+N' WITH PASSWORD='+QUOTENAME(@password,'''')+N', CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;'; EXEC(@sql);"
  $createdLogin = $true
  $null = Query "USE [$DatabaseName]; EXEC(N'CREATE SCHEMA tsaat'); CREATE TABLE dbo.sentinel(id int); INSERT dbo.sentinel VALUES(7);"
  $null = Query "USE [$otherDatabase]; CREATE USER [$login] FOR LOGIN [$login]; CREATE TABLE dbo.sentinel(id int); INSERT dbo.sentinel VALUES(19); ALTER ROLE db_datareader ADD MEMBER [$login];"
  $before = Query 'SELECT CONVERT(varchar(512),sid,2)+CONVERT(varchar(512),password_hash,2) FROM sys.sql_logins WHERE name=@login;'

  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly } 'Login already exists'
  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -AllowExistingLoginForReplacement } 'preflight'
  $settings.password = 'Wrong1!' + [guid]::NewGuid().ToString('N')
  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly -AllowExistingLoginForReplacement } 'Cannot authenticate'
  $settings.password = $password
  $settings.database = $DatabaseName + '_Missing'
  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly -AllowExistingLoginForReplacement } 'Login already exists'
  $settings.database = $DatabaseName
  $null = Query "ALTER SERVER ROLE securityadmin ADD MEMBER [$login];"
  try { Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly -AllowExistingLoginForReplacement } 'server role' }
  finally { $null = Query "ALTER SERVER ROLE securityadmin DROP MEMBER [$login];" }

  # Reproduce the reported failure: the SQL login has no user or setup marker.
  $preflight = & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly -AllowExistingLoginForReplacement
  Assert ($preflight.LoginSid -is [byte[]]) 'Preflight must return the authenticated binary SID.'
  Assert ((Query "USE [$DatabaseName]; SELECT COUNT(*) FROM sys.database_principals WHERE name=@login;") -eq 0) 'Preflight changed database users.'
  Assert ((Query "SELECT id FROM [$DatabaseName].dbo.sentinel;") -eq 7) 'Preflight changed existing data.'

  # A conflicting user must never be remapped, even with a verified server SID.
  $null = Query "USE [$DatabaseName]; CREATE USER [$login] WITHOUT LOGIN;"
  $conflictSid = Query "USE [$DatabaseName]; SELECT CONVERT(varchar(512),sid,2) FROM sys.database_principals WHERE name=@login;"
  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -VerifiedLoginSid $preflight.LoginSid } 'conflicting user'
  Assert ((Query "USE [$DatabaseName]; SELECT CONVERT(varchar(512),sid,2) FROM sys.database_principals WHERE name=@login;") -eq $conflictSid) 'Conflicting user was remapped.'
  $null = Query "USE [$DatabaseName]; DROP USER [$login];"

  & $ConfigureScript -Settings $settings -Administrator $administrator -VerifiedLoginSid $preflight.LoginSid
  $rerun = & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly
  Assert ([BitConverter]::ToString($rerun.LoginSid) -eq [BitConverter]::ToString($preflight.LoginSid)) 'Marked rerun changed identity.'
  & $ConfigureScript -Settings $settings -Administrator $administrator -VerifiedLoginSid $preflight.LoginSid
  Assert ((Query 'SELECT CONVERT(varchar(512),sid,2)+CONVERT(varchar(512),password_hash,2) FROM sys.sql_logins WHERE name=@login;') -eq $before) 'Login SID or password changed.'
  Assert ((Query 'SELECT COUNT(*) FROM sys.server_role_members WHERE member_principal_id=SUSER_ID(@login);') -eq 0) 'Server roles changed.'
  Assert ((Query "USE [$otherDatabase]; SELECT COUNT(*) FROM sys.database_role_members m JOIN sys.database_principals p ON p.principal_id=m.member_principal_id WHERE p.name=@login AND p.sid=SUSER_SID(@login) AND m.role_principal_id=USER_ID(N'db_datareader');") -eq 1) 'Other database access changed.'
  Assert ((Query "SELECT id FROM [$otherDatabase].dbo.sentinel;") -eq 19) 'Other database data changed.'
  $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
  $builder['Data Source']=$ServerInstance; $builder['Initial Catalog']=$DatabaseName; $builder['User ID']=$login; $builder['Password']=$password; $builder['Encrypt']=$false
  $app = New-Object System.Data.SqlClient.SqlConnection -ArgumentList $builder.ConnectionString
  try {
    $app.Open(); $command=$app.CreateCommand()
    $command.CommandText="SELECT CASE WHEN IS_ROLEMEMBER('db_datareader')=1 AND IS_ROLEMEMBER('db_datawriter')=1 AND IS_ROLEMEMBER('db_owner')=0 AND HAS_PERMS_BY_NAME('tsaat','SCHEMA','EXECUTE')=1 AND HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION')=1 THEN 1 ELSE 0 END;"
    Assert ($command.ExecuteScalar() -eq 1) 'Application database grants are incorrect.'
  } finally { $app.Dispose() }

  $settings.userId = $freshLogin
  try {
    $freshPreflight = & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly
    Assert ($null -eq $freshPreflight.LoginSid) 'New-login preflight returned an existing identity.'
    Assert ((Query 'SELECT COUNT(*) FROM sys.server_principals WHERE name=@fresh;') -eq 0) 'Preflight created a login.'
    & $ConfigureScript -Settings $settings -Administrator $administrator
    $createdFreshLogin = $true
    $freshVerified = & $ConfigureScript -Settings $settings -Administrator $administrator -CheckOnly
    Assert ($freshVerified.LoginSid -is [byte[]]) 'Fresh login creation/authentication failed.'
  } finally { $settings.userId = $login }

  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -VerifiedLoginSid ([byte[]]@(1,2,3)) } 'changed or was removed'
  [System.Data.SqlClient.SqlConnection]::ClearAllPools()
  $null = Query "DROP LOGIN [$login];"
  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -VerifiedLoginSid $preflight.LoginSid } 'changed or was removed'
  Assert ((Query 'SELECT COUNT(*) FROM sys.server_principals WHERE name=@login;') -eq 0) 'A removed verified login was recreated.'
  $null = Query "DECLARE @sql nvarchar(max)=N'CREATE LOGIN '+QUOTENAME(@login)+N' WITH PASSWORD='+QUOTENAME(@password,'''')+N', CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;'; EXEC(@sql);"
  Reject { & $ConfigureScript -Settings $settings -Administrator $administrator -VerifiedLoginSid $preflight.LoginSid } 'changed or was removed'
  Write-Host 'Existing-login reuse and all rejection/preservation checks passed.'
} finally {
  # Only names proven absent and created by this invocation are eligible.
  [System.Data.SqlClient.SqlConnection]::ClearAllPools()
  foreach ($name in $createdDatabases) {
    $null = Query "USE master; ALTER DATABASE [$name] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$name];"
  }
  if ($createdLogin) { $null = Query "IF SUSER_ID(@login) IS NOT NULL DROP LOGIN [$login];" }
  if ($createdFreshLogin) { $null = Query "IF SUSER_ID(@fresh) IS NOT NULL DROP LOGIN [$freshLogin];" }
  $admin.Dispose()
}
