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

- Bundled Node.js runtime is included at `Dependencies/runtime/nodejs/win-x64` for offline compile
- SQL Server Express instance (`localhost\SQLEXPRESS`)
- `sqlcmd` available in `PATH`
- Windows PowerShell available in `PATH`

## Install

```bash
npm install --legacy-peer-deps
```

## Offline Build and Database Setup (Windows)

### Step 1: Run Offline App Compile

Run:

```bat
compile.cmd
```

What it does:

- Uses the vendored Node.js + npm runtime from `Dependencies/runtime/nodejs/win-x64`
- Restores vendored dependencies from `Dependencies/node_modules` when present
- Falls back to extracting `Dependencies/node_modules-win-x64.zip` on clean clones/new machines
- Verifies `next` and the full dependency tree are restored before build
- Runs `npm rebuild --offline`
- Runs `npm run build --offline`
- Validates that required SQL data is already present

`compileApp.cmd` remains available as the explicit entrypoint and `compile.cmd` is a compatibility wrapper.

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
compile.cmd
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
