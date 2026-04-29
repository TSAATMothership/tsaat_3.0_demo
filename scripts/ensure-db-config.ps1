[CmdletBinding()]
param(
  [string]$RepoRoot,
  [string]$DbConfigPath
)

$ErrorActionPreference = 'Stop'

$EnvelopeFormat = 'tsaat-db-config'
$EnvelopeVersion = 1
$EnvelopeAlgorithm = 'dpapi'
$EntropyText = 'TSAAT_DB_CONFIG_V1'
$DefaultServer = 'localhost\SQLEXPRESS'
$DefaultDatabase = 'TSAAT'

function Resolve-RepoRoot {
  param([AllowNull()][AllowEmptyString()][string]$InputRoot)

  if (-not [string]::IsNullOrWhiteSpace($InputRoot)) {
    return (Resolve-Path -LiteralPath $InputRoot).Path
  }

  return (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
}

function Convert-SecureStringToPlaintext {
  param([Parameter(Mandatory = $true)][Security.SecureString]$SecureString)

  $bstr = [IntPtr]::Zero
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Parse-Boolean {
  param([AllowNull()][AllowEmptyString()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  switch ($Value.Trim().ToLowerInvariant()) {
    'true' { return $true }
    '1' { return $true }
    'yes' { return $true }
    'y' { return $true }
    'sspi' { return $true }
    'false' { return $false }
    '0' { return $false }
    'no' { return $false }
    'n' { return $false }
    default { throw "Invalid boolean value: $Value" }
  }
}

function Test-AssumeYes {
  try {
    return (Parse-Boolean -Value $env:TSAAT_DB_CONFIG_ASSUME_YES) -eq $true
  } catch {
    throw 'TSAAT_DB_CONFIG_ASSUME_YES must be true/false when set.'
  }
}

function Is-Interactive {
  return (-not [Console]::IsInputRedirected)
}

function Require-String {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyString()][object]$Value
  )

  if ($Value -isnot [string]) {
    throw "$Name must be a string."
  }

  $trimmed = $Value.Trim()
  if ($trimmed.Length -eq 0) {
    throw "$Name is required."
  }
  if ($trimmed -match "[`r`n]") {
    throw "$Name cannot contain line breaks."
  }
  if ($trimmed.Contains(';')) {
    throw "$Name cannot include ';'."
  }

  return $trimmed
}

function Optional-String {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [AllowNull()][AllowEmptyString()][object]$Value
  )

  if ($null -eq $Value) {
    return ''
  }
  if ($Value -isnot [string]) {
    throw "$Name must be a string."
  }

  $trimmed = $Value.Trim()
  if ($trimmed -match "[`r`n]") {
    throw "$Name cannot contain line breaks."
  }
  if ($trimmed.Contains(';')) {
    throw "$Name cannot include ';'."
  }

  return $trimmed
}

function Resolve-KeyProvider {
  param([AllowNull()][AllowEmptyString()][string]$ExistingKeyProvider)

  $raw = $env:TSAAT_DB_CONFIG_DPAPI_SCOPE
  if (-not [string]::IsNullOrWhiteSpace($raw)) {
    switch ($raw.Trim().ToLowerInvariant()) {
      'local-machine' { return 'dpapi-local-machine' }
      'localmachine' { return 'dpapi-local-machine' }
      'current-user' { return 'dpapi-current-user' }
      'currentuser' { return 'dpapi-current-user' }
      default { throw 'TSAAT_DB_CONFIG_DPAPI_SCOPE must be current-user or local-machine.' }
    }
  }

  if ($ExistingKeyProvider -eq 'dpapi-local-machine') {
    return 'dpapi-local-machine'
  }

  return 'dpapi-current-user'
}

function Resolve-DpapiScope {
  param([Parameter(Mandatory = $true)][string]$KeyProvider)

  if ($KeyProvider -eq 'dpapi-local-machine') {
    return 'LocalMachine'
  }

  return 'CurrentUser'
}

function Invoke-Dpapi {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('protect', 'unprotect')][string]$Mode,
    [Parameter(Mandatory = $true)][ValidateSet('dpapi-current-user', 'dpapi-local-machine')][string]$KeyProvider,
    [Parameter(Mandatory = $true)][string]$InputBase64
  )

  $helperPath = Join-Path $script:RepoRoot 'scripts\invoke-dpapi.ps1'
  if (-not (Test-Path -LiteralPath $helperPath)) {
    throw "Missing DPAPI helper script: $helperPath"
  }

  $scope = Resolve-DpapiScope -KeyProvider $KeyProvider
  try {
    $output = & $helperPath -Mode $Mode -Scope $scope -InputBase64 $InputBase64 -EntropyText $EntropyText
  } catch {
    throw "DPAPI $Mode operation failed. $($_.Exception.Message)"
  }

  $trimmed = ([string]$output).Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    throw "DPAPI $Mode operation returned no output."
  }

  return $trimmed
}

function Normalize-DbSettings {
  param([Parameter(Mandatory = $true)][object]$InputValue)

  $authMode = (Require-String -Name 'authMode' -Value $InputValue.authMode).ToLowerInvariant()
  if ($authMode -ne 'trusted' -and $authMode -ne 'sql') {
    throw "authMode must be either 'trusted' or 'sql'."
  }

  $server = Require-String -Name 'Server' -Value $InputValue.server
  $database = Require-String -Name 'Database' -Value $InputValue.database
  $userId = Optional-String -Name 'User Id' -Value $InputValue.userId
  $password = Optional-String -Name 'Password' -Value $InputValue.password

  $sslEnabled = $false
  if ($InputValue.sslEnabled -is [bool]) {
    $sslEnabled = [bool]$InputValue.sslEnabled
  } elseif ($null -ne $InputValue.sslEnabled) {
    $parsedSslEnabled = Parse-Boolean -Value ([string]$InputValue.sslEnabled)
    $sslEnabled = $parsedSslEnabled -eq $true
  }

  $sslType = 'strict'
  if (-not [string]::IsNullOrWhiteSpace([string]$InputValue.sslType)) {
    $sslType = ([string]$InputValue.sslType).Trim().ToLowerInvariant()
  }
  if ($sslType -ne 'strict' -and $sslType -ne 'trust-server-certificate') {
    throw "sslType must be either 'strict' or 'trust-server-certificate'."
  }
  if ($sslType -eq 'trust-server-certificate') {
    $sslEnabled = $true
  }
  if (-not $sslEnabled) {
    $sslType = 'strict'
  }

  if ($authMode -eq 'trusted') {
    $userId = ''
    $password = ''
  } else {
    if ([string]::IsNullOrWhiteSpace($userId) -or [string]::IsNullOrWhiteSpace($password)) {
      throw 'SQL authentication requires both User Id and Password.'
    }
  }

  return [pscustomobject]@{
    server = $server
    database = $database
    authMode = $authMode
    userId = $userId
    password = $password
    sslEnabled = $sslEnabled
    sslType = $sslType
  }
}

function Read-EncryptedDbConfig {
  param([Parameter(Mandatory = $true)][string]$Path)

  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw 'DB_config is empty.'
  }
  $trimmed = $raw.Trim()
  if (-not $trimmed.StartsWith('{')) {
    throw 'DB_config is not in encrypted envelope format.'
  }

  try {
    $envelope = $trimmed | ConvertFrom-Json
  } catch {
    throw 'DB_config contains invalid JSON.'
  }

  $keyProvider = [string]$envelope.keyProvider
  if ($envelope.format -ne $EnvelopeFormat -or $envelope.version -ne $EnvelopeVersion -or $envelope.algorithm -ne $EnvelopeAlgorithm) {
    throw 'DB_config envelope metadata is invalid.'
  }
  if ($keyProvider -ne 'dpapi-current-user' -and $keyProvider -ne 'dpapi-local-machine') {
    throw 'DB_config key provider is invalid.'
  }

  $ciphertextBase64 = Require-String -Name 'ciphertextBase64' -Value $envelope.ciphertextBase64
  $payloadBase64 = Invoke-Dpapi -Mode unprotect -KeyProvider $keyProvider -InputBase64 $ciphertextBase64
  $payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadBase64))

  try {
    $payload = $payloadJson | ConvertFrom-Json
  } catch {
    throw 'Decrypted DB_config payload is not valid JSON.'
  }

  return [pscustomobject]@{
    keyProvider = $keyProvider
    payload = (Normalize-DbSettings -InputValue $payload)
  }
}

function ConvertTo-CanonicalJson {
  param([Parameter(Mandatory = $true)][object]$Value)

  return $Value | ConvertTo-Json -Depth 8
}

function Write-DbConfigFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object]$Payload,
    [Parameter(Mandatory = $true)][ValidateSet('dpapi-current-user', 'dpapi-local-machine')][string]$KeyProvider
  )

  $now = [DateTimeOffset]::UtcNow.ToString('o')
  $payloadJson = ConvertTo-CanonicalJson -Value $Payload
  $payloadBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payloadJson))
  $ciphertextBase64 = Invoke-Dpapi -Mode protect -KeyProvider $KeyProvider -InputBase64 $payloadBase64

  $envelope = [ordered]@{
    format = $EnvelopeFormat
    version = $EnvelopeVersion
    keyProvider = $KeyProvider
    algorithm = $EnvelopeAlgorithm
    ciphertextBase64 = $ciphertextBase64
    updatedAtUtc = $now
  }

  $content = (ConvertTo-CanonicalJson -Value $envelope) + [Environment]::NewLine
  $parent = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  $tempPath = "$Path.tmp-$PID-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Set-Content -LiteralPath $tempPath -Value $content -Encoding UTF8
  Move-Item -LiteralPath $tempPath -Destination $Path -Force

  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $Path /inheritance:r /grant:r "$($identity):(R,W)" "SYSTEM:(R,W)" "Administrators:(R,W)" | Out-Null
  } catch {
    Write-Warning 'Unable to harden DB_config ACL. Continuing with encrypted file contents.'
  }
}

function Env-Value {
  param([Parameter(Mandatory = $true)][string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $null
  }

  return $value.Trim()
}

function Build-CandidateSettings {
  param([AllowNull()][object]$ExistingPayload)

  $server = $ExistingPayload.server
  if ([string]::IsNullOrWhiteSpace($server)) {
    $server = Env-Value -Name 'TSAAT_SQL_SERVER'
  }
  if ([string]::IsNullOrWhiteSpace($server)) {
    $server = $DefaultServer
  }

  $database = $ExistingPayload.database
  if ([string]::IsNullOrWhiteSpace($database)) {
    $database = Env-Value -Name 'TSAAT_APP_DATABASE'
  }
  if ([string]::IsNullOrWhiteSpace($database)) {
    $database = $DefaultDatabase
  }

  $envTrusted = Parse-Boolean -Value $env:TSAAT_SQL_TRUSTED_CONNECTION
  $envUser = Env-Value -Name 'TSAAT_SQL_USER'
  $envPassword = Env-Value -Name 'TSAAT_SQL_PASSWORD'

  $authMode = $ExistingPayload.authMode
  if ([string]::IsNullOrWhiteSpace($authMode)) {
    if ($envTrusted -eq $true) {
      $authMode = 'trusted'
    } elseif ($envTrusted -eq $false -or -not [string]::IsNullOrWhiteSpace($envUser) -or -not [string]::IsNullOrWhiteSpace($envPassword)) {
      $authMode = 'sql'
    } else {
      $authMode = 'trusted'
    }
  }

  $userId = $ExistingPayload.userId
  if ([string]::IsNullOrWhiteSpace($userId)) {
    $userId = $envUser
  }
  if ([string]::IsNullOrWhiteSpace($userId)) {
    $userId = ''
  }

  $password = $ExistingPayload.password
  if ([string]::IsNullOrWhiteSpace($password)) {
    $password = $envPassword
  }
  if ([string]::IsNullOrWhiteSpace($password)) {
    $password = ''
  }

  $sslEnabled = $ExistingPayload.sslEnabled
  if ($null -eq $sslEnabled) {
    $sslEnabled = $false
  }
  $sslType = $ExistingPayload.sslType
  if ([string]::IsNullOrWhiteSpace($sslType)) {
    $sslType = 'strict'
  }

  $envEncrypt = Parse-Boolean -Value $env:TSAAT_SQL_ENCRYPT
  $envTrustServerCertificate = Parse-Boolean -Value $env:TSAAT_SQL_TRUST_SERVER_CERTIFICATE
  if ($null -ne $envEncrypt -and $null -eq $ExistingPayload.sslEnabled) {
    $sslEnabled = $envEncrypt
  }
  if ($envTrustServerCertificate -eq $true -and [string]::IsNullOrWhiteSpace($ExistingPayload.sslType)) {
    $sslEnabled = $true
    $sslType = 'trust-server-certificate'
  } elseif ($envEncrypt -eq $true -and [string]::IsNullOrWhiteSpace($ExistingPayload.sslType)) {
    $sslType = 'strict'
  }

  return Normalize-DbSettings -InputValue ([pscustomobject]@{
    server = $server
    database = $database
    authMode = $authMode
    userId = $userId
    password = $password
    sslEnabled = $sslEnabled
    sslType = $sslType
  })
}

function Has-RequiredEnvProvisioning {
  $server = Env-Value -Name 'TSAAT_SQL_SERVER'
  $database = Env-Value -Name 'TSAAT_APP_DATABASE'
  if ([string]::IsNullOrWhiteSpace($server) -or [string]::IsNullOrWhiteSpace($database)) {
    return $false
  }

  $trusted = Parse-Boolean -Value $env:TSAAT_SQL_TRUSTED_CONNECTION
  if ($trusted -eq $true) {
    return $true
  }

  $user = Env-Value -Name 'TSAAT_SQL_USER'
  $password = Env-Value -Name 'TSAAT_SQL_PASSWORD'
  return (-not [string]::IsNullOrWhiteSpace($user) -and -not [string]::IsNullOrWhiteSpace($password))
}

function Write-SettingsSummary {
  param([Parameter(Mandatory = $true)][object]$Settings)

  $sslSummary = if ($Settings.sslEnabled) { $Settings.sslType } else { 'disabled' }
  Write-Host 'Database settings:'
  Write-Host "  Server: $($Settings.server)"
  Write-Host "  Database: $($Settings.database)"
  Write-Host "  Authentication: $($Settings.authMode)"
  if ($Settings.authMode -eq 'sql') {
    Write-Host "  SQL User Id: $($Settings.userId)"
    Write-Host '  SQL Password: set (not shown)'
  }
  Write-Host "  SSL: $sslSummary"
}

function Read-TextWithDefault {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [AllowNull()][AllowEmptyString()][string]$DefaultValue
  )

  if ([string]::IsNullOrWhiteSpace($DefaultValue)) {
    $value = Read-Host $Prompt
  } else {
    $value = Read-Host "$Prompt [$DefaultValue]"
  }
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  return $value.Trim()
}

function Read-YesNo {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [Parameter(Mandatory = $true)][bool]$DefaultValue
  )

  $suffix = if ($DefaultValue) { '[Y/n]' } else { '[y/N]' }
  while ($true) {
    $answer = (Read-Host "$Prompt $suffix").Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($answer)) {
      return $DefaultValue
    }
    if ($answer -eq 'y' -or $answer -eq 'yes') {
      return $true
    }
    if ($answer -eq 'n' -or $answer -eq 'no') {
      return $false
    }
    Write-Host 'Enter y or n.'
  }
}

function Read-AuthMode {
  param([Parameter(Mandatory = $true)][string]$DefaultValue)

  while ($true) {
    $value = (Read-TextWithDefault -Prompt 'Authentication mode (trusted/sql)' -DefaultValue $DefaultValue).ToLowerInvariant()
    if ($value -eq 'trusted' -or $value -eq 'sql') {
      return $value
    }
    Write-Host "Enter 'trusted' or 'sql'."
  }
}

function Read-SslType {
  param([Parameter(Mandatory = $true)][string]$DefaultValue)

  while ($true) {
    $value = (Read-TextWithDefault -Prompt 'SSL type (strict/trust-server-certificate)' -DefaultValue $DefaultValue).ToLowerInvariant()
    if ($value -eq 'strict' -or $value -eq 'trust-server-certificate') {
      return $value
    }
    Write-Host "Enter 'strict' or 'trust-server-certificate'."
  }
}

function Read-InteractiveSettings {
  param([Parameter(Mandatory = $true)][object]$Defaults)

  $server = Read-TextWithDefault -Prompt 'SQL Server' -DefaultValue $Defaults.server
  $database = Read-TextWithDefault -Prompt 'Application database' -DefaultValue $Defaults.database
  $authMode = Read-AuthMode -DefaultValue $Defaults.authMode
  $userId = ''
  $password = ''

  if ($authMode -eq 'sql') {
    $userId = Read-TextWithDefault -Prompt 'SQL User Id' -DefaultValue $Defaults.userId
    $keepExistingPassword = $false
    if (-not [string]::IsNullOrWhiteSpace($Defaults.password)) {
      $keepExistingPassword = Read-YesNo -Prompt 'Keep existing SQL password?' -DefaultValue $true
    }
    if ($keepExistingPassword) {
      $password = $Defaults.password
    } else {
      $securePassword = Read-Host 'SQL Password' -AsSecureString
      $password = Convert-SecureStringToPlaintext -SecureString $securePassword
    }
  }

  $sslEnabled = Read-YesNo -Prompt 'Enable SQL SSL encryption?' -DefaultValue ([bool]$Defaults.sslEnabled)
  $sslType = 'strict'
  if ($sslEnabled) {
    $sslType = Read-SslType -DefaultValue $Defaults.sslType
  }

  return Normalize-DbSettings -InputValue ([pscustomobject]@{
    server = $server
    database = $database
    authMode = $authMode
    userId = $userId
    password = $password
    sslEnabled = $sslEnabled
    sslType = $sslType
  })
}

$script:RepoRoot = Resolve-RepoRoot -InputRoot $RepoRoot
if ([string]::IsNullOrWhiteSpace($DbConfigPath)) {
  $DbConfigPath = Join-Path $script:RepoRoot 'DB_config'
}

$assumeYes = Test-AssumeYes
$interactive = Is-Interactive
$existing = $null
$existingReadError = $null

if (Test-Path -LiteralPath $DbConfigPath) {
  try {
    $existing = Read-EncryptedDbConfig -Path $DbConfigPath
  } catch {
    $existingReadError = $_.Exception.Message
    Write-Warning ("Existing DB_config cannot be decrypted or validated by this Windows identity. It may have been created by another Windows user/machine or it may be invalid. Details: {0}" -f $existingReadError)
  }

  if ($null -ne $existing) {
    if ($assumeYes -or -not $interactive) {
      Write-Host "Validated encrypted DB_config file: $DbConfigPath"
      exit 0
    }

    Write-SettingsSummary -Settings $existing.payload
    $acceptExisting = Read-YesNo -Prompt 'Use these database settings?' -DefaultValue $true
    $settings = if ($acceptExisting) { $existing.payload } else { Read-InteractiveSettings -Defaults $existing.payload }
    $keyProvider = Resolve-KeyProvider -ExistingKeyProvider $existing.keyProvider
    Write-DbConfigFile -Path $DbConfigPath -Payload $settings -KeyProvider $keyProvider
    Write-Host "Confirmed encrypted DB_config file: $DbConfigPath"
    exit 0
  }

  if (-not $interactive -and -not $assumeYes) {
    throw 'Existing DB_config cannot be decrypted or validated by this Windows identity. Re-run CreateDB.cmd or compileApp.cmd interactively to recreate it, or set TSAAT_DB_CONFIG_ASSUME_YES=true with TSAAT_SQL_SERVER, TSAAT_APP_DATABASE, and either trusted auth or SQL credentials.'
  }

  if ($assumeYes -and -not (Has-RequiredEnvProvisioning)) {
    throw 'Existing DB_config cannot be decrypted or validated by this Windows identity. Unattended recreation requires TSAAT_DB_CONFIG_ASSUME_YES=true, TSAAT_SQL_SERVER, TSAAT_APP_DATABASE, and either TSAAT_SQL_TRUSTED_CONNECTION=true or both TSAAT_SQL_USER and TSAAT_SQL_PASSWORD.'
  }

  $recreateDefaults = Build-CandidateSettings -ExistingPayload ([pscustomobject]@{})
  $settingsToRewrite = $recreateDefaults

  if ($interactive -and -not $assumeYes) {
    $recreate = Read-YesNo -Prompt 'Recreate DB_config for this Windows user?' -DefaultValue $true
    if (-not $recreate) {
      throw 'DB_config was not changed. Recreate it before running database or compile commands on this Windows identity.'
    }
    Write-Host 'Confirm database settings to recreate DB_config.'
    Write-SettingsSummary -Settings $recreateDefaults
    $acceptDefaults = Read-YesNo -Prompt 'Use these database settings?' -DefaultValue $true
    if (-not $acceptDefaults) {
      $settingsToRewrite = Read-InteractiveSettings -Defaults $recreateDefaults
    }
  }

  $rewriteKeyProvider = Resolve-KeyProvider -ExistingKeyProvider $null
  Write-DbConfigFile -Path $DbConfigPath -Payload $settingsToRewrite -KeyProvider $rewriteKeyProvider
  Write-Host "Recreated encrypted DB_config file: $DbConfigPath"
  exit 0
}

if (-not $interactive -and -not $assumeYes) {
  throw 'DB_config is missing and interactive database settings input is unavailable. Set TSAAT_DB_CONFIG_ASSUME_YES=true with TSAAT_SQL_SERVER, TSAAT_APP_DATABASE, and either trusted auth or SQL credentials.'
}

if ($assumeYes -and -not (Has-RequiredEnvProvisioning)) {
  throw 'DB_config is missing. Unattended creation requires TSAAT_DB_CONFIG_ASSUME_YES=true, TSAAT_SQL_SERVER, TSAAT_APP_DATABASE, and either TSAAT_SQL_TRUSTED_CONNECTION=true or both TSAAT_SQL_USER and TSAAT_SQL_PASSWORD.'
}

$defaults = Build-CandidateSettings -ExistingPayload ([pscustomobject]@{})
$settingsToWrite = $defaults

if ($interactive -and -not $assumeYes) {
  Write-Host 'DB_config is missing. Confirm database settings to create it.'
  Write-SettingsSummary -Settings $defaults
  $acceptDefaults = Read-YesNo -Prompt 'Use these database settings?' -DefaultValue $true
  if (-not $acceptDefaults) {
    $settingsToWrite = Read-InteractiveSettings -Defaults $defaults
  }
}

$newKeyProvider = Resolve-KeyProvider -ExistingKeyProvider $null
Write-DbConfigFile -Path $DbConfigPath -Payload $settingsToWrite -KeyProvider $newKeyProvider
Write-Host "Created encrypted DB_config file: $DbConfigPath"
