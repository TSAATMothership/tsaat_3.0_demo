# CI runs this only on its disposable Windows runner, never on an operational host.
$ErrorActionPreference = 'Stop'
if (-not $env:CI -or -not $env:RUNNER_TEMP) { throw 'Run this gate only on the disposable CI runner.' }
$ruleName = 'TSAAT-Offline-CI-' + [guid]::NewGuid().ToString('N')
$nodePath = (Get-Command node -CommandType Application).Source
$cachePath = Join-Path $env:RUNNER_TEMP ('tsaat-empty-npm-cache-' + [guid]::NewGuid().ToString('N'))
New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Program $nodePath -Action Block -Profile Any | Out-Null
try {
    # No restored npm cache and no previously installed node_modules are needed.
    & npm run install:offline -- --cache $cachePath
    if ($LASTEXITCODE -ne 0) { throw 'Offline npm ci failed.' }
    & npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Source/documentation checks failed.' }
    & npm run build:all
    if ($LASTEXITCODE -ne 0) { throw 'Offline SQL/No-SQL compilation failed.' }
} finally {
    Remove-NetFirewallRule -DisplayName $ruleName
}
