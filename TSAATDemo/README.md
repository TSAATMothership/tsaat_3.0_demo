# TSAAT Demo

TSAAT Demo is a database-free replica of the TSAAT application. It preserves the production app's pages, visual design, filters, drill-throughs, impact analysers, reports, and navigation while loading all application data from bundled JSON snapshots.

## Demo login

- Username: `demo`
- Password: `demo123`

The signed session-cookie and logout behavior are the same as TSAAT. The credentials are fixed for the demo and cannot be changed.

## Run the app

```powershell
cd "C:\ShuffyNet\VS Code\TSAAT\TSAATDemo"
npm install
npm run dev
```

Open `http://localhost:3000` and sign in with the demo credentials.

For a production-mode run:

```powershell
npm run build
npm start
```

## Data architecture

- `data/snapshots/week-01.json` through `week-08.json` contain eight fully processed TSAAT snapshots.
- `data/current.json` contains the latest snapshot.
- `data/runtime-config.json` contains SPI, KPI, severity, findings, measures, discovery-tool, and reference-version configuration.
- `lib/data-loader.ts` implements the same loader contract used by the TSAAT pages and APIs, but reads only these JSON files.
- `lib/demo-kpi-evaluator.ts` calculates filter- and scope-dependent KPI results locally from the bundled snapshot data.

The demo does not require SQL Server, `sqlcmd`, `DB_config`, database schemas, or database setup scripts. The Menu → Settings section is intentionally absent. Measures and Discovery configuration controls remain functional for the running demo process and reset to the bundled defaults when the process restarts.

Validate the bundled data with:

```powershell
npm run data:validate
```
