# Dependencies Build Guide

This folder contains:

- `dependencies.txt`: Plain-text inventory of system and npm dependencies required to compile TSAAT.
- `compile.ps1`: Windows PowerShell script that restores dependencies from `sourcecode\node_modules` and compiles the app.
- `compile.cmd`: Windows Command Prompt script with the same offline behavior as `compile.ps1`.
- `sync-sourcecode.ps1`: Creates/updates a clear-text offline source mirror in `sourcecode\`.
- `sync-sourcecode.cmd`: Command Prompt wrapper for `sync-sourcecode.ps1`.

## Offline-First Build Workflow

1. On a connected machine, install dependencies once:

```powershell
npm ci --legacy-peer-deps
```

2. Build the clear-text mirror:

```powershell
powershell -ExecutionPolicy Bypass -File .\Dependencies\sync-sourcecode.ps1
```

3. On the offline machine, compile using only the mirrored source:

```powershell
powershell -ExecutionPolicy Bypass -File .\Dependencies\compile.ps1
```

Or from Command Prompt:

```bat
Dependencies\compile.cmd
```

## Source Mirror Layout

- `sourcecode\project`: Mirror of repository source code (clear text).
- `sourcecode\node_modules`: Mirror of npm dependency source code (clear text).
- `sourcecode\MANIFEST.txt`: Timestamp and mirror metadata.

`compile.ps1` / `compile.cmd` require `sourcecode\project` and `sourcecode\node_modules` to exist.

## What the compile scripts do

1. Check required tools are available (`node`, `npm`, `robocopy`).
2. Enforce minimum tool versions:
   - Node.js `>= 18.17.0`
   - npm `>= 8.0.0`
3. Restore `node_modules` from `sourcecode\node_modules` (offline; no registry calls).
4. Compile the source code with:
   - `npm run build`

## Optional flags

- Skip dependency restore:

```powershell
powershell -ExecutionPolicy Bypass -File .\Dependencies\compile.ps1 -SkipDependencyInstall
```

```bat
Dependencies\compile.cmd -SkipDependencyInstall
```

- Skip source compilation:

```powershell
powershell -ExecutionPolicy Bypass -File .\Dependencies\compile.ps1 -SkipBuild
```

```bat
Dependencies\compile.cmd -SkipBuild
```

- Sync project source only (skip `node_modules` mirror):

```powershell
powershell -ExecutionPolicy Bypass -File .\Dependencies\sync-sourcecode.ps1 -SkipNodeModules
```
