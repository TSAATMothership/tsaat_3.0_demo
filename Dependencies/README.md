# Dependencies Build Guide

This folder contains:

- `dependencies.txt`: Plain-text inventory of system and npm dependencies required to compile TSAAT.
- `compile.ps1`: Windows PowerShell script that installs dependencies in order and compiles the app.
- `compile.cmd`: Windows Command Prompt script that installs dependencies in order and compiles the app.

## Run on Windows

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\Dependencies\compile.ps1
```

Or from Command Prompt:

```bat
Dependencies\compile.cmd
```

## What the script does

1. Checks required tools are available (`node`, `npm`).
2. Enforces minimum tool versions:
   - Node.js `>= 18.17.0`
   - npm `>= 8.0.0`
3. Installs project dependencies:
   - Uses `npm ci --legacy-peer-deps` when `package-lock.json` exists.
   - Falls back to `npm install --legacy-peer-deps` if `npm ci` fails or lockfile is missing.
4. Compiles the source code with:
   - `npm run build`

## Common Windows issue

If install fails with an `EPERM` / `operation not permitted` error, a file in `node_modules` is locked by a running process (commonly `npm run dev`). Stop active Node.js processes for this repo and rerun:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Optional flags

- Skip dependency installation:

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
