# Shared by the offline launcher and the explicit distribution packager. Never downloads.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-TsaatLocalPath([string]$Root, [string]$Path) {
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    $fullPath = [IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($rootPath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Path must stay inside $rootPath : $Path" }
    $current = $fullPath
    while ($current.Length -gt $rootPath.Length) {
        if (Test-Path -LiteralPath $current) {
            if ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing linked runtime/output path: $current" }
        }
        $current = [IO.Path]::GetDirectoryName($current)
    }
}

function Get-TsaatRuntimeManifest([string]$RepositoryRoot) {
    return Get-Content -LiteralPath (Join-Path $RepositoryRoot 'scripts/offline-runtime.json') -Raw | ConvertFrom-Json
}

function Test-TsaatVersionFloor([string]$Actual, [string]$Minimum) {
    if ($Actual -notmatch '^v?\d+\.\d+\.\d+$') { return $false }
    return [version]($Actual -replace '^v', '') -ge [version]$Minimum
}

function Assert-TsaatRuntimeArchive([string]$Archive, $Manifest) {
    if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) { throw "Missing offline Node archive: $Archive. Transfer the complete offline package; installation never downloads Node." }
    if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash -ne $Manifest.sha256) { throw "Node archive checksum mismatch: $Archive. Restore the reviewed original archive; no host fallback was attempted." }
}

function Assert-TsaatRuntimeFiles([string]$Root, [string]$Directory, $Manifest) {
    foreach ($relative in @('node.exe', 'node_modules/npm/bin/npm-cli.js', 'node_modules/npm/package.json', 'LICENSE')) {
        $file = Join-Path $Directory $relative
        Assert-TsaatLocalPath $Root $file
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Incomplete portable Node runtime: $file. Stop this package's Node processes, rename its .local/runtime directory, then retry." }
    }
    if ((Get-FileHash -LiteralPath (Join-Path $Directory 'node.exe') -Algorithm SHA256).Hash -ne $Manifest.nodeSha256) { throw 'Portable node.exe checksum mismatch. Restore the runtime from the reviewed archive.' }
    $npm = Get-Content -LiteralPath (Join-Path $Directory 'node_modules/npm/package.json') -Raw | ConvertFrom-Json
    if ($npm.version -ne $Manifest.npmVersion) { throw 'Portable npm version does not match the runtime manifest.' }
}

function Get-TsaatNode([string]$RepositoryRoot) {
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($architecture -ne 'AMD64') { throw 'The offline runtime package supports Windows x64 only.' }
    $manifest = Get-TsaatRuntimeManifest $RepositoryRoot
    $archive = Join-Path $RepositoryRoot ('runtime/' + $manifest.archive)
    Assert-TsaatLocalPath $RepositoryRoot $archive
    if (-not (Test-Path -LiteralPath $archive)) {
        $hostNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hostNode) {
            $version = & $hostNode.Source --version
            if ($LASTEXITCODE -eq 0 -and (Test-TsaatVersionFloor $version '24.13.1')) {
                $npm = Join-Path (Split-Path $hostNode.Source) 'node_modules/npm/bin/npm-cli.js'
                $npmPackage = Join-Path (Split-Path $hostNode.Source) 'node_modules/npm/package.json'
                if ((Test-Path -LiteralPath $npm -PathType Leaf) -and (Test-Path -LiteralPath $npmPackage -PathType Leaf)) {
                    $npmVersion = (Get-Content -LiteralPath $npmPackage -Raw | ConvertFrom-Json).version
                    if (Test-TsaatVersionFloor $npmVersion '11.8.0') { return $hostNode.Source }
                }
            }
        }
        throw "Node.js 24.13.1+ and npm 11.8.0+ are unavailable. Use the complete TSAAT offline ZIP containing runtime/$($manifest.archive), then run .\install-offline.cmd. Stable newer versions are accepted; preview versions are excluded."
    }
    Assert-TsaatRuntimeArchive $archive $manifest
    $runtimeRoot = Join-Path $RepositoryRoot '.local/runtime'
    $directory = Join-Path $runtimeRoot $manifest.directory
    Assert-TsaatLocalPath $RepositoryRoot $directory
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
        $lockPath = Join-Path $runtimeRoot 'extract.lock'
        Assert-TsaatLocalPath $RepositoryRoot $lockPath
        try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None) }
        catch { throw "Portable runtime extraction is active or was interrupted. Confirm no launcher is running before removing only $lockPath and retrying." }
        $staging = Join-Path $runtimeRoot ('extract-' + [guid]::NewGuid().ToString('N'))
        try {
            Assert-TsaatLocalPath $RepositoryRoot $staging
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            Write-Host "Unpacking portable Node.js $($manifest.version) and npm $($manifest.npmVersion)..."
            [IO.Compression.ZipFile]::ExtractToDirectory($archive, $staging)
            $extracted = Join-Path $staging $manifest.directory
            Assert-TsaatRuntimeFiles $RepositoryRoot $extracted $manifest
            Move-Item -LiteralPath $extracted -Destination $directory
        } finally {
            $lock.Dispose()
            Remove-Item -LiteralPath $lockPath
            if (Test-Path -LiteralPath $staging) {
                Assert-TsaatLocalPath $runtimeRoot $staging
                Remove-Item -LiteralPath $staging -Recurse -Force
            }
        }
    }
    Assert-TsaatRuntimeFiles $RepositoryRoot $directory $manifest
    return Join-Path $directory 'node.exe'
}
