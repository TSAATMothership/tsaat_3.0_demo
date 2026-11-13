# TSAAT UI 3

Threat Surface Area Assessment Tool: one Windows-hosted Next.js/TypeScript app with two compilation paths. The standard build uses Microsoft SQL Server. The No-SQL build uses persistent JSON files. Both share the current pages, reports, scope controls and interactions.

## Start here

- [Documentation index](docs/README.md), [development](docs/development.md) and [data providers](docs/data-providers.md)
- [Architecture](docs/architecture.md), [UI design](docs/ui-design.md) and [solution design](Requirements%20Documentation/TSAAT-Solution-Design-Index.md)
- [Database lifecycle](docs/database.md), [ERD](Database%20Schema/ERD.md) and [schema catalogue](docs/generated/database-catalogue.md)
- [Contribution workflow](CONTRIBUTING.md), [SDLC](docs/sdlc.md) and [release runbook](docs/operations.md)
- [Shared eight-week sample evidence and existing-store updates](docs/sample-evidence.md)

## Local setup

Both builds compile offline on Windows x64 with PowerShell. The generated offline distribution includes portable Node.js 24.13.1 and npm 11.8.0; no Node/npm installation or administrator access is needed. A source-only Git checkout still requires stable Node.js 24.13.1+ and npm 11.8.0+, or the reviewed runtime archive described in [offline packaging](docs/offline-builds.md#package-nodejs-for-a-disconnected-machine). All application packages, including native compiler packages, are checked in under vendor/npm. No registry, prewarmed npm cache or sibling folder is needed:

~~~powershell
.\install-offline.cmd
~~~

This command verifies and unpacks the bundled runtime, verifies the dependency archives, stops this checkout's active Next.js servers, then runs `npm ci --offline` with lifecycle scripts disabled and Node network access blocked. It works before `node_modules` exists. Use `.\tsaat-npm.cmd` in place of `npm` for all later commands when using portable Node, for example `.\tsaat-npm.cmd run dev:nosql`. The launcher changes PATH only for its process and children. Other checkouts and unrelated Node processes are left running. `npm run install:offline` also works with an older host Node: it automatically hands installation to the bundled Node 24 launcher. Bare `npm ci --offline` requires servers to be stopped first.

Application pages and APIs no longer require a user login. The header has no Signed in or Logout section, and Password Settings is retired. Existing local logindetails files are unused and remain excluded from Git.

Menu and Settings are retired. Existing persona selection is available directly in the header, with All sections and load recovery. Shared persona definitions and discovery coverage rules remain in SQL/JSON for the retained features. SQL configuration remains a command-line operation. See [Settings retirement](Requirements%20Documentation/11-Settings.md) and [Personas](docs/personas.md).

Choose a build:

| Action | Standard SQL | No-SQL (JSON files) |
| --- | --- | --- |
| Configure storage | npm run setup:database | npm run setup:nosql |
| Development | npm run dev:sql | npm run dev:nosql |
| Compile | npm run build:sql | npm run build:nosql |
| Run compiled app | npm run start:sql | npm run start:nosql |
| Build output | .next-sql | .next-nosql |

Open http://localhost:3000 and select a network or ICT system to populate the workspace. Production deployment uses HTTPS. The ordinary dev/build/start commands remain SQL defaults. compileApp.cmd accepts sql, nosql or all (default sql) and uses the same server shutdown and locked offline installer before validation/compilation. Builds reject network access. See the mandatory [offline compilation contract](docs/offline-builds.md).

SQL needs a running SQL Server with SQL authentication enabled and sqlcmd on PATH (or SQLCMD_PATH). Run `npm run setup:database`: it asks whether the endpoint is `localhost\SQLEXPRESS` (default Yes); answer No to enter another endpoint. It uses the local instance's configured TCP port when available and prepares **TSAATDB**. Enter a new database username/password, or the existing SQL login/password when replacing the database, then choose the administrator connection (your Windows account by default, or a separate SQL administrator username/password). **If TSAATDB already exists, setup asks you to type its name, then deletes and replaces it. All existing data/settings are lost; active sessions are disconnected and no backup is created.** Setup verifies a reused login before deletion even if its database-user mapping is missing; it preserves the login's password and server permissions. Setup applies schema and migrations, loads reference data and eight sample snapshots, creates or reconnects the app login/user, validates access, and saves DPAPI-encrypted DB_config. **SSL is disabled** for setup and the saved app connection. Administrator credentials are not saved. Then run `npm run dev:sql`. Other databases are left intact. See [setup and recovery](docs/database.md#one-command-database-setup).

No-SQL needs no SQL Server, sqlcmd or DB_config. It runs the same app server; it is not a static HTML export. Setup, build and start initialize a missing JSON store from the repository's sample snapshots/reference data and retain an existing store. Data and saved settings live in NoSQL/data by default; set TSAAT_JSON_DATA_DIR to an absolute path for another location. Fresh stores include complete sample endpoint/software details, entity profiles and Shadow IT observations. Existing stores can be populated from an explicit SQL export using npm run populate:nosql; preview first and apply with --source <export.json> --apply --demo to enrich imported records. Population backs up the store and preserves settings. Fresh samples remain independent of any live SQL database. See [JSON storage and recovery](docs/data-providers.md).

The lower-level `npm run db:bootstrap -- -DatabaseName TSAAT_UI3_Dev` remains available for a NEW disposable SQL database and refuses an existing name. Ordinary first-time setup needs only `setup:database`. Never apply the destructive base schema/seed loader to an operational database.

## Development validation

Assess the change before selecting checks using the [SDLC matrix](docs/sdlc.md). Run node scripts/change-impact.mjs for a conservative plan, then use focused tests and relevant lint/type/browser checks. SQL/JSON data and structure checks are required when those contracts are affected; documentation checks/regeneration are required only when documentation or inventories are affected. Record reasons for omitted categories.

npm run check, npm run build:all and npm run test:nosql remain the comprehensive path for releases and broad changes. Dependency/build changes also require fresh empty-cache offline installation. CI selects affected checks and supports validation:data, validation:docs and validation:full PR labels; workflow_dispatch runs the full offline release gate. Both providers and offline capability remain supported for every change.

## Current workspace

Governance: Installed Software Insights, End Point Insights and Security Vulnerability Insights, each retaining scoped PDF export. Discovery: End Point, Installed Software, Security Vulnerability, Shadow IT and Topology Explorers; the former Installed Software Dashboard URL shows a retirement notice. Retained tabular Explorers keep Excel exports and CMDB drill-through.

The header provides Persona, Security Domain, Managed Network, ICT System and Date controls. Menu and Settings, Database Settings, both SPI matrix tabs, Cyber Security, Observed Measures, Findings and Briefs & Reports are retired. Old URLs show an explicit retirement response.

Existing SQL and JSON stores require the [explicit backed-up storage-v2 upgrade](docs/feature-retirement.md). Fresh setup uses the reduced schema and the same eight weekly snapshots. Builds never overwrite existing JSON data. See [the current solution contracts](Requirements%20Documentation/TSAAT-Solution-Design-Index.md).

## Repository boundary

Includes current source, tests, assets, SQL schema/migrations/loaders/reference data, JSON initialization data and maintained documentation. Includes the integrity-locked third-party archives and provenance manifest in vendor/npm as the sole dependency-vendoring exception. Excludes independently maintained duplicate apps, installed node_modules, host runtimes, credentials, mutable JSON stores, build outputs, reports and logs. The rejected standalone Demo distribution has been removed. Compatibility routes remain for existing bookmarks and APIs. [Baseline provenance](docs/import-baseline.md) records the import. A local repository does not configure remote hosting, branch protection or deployment services.


The header Security Domain filter defaults to PROTECTED, SECRET and UNKNOWN selected. Each endpoint, ICT-system model and network model has its own domain. See [security domain scope and upgrade](docs/security-domains.md) for migration 030 and the explicit JSON migration.


The three retained Governance Insights include Generate PDF. Reports and Explorer Excel exports retain applied scope, security domains and snapshot dates. See [report design](docs/inventory-insights-reports.md). Existing SQL/JSON installations require the explicit [inventory storage v2 upgrade](docs/feature-retirement.md); builds never delete or replace installed data.
