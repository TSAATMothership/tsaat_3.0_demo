# Development and validation

## Environment

Use Windows, Node 24.13.1, npm and the committed package-lock.json. `npm ci --offline` installs only committed vendor/npm archives, using the checked-in legacy-peer-deps setting, with lifecycle scripts, audit and update notices disabled. No populated npm cache or network is required. The checkout does not require a sibling TSAAT folder or vendored host runtime. The [offline compilation contract](offline-builds.md) is mandatory for all changes. node_modules, .next-sql and .next-nosql are local outputs. NoSQL/data is mutable local data and is also ignored.

Both builds use `npm run setup:login` for local DPAPI credentials. For SQL, `npm run setup:database` provisions DB_config. Choose an existing development database for ordinary work. `npm run db:bootstrap` requires a new database name and refuses an existing one. sqlcmd must be on PATH or selected by SQLCMD_PATH.

## Setting the application login

Run `npm run setup:login` in a terminal under the Windows identity that runs TSAAT. Enter the username, then a password of 8-256 characters, and confirm the password. Password prompts hide the input. Usernames are trimmed and lowercased; passwords retain case and are trimmed, matching the application's existing credential rules. Mismatched confirmation or invalid input leaves any existing login unchanged; rerun the command to try again.

Running setup again lets you replace both credentials without deleting logindetails. Saving increments the existing session version, so old sessions expire, and retains the original creation timestamp. The encrypted file format is unchanged. The direct ensure-logindetails.ps1 helper without -Configure still validates an existing usable file without rewriting it.

For unattended setup, provide TSAAT_LOGIN_USERNAME and TSAAT_LOGIN_PASSWORD in the process environment, run the same npm command, then remove them from that environment. These values supply the corresponding prompts; password confirmation is only requested for a typed password. Do not put real passwords into command-line arguments, scripts or repository files. A redirected input stream with missing values fails clearly without replacing usable credentials. Recovery of an unreadable DPAPI file retains the existing recreation flow under the current Windows identity.

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
| npm run setup:login | Set or replace the application username/password for either provider |
| npm run populate:nosql | Preview current-store enrichment; --source selects a SQL export and --apply --demo publishes with backup |
| npm run populate:patches | Preview missing sample server patch records; --apply --demo publishes with backup |
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

If dev, start or build reports that Next.js is missing or incomplete (or an older launcher reports `Cannot find module 'next/dist/bin/next'`), stop this checkout's app processes, run `npm ci --offline` from the repository root, then retry the original command. This repairs `node_modules` from the committed archives without changing credentials or JSON data. The launcher checks for Next.js before JSON initialization or build setup and prints this recovery command when it is absent.

Create missing DPAPI files under the runtime identity. Configure sqlcmd if absent. Hard-refresh stale Next hot-update references after a restart; stop the corresponding server before clearing its .next-sql or .next-nosql output. Never clear NoSQL/data as a build fix. Fix build errors rather than bypassing them. Deployment troubleshooting is in [operations](operations.md).

## Provider development

Security Vulnerability Explorer uses `populate:vulnerabilities` to preview existing-store CVE additions and `populate:vulnerabilities -- --apply --demo` to publish with backup. SQL migration 028 is required before running the SQL app. Actual SQL parity requires an explicitly selected disposable `TSAAT_VulnerabilityParity_*` database and trusted TLS; the commands and source catalogue are in [the feature contract](security-vulnerability-explorer.md).

SQL remains the default for npm run dev/build/start. compileApp.cmd accepts sql, nosql or all and performs npm ci --offline before checks/builds. No-SQL initialization/build/start retains existing JSON data. Use TSAAT_JSON_DATA_DIR for isolated test stores and a stable absolute runtime path. See [provider contracts](data-providers.md) for schema evolution, equivalent calculations and settings writes.

The No-SQL smoke needs installed Chrome or Edge; TSAAT_TEST_BROWSER overrides its executable. It starts the compiled app with isolated credentials/data and an unavailable SQL executable, exercises both scope types, reports and saved settings, then restarts to verify persistence. It does not touch local DB_config, logindetails or NoSQL/data. Unit tests also use temporary stores. Set TSAAT_TEST_SQL_EXPORT to an authorized local export file to run the same compiled smoke against imported/enriched SQL records in isolation; it never writes the active store. Population tests cover field coverage, history preservation, stable identities, idempotence, backup/publication, failure safety and source conversion.

All new feature code uses the shared data facades. Type checking requires the JSON operation set to match SQL. Add behavior tests for both providers when data or rule semantics change; review the SQL calculation hash guard only after implementation and regression validation. The No-SQL provider does not execute arbitrary SQL text.

To preview missing known-endpoint measure findings, run `npm run enrich:nosql`. Stop the app and apply with `npm run enrich:nosql -- --apply --demo`; this is sample maintenance with a complete backup, not a runtime fallback. It keeps Shadow IT unidentified. The No-SQL production smoke now includes this enrichment in its isolated test store before checking pages, exports and settings persistence.

Optional read-only SQL parity: provision a separate `TSAAT_CoverageParity_*` disposable database with trusted TLS, set `TSAAT_COVERAGE_PARITY_DATABASE` to that exact name, then run `npm exec -- vitest run tests/nosql-coverage-sql.test.ts`. The test selects that database explicitly, compares configured SQL and shared JSON SPI results, and checks sample finding coverage without SQL writes. It never installs a schema or relaxes TLS and is skipped unless explicitly selected.

The production No-SQL smoke follows all eight row drill-throughs on each risk-profile explorer in real new tabs. It checks keyboard activation, selected-item/date presets, severity/duration filters, detail-panel loading, and unchanged source-table search/order/scope. This shared navigation has no provider-specific SQL behavior.


Security-domain changes add no dependencies. Run tests/security-domain*.test.ts plus provider/navigation tests and the production smoke gate. Live SQL migration verification requires explicitly configured TSAAT_DOMAIN_PARITY_SERVER and an empty TSAAT_DomainParity_* database; absence skips it. See [scope and migration](security-domains.md).

The shared pure domain module is native ESM for use by offline setup/migration scripts. Its .d.mts declaration uses the already installed TypeScript ESLint parser override, keeping declaration files linted.
