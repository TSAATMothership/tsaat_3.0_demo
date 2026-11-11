# No PowerShell parameter binding: preserve npm's -- separator and flags verbatim.
[string[]]$NpmArguments = $args
$ErrorActionPreference = 'Stop'
try {
    $repositoryRoot = Split-Path $PSScriptRoot -Parent
    . (Join-Path $PSScriptRoot 'offline-runtime.ps1')
    $node = Get-TsaatNode $repositoryRoot
    # Process-local only: npm scripts and their children use the same runtime.
    $env:PATH = (Split-Path $node) + ';' + $env:PATH
    $npmCli = Join-Path (Split-Path $node) 'node_modules/npm/bin/npm-cli.js'
    Push-Location -LiteralPath $repositoryRoot
    try { & $node $npmCli @NpmArguments; $result = $LASTEXITCODE }
    finally { Pop-Location }
    exit $result
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
