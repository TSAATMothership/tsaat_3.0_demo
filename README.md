# TSAAT - Threat Surface Area Assessment Tool

A Next.js + TypeScript reporting web app for TSAAT posture analytics.

## Features

- Executive Dashboard with posture KPIs, top risks, and 8-week trend charts
- Measures page with KPI/SPI cards, trends, report tiles, and scoped PDF report launchers
- Managed Network roll-up page + per-network drill-down
- ICT System roll-up page with mission/service context + environment breakdown
- Findings / Issues Register with SPI, severity, evidence, and rule-based recommendations
- Findings export API (`JSON` and `CSV`)
- Written Report Generator (print view + browser Save as PDF)
- Deterministic seed data generation with realistic posture exceptions
- Application login gate with encrypted file-backed credentials, signed session checks, logout, and password rotation settings

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Microsoft SQL Server (runtime data store, schema under `Database Schema/`)

## Prerequisites

- Bundled Node.js runtime is included at `Dependencies/runtime/nodejs/win-x64` for offline compile (including `node_modules/npm/bin/npm-cli.js`)
- Reachable Microsoft SQL Server instance. Local SQL Server Express (`localhost\SQLEXPRESS`) is the default, but remote SQL Server targets are supported.
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

The repository is intended to compile and run on Windows x64 without internet access after it is copied locally. App/build dependencies are stored under `Dependencies/`; a reachable SQL Server instance is the only external runtime prerequisite.

### 1. Install Or Confirm SQL Server

Use a local SQL Server Express instance, preferably the default `localhost\SQLEXPRESS` instance, or a reachable remote SQL Server instance.

If SQL Server Express is not already installed, download and pre-stage the Microsoft SQL Server Express installer before moving to an offline machine. The installer is typically larger than 100 MB, so it is not stored in this repository and is not split into repo files.

### 2. Confirm Database Access

`CreateDB.cmd` and `compileApp.cmd` both run `scripts/ensure-db-config.ps1` before using database settings.

- If encrypted `DB_config` already exists and can be decrypted by the current Windows identity, interactive runs show the saved non-secret values so you can confirm or change them. Noninteractive runs accept a valid existing file without rewriting it.
- If `DB_config` is missing, interactive runs prompt for server, database, authentication, and SSL values, then write encrypted `DB_config`.
- If `DB_config` exists but cannot be decrypted on this computer/user, interactive runs warn that the file is from another Windows identity or is invalid and offer to recreate it locally. Unattended runs recreate it only when the required environment values are supplied.
- For unattended offline setup, set `TSAAT_DB_CONFIG_ASSUME_YES=true` plus the required database environment values before running `CreateDB.cmd`.

For the simplest unattended first-time setup, use Windows trusted authentication:

```powershell
$env:TSAAT_DB_CONFIG_ASSUME_YES='true'
$env:TSAAT_SQL_TRUSTED_CONNECTION='true'
$env:TSAAT_SQL_SERVER='localhost\SQLEXPRESS'
$env:TSAAT_APP_DATABASE='TSAAT'
$env:TSAAT_DATA_LOAD_MODE='client-payload'
```

If you must use SQL authentication and `DB_config` is not already set, create the SQL login before running `CreateDB.cmd`, then set:

```powershell
$env:TSAAT_DB_CONFIG_ASSUME_YES='true'
$env:TSAAT_SQL_SERVER='localhost\SQLEXPRESS'
$env:TSAAT_APP_DATABASE='TSAAT'
$env:TSAAT_SQL_USER='your-sql-login'
$env:TSAAT_SQL_PASSWORD='your-sql-password'
$env:TSAAT_DATA_LOAD_MODE='client-payload'
```

The app can also save database settings to encrypted `DB_config` from `/settings` -> `Database Settings`. Do not edit `DB_config` manually.

### 3. Create Or Refresh The Database

Run:

```bat
cmd /c CreateDB.cmd
```

This confirms or creates encrypted `DB_config`, stages bundled `sqlcmd`, creates/updates the SQL Server database using the confirmed settings, applies `Database Schema/database-schema.sql`, applies migrations, loads seed/reference data, maps source snapshots, and writes `Database Schema/loaders/last-build-summary.txt`.

`CreateDB.cmd` asks how seed data should be loaded:

- `1` / `ClientPayload` (default): reads repository JSON files on the machine running `CreateDB.cmd`, sends them as parameterized `NVARCHAR(MAX)` payload inserts over the SQL connection, and then maps them with SQL Server `OPENJSON`. Use this for remote SQL Server installs where the database server cannot see the app server filesystem.
- `2` / `SqlServerFiles`: prompts for one SQL-server-visible UNC staging root, copies the required JSON files there, and keeps SQL Server-side reads through `OPENROWSET(BULK...)`. Use this only when the machine running `CreateDB.cmd` can write the UNC share and the SQL Server service account can read it.

For unattended client-payload setup, set:

```powershell
$env:TSAAT_DATA_LOAD_MODE='client-payload'
```

For unattended SQL-server-file setup, set a UNC staging root as it is visible from the SQL Server host:

```powershell
$env:TSAAT_DATA_LOAD_MODE='sql-server-files'
$env:TSAAT_SQL_SERVER_STAGING_UNC_ROOT='\\server\share\tsaat-db-compile'
```

`CreateDB.cmd` stages package JSON files under `<UNC root>\package-data` and snapshot JSON files under `<UNC root>\snapshots`, then passes those derived paths to the database loader.

### 4. Compile The App Offline

Run:

```bat
cmd /c compileApp.cmd
```

`compileApp.cmd` confirms or validates encrypted `DB_config`, uses the vendored Node.js/npm runtime, restores `node_modules` from `Dependencies/node_modules`, stages bundled `sqlcmd`, validates/extracts the bundled SWC archive, checks the target database has loaded snapshot data, runs `npm rebuild --offline`, and runs `npm run build --offline`.

When `logindetails` does not exist, or exists but cannot be decrypted by the current Windows identity, the compile script creates/recreates it by prompting for a non-empty username and password. For unattended offline compilation or recreation, set both values first:

```powershell
$env:TSAAT_LOGIN_USERNAME='your-app-user'
$env:TSAAT_LOGIN_PASSWORD='your-app-password'
cmd /c compileApp.cmd
```

Application login credentials are stored in repo-root `logindetails`, not SQL Server. The file is encrypted with Windows DPAPI `CurrentUser` scope and stores salted PBKDF2-HMAC-SHA256 password hash metadata; plaintext passwords are never written to disk. Recreating an undecryptable file sets a new application login credential because existing password hash material cannot be recovered from another Windows identity.

### 5. Run The App Offline

If Node.js/npm is already on `PATH`, run:

```bash
npm run dev
```

For a fully repo-contained run using the bundled runtime, run:

```bat
Dependencies\runtime\nodejs\win-x64\npm.cmd run dev
```

Open `http://localhost:3000`. First access redirects to `/login`; use the credentials that created `logindetails`. Direct page URLs and protected APIs require a valid signed `tsaat_session` cookie; unauthenticated page requests redirect to `/login`, while unauthenticated API requests return `401`.

After sign-in, the app monitors session validity while pages are open and returns to `/login` if the session expires, is cleared, or is invalidated by password rotation/logout in another tab. Rotate the app password from `/settings` -> `Password Settings`.

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

Local encrypted configuration files:

- `DB_config`
- `logindetails`

Generated staging files are local machine outputs and are not required as committed source artifacts. `DB_config` and `logindetails` are encrypted local configuration files; plaintext SQL/app passwords are not stored.
`DB_config` and `logindetails` are ignored by git and are not portable between Windows identities when encrypted with the default DPAPI `CurrentUser` scope.

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

- `CreateDB.cmd` and `compileApp.cmd` use encrypted `DB_config` after confirmation. Environment variables provision a missing or undecryptable `DB_config` only when `TSAAT_DB_CONFIG_ASSUME_YES=true`.
- SQL authentication requires both `TSAAT_SQL_USER` and `TSAAT_SQL_PASSWORD` when provisioning `DB_config` from environment variables.
- For remote SQL Server database creation, prefer `TSAAT_DATA_LOAD_MODE=client-payload`. `SqlServerFiles` mode requires a UNC staging root that the setup machine can write and the SQL Server service account can read.
- Application login recreation requires both `TSAAT_LOGIN_USERNAME` and `TSAAT_LOGIN_PASSWORD` in unattended mode.
- Logout clears the local session cookie, broadcasts the sign-out to other open TSAAT tabs, and returns the browser to `/login`.
- Local named instances such as `localhost\SQLEXPRESS` are normalized to `lpc:` for bundled `sqlcmd` compatibility.
- `npm run dev` uses `scripts/run-next-dev-offline.cjs`, which disables SWC downloads and extracts/copies the bundled SWC artifact when needed.
- `DB_config` and `logindetails` use Windows DPAPI. The same Windows identity that creates a `CurrentUser` encrypted file must run/decrypt it; on a new computer, let `CreateDB.cmd` or `compileApp.cmd` recreate the local file.
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
  - `storage-device`
  - `printer-device`
  - `other`
- Seed profile:
  - 70% of assets are mapped to ICT system models (server-only in systems)
  - 30% remain unmodelled (no ICT system context)
  - Flow dependency distribution per source CI: 10%=`0`, 70%=`20..50`, 19%=`3..19`, 1%=`51..150`
- Physical assets include lifecycle (`EOL`, `warranty`)
- Vulnerabilities include severity (including `Critical`)

## SPI and Roll-up Logic (Short)

- SPI catalogue metadata, applicability, enabled/report flags, rule parameters, tasking metadata, and severity options are loaded from SQL Server seed tables.
- Current seed data preserves SPIs 1-10 and evaluates them per applicable asset.
- SPI score execution is SQL-driven through database calculation rows evaluated by `tsaat.usp_evaluate_spi_snapshot`.
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
