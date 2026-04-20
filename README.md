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

### Step 0: Verify Bundled Large Dependency Artifact (>100 MB Extracted)

Before running `compileApp.cmd` on a machine without internet access, verify bundled dependency artifacts are present.

1. Next.js SWC win32-x64 native binary (required for this repository)
   - Bundled in-repo source archive:
     - `Dependencies/offline-artifacts/@next/swc-win32-x64-msvc-14.2.33.tgz`
   - Runtime file path used by `compileApp.cmd` and `npm run dev` (auto-extracted when missing):
     - `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`
   - Version required by this repo:
     - `@next/swc-win32-x64-msvc@14.2.33`
   - Download source:
     - npm registry package: `https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz`
   - Git feasibility:
     - Extracted binary cannot be committed under `<100 MB per file` policy (`135,864,320` bytes).
     - The repo therefore stores the npm archive (`41,491,235` bytes) and extracts the binary locally during offline build/dev.
   - Canonical artifact fingerprint used by offline scripts:
     - Extracted binary size: `135864320` bytes
     - Extracted binary SHA-256: `2CDDED4F290711FBD6911D880AA1A653519AF42C6139B9AE07C4D408A42B9B1B`
     - Source tarball size (`swc-win32-x64-msvc-14.2.33.tgz`): `41491235` bytes
     - Source tarball SHA-256: `AB5D8BC3837EF28228FEBBED8AC51CB9E5E460B351ADCCF169B7EC7888127382`
   - Optional refresh procedure on an internet-connected Windows machine:

```powershell
New-Item -ItemType Directory -Path .\Dependencies\offline-artifacts\@next -Force | Out-Null
Invoke-WebRequest -Uri "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz" -OutFile ".\Dependencies\offline-artifacts\@next\swc-win32-x64-msvc-14.2.33.tgz"
$archive = ".\Dependencies\offline-artifacts\@next\swc-win32-x64-msvc-14.2.33.tgz"
if ((Get-Item $archive).Length -ne 41491235) { throw "Unexpected SWC archive size." }
if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToUpperInvariant() -ne "AB5D8BC3837EF28228FEBBED8AC51CB9E5E460B351ADCCF169B7EC7888127382") { throw "Unexpected SWC archive hash." }
```

   - `compileApp.cmd` auto-extracts this archive into `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` when required.
   - Both `compileApp.cmd` and `npm run dev` validate archive and binary size/hash before use.
   - `compileApp.cmd` fails if this >100 MB binary is vendored inside `Dependencies/node_modules`; it must remain external/runtime-generated.

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
- Verifies required Next.js SWC artifact fingerprints; auto-extracts from `Dependencies/offline-artifacts/@next/swc-win32-x64-msvc-14.2.33.tgz` when needed
- Copies SWC binary from `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` into restored `node_modules` when needed
- Runs `npm rebuild --offline`
- Runs `npm run build --offline`
- Validates that required SQL data is already present

If it fails with missing/empty `tsaat.dataset_snapshot`, continue with database setup below.

### Step 2: Create SQL Server Database and SQL Login (SQLEXPRESS)

Connect to `localhost\SQLEXPRESS` and run:

```sql
CREATE DATABASE TSAAT;
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'shuffydog')
BEGIN
  CREATE LOGIN [shuffydog] WITH PASSWORD = N'bones123', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
END
ELSE
BEGIN
  ALTER LOGIN [shuffydog] WITH PASSWORD = N'bones123', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
END
GO
IF IS_SRVROLEMEMBER(N'sysadmin', N'shuffydog') <> 1
BEGIN
  ALTER SERVER ROLE [sysadmin] ADD MEMBER [shuffydog];
END
GO
USE [TSAAT];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'shuffydog')
BEGIN
  CREATE USER [shuffydog] FOR LOGIN [shuffydog];
END
GO
IF IS_ROLEMEMBER(N'db_owner', N'shuffydog') <> 1
BEGIN
  ALTER ROLE [db_owner] ADD MEMBER [shuffydog];
END
```

You can run this from SSMS or `sqlcmd` against `master`.

### Step 3: Update DB_config

Open `DB_config` and set runtime connection + SSL settings. You can switch auth mode by toggling `Trusted_Connection`:

```ini
Server=localhost\SQLEXPRESS;Database=TSAAT;Trusted_Connection=True;User Id=shuffydog;Password=bones123;Encrypt=False;TrustServerCertificate=False;
```

Required format:

```ini
Server=<server>;Database=<database>;Trusted_Connection=True|False;User Id=<user>;Password=<password>;Encrypt=True|False;TrustServerCertificate=True|False;
```

Mode behavior:
- `Trusted_Connection=True`: Windows trusted auth is used (User Id/Password ignored by runtime).
- `Trusted_Connection=False`: SQL auth is used and `User Id` + `Password` are required.
- `Encrypt=False`: SSL/TLS encryption is disabled.
- `Encrypt=True;TrustServerCertificate=False`: SSL/TLS enabled with strict certificate validation.
- `Encrypt=True;TrustServerCertificate=True`: SSL/TLS enabled and certificate chain validation is bypassed.

If SQL Server is running in Windows-auth-only mode (`SERVERPROPERTY('IsIntegratedSecurityOnly') = 1`), SQL logins cannot authenticate until mixed mode is enabled and the SQL Server service is restarted. Temporary compatibility fallback for scripts:

```powershell
$env:TSAAT_SQL_TRUSTED_CONNECTION='true'
cmd /c CreateDB.cmd
cmd /c compileApp.cmd
```

### Step 4: Build Schema and Load Data

Run:

```bat
CreateDB.cmd
```

What it does:

- Reads SQL connection details from `DB_config`
- Connects with SQL authentication (`User Id` / `Password`) or trusted auth fallback
- Applies SSL mode from `DB_config` (`Encrypt` + `TrustServerCertificate`)
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

Notes for offline Windows dev:
- `npm run dev` now runs `scripts/run-next-dev-offline.cjs`, which:
  - sets `NEXT_DISABLE_SWC_DOWNLOAD=1` and `NEXT_SKIP_SWC_DOWNLOAD=1`
  - checks for `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` (or Next fallback path)
  - validates SWC size/hash for `@next/swc-win32-x64-msvc@14.2.33`
  - extracts SWC from `Dependencies/offline-artifacts/@next/swc-win32-x64-msvc-14.2.33.tgz` when staged binary is missing
  - copies the staged SWC file from `Dependencies/external/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` when needed
- If both the staged SWC binary and bundled SWC archive are missing, startup exits with a clear local error instead of trying to download from npm.
- Database connectivity and SSL settings can be updated at runtime via `/settings` -> `Database Settings` and persisted to `DB_config` after successful connection + schema checks (plus SSL test when SSL is enabled).
- If runtime SQL auth from `DB_config` fails with login error, app queries automatically retry with trusted auth (unless `TSAAT_SQL_TRUSTED_FALLBACK=false` is set).

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
