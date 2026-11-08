# TSAAT UI 3

Threat Surface Area Assessment Tool: one Windows-hosted Next.js/TypeScript app with two compilation paths. The standard build uses Microsoft SQL Server. The No-SQL build uses persistent JSON files. Both share the current pages, reports, settings and interactions.

## Start here

- [Documentation index](docs/README.md), [development](docs/development.md) and [data providers](docs/data-providers.md)
- [Architecture](docs/architecture.md), [UI design](docs/ui-design.md) and [solution design](Requirements%20Documentation/TSAAT-Solution-Design-Index.md)
- [Database lifecycle](docs/database.md), [ERD](Database%20Schema/ERD.md) and [schema catalogue](docs/generated/database-catalogue.md)
- [Contribution workflow](CONTRIBUTING.md), [SDLC](docs/sdlc.md) and [release runbook](docs/operations.md)
- [Shared eight-week sample evidence and existing-store updates](docs/sample-evidence.md)

## Local setup

Both builds compile offline on Windows with preinstalled Node.js 24, npm and PowerShell. All application packages, including native compiler packages, are checked in under vendor/npm. No registry, prewarmed npm cache or sibling folder is needed. Install from the local lockfile archives and open the workspace directly:

~~~powershell
npm ci --offline
~~~

Application pages and APIs no longer require a user login. The header has no Signed in or Logout section, and Password Settings is retired. Existing local logindetails files are unused and remain excluded from Git.

Menu → Settings → Personas manages the shared persona list, names, pages and popup preferences. Save writes to the active SQL or JSON source; the browser remembers only its selected persona. Existing configurations retain selections and upgrade on explicit save. See [Personas and upgrades](docs/personas.md).

Choose a build:

| Action | Standard SQL | No-SQL (JSON files) |
| --- | --- | --- |
| Configure storage | npm run setup:database | npm run setup:nosql |
| Development | npm run dev:sql | npm run dev:nosql |
| Compile | npm run build:sql | npm run build:nosql |
| Run compiled app | npm run start:sql | npm run start:nosql |
| Build output | .next-sql | .next-nosql |

Open http://localhost:3000 and select a network or ICT system to populate the workspace. Production deployment uses HTTPS. The ordinary dev/build/start commands remain SQL defaults. compileApp.cmd accepts sql, nosql or all (default sql) and performs a locked offline install before validation/compilation. Builds reject network access. See the mandatory [offline compilation contract](docs/offline-builds.md).

SQL needs a running SQL Server with SQL authentication enabled and sqlcmd on PATH (or SQLCMD_PATH). Run `npm run setup:database`: it asks whether the endpoint is `localhost\SQLEXPRESS` (default Yes); answer No to enter another endpoint. It uses the local instance's configured TCP port when available and prepares **TSAATDB**. Enter a new database username and password, then choose the administrator connection (your Windows account by default, or a separate SQL administrator username/password). **If TSAATDB already exists, setup asks you to type its name, then deletes and replaces it. All existing data/settings are lost; active sessions are disconnected and no backup is created.** Setup applies schema and migrations, loads reference data and eight sample snapshots, creates or reconnects the app login/user, validates access, and saves DPAPI-encrypted DB_config. **SSL is disabled** for setup and the saved app connection. Administrator credentials are not saved. Then run `npm run dev:sql`. Other databases are left intact. See [setup and recovery](docs/database.md#one-command-database-setup).

No-SQL needs no SQL Server, sqlcmd or DB_config. It runs the same app server; it is not a static HTML export. Setup, build and start initialize a missing JSON store from the repository's sample snapshots/reference data and retain an existing store. Data and saved settings live in NoSQL/data by default; set TSAAT_JSON_DATA_DIR to an absolute path for another location. Fresh stores include complete sample endpoint/software details, entity profiles and Shadow IT observations. Existing stores can be populated from an explicit SQL export using npm run populate:nosql; preview first and apply with --source <export.json> --apply --demo to enrich imported records. Population backs up the store and preserves settings. For explicit sample finding coverage, run npm run enrich:nosql to preview, then npm run enrich:nosql -- --apply --demo. This fills missing known-endpoint details and adds open findings for every failed or unknown applicable SPI while preserving existing history; Shadow IT remains unidentified. Fresh samples remain independent of any live SQL database. See [JSON storage and recovery](docs/data-providers.md).

The lower-level `npm run db:bootstrap -- -DatabaseName TSAAT_UI3_Dev` remains available for a NEW disposable SQL database and refuses an existing name. Ordinary first-time setup needs only `setup:database`. Never apply the destructive base schema/seed loader to an operational database.

## Development validation

Assess the change before selecting checks using the [SDLC matrix](docs/sdlc.md). Run node scripts/change-impact.mjs for a conservative plan, then use focused tests and relevant lint/type/browser checks. SQL/JSON data and structure checks are required when those contracts are affected; documentation checks/regeneration are required only when documentation or inventories are affected. Record reasons for omitted categories.

npm run check, npm run build:all and npm run test:nosql remain the comprehensive path for releases and broad changes. Dependency/build changes also require fresh empty-cache offline installation. CI selects affected checks and supports validation:data, validation:docs and validation:full PR labels; workflow_dispatch runs the full offline release gate. Both providers and offline capability remain supported for every change.

## Current workspace

End Point Insights and Security Vulnerability Insights include **Generate PDF**, retaining scope and snapshot with complete field/distribution breakdowns. See [report content and behavior](docs/inventory-insights-reports.md).

[Security Vulnerability Insights](Requirements%20Documentation/23-Security-Vulnerability-Insights.md) follows End Point Insights in Governance. It explains recorded CVEs, affected software and endpoints, missing metadata, detection sources/dates and discovery coverage, with filtered Explorer links. Existing saved personas can enable it in Persona Settings.

Governance also includes [End Point Insights](Requirements%20Documentation/22-End-Point-Insights.md), below Discovery Insights. Its infographic explains endpoint composition, missing identity/context, discovery dates and sources, and surrounding tool coverage, with links to matching Explorer records. Existing saved personas can enable the new page in Persona Settings.

Governance appears first in the sidebar. Installed Software Insights sits below Cyber Terrain Insights, followed by Discovery Insights. Both present infographic briefings with Generate PDF. Discovery Insights connects the discovery footprint, tool coverage, evidence quality, security follow-up and next actions. Cyber Terrain Insights presents a scrolling executive Cyber Terrain Posture briefing covering visibility, exposure, service impact, patch assurance and leadership priorities, using the applied scope and snapshot. Governance Overview is retired; old bookmarks redirect to Trends. Trends presents a scoped executive history of compliance, lifecycle and discovery. See the [Insights contract](Requirements%20Documentation/15-Governance-Insights.md).

Cyber Security contains Network Risk Profile, ICT System Risk Profile, Service Impact Analyser, ICT System Impact Analyser and ICT System Dependencies. Discovery contains Discovery Tool Coverage, Discovery Compliance Explorer, End Point Explorer, Installed Software Explorer, Security Vulnerability Explorer, Patch Management Explorer, Life Cycle Management, Shadow IT Explorer and Topology Explorer. Topology Explorer finds CIs by name, software, CVE or IP. Business Impact shows model relationships above/below the CI; Dependencies shows incoming/outgoing communication and peer business context, including direct peers across network/system boundaries while retaining Security Domain filtering. Observed Measures contains Measures Summary, Measures Trends, KPIs and SPIs. Measures Trends separates KPIs/SPIs into tabs with 1 week, 4 weeks, 3 months, 6 months and 12 months history. Findings contains the Findings Register. Briefs & Reports is separate; Settings is in the header menu.

Patch Management Explorer tracks server installation, restart and verification evidence with maintenance planning and filtered Excel export. Fresh samples include labelled patch observations. Preview existing-store sample population with `npm run populate:patches`, then explicitly apply with `-- --apply --demo`. SQL requires forward migration 029. See [status rules, sources and recovery](docs/patch-management-explorer.md).

## Repository boundary

Includes current source, tests, assets, SQL schema/migrations/loaders/reference data, JSON initialization data and maintained documentation. Includes the integrity-locked third-party archives and provenance manifest in vendor/npm as the sole dependency-vendoring exception. Excludes independently maintained duplicate apps, installed node_modules, host runtimes, credentials, mutable JSON stores, build outputs, reports and logs. The rejected standalone Demo distribution has been removed. Compatibility routes remain for existing bookmarks and APIs. [Baseline provenance](docs/import-baseline.md) records the import. A local repository does not configure remote hosting, branch protection or deployment services.


The header Security Domain filter defaults to PROTECTED, SECRET and UNKNOWN selected. Each endpoint, ICT-system model and network model has its own domain. See [security domain scope and upgrade](docs/security-domains.md) for migration 030 and the explicit JSON migration.


Governance > Discovery Insights includes Generate PDF, with charts/tables for all overview sections and report-card charts for discovery tools. Reports retain applied scope, security domains and snapshot dates. See [report design](docs/discovery-overview-report.md).
