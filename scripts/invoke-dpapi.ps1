[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('protect', 'unprotect')]
  [string]$Mode,

  [Parameter(Mandatory = $true)]
  [ValidateSet('CurrentUser', 'LocalMachine')]
  [string]$Scope,

  [Parameter(Mandatory = $true)]
  [string]$InputBase64,

  [string]$EntropyText = 'TSAAT_DB_CONFIG_V1'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

if ([string]::IsNullOrWhiteSpace($InputBase64)) {
  throw 'InputBase64 is required.'
}

$entropyBytes = [System.Text.Encoding]::UTF8.GetBytes($EntropyText)
$scopeValue = [System.Security.Cryptography.DataProtectionScope]::$Scope
$inputBytes = [Convert]::FromBase64String($InputBase64)

if ($Mode -eq 'protect') {
  $outputBytes = [System.Security.Cryptography.ProtectedData]::Protect($inputBytes, $entropyBytes, $scopeValue)
} else {
  $outputBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($inputBytes, $entropyBytes, $scopeValue)
}

Write-Output ([Convert]::ToBase64String($outputBytes))
