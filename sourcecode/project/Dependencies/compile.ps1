[CmdletBinding()]
param(
    [switch]$SkipDependencyInstall,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $false)][string[]]$Arguments = @()
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Command $($Arguments -join ' ') (exit code $LASTEXITCODE)."
    }
}

function Sync-DirectoryWithRobocopy {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "$Label source directory was not found: $Source"
    }

    if (-not (Test-Path -LiteralPath $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }

    $args = @(
        $Source,
        $Destination,
        "/MIR",
        "/R:1",
        "/W:1",
        "/NFL",
        "/NDL",
        "/NP",
        "/NJH",
        "/NJS"
    )

    & robocopy @args | Out-Host
    $robocopyExitCode = $LASTEXITCODE
    if ($robocopyExitCode -ge 8) {
        throw "Failed to sync $Label (robocopy exit code $robocopyExitCode)."
    }
}

function Get-NormalizedVersion {
    param([Parameter(Mandatory = $true)][string]$RawVersion)

    $clean = $RawVersion.Trim().TrimStart("v")
    if ($clean -match "^(\d+)\.(\d+)\.(\d+)") {
        return [Version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
    }

    throw "Unable to parse version string: $RawVersion"
}

function Assert-MinVersion {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][Version]$Actual,
        [Parameter(Mandatory = $true)][Version]$Minimum
    )

    if ($Actual -lt $Minimum) {
        throw "$Label version $Actual is below the minimum required version $Minimum."
    }
}

function Assert-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

Set-Location $repoRoot

if (-not (Test-Path (Join-Path $repoRoot "package.json"))) {
    throw "package.json not found at $repoRoot. Run this script from inside the TSAAT repository."
}

Write-Host "==> Checking required commands..." -ForegroundColor Cyan
Assert-CommandExists -Name "node"
Assert-CommandExists -Name "npm"
Assert-CommandExists -Name "robocopy"

$nodeVersionText = (node --version).Trim()
$npmVersionText = (npm --version).Trim()

$nodeVersion = Get-NormalizedVersion -RawVersion $nodeVersionText
$npmVersion = Get-NormalizedVersion -RawVersion $npmVersionText

Assert-MinVersion -Label "Node.js" -Actual $nodeVersion -Minimum ([Version]"18.17.0")
Assert-MinVersion -Label "npm" -Actual $npmVersion -Minimum ([Version]"8.0.0")

Write-Host "Node.js: $nodeVersionText"
Write-Host "npm:     $npmVersionText"

if (-not $SkipDependencyInstall) {
    $sourceCodeRoot = Join-Path $repoRoot "sourcecode"
    $projectSourceRoot = Join-Path $sourceCodeRoot "project"
    $dependencySourceRoot = Join-Path $sourceCodeRoot "node_modules"

    if (-not (Test-Path -LiteralPath $sourceCodeRoot)) {
        throw "Offline source mirror not found at '$sourceCodeRoot'. Run Dependencies\sync-sourcecode.ps1 on a connected machine first."
    }
    if (-not (Test-Path -LiteralPath $projectSourceRoot)) {
        throw "Offline project source not found at '$projectSourceRoot'. Regenerate the mirror with Dependencies\sync-sourcecode.ps1."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectSourceRoot "package.json"))) {
        throw "Offline project source is incomplete. Missing '$projectSourceRoot\package.json'."
    }
    if (-not (Test-Path -LiteralPath $dependencySourceRoot)) {
        throw "Offline dependency source not found at '$dependencySourceRoot'. Regenerate the mirror with Dependencies\sync-sourcecode.ps1."
    }

    $repoPackageJson = Join-Path $repoRoot "package.json"
    $mirrorPackageJson = Join-Path $projectSourceRoot "package.json"
    $repoPackageHash = (Get-FileHash -LiteralPath $repoPackageJson).Hash
    $mirrorPackageHash = (Get-FileHash -LiteralPath $mirrorPackageJson).Hash
    if ($repoPackageHash -ne $mirrorPackageHash) {
        Write-Warning "sourcecode\project\package.json does not match repository root package.json. The mirror may be stale."
    }

    Write-Host "==> Restoring npm dependencies from sourcecode\node_modules..." -ForegroundColor Cyan
    Sync-DirectoryWithRobocopy -Source $dependencySourceRoot -Destination (Join-Path $repoRoot "node_modules") -Label "offline dependencies"
}
else {
    Write-Host "==> Skipping dependency restore (requested)." -ForegroundColor Yellow
}

if (-not $SkipBuild) {
    Write-Host "==> Compiling source code (npm run build)..." -ForegroundColor Cyan
    Invoke-ExternalCommand -Command "npm" -Arguments @("run", "build")
}
else {
    Write-Host "==> Skipping source compilation (requested)." -ForegroundColor Yellow
}

Write-Host "==> Compilation workflow completed successfully." -ForegroundColor Green
