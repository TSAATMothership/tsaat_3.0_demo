[CmdletBinding()]
param(
  [string]$RepoRoot,
  [string]$LoginDetailsPath
)

$ErrorActionPreference = 'Stop'

$EnvelopeFormat = 'tsaat-logindetails'
$EnvelopeVersion = 1
$EnvelopeAlgorithm = 'dpapi'
$KeyProvider = 'dpapi-current-user'
$EntropyText = 'TSAAT_LOGINDETAILS_V1'
$HashAlgorithmName = 'PBKDF2-HMAC-SHA256'
$IterationCount = 210000
$MinIterationCount = 100000
$HashBytes = 32
$SaltBytes = 16
$MinPasswordLength = 8

function Resolve-RepoRoot {
  param([AllowNull()][AllowEmptyString()][string]$InputRoot)

  if (-not [string]::IsNullOrWhiteSpace($InputRoot)) {
    return (Resolve-Path -LiteralPath $InputRoot).Path
  }

  return (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
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

  return $trimmed
}

function Normalize-Username {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)

  $username = (Require-String -Name 'Username' -Value $Value).ToLowerInvariant()
  if ($username.Length -gt 120) {
    throw 'Username is too long.'
  }
  if ($username -match "[`r`n`t]") {
    throw 'Username contains invalid characters.'
  }

  return $username
}

function Normalize-Password {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)

  $password = $Value.Trim()
  if ($password.Length -eq 0) {
    throw 'Password is required.'
  }
  if ($password.Length -lt $MinPasswordLength) {
    throw "Password must be at least $MinPasswordLength characters."
  }
  if ($password.Length -gt 256) {
    throw 'Password is too long.'
  }

  return $password
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

function Read-RequiredUsername {
  if (-not [string]::IsNullOrWhiteSpace($env:TSAAT_LOGIN_USERNAME)) {
    return Normalize-Username -Value $env:TSAAT_LOGIN_USERNAME
  }

  if ([Console]::IsInputRedirected) {
    throw 'logindetails is missing and interactive username input is unavailable. Set TSAAT_LOGIN_USERNAME and TSAAT_LOGIN_PASSWORD before running compileApp.cmd.'
  }

  return Normalize-Username -Value (Read-Host 'Enter TSAAT login username')
}

function Read-RequiredPassword {
  if (-not [string]::IsNullOrWhiteSpace($env:TSAAT_LOGIN_PASSWORD)) {
    return Normalize-Password -Value $env:TSAAT_LOGIN_PASSWORD
  }

  if ([Console]::IsInputRedirected) {
    throw 'logindetails is missing and interactive password input is unavailable. Set TSAAT_LOGIN_USERNAME and TSAAT_LOGIN_PASSWORD before running compileApp.cmd.'
  }

  $securePassword = Read-Host 'Enter TSAAT login password' -AsSecureString
  return Normalize-Password -Value (Convert-SecureStringToPlaintext -SecureString $securePassword)
}

function Convert-Base64ToBytes {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value,
    [Parameter(Mandatory = $true)][int]$ExpectedLength
  )

  $raw = Require-String -Name $Name -Value $Value
  try {
    $bytes = [Convert]::FromBase64String($raw)
  } catch {
    throw "$Name is not valid base64."
  }
  if ($bytes.Length -ne $ExpectedLength) {
    throw "$Name has unexpected length."
  }

  return $bytes
}

function Invoke-Dpapi {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('protect', 'unprotect')][string]$Mode,
    [Parameter(Mandatory = $true)][string]$InputBase64
  )

  $helperPath = Join-Path $script:RepoRoot 'scripts\invoke-dpapi.ps1'
  if (-not (Test-Path -LiteralPath $helperPath)) {
    throw "Missing DPAPI helper script: $helperPath"
  }

  try {
    $output = & $helperPath -Mode $Mode -Scope CurrentUser -InputBase64 $InputBase64 -EntropyText $EntropyText
  } catch {
    throw "DPAPI $Mode operation failed. $($_.Exception.Message)"
  }

  $trimmed = ([string]$output).Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    throw "DPAPI $Mode operation returned no output."
  }

  return $trimmed
}

function ConvertTo-CanonicalJson {
  param([Parameter(Mandatory = $true)][object]$Value)

  return $Value | ConvertTo-Json -Depth 8
}

function Read-EncryptedPayload {
  param([Parameter(Mandatory = $true)][string]$Path)

  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw 'logindetails is empty.'
  }
  $trimmed = $raw.Trim()
  if (-not $trimmed.StartsWith('{')) {
    throw 'logindetails is not in encrypted envelope format.'
  }

  try {
    $envelope = $trimmed | ConvertFrom-Json
  } catch {
    throw 'logindetails contains invalid JSON.'
  }

  if ($envelope.format -ne $EnvelopeFormat -or $envelope.version -ne $EnvelopeVersion -or $envelope.algorithm -ne $EnvelopeAlgorithm -or $envelope.keyProvider -ne $KeyProvider) {
    throw 'logindetails envelope metadata is invalid.'
  }

  $ciphertextBase64 = Require-String -Name 'ciphertextBase64' -Value $envelope.ciphertextBase64
  $payloadBase64 = Invoke-Dpapi -Mode unprotect -InputBase64 $ciphertextBase64
  $payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadBase64))

  try {
    return $payloadJson | ConvertFrom-Json
  } catch {
    throw 'Decrypted logindetails payload is not valid JSON.'
  }
}

function Test-LoginDetailsPayload {
  param([Parameter(Mandatory = $true)][object]$Payload)

  [void](Normalize-Username -Value $Payload.username)
  [void](Convert-Base64ToBytes -Name 'Password hash' -Value $Payload.passwordHashBase64 -ExpectedLength $HashBytes)
  [void](Convert-Base64ToBytes -Name 'Password salt' -Value $Payload.passwordSaltBase64 -ExpectedLength $SaltBytes)

  if ($Payload.hashAlgorithm -ne $HashAlgorithmName) {
    throw 'Stored password algorithm is unsupported.'
  }

  $payloadIterationCount = [int]$Payload.iterationCount
  if ($payloadIterationCount -lt $MinIterationCount) {
    throw "Iteration count must be at least $MinIterationCount."
  }

  $payloadSessionVersion = [int]$Payload.sessionVersion
  if ($payloadSessionVersion -lt 1) {
    throw 'Session version must be at least 1.'
  }

  [void](Require-String -Name 'passwordChangedAtUtc' -Value $Payload.passwordChangedAtUtc)
  [void](Require-String -Name 'createdAtUtc' -Value $Payload.createdAtUtc)
  [void](Require-String -Name 'updatedAtUtc' -Value $Payload.updatedAtUtc)
}

function Write-LoginDetailsFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object]$Envelope
  )

  $content = (ConvertTo-CanonicalJson -Value $Envelope) + [Environment]::NewLine
  $tempPath = "$Path.tmp-$PID-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Set-Content -LiteralPath $tempPath -Value $content -Encoding UTF8
  Move-Item -LiteralPath $tempPath -Destination $Path -Force

  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $Path /inheritance:r /grant:r "$($identity):(R,W)" "SYSTEM:(R,W)" "Administrators:(R,W)" | Out-Null
  } catch {
    Write-Warning 'Unable to harden logindetails ACL. Continuing with encrypted file contents.'
  }
}

function New-LoginDetailsFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  $username = Read-RequiredUsername
  $password = Read-RequiredPassword
  $salt = New-Object byte[] $SaltBytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($salt)
  } finally {
    $rng.Dispose()
  }

  $derive = [Security.Cryptography.Rfc2898DeriveBytes]::new(
    $password,
    $salt,
    $IterationCount,
    [Security.Cryptography.HashAlgorithmName]::SHA256
  )
  try {
    $passwordHash = $derive.GetBytes($HashBytes)
  } finally {
    $derive.Dispose()
  }

  $now = [DateTimeOffset]::UtcNow.ToString('o')
  $payload = [ordered]@{
    username = $username
    passwordHashBase64 = [Convert]::ToBase64String($passwordHash)
    passwordSaltBase64 = [Convert]::ToBase64String($salt)
    hashAlgorithm = $HashAlgorithmName
    iterationCount = $IterationCount
    passwordChangedAtUtc = $now
    sessionVersion = 1
    createdAtUtc = $now
    updatedAtUtc = $now
  }
  $payloadJson = ConvertTo-CanonicalJson -Value $payload
  $payloadBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payloadJson))
  $ciphertextBase64 = Invoke-Dpapi -Mode protect -InputBase64 $payloadBase64

  $envelope = [ordered]@{
    format = $EnvelopeFormat
    version = $EnvelopeVersion
    keyProvider = $KeyProvider
    algorithm = $EnvelopeAlgorithm
    ciphertextBase64 = $ciphertextBase64
    updatedAtUtc = $now
  }

  Write-LoginDetailsFile -Path $Path -Envelope $envelope
  Write-Host "Created encrypted logindetails file: $Path"
}

$script:RepoRoot = Resolve-RepoRoot -InputRoot $RepoRoot
if ([string]::IsNullOrWhiteSpace($LoginDetailsPath)) {
  $LoginDetailsPath = Join-Path $script:RepoRoot 'logindetails'
}

if (Test-Path -LiteralPath $LoginDetailsPath) {
  $payload = Read-EncryptedPayload -Path $LoginDetailsPath
  Test-LoginDetailsPayload -Payload $payload
  Write-Host "Validated encrypted logindetails file: $LoginDetailsPath"
  exit 0
}

New-LoginDetailsFile -Path $LoginDetailsPath
