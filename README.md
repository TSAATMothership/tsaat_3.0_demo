# TSAAT UI 3

Threat Surface Area Assessment Tool: one Windows-hosted Next.js/TypeScript app with two compilation paths. The standard build uses Microsoft SQL Server. The No-SQL build uses persistent JSON files. Both share the current pages, login, reports, settings and interactions.

## Start here

- [Documentation index](docs/README.md), [development](docs/development.md) and [data providers](docs/data-providers.md)
- [Architecture](docs/architecture.md), [UI design](docs/ui-design.md) and [solution design](Requirements%20Documentation/TSAAT-Solution-Design-Index.md)
- [Database lifecycle](docs/database.md), [ERD](Database%20Schema/ERD.md) and [schema catalogue](docs/generated/database-catalogue.md)
- [Contribution workflow](CONTRIBUTING.md), [SDLC](docs/sdlc.md) and [release runbook](docs/operations.md)

## Local setup

Both builds use Windows, Node.js 24, npm and PowerShell. Install from the lockfile and provision login under the runtime Windows identity:

~~~powershell
npm ci
npm run setup:login
~~~

Choose a build:

| Action | Standard SQL | No-SQL (JSON files) |
| --- | --- | --- |
| Configure storage | npm run setup:database | npm run setup:nosql |
| Development | npm run dev:sql | npm run dev:nosql |
| Compile | npm run build:sql | npm run build:nosql |
| Run compiled app | npm run start:sql | npm run start:nosql |
| Build output | .next-sql | .next-nosql |

Open http://localhost:3000 and sign in. Select a network or ICT system to populate the workspace. Production deployment uses HTTPS. The ordinary dev/build/start commands remain SQL defaults. compileApp.cmd accepts sql, nosql or all (default sql).

SQL additionally needs a compatible SQL Server database and sqlcmd on PATH (or SQLCMD_PATH). DB_config is encrypted for the runtime Windows identity. Setup does not import or replace database data; preserve strict TLS and configure a trusted certificate.

No-SQL needs no SQL Server, sqlcmd or DB_config. It runs the same app server and login; it is not a static HTML export. Setup, build and start initialize a missing JSON store from the repository's sample snapshots/reference data and retain an existing store. Data and saved settings live in NoSQL/data by default; set TSAAT_JSON_DATA_DIR to an absolute path for another location. These samples are not an export of the live SQL database. See [JSON storage and recovery](docs/data-providers.md).

For a NEW disposable SQL database only, use npm run db:bootstrap -- -DatabaseName TSAAT_UI3_Dev after reviewing [database operations](docs/database.md). The bootstrap refuses an existing database. Never apply the destructive base schema/seed loader to an operational database.

## Development gates

~~~powershell
npm run docs:generate
npm run check
npm run build:all
npm run test:nosql
~~~

Review affected human-written documentation before regenerating inventories. The gates check repository hygiene, documentation, lint, types, tests, both production compilations and the compiled No-SQL app in an authenticated browser. SQL integration is separately opt-in against a disposable database. Every feature change must support both providers in the same release.

## Current workspace

Cyber Security contains Network Risk Profile, ICT System Risk Profile, Service Impact Analyser, Network Impact Analyser and ICT System Impact Analyser. Discovery contains Overview, Discovery Tool Coverage, Discovery Compliance Explorer, End Point Explorer, Installed Software Explorer and Shadow IT Explorer. Observed Measures contains Measures Summary, KPIs and SPIs. Findings contains the Findings Register. Briefs & Reports is separate; Settings is in the header menu.

## Repository boundary

Includes current source, tests, assets, SQL schema/migrations/loaders/reference data, JSON initialization data and maintained documentation. Excludes independently maintained duplicate apps, dependencies/runtimes, credentials, mutable JSON stores, build outputs, reports and logs. The rejected standalone Demo distribution has been removed. Compatibility routes remain for existing bookmarks and APIs. [Baseline provenance](docs/import-baseline.md) records the import. A local repository does not configure remote hosting, branch protection or deployment services.
