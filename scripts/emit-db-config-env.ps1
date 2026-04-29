[CmdletBinding()]
param(
  [string]$RepoRoot,
  [string]$DbConfigPath
)

$ErrorActionPreference = 'Stop'

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

  return $trimmed
}

function Require-OptionalString {
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

  return $Value.Trim()
}

function To-CmdSafeValue {
  param(
    [AllowNull()][AllowEmptyString()][string]$Value
  )

  if ($null -eq $Value) {
    return ''
  }

  return $Value.Replace('"', '""')
}

function Emit-CmdSet {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [AllowNull()][AllowEmptyString()][string]$Value
  )

  $safeValue = To-CmdSafeValue -Value $Value
  Write-Output ("set ""{0}={1}""" -f $Name, $safeValue)
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $RepoRoot = Split-Path -Parent $scriptDir
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
if ([string]::IsNullOrWhiteSpace($DbConfigPath)) {
  $DbConfigPath = Join-Path $RepoRoot 'DB_config'
}

if (-not (Test-Path -LiteralPath $DbConfigPath)) {
  throw "Missing DB config file: $DbConfigPath"
}

$helperPath = Join-Path $RepoRoot 'scripts\invoke-dpapi.ps1'
if (-not (Test-Path -LiteralPath $helperPath)) {
  throw "Missing DPAPI helper script: $helperPath"
}

$raw = Get-Content -LiteralPath $DbConfigPath -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($raw)) {
  throw 'DB_config is empty.'
}

$trimmed = $raw.Trim()
if (-not $trimmed.StartsWith('{')) {
  throw 'DB_config is not in encrypted envelope format. Re-run CreateDB.cmd or compileApp.cmd to recreate it, or open /settings and save database settings.'
}

try {
  $envelope = $trimmed | ConvertFrom-Json
} catch {
  throw 'DB_config contains invalid JSON.'
}

if ($envelope.format -ne 'tsaat-db-config' -or $envelope.version -ne 1 -or $envelope.algorithm -ne 'dpapi') {
  throw 'DB_config envelope metadata is invalid.'
}

$keyProvider = [string]$envelope.keyProvider
$scope = switch ($keyProvider.Trim().ToLowerInvariant()) {
  'dpapi-current-user' { 'CurrentUser' }
  'dpapi-local-machine' { 'LocalMachine' }
  default { throw 'DB_config key provider is invalid.' }
}

$ciphertextBase64 = [string]$envelope.ciphertextBase64
if ([string]::IsNullOrWhiteSpace($ciphertextBase64)) {
  throw 'DB_config ciphertext is missing.'
}

try {
  $payloadBase64 = & $helperPath -Mode unprotect -Scope $scope -InputBase64 $ciphertextBase64 -EntropyText 'TSAAT_DB_CONFIG_V1'
} catch {
  throw "Unable to decrypt DB_config for this Windows identity. Re-run CreateDB.cmd or compileApp.cmd to recreate it locally. $($_.Exception.Message)"
}
$payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadBase64.Trim()))

try {
  $payload = $payloadJson | ConvertFrom-Json
} catch {
  throw 'Decrypted DB_config payload is not valid JSON.'
}

$server = Require-String -Name 'Server' -Value $payload.server
$database = Require-String -Name 'Database' -Value $payload.database
$authMode = Require-String -Name 'authMode' -Value $payload.authMode
$userId = Require-OptionalString -Name 'User Id' -Value $payload.userId
$password = Require-OptionalString -Name 'Password' -Value $payload.password

if ($authMode -ne 'trusted' -and $authMode -ne 'sql') {
  throw "authMode must be either 'trusted' or 'sql'."
}

if ($payload.sslEnabled -isnot [bool]) {
  throw 'sslEnabled must be a boolean.'
}
$sslEnabled = [bool]$payload.sslEnabled

$sslType = Require-String -Name 'sslType' -Value $payload.sslType
if ($sslType -ne 'strict' -and $sslType -ne 'trust-server-certificate') {
  throw "sslType must be either 'strict' or 'trust-server-certificate'."
}

if ($authMode -eq 'sql') {
  if ([string]::IsNullOrWhiteSpace($userId) -or [string]::IsNullOrWhiteSpace($password)) {
    throw 'DB_config SQL authentication requires User Id and Password.'
  }
}

$trustedConnection = if ($authMode -eq 'trusted') { 'true' } else { 'false' }
$encrypt = if ($sslEnabled) { 'true' } else { 'false' }
$trustServerCertificate = if ($sslEnabled -and $sslType -eq 'trust-server-certificate') { 'true' } else { 'false' }

Emit-CmdSet -Name 'DB_CONF_SERVER' -Value $server
Emit-CmdSet -Name 'DB_CONF_DATABASE' -Value $database
Emit-CmdSet -Name 'DB_CONF_AUTH_MODE' -Value $authMode
Emit-CmdSet -Name 'DB_CONF_TRUSTED_CONNECTION' -Value $trustedConnection
Emit-CmdSet -Name 'DB_CONF_ENCRYPT' -Value $encrypt
Emit-CmdSet -Name 'DB_CONF_TRUST_SERVER_CERTIFICATE' -Value $trustServerCertificate
Emit-CmdSet -Name 'DB_SERVER' -Value $server
Emit-CmdSet -Name 'DB_APP_DATABASE' -Value $database
Emit-CmdSet -Name 'DB_AUTH_MODE' -Value $authMode
Emit-CmdSet -Name 'DB_ENCRYPT' -Value $encrypt
Emit-CmdSet -Name 'DB_TRUST_SERVER_CERTIFICATE' -Value $trustServerCertificate

if ($authMode -eq 'sql') {
  Emit-CmdSet -Name 'DB_CONF_USER_ID' -Value $userId
  Emit-CmdSet -Name 'DB_CONF_PASSWORD' -Value $password
  Emit-CmdSet -Name 'DB_USER_ID' -Value $userId
  Emit-CmdSet -Name 'DB_PASSWORD' -Value $password
}
