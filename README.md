# TSAAT - Threat Surface Area Assessment Tool

A Next.js + TypeScript reporting web app for TSAAT posture analytics.

## Features

- Executive Dashboard with posture KPIs, top risks, and 8-week trend charts
- Measures page with KPI cards, KPI trends, and SPI/KPI scoring matrix
- Managed Network roll-up page + per-network drill-down
- ICT System roll-up page with mission/service context + environment breakdown
- Findings / Issues Register with SPI, severity, evidence, and rule-based recommendations
- Findings export API (`JSON` and `CSV`)
- Written Report Generator (print view + browser Save as PDF)
- Deterministic seed data generation with realistic posture exceptions
- Application login gate with encrypted file-backed credentials and password rotation settings

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Microsoft SQL Server (runtime data store, schema under `Database Schema/`)

## Prerequisites

- Bundled Node.js runtime is included at `Dependencies/runtime/nodejs/win-x64` for offline compile (including `node_modules/npm/bin/npm-cli.js`)
- SQL Server Express instance (`localhost\SQLEXPRESS`)
- Bundled `sqlcmd` archive is included at `Dependencies/offline-artifacts/sqlcmd/sqlcmd-windows-amd64-1.10.0.zip` (auto-staged by offline scripts)
- Windows PowerShell available in `PATH`
- Offline compile entrypoint is `compileApp.cmd` (single supported compile command)
- Bundled SWC archive (included in-repo, under 100 MB):
  - `Dependencies/offline-artifacts/@next/swc-win32-x64-msvc-14.2.33.tgz`
- External staged SWC binary location used by offline scripts (auto-populated when missing):
  - `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`

## Install

For online developer setup only (not required for offline compile):

```bash
npm install --legacy-peer-deps
```

## Offline Build and Database Setup (Windows)

The repository is intended to compile and run on Windows x64 without internet access after it is copied locally. App/build dependencies are stored under `Dependencies/`; SQL Server Express itself is the only external prerequisite when it is not already installed.

### 1. Install Or Confirm SQL Server Express

Use a local SQL Server Express instance, preferably the default `localhost\SQLEXPRESS` instance.

If SQL Server Express is not already installed, download and pre-stage the Microsoft SQL Server Express installer before moving to an offline machine. The installer is typically larger than 100 MB, so it is not stored in this repository and is not split into repo files.

### 2. Configure Database Access

For the simplest first-time setup, use Windows trusted authentication:

```powershell
$env:TSAAT_SQL_TRUSTED_CONNECTION='true'
$env:TSAAT_SQL_SERVER='localhost\SQLEXPRESS'
$env:TSAAT_APP_DATABASE='TSAAT'
```

If you must use SQL authentication, create the SQL login before running `CreateDB.cmd`, then set:

```powershell
$env:TSAAT_SQL_SERVER='localhost\SQLEXPRESS'
$env:TSAAT_APP_DATABASE='TSAAT'
$env:TSAAT_SQL_USER='your-sql-login'
$env:TSAAT_SQL_PASSWORD='your-sql-password'
```

The app can later save database settings to encrypted `DB_config` from `/settings` -> `Database Settings`. Do not edit `DB_config` manually.

### 3. Create Or Refresh The Database

Run:

```bat
cmd /c CreateDB.cmd
```

This stages bundled `sqlcmd`, creates/updates the SQL Server database, applies `Database Schema/database-schema.sql`, applies migrations, loads seed/reference data, maps source snapshots, and writes `Database Schema/loaders/last-build-summary.txt`.

### 4. Compile The App Offline

Run:

```bat
cmd /c compileApp.cmd
```

`compileApp.cmd` uses the vendored Node.js/npm runtime, restores `node_modules` from `Dependencies/node_modules`, stages bundled `sqlcmd`, validates/extracts the bundled SWC archive, runs `npm rebuild --offline`, and runs `npm run build --offline`.

When `logindetails` does not exist, the compile script creates it by prompting for a non-empty username and password. For unattended offline compilation, set both values first:

```powershell
$env:TSAAT_LOGIN_USERNAME='your-app-user'
$env:TSAAT_LOGIN_PASSWORD='your-app-password'
cmd /c compileApp.cmd
```

Application login credentials are stored in repo-root `logindetails`, not SQL Server. The file is encrypted with Windows DPAPI `CurrentUser` scope and stores salted PBKDF2-HMAC-SHA256 password hash metadata; plaintext passwords are never written to disk.

### 5. Run The App Offline

If Node.js/npm is already on `PATH`, run:

```bash
npm run dev
```

For a fully repo-contained run using the bundled runtime, run:

```bat
Dependencies\runtime\nodejs\win-x64\npm.cmd run dev
```

Open `http://localhost:3000`. First access redirects to `/login`; use the credentials that created `logindetails`. After sign-in, rotate the app password from `/settings` -> `Password Settings`.

### Offline Dependency Inventory

Included in the repository for offline compile/run:

- Windows x64 Node.js/npm runtime: `Dependencies/runtime/nodejs/win-x64`
- npm dependency tree: `Dependencies/node_modules`
- package snapshots: `Dependencies/package.json` and `Dependencies/package-lock.json`
- Next.js SWC source archive: `Dependencies/offline-artifacts/@next/swc-win32-x64-msvc-14.2.33.tgz`
- sqlcmd source archive: `Dependencies/offline-artifacts/sqlcmd/sqlcmd-windows-amd64-1.10.0.zip`
- database schema, migrations, loaders, seed/reference data, and source snapshots

Generated offline staging output:

- `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`
- `Dependencies/external/sqlcmd/win-x64/sqlcmd.exe`
- root `node_modules`
- `.next`
- `logindetails`

These generated files are local machine outputs and are not required as committed source artifacts.

### Large File Policy

No tracked repository file should exceed 100 MB. The required SWC binary is `135,864,320` bytes after extraction, so the repo stores the compressed npm archive (`41,491,235` bytes) and extracts the binary locally into ignored staging paths.

The SQL Server Express installer is also expected to exceed 100 MB and must be downloaded/pre-staged outside the repository before offline setup when SQL Server is not already installed.

### Artifact Reference

The offline scripts validate these bundled artifacts:

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Dependencies/offline-artifacts/@next/swc-win32-x64-msvc-14.2.33.tgz` | `41491235` | `AB5D8BC3837EF28228FEBBED8AC51CB9E5E460B351ADCCF169B7EC7888127382` |
| `Dependencies/offline-artifacts/sqlcmd/sqlcmd-windows-amd64-1.10.0.zip` | `23964312` | `A4C28332FCC6E497D655E53AC8F4939F4AB170F9CFD32D0FA5081B60F4D9D691` |
| extracted SWC binary | `135864320` | `2CDDED4F290711FBD6911D880AA1A653519AF42C6139B9AE07C4D408A42B9B1B` |
| staged `sqlcmd.exe` | `24499224` | `D9DBD1A8BD26213747B246DEBA1E13663A7E1DEF530CD961D7582B41A5E27852` |

If an artifact is missing on an internet-connected preparation machine, restore it from the original source, verify the size/hash above, then copy the repository to the offline machine:

- SWC archive: `https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz`
- sqlcmd archive: `https://github.com/microsoft/go-sqlcmd/releases/download/v1.10.0/sqlcmd-windows-amd64.zip`

### Troubleshooting

- `CreateDB.cmd` defaults to trusted auth when `TSAAT_SQL_TRUSTED_CONNECTION=true`; otherwise SQL auth requires both `TSAAT_SQL_USER` and `TSAAT_SQL_PASSWORD`.
- Local named instances such as `localhost\SQLEXPRESS` are normalized to `lpc:` for bundled `sqlcmd` compatibility.
- `npm run dev` uses `scripts/run-next-dev-offline.cjs`, which disables SWC downloads and extracts/copies the bundled SWC artifact when needed.
- `DB_config` and `logindetails` use Windows DPAPI. The same Windows identity that creates a `CurrentUser` encrypted file must run/decrypt it.
- If both the staged SWC binary and bundled SWC archive are missing, compile/startup fails with a local error instead of downloading from npm.

## Build and Start

For offline Windows builds, prefer `compileApp.cmd`; it restores local dependencies and runs the build with network access disabled. To start the already-built app with the bundled runtime:

```bat
Dependencies\runtime\nodejs\win-x64\npm.cmd run start
```

For online developer workflows with Node/npm already installed:

```bash
npm run build
npm run start
```

## Generate / Regenerate Test Data

Default deterministic seed:

```bash
npm run seed
```

Custom seed:

```bash
npm run seed -- --seed=12345
```

Validate generated dataset:

```bash
npm run seed:validate
```

## Test

```bash
npm test
```

## Data Model (Short)

- `ManagedNetwork` -> contains `assetIds`, linked `ictSystemIds`, and platform flags (`adfPlatform`, `enterprisePlatform`)
- `ICTSystem` -> includes mission capabilities, business services, environments, and platform flags (`adfPlatform`, `enterprisePlatform`)
- `Environment` -> Production required, non-prod optional (Development/UAT/Test)
- `Asset` union:
  - `server`
  - `workstation`
  - `network-device`
- Seed profile:
  - 70% of assets are mapped to ICT system models (server-only in systems)
  - 30% remain unmodelled (no ICT system context)
  - Flow dependency distribution per source CI: 10%=`0`, 70%=`20..50`, 19%=`3..19`, 1%=`51..150`
- Physical assets include lifecycle (`EOL`, `warranty`)
- Vulnerabilities include severity (including `Critical`)

## SPI and Roll-up Logic (Short)

- SPIs 1-10 are evaluated per applicable asset
- Each SPI returns `Compliant`, `Non-compliant`, or `Unknown`
- High Risk tagging is applied to SPI 4/5/6 trigger conditions
- Critical Exposure tagging is applied where production assets have critical vulnerabilities
- Roll-up precedence for network/system/environment:
  1. If any child `Non-compliant` -> roll-up `Non-compliant`
  2. Else if any child `Unknown` -> roll-up `Unknown`
  3. Else -> `Compliant`

## Export Endpoints

- JSON: `/api/findings/export?format=json`
- CSV: `/api/findings/export?format=csv`

Optional filter query params:

- `network`
- `system`
- `environment`
- `assetType`
- `mission`
- `service`

## PDF Output

Use **Written Report** page (`/report`) and click **Print / Save PDF**.

## Notes

- Runtime data is SQL Server-backed; packaged seed/reference data is loaded from repository artefacts.
- The app is optimized for desktop and mobile layouts.
