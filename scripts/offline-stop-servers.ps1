param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

$ErrorActionPreference = 'Stop'
# Use Windows' own argument parser: spaces, quotes and similarly named checkouts
# must never turn a command-line substring into permission to terminate a process.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TsaatCommandLine {
    [DllImport("shell32.dll", SetLastError = true)]
    static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string command, out int count);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
    public static string[] Parse(string command) {
        int count;
        IntPtr memory = CommandLineToArgvW(command, out count);
        if (memory == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
        try {
            var args = new string[count];
            for (int i = 0; i < count; i++) args[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(memory, i * IntPtr.Size));
            return args;
        } finally { LocalFree(memory); }
    }
}
'@

$root = (Get-Item -LiteralPath $RepositoryRoot).FullName
$nextCli = Join-Path $root 'node_modules\next\dist\bin\next'
$nextServer = Join-Path $root 'node_modules\next\dist\server\lib\start-server.js'

function Get-AppCommand($process) {
    if ($process.Name -ne 'node.exe' -or -not $process.CommandLine) { return $null }
    $arguments = [TsaatCommandLine]::Parse($process.CommandLine)
    $index = 1
    # Only skip known Node options; never interpret an eval string or another
    # program's arguments as this checkout's entry point.
    while ($index -lt $arguments.Length -and $arguments[$index].StartsWith('-')) {
        if ($arguments[$index] -eq '--') { $index++; break }
        if ($arguments[$index] -in @('--require', '-r', '--import')) { $index += 2; continue }
        if ($arguments[$index] -match '^--(?:inspect(?:-brk|-port)?(?:=.*)?|require=.+|import=.+|enable-source-maps|no-warnings)$') { $index++; continue }
        return $null
    }
    # IsPathRooted also accepts C:relative and \drive-relative paths. Their
    # meaning depends on the other process's cwd, which CIM does not provide.
    if ($index -ge $arguments.Length -or $arguments[$index] -notmatch '^(?:[A-Za-z]:[\\/]|\\\\)') { return $null }
    $entry = [IO.Path]::GetFullPath($arguments[$index])
    if ($entry -eq $nextServer) { return 'server' }
    if ($entry -eq $nextCli -or $entry -eq ($nextCli + '.js')) {
        if ($index + 1 -lt $arguments.Length) { return $arguments[$index + 1] }
    }
    return $null
}

$processes = @(Get-CimInstance Win32_Process)
$servers = @($processes | Where-Object { (Get-AppCommand $_) -in @('dev', 'start', 'server') })
$builds = @($processes | Where-Object { (Get-AppCommand $_) -eq 'build' })
if ($builds.Count) { throw 'A build is active in this checkout. Wait for it to finish before installing dependencies.' }

# Capture descendants before stopping the CLI so compiler workers cannot retain
# locks. Do not climb to terminal/npm parents or match by port/process name alone.
$selected = @{}
foreach ($server in $servers) { $selected[[int]$server.ProcessId] = $server }
do {
    $added = $false
    foreach ($process in $processes) {
        if ($selected.ContainsKey([int]$process.ParentProcessId) -and -not $selected.ContainsKey([int]$process.ProcessId) -and
            $process.CreationDate -ge $selected[[int]$process.ParentProcessId].CreationDate) {
            $selected[[int]$process.ProcessId] = $process
            $added = $true
        }
    }
} while ($added)

$ordered = @($servers | Where-Object { (Get-AppCommand $_) -in @('dev', 'start') }) + @($selected.Values)
$visited = @{}
foreach ($process in $ordered) {
    if ($visited.ContainsKey([int]$process.ProcessId)) { continue }
    $visited[[int]$process.ProcessId] = $true
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ProcessId)"
    if (-not $current) { continue }
    if ($current.CreationDate -ne $process.CreationDate -or $current.CommandLine -ne $process.CommandLine) {
        throw "Process identity changed for PID $($process.ProcessId); installation aborted."
    }
    Write-Output "Stopping checkout app process $($process.ProcessId) ($($process.Name))."
    try {
        Stop-Process -Id $process.ProcessId -ErrorAction Stop
        Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    } catch {
        if (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue) { throw }
    }
}

foreach ($process in $selected.Values) {
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ProcessId)"
    if ($current -and $current.CreationDate -eq $process.CreationDate) {
        throw "Checkout app process $($process.ProcessId) has not exited; installation aborted."
    }
}
$remaining = @(Get-CimInstance Win32_Process | Where-Object { (Get-AppCommand $_) -in @('dev', 'start', 'server', 'build') })
if ($remaining.Count) { throw 'Checkout app processes are still active. Stop them and retry; dependencies have not been removed.' }
if (-not $selected.Count) { Write-Output 'No active app servers found for this checkout.' }
