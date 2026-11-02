# TSAAT UI 3

Threat Surface Area Assessment Tool: a Windows-hosted Next.js/TypeScript application backed by Microsoft SQL Server. This clean development baseline includes the latest network and ICT system compliance popup redesign.

## Start here

- [Documentation index](docs/README.md)
- [Development and testing](docs/development.md)
- [Architecture](docs/architecture.md) and [UI design](docs/ui-design.md)
- [Solution design](Requirements%20Documentation/TSAAT-Solution-Design-Index.md)
- [Database lifecycle](docs/database.md), [ERD](Database%20Schema/ERD.md) and [generated schema catalogue](docs/generated/database-catalogue.md)
- [Contribution workflow](CONTRIBUTING.md), [SDLC](docs/sdlc.md) and [release runbook](docs/operations.md)

## Local setup

Use Windows, Node.js 24 (baseline 24.13.1), npm, PowerShell, a reachable SQL Server instance and sqlcmd on PATH (or SQLCMD_PATH). Packages are installed from the committed lockfile; runtimes and node_modules are not versioned.

```powershell
npm ci
npm run setup:database
npm run setup:login
npm run dev
```

Setup creates local encrypted DB_config and logindetails files for the current Windows identity. Point database settings at an existing compatible database; configuration setup does not import or replace data. Open http://localhost:3000 and sign in. Select a network or ICT system to populate the workspace.

For a NEW disposable demo database only:

```powershell
npm run db:bootstrap -- -DatabaseName TSAAT_UI3_Dev -TrustServerCertificate
```

The bootstrap refuses an existing database. Review [database operations](docs/database.md) first. Never run the destructive base schema/seed loader against an operational database.

## Browser-only demo

Open [Demo/index.html](Demo/index.html) directly in Chrome or Edge. This synthetic-data demo needs no installation, SQL, login, backend or internet. See [Demo instructions](Demo/README.md) and [the maintenance contract](docs/demo.md).

## Development gates

```powershell
npm run demo:build
npm run demo:test
npm run docs:generate
npm run check
npm run build
npm start
```

Review and update affected human-written documentation before regenerating inventories. `check` verifies repository hygiene, documentation freshness, lint, TypeScript and tests. SQL integration is a separate opt-in check against a disposable database. Production authentication requires HTTPS; see the release runbook.

## Current workspace

Cyber Security contains Network Risk Profile, ICT System Risk Profile, Service Impact Analyser, Network Impact Analyser and ICT System Impact Analyser. Discovery contains Overview, Discovery Tool Coverage, Discovery Compliance Explorer, End Point Explorer, Installed Software Explorer and Shadow IT Explorer. Observed Measures contains Measures Summary, KPIs and SPIs. Findings contains the Findings Register. Briefs & Reports is separate; Settings is in the header menu.

## Repository boundary

Includes current source, tests, assets, SQL schema/migrations/loaders/reference data, required demo/test snapshots and maintained documentation. Excludes old Git history, independently maintained duplicate app implementations, vendored packages/runtimes, credentials, other builds, temporary reports and logs. The portable Demo/index.html distribution and its source adapters are maintained with the app. Compatibility routes remain for existing bookmarks and APIs. [Baseline provenance](docs/import-baseline.md) records the import. A local repository does not configure a remote host, branch protection or deployment service.
