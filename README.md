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

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Microsoft SQL Server (runtime data store, schema under `Database Schema/`)

## Prerequisites

- Bundled Node.js runtime is included at `Dependencies/runtime/nodejs/win-x64` for offline compile (including `node_modules/npm/bin/npm-cli.js`)
- SQL Server Express instance (`localhost\SQLEXPRESS`)
- `sqlcmd` available in `PATH`
- Windows PowerShell available in `PATH`
- Offline compile entrypoint is `compileApp.cmd` (single supported compile command)
- Pre-staged external large dependency artifact (required because SWC is intentionally not vendored in `Dependencies/node_modules`):
  - `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`

## Install

For online developer setup only (not required for offline compile):

```bash
npm install --legacy-peer-deps
```

## Offline Build and Database Setup (Windows)

### Step 0: Stage External Large Dependencies (>100 MB)

Before running `compileApp.cmd` on a machine without internet access, pre-stage any required >100 MB dependency artifacts outside source control.

1. Next.js SWC win32-x64 native binary (required for this repository because it is intentionally excluded from `Dependencies/node_modules` due size)
   - Required file path expected by `compileApp.cmd`:
     - `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`
   - Version required by this repo:
     - `@next/swc-win32-x64-msvc@14.2.33`
   - Download source:
     - npm registry package: `https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz`
   - Extract and stage on an internet-connected Windows machine:

```powershell
New-Item -ItemType Directory -Path .\Dependencies\external\@next\swc-win32-x64-msvc -Force | Out-Null
Invoke-WebRequest -Uri "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz" -OutFile ".\swc-win32-x64-msvc-14.2.33.tgz"
tar -xf ".\swc-win32-x64-msvc-14.2.33.tgz"
Copy-Item ".\package\next-swc.win32-x64-msvc.node" ".\Dependencies\external\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node" -Force
Remove-Item ".\swc-win32-x64-msvc-14.2.33.tgz" -Force
Remove-Item ".\package" -Recurse -Force
```

   - Copy the staged file to the same path on the offline target machine.
   - `compileApp.cmd` will copy this file into restored `node_modules` only when required, and will exit with a clear error if it is missing.
   - `compileApp.cmd` will also fail if this >100 MB binary is vendored inside `Dependencies/node_modules`; it must remain pre-staged under `Dependencies/external`.

2. SQL Server Express installer (required only when SQL Server is not already installed)
   - File: `SQLEXPR_x64_ENU.exe` (typically >100 MB)
   - Download from: Microsoft SQL Server downloads page (`https://www.microsoft.com/sql-server/sql-server-downloads`) and choose the Express edition installer.
   - Install using a default `SQLEXPRESS` instance with Windows authentication.

### Step 1: Run Offline App Compile

Run:

```bat
compileApp.cmd
```

What it does:

- Uses the vendored Node.js + npm runtime from `Dependencies/runtime/nodejs/win-x64`
- Restores vendored dependencies from `Dependencies/node_modules`
- Verifies `next` and the full dependency tree are restored before build
- Verifies required Next.js SWC binary is available, and copies it from `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` when needed
- Runs `npm rebuild --offline`
- Runs `npm run build --offline`
- Validates that required SQL data is already present

If it fails with missing/empty `tsaat.dataset_snapshot`, continue with database setup below.

### Step 2: Create SQL Server Database (SQLEXPRESS)

Connect to `localhost\SQLEXPRESS` and run:

```sql
CREATE DATABASE TSAAT;
```

You can run this from SSMS or `sqlcmd` against `master`.

### Step 3: Update DB_config

Open `DB_config` and set the admin connection string (default):

```ini
Server=localhost\SQLEXPRESS;Database=master;Trusted_Connection=True;
```

Optional override if your app database is not `TSAAT`:

```ini
APP_DATABASE=YourDatabaseName
```

### Step 4: Build Schema and Load Data

Run:

```bat
CreateDB.cmd
```

What it does:

- Reads SQL connection details from `DB_config`
- Creates/updates the application database
- Applies `Database Schema/database-schema.sql`
- Applies migrations under `Database Schema/migrations/`
- Loads seed/reference/application data
- Runs validation and writes `Database Schema/loaders/last-build-summary.txt`

### Step 5: Re-run Offline App Compile

Run again:

```bat
compileApp.cmd
```

At this point, offline app build and SQL-backed runtime data should both be ready.

## Run

```bash
npm run dev
```

Open: `http://localhost:3000`

## Build and Start

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

- `ManagedNetwork` -> contains `assetIds` and linked `ictSystemIds`
- `ICTSystem` -> includes mission capabilities, business services, and environments
- `Environment` -> Production required, non-prod optional (Development/UAT/Test)
- `Asset` union:
  - `server`
  - `workstation`
  - `network-device`
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
