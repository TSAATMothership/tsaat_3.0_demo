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
- In-repo JSON data (`data/current.json` + `data/snapshots/*.json`)

## Prerequisites

- Node.js `>=18.17` recommended for Next.js 14
- npm `>=8`

## Install

```bash
npm install --legacy-peer-deps
```

## Offline Compile (Windows)

Use the scripts in `Dependencies/` to mirror all clear-text source into `sourcecode/` and compile without internet access:

1. Connected machine: `Dependencies\sync-sourcecode.ps1`
2. Offline machine: `Dependencies\compile.ps1`

Detailed workflow: `Dependencies/README.md`.

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

- Data is local demo data only (no external integrations).
- The app is optimized for desktop and mobile layouts.
