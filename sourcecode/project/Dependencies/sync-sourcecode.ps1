[CmdletBinding()]
param(
    [switch]$SkipNodeModules
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Sync-DirectoryWithRobocopy {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $false)][string[]]$AdditionalArgs = @()
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Source directory was not found: $Source"
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
    ) + $AdditionalArgs

    & robocopy @args | Out-Host
    $robocopyExitCode = $LASTEXITCODE
    if ($robocopyExitCode -ge 8) {
        throw "Failed to sync '$Source' to '$Destination' (robocopy exit code $robocopyExitCode)."
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$sourceCodeRoot = Join-Path $repoRoot "sourcecode"
$projectMirrorRoot = Join-Path $sourceCodeRoot "project"
$dependencyMirrorRoot = Join-Path $sourceCodeRoot "node_modules"
$manifestPath = Join-Path $sourceCodeRoot "MANIFEST.txt"

Set-Location $repoRoot

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json"))) {
    throw "package.json not found at $repoRoot. Run this script from inside the TSAAT repository."
}

Assert-CommandExists -Name "robocopy"

if (-not (Test-Path -LiteralPath $sourceCodeRoot)) {
    New-Item -ItemType Directory -Path $sourceCodeRoot -Force | Out-Null
}

Write-Host "==> Mirroring project source into sourcecode\project..." -ForegroundColor Cyan
$projectMirrorArgs = @(
    "/XD", ".git", ".next", "node_modules", "sourcecode", "artifacts", "coverage",
    "/XF", "*.log", "*.tsbuildinfo"
)
Sync-DirectoryWithRobocopy -Source $repoRoot -Destination $projectMirrorRoot -AdditionalArgs $projectMirrorArgs

if (-not $SkipNodeModules) {
    $nodeModulesPath = Join-Path $repoRoot "node_modules"
    if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
        throw "node_modules was not found at '$nodeModulesPath'. Run npm install/npm ci while online, then rerun this script."
    }

    Write-Host "==> Mirroring dependency source into sourcecode\node_modules..." -ForegroundColor Cyan
    Sync-DirectoryWithRobocopy -Source $nodeModulesPath -Destination $dependencyMirrorRoot
}
else {
    Write-Host "==> Skipping node_modules mirror (requested)." -ForegroundColor Yellow
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$manifest = @(
    "Offline source mirror for TSAAT",
    "GeneratedAtUtc: $timestamp",
    "ProjectSource: sourcecode\project",
    "DependencySource: sourcecode\node_modules",
    "BuildCommand: Dependencies\compile.ps1"
)
Set-Content -LiteralPath $manifestPath -Value $manifest -Encoding UTF8

Write-Host "==> Source mirror completed successfully." -ForegroundColor Green
