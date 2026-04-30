[CmdletBinding()]
param(
  [string]$RepoRoot,
  [Parameter(Mandatory = $true)]
  [AllowNull()]
  [AllowEmptyString()]
  [string]$StagingRoot
)

$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  param([AllowNull()][AllowEmptyString()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
  }

  return (Resolve-Path -LiteralPath $Value).Path
}

function Normalize-UncRoot {
  param(
    [Parameter(Mandatory = $true)]
    [AllowNull()]
    [AllowEmptyString()]
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw 'SqlServerFiles mode requires a UNC staging root.'
  }

  $root = $Value.Trim()
  if ($root.StartsWith('\\?\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "UNC staging root must use the standard \\server\share form, not an extended path: $root"
  }
  if (-not $root.StartsWith('\\', [System.StringComparison]::Ordinal)) {
    throw "UNC staging root must start with \\server\share: $root"
  }

  $root = $root.TrimEnd('\')
  $tail = $root.Substring(2)
  $parts = $tail.Split('\')
  if ($parts.Count -lt 2) {
    throw "UNC staging root must include both server and share names: $root"
  }

  foreach ($part in $parts) {
    if ($part.Length -eq 0) {
      throw "UNC staging root contains an empty path component: $root"
    }
    if ($part -match '[<>:"|?*\x00-\x1F]') {
      throw "UNC staging root contains an invalid path character: $root"
    }
  }

  return $root
}

function To-CmdSafeValue {
  param([AllowNull()][AllowEmptyString()][string]$Value)

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

function Copy-And-VerifyFiles {
  param(
    [Parameter(Mandatory = $true)][object[]]$Files,
    [Parameter(Mandatory = $true)][string]$DestinationRoot
  )

  [void][System.IO.Directory]::CreateDirectory($DestinationRoot)

  foreach ($file in $Files) {
    $sourceItem = Get-Item -LiteralPath ([string]$file.SourcePath) -ErrorAction Stop
    if ($sourceItem.PSIsContainer) {
      throw "Source path is not a file: $($sourceItem.FullName)"
    }

    $destinationPath = Join-Path $DestinationRoot ([string]$file.FileName)
    [System.IO.File]::Copy($sourceItem.FullName, $destinationPath, $true)

    $destinationItem = Get-Item -LiteralPath $destinationPath -ErrorAction Stop
    if ($destinationItem.PSIsContainer) {
      throw "Destination path is not a file after copy: $destinationPath"
    }
    if ($destinationItem.Length -ne $sourceItem.Length) {
      throw "Copied file length mismatch for $($sourceItem.Name). Source=$($sourceItem.Length), Destination=$($destinationItem.Length)."
    }
  }
}

$resolvedRepoRoot = Resolve-RepoRoot -Value $RepoRoot
$normalizedStagingRoot = Normalize-UncRoot -Value $StagingRoot

$packageRoot = Join-Path $resolvedRepoRoot 'Database Schema'
$packageDataRoot = Join-Path $packageRoot 'data'
$manifestPath = Join-Path $packageDataRoot 'database-build-manifest.json'

if (-not (Test-Path -LiteralPath $packageDataRoot)) {
  throw "Package data directory missing: $packageDataRoot"
}
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Database build manifest missing: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

$packageFiles = @(
  Get-ChildItem -LiteralPath $packageDataRoot -Filter '*.json' -File |
    Sort-Object Name |
    ForEach-Object {
      [pscustomobject]@{
        SourcePath = $_.FullName
        FileName = $_.Name
      }
    }
)
if ($packageFiles.Count -eq 0) {
  throw "No package JSON files found in: $packageDataRoot"
}

$snapshotsRoot = Join-Path $resolvedRepoRoot 'data\snapshots'
if ($manifest.snapshotSourceDirectory) {
  $candidate = Join-Path $packageRoot ([string]$manifest.snapshotSourceDirectory)
  $candidateResolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($candidateResolved) {
    $snapshotsRoot = $candidateResolved.Path
  }
}

if (-not (Test-Path -LiteralPath $snapshotsRoot)) {
  throw "Snapshots directory missing: $snapshotsRoot"
}

$snapshotFiles = @()
foreach ($snapshotFile in $manifest.snapshotFiles) {
  $fileName = [string]$snapshotFile
  if ([string]::IsNullOrWhiteSpace($fileName)) {
    throw 'Database build manifest contains a blank snapshot file entry.'
  }

  $sourcePath = Join-Path $snapshotsRoot $fileName
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Snapshot file missing: $sourcePath"
  }

  $snapshotFiles += [pscustomobject]@{
    SourcePath = $sourcePath
    FileName = $fileName
  }
}
if ($snapshotFiles.Count -eq 0) {
  throw 'Database build manifest does not list any snapshot files.'
}

$packageDestinationRoot = Join-Path $normalizedStagingRoot 'package-data'
$snapshotsDestinationRoot = Join-Path $normalizedStagingRoot 'snapshots'

Copy-And-VerifyFiles -Files $packageFiles -DestinationRoot $packageDestinationRoot
Copy-And-VerifyFiles -Files $snapshotFiles -DestinationRoot $snapshotsDestinationRoot

Emit-CmdSet -Name 'SQL_SERVER_STAGING_UNC_ROOT' -Value $normalizedStagingRoot
Emit-CmdSet -Name 'SQL_SERVER_PACKAGE_DATA_ROOT' -Value $packageDestinationRoot
Emit-CmdSet -Name 'SQL_SERVER_SNAPSHOTS_ROOT' -Value $snapshotsDestinationRoot
