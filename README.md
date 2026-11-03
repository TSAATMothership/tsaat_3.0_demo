# TSAAT UI 3

Threat Surface Area Assessment Tool: one Windows-hosted Next.js/TypeScript app with two compilation paths. The standard build uses Microsoft SQL Server. The No-SQL build uses persistent JSON files. Both share the current pages, login, reports, settings and interactions.

## Start here

- [Documentation index](docs/README.md), [development](docs/development.md) and [data providers](docs/data-providers.md)
- [Architecture](docs/architecture.md), [UI design](docs/ui-design.md) and [solution design](Requirements%20Documentation/TSAAT-Solution-Design-Index.md)
- [Database lifecycle](docs/database.md), [ERD](Database%20Schema/ERD.md) and [schema catalogue](docs/generated/database-catalogue.md)
- [Contribution workflow](CONTRIBUTING.md), [SDLC](docs/sdlc.md) and [release runbook](docs/operations.md)

## Local setup

Both builds compile offline on Windows with preinstalled Node.js 24, npm and PowerShell. All application packages, including native compiler packages, are checked in under vendor/npm. No registry, prewarmed npm cache or sibling folder is needed. Install from the local lockfile archives and provision login under the runtime Windows identity:

~~~powershell
npm ci --offline
npm run setup:login
~~~

The login command asks for a username, password (8-256 characters) and password confirmation. Run it again to change the login, even when logindetails already exists; saving signs out existing sessions. Password entry is hidden. Use the same Windows identity to run setup and the app.

If `npm run setup:login` does not work or hangs before showing the username prompt, press **Ctrl+C** to cancel it, then run the setup script directly from the repository root in PowerShell:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\ensure-logindetails.ps1 -Configure
~~~

This fallback uses the same username, password and confirmation prompts for both SQL and No-SQL builds.

Choose a build:

| Action | Standard SQL | No-SQL (JSON files) |
| --- | --- | --- |
| Configure storage | npm run setup:database | npm run setup:nosql |
| Development | npm run dev:sql | npm run dev:nosql |
| Compile | npm run build:sql | npm run build:nosql |
| Run compiled app | npm run start:sql | npm run start:nosql |
| Build output | .next-sql | .next-nosql |

Open http://localhost:3000 and sign in. Select a network or ICT system to populate the workspace. Production deployment uses HTTPS. The ordinary dev/build/start commands remain SQL defaults. compileApp.cmd accepts sql, nosql or all (default sql) and performs a locked offline install before validation/compilation. Builds reject network access. See the mandatory [offline compilation contract](docs/offline-builds.md).

SQL additionally needs a compatible SQL Server database and sqlcmd on PATH (or SQLCMD_PATH). DB_config is encrypted for the runtime Windows identity. Setup does not import or replace database data; preserve strict TLS and configure a trusted certificate.

No-SQL needs no SQL Server, sqlcmd or DB_config. It runs the same app server and login; it is not a static HTML export. Setup, build and start initialize a missing JSON store from the repository's sample snapshots/reference data and retain an existing store. Data and saved settings live in NoSQL/data by default; set TSAAT_JSON_DATA_DIR to an absolute path for another location. Fresh stores include complete sample endpoint/software details, entity profiles and Shadow IT observations. Existing stores can be populated from an explicit SQL export using npm run populate:nosql; preview first and apply with --source <export.json> --apply --demo to enrich imported records. Population backs up the store and preserves settings. For explicit sample finding coverage, run npm run enrich:nosql to preview, then npm run enrich:nosql -- --apply --demo. This fills missing known-endpoint details and adds open findings for every failed or unknown applicable SPI while preserving existing history; Shadow IT remains unidentified. Fresh samples remain independent of any live SQL database. See [JSON storage and recovery](docs/data-providers.md).

For a NEW disposable SQL database only, use npm run db:bootstrap -- -DatabaseName TSAAT_UI3_Dev after reviewing [database operations](docs/database.md). The bootstrap refuses an existing database. Never apply the destructive base schema/seed loader to an operational database.

## Development gates

~~~powershell
npm run docs:generate
npm run check
npm run build:all
npm run test:nosql
~~~

Review affected human-written documentation before regenerating inventories. The gates check repository hygiene, documentation, lint, types, tests, both production compilations and the compiled No-SQL app in an authenticated browser. SQL integration is separately opt-in against a disposable database. Every feature change must support both providers and preserve fresh-checkout offline installation and compilation in the same release. CI uses an empty npm cache and denies outbound Node traffic during installation, checks and both builds.

## Current workspace

Governance appears first in the sidebar with empty Overview, Trends and Insights pages. They retain the applied scope and snapshot date and are ready for future content.

Cyber Security contains Network Risk Profile, ICT System Risk Profile, Service Impact Analyser, Network Impact Analyser and ICT System Impact Analyser. Discovery contains Overview, Discovery Tool Coverage, Discovery Compliance Explorer, End Point Explorer, Installed Software Explorer, Security Vulnerability Explorer, Patch Management Explorer and Shadow IT Explorer. Observed Measures contains Measures Summary, KPIs and SPIs. Findings contains the Findings Register. Briefs & Reports is separate; Settings is in the header menu.

Patch Management Explorer tracks server installation, restart and verification evidence with maintenance planning and filtered Excel export. Fresh samples include labelled patch observations. Preview existing-store sample population with `npm run populate:patches`, then explicitly apply with `-- --apply --demo`. SQL requires forward migration 029. See [status rules, sources and recovery](docs/patch-management-explorer.md).

## Repository boundary

Includes current source, tests, assets, SQL schema/migrations/loaders/reference data, JSON initialization data and maintained documentation. Includes the integrity-locked third-party archives and provenance manifest in vendor/npm as the sole dependency-vendoring exception. Excludes independently maintained duplicate apps, installed node_modules, host runtimes, credentials, mutable JSON stores, build outputs, reports and logs. The rejected standalone Demo distribution has been removed. Compatibility routes remain for existing bookmarks and APIs. [Baseline provenance](docs/import-baseline.md) records the import. A local repository does not configure remote hosting, branch protection or deployment services.


The header Security Domain filter defaults to PROTECTED, SECRET and UNKNOWN selected. Each endpoint, ICT-system model and network model has its own domain. See [security domain scope and upgrade](docs/security-domains.md) for migration 030 and the explicit JSON migration.
