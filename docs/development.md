# Development and validation

## Environment

Use Windows, Node 24.13.1, npm and the committed package-lock.json. `npm ci --offline` installs only committed vendor/npm archives, using the checked-in legacy-peer-deps setting, with lifecycle scripts, audit and update notices disabled. No populated npm cache or network is required. The checkout does not require a sibling TSAAT folder or vendored host runtime. The [offline compilation contract](offline-builds.md) is mandatory for all changes. node_modules, .next-sql and .next-nosql are local outputs. NoSQL/data is mutable local data and is also ignored.

Both builds use `npm run setup:login` for local DPAPI credentials. For SQL, `npm run setup:database` provisions DB_config. Choose an existing development database for ordinary work. `npm run db:bootstrap` requires a new database name and refuses an existing one. sqlcmd must be on PATH or selected by SQLCMD_PATH.

## Commands

| Command | Purpose |
| --- | --- |
| npm ci --offline | Locked installation from repository archives, even with an empty npm cache |
| npm run offline:check | Verify local lockfile closure, archive integrity and provenance |
| npm run offline:refresh | Explicit connected maintenance only: vendor reviewed locked packages |
| npm run dev:sql / dev:nosql | Development server using the selected provider |
| npm run docs:generate | Regenerate inventories/checksums after documentation review |
| npm run docs:check | Verify links, inventories, source freshness and PR documentation impact |
| npm run repo:check | Reject tracked secrets, generated folders, oversized files and unreachable runtime modules |
| npm run lint | ESLint/Next checks |
| npm run typecheck | Strict checking of app, scripts and tests, including unused locals/parameters |
| npm test | Full default suite; SQL integration remains opt-in |
| npm run check | All source/documentation gates |
| npm run build:all | Both production compilations with network access blocked and local archives verified |
| npm run build:sql / build:nosql | Compile a single provider |
| npm run test:nosql | Authenticated production browser/API smoke and restart persistence |
| npm run setup:nosql | Initialize missing JSON storage without replacing existing data |
| npm run storage:check | Require review when SQL calculation contracts change |
| npm run start:sql / start:nosql | Serve the corresponding compiled artifact; production login requires HTTPS |
| npm run seed / seed:validate | Regenerate/validate sample JSON; generation intentionally changes fixture data |

## Validation strategy

Use `npm test -- tests/name.test.ts` for focused checks. The full suite limits workers to four and permits 30 seconds per test/hook because native PowerShell/DPAPI processes are slower under load. Authentication tests use isolated temporary credentials. Retired-page tests assert redirects; risk-profile tests cover replacement behavior. Fix fixture types instead of suppressing compiler errors.

Set TSAAT_SQL_INTEGRATION=1 only against an explicitly selected disposable compatible database. Review each SQL suite: temporary migration/mapping fixtures roll back, while the entity-panel coverage test expects populated demo snapshots. Record database/schema and results separately. Default CI does not provision or mutate SQL Server.

KPI integration targets the current cleanup migration 027. Run it after provisioning/upgrading the disposable database; never reapply 023 to a cleaned installation. CMDB integration validates mappings for all supported asset types and exercises API values for every type actually present in the snapshot. Demo data need not contain every supported type.

For UI work, check representative snapshot data, desktop/narrow layouts, keyboard use, loading/error/retry/empty states and retained scope. For reports, inspect PDF pages, endpoint columns, filenames, totals and date scope. Unit tests do not replace these checks.

## Troubleshooting

Create missing DPAPI files under the runtime identity. Configure sqlcmd if absent. Hard-refresh stale Next hot-update references after a restart; stop the corresponding server before clearing its .next-sql or .next-nosql output. Never clear NoSQL/data as a build fix. Fix build errors rather than bypassing them. Deployment troubleshooting is in [operations](operations.md).

## Provider development

SQL remains the default for npm run dev/build/start. compileApp.cmd accepts sql, nosql or all and performs npm ci --offline before checks/builds. No-SQL initialization/build/start retains existing JSON data. Use TSAAT_JSON_DATA_DIR for isolated test stores and a stable absolute runtime path. See [provider contracts](data-providers.md) for schema evolution, equivalent calculations and settings writes.

The No-SQL smoke needs installed Chrome or Edge; TSAAT_TEST_BROWSER overrides its executable. It starts the compiled app with isolated credentials/data and an unavailable SQL executable, exercises both scope types, reports and saved settings, then restarts to verify persistence. It does not touch local DB_config, logindetails or NoSQL/data. Unit tests also use temporary stores.

All new feature code uses the shared data facades. Type checking requires the JSON operation set to match SQL. Add behavior tests for both providers when data or rule semantics change; review the SQL calculation hash guard only after implementation and regression validation. The No-SQL provider does not execute arbitrary SQL text.
