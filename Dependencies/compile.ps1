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

$nodeVersionText = (node --version).Trim()
$npmVersionText = (npm --version).Trim()

$nodeVersion = Get-NormalizedVersion -RawVersion $nodeVersionText
$npmVersion = Get-NormalizedVersion -RawVersion $npmVersionText

Assert-MinVersion -Label "Node.js" -Actual $nodeVersion -Minimum ([Version]"18.17.0")
Assert-MinVersion -Label "npm" -Actual $npmVersion -Minimum ([Version]"8.0.0")

Write-Host "Node.js: $nodeVersionText"
Write-Host "npm:     $npmVersionText"

if (-not $SkipDependencyInstall) {
    Write-Host "==> Installing npm dependencies..." -ForegroundColor Cyan
    $hasLockfile = Test-Path (Join-Path $repoRoot "package-lock.json")
    try {
        if ($hasLockfile) {
            try {
                Invoke-ExternalCommand -Command "npm" -Arguments @("ci", "--legacy-peer-deps")
            }
            catch {
                Write-Warning "npm ci failed. Retrying with npm install --legacy-peer-deps."
                Invoke-ExternalCommand -Command "npm" -Arguments @("install", "--legacy-peer-deps")
            }
        }
        else {
            Invoke-ExternalCommand -Command "npm" -Arguments @("install", "--legacy-peer-deps")
        }
    }
    catch {
        $message = $_.Exception.Message
        if ($message -match "EPERM|operation not permitted|unlink") {
            throw "Dependency install failed due to a locked file in node_modules. Close running Node.js/Next.js processes (for example, stop 'npm run dev'), then rerun this script."
        }
        throw
    }
}
else {
    Write-Host "==> Skipping dependency install (requested)." -ForegroundColor Yellow
}

if (-not $SkipBuild) {
    Write-Host "==> Compiling source code (npm run build)..." -ForegroundColor Cyan
    Invoke-ExternalCommand -Command "npm" -Arguments @("run", "build")
}
else {
    Write-Host "==> Skipping source compilation (requested)." -ForegroundColor Yellow
}

Write-Host "==> Compilation workflow completed successfully." -ForegroundColor Green
