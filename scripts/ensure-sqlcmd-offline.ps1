[CmdletBinding()]
param(
  [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

function Assert-FileFingerprint {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][Int64]$ExpectedBytes,
    [Parameter(Mandatory = $true)][string]$ExpectedSha256,
    [Parameter(Mandatory = $true)][string]$DisplayName
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$DisplayName is missing: $Path"
  }

  $item = Get-Item -LiteralPath $Path
  if ($item.Length -ne $ExpectedBytes) {
    throw "$DisplayName has unexpected size at $Path. Expected $ExpectedBytes bytes, found $($item.Length) bytes."
  }

  $actualHash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualHash -ne $ExpectedSha256.ToUpperInvariant()) {
    throw "$DisplayName has unexpected SHA-256 at $Path. Expected $ExpectedSha256, found $actualHash."
  }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $RepoRoot = Split-Path -Parent $scriptDir
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

$archivePath = Join-Path $RepoRoot 'Dependencies\offline-artifacts\sqlcmd\sqlcmd-windows-amd64-1.10.0.zip'
$archiveDownloadUrl = 'https://github.com/microsoft/go-sqlcmd/releases/download/v1.10.0/sqlcmd-windows-amd64.zip'
$expectedArchiveBytes = 23964312
$expectedArchiveSha256 = 'A4C28332FCC6E497D655E53AC8F4939F4AB170F9CFD32D0FA5081B60F4D9D691'

$extractDir = Join-Path $RepoRoot 'Dependencies\external\cache\sqlcmd-windows-amd64-1.10.0'
$extractedExePath = Join-Path $extractDir 'sqlcmd.exe'
$extractedNoticePath = Join-Path $extractDir 'NOTICE.md'

$stagedDir = Join-Path $RepoRoot 'Dependencies\external\sqlcmd\win-x64'
$stagedExePath = Join-Path $stagedDir 'sqlcmd.exe'
$stagedNoticePath = Join-Path $stagedDir 'NOTICE.md'
$expectedExeBytes = 24499224
$expectedExeSha256 = 'D9DBD1A8BD26213747B246DEBA1E13663A7E1DEF530CD961D7582B41A5E27852'

if (Test-Path -LiteralPath $stagedExePath) {
  try {
    Assert-FileFingerprint -Path $stagedExePath -ExpectedBytes $expectedExeBytes -ExpectedSha256 $expectedExeSha256 -DisplayName 'Bundled sqlcmd executable'
    (Resolve-Path -LiteralPath $stagedExePath).Path
    exit 0
  } catch {
    Remove-Item -LiteralPath $stagedExePath -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path -LiteralPath $archivePath)) {
  throw "Missing bundled sqlcmd archive: $archivePath. Restore the repository artifact or re-download from $archiveDownloadUrl."
}

Assert-FileFingerprint -Path $archivePath -ExpectedBytes $expectedArchiveBytes -ExpectedSha256 $expectedArchiveSha256 -DisplayName 'Bundled sqlcmd archive'

if (Test-Path -LiteralPath $extractDir) {
  Remove-Item -LiteralPath $extractDir -Recurse -Force
}
New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force

if (-not (Test-Path -LiteralPath $extractedExePath)) {
  throw "Bundled sqlcmd archive did not contain expected executable: $extractedExePath"
}

Assert-FileFingerprint -Path $extractedExePath -ExpectedBytes $expectedExeBytes -ExpectedSha256 $expectedExeSha256 -DisplayName 'Extracted sqlcmd executable'

New-Item -ItemType Directory -Path $stagedDir -Force | Out-Null
Copy-Item -LiteralPath $extractedExePath -Destination $stagedExePath -Force

if (Test-Path -LiteralPath $extractedNoticePath) {
  Copy-Item -LiteralPath $extractedNoticePath -Destination $stagedNoticePath -Force
}

Assert-FileFingerprint -Path $stagedExePath -ExpectedBytes $expectedExeBytes -ExpectedSha256 $expectedExeSha256 -DisplayName 'Staged sqlcmd executable'
(Resolve-Path -LiteralPath $stagedExePath).Path
