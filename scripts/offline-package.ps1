param(
    [string]$NodeArchive,
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$')][string]$Name = 'TSAAT-offline-win-x64.zip',
    [switch]$IncludeWorkingTree
)
$ErrorActionPreference = 'Stop'
try {
    $repositoryRoot = Split-Path $PSScriptRoot -Parent
    . (Join-Path $PSScriptRoot 'offline-runtime.ps1')
    Push-Location -LiteralPath $repositoryRoot
    try {
        $manifest = Get-TsaatRuntimeManifest $repositoryRoot
        $archive = Join-Path $repositoryRoot ('runtime/' + $manifest.archive)
        Assert-TsaatLocalPath $repositoryRoot $archive
        if ($NodeArchive) {
            $source = (Resolve-Path -LiteralPath $NodeArchive).Path
            Assert-TsaatRuntimeArchive $source $manifest
            if (-not (Test-Path -LiteralPath $archive)) {
                New-Item -ItemType Directory -Path (Split-Path $archive) -Force | Out-Null
                [IO.File]::Copy($source, $archive, $false)
            }
        }
        Assert-TsaatRuntimeArchive $archive $manifest
        $commit = & git rev-parse HEAD
        if ($LASTEXITCODE -ne 0) { throw 'Package from a Git checkout with Git available.' }
        $status = & git status --porcelain
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect source status.' }
        if ($status -and -not $IncludeWorkingTree) { throw 'The checkout has uncommitted changes. Commit the reviewed release, or explicitly use -IncludeWorkingTree for a development package.' }
        $node = Get-TsaatNode $repositoryRoot
        & $node (Join-Path $PSScriptRoot 'repository-check.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Repository hygiene failed; package was not created.' }
        & $node (Join-Path $PSScriptRoot 'offline-dependencies.mjs') --check
        if ($LASTEXITCODE -ne 0) { throw 'Offline dependency verification failed; package was not created.' }
        # Git supplies the exact reviewed file boundary; ignored credentials/data/builds are never copied.
        $fileOutput = & git -c core.quotepath=false ls-files --cached --others --exclude-standard -z
        if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate package sources.' }
        $files = @(($fileOutput -join "`n").Split([char]0) | Where-Object { $_ } | Sort-Object -Unique)
        $files += 'runtime/' + $manifest.archive
        $output = Join-Path $repositoryRoot ('output/' + $Name)
        Assert-TsaatLocalPath $repositoryRoot $output
        if ((Test-Path -LiteralPath $output) -or (Test-Path -LiteralPath ($output + '.partial')) -or (Test-Path -LiteralPath ($output + '.sha256'))) { throw "Output already exists; choose a new -Name: $output" }
        New-Item -ItemType Directory -Path (Split-Path $output) -Force | Out-Null
        Add-Type -AssemblyName System.IO.Compression
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $partial = $output + '.partial'
        $zip = [IO.Compression.ZipFile]::Open($partial, [IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($file in $files) {
                $sourceFile = Join-Path $repositoryRoot $file
                Assert-TsaatLocalPath $repositoryRoot $sourceFile
                if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw "Missing package source: $file" }
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $sourceFile, ('TSAAT/' + $file.Replace('\', '/')), [IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
            $entry = $zip.CreateEntry('TSAAT/OFFLINE-PACKAGE.json')
            $writer = New-Object IO.StreamWriter($entry.Open(), (New-Object Text.UTF8Encoding($false)))
            try {
                $writer.WriteLine((@{ sourceCommit = "$commit"; includesWorkingTree = [bool]$status; nodeVersion = $manifest.version; npmVersion = $manifest.npmVersion; runtimeSha256 = $manifest.sha256; sourceFiles = $files.Count; createdUtc = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json))
            } finally { $writer.Dispose() }
        } finally { $zip.Dispose() }
        Move-Item -LiteralPath $partial -Destination $output
        $hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
        [IO.File]::WriteAllText($output + '.sha256', "$hash  $Name`n", (New-Object Text.UTF8Encoding($false)))
        Write-Host "Offline package created: $output"
        Write-Host 'Extract it on Windows x64, then run TSAAT\install-offline.cmd. No Node/npm or Git installation is required on the destination.'
    } finally { Pop-Location }
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
