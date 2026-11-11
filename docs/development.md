# Development and validation

## Environment

For a generated offline distribution, run .\install-offline.cmd to prepare its bundled Node.js 24.13.1/npm runtime. Use .\tsaat-npm.cmd instead of npm for all later commands. The portable runtime needs no administrator rights or persistent PATH change. Source-only checkouts can still use the host tools below. See [offline packaging](offline-builds.md#package-nodejs-for-a-disconnected-machine).

Use Windows, Node 24.13.1, npm and the committed package-lock.json. `npm ci --offline` installs only committed vendor/npm archives, using the checked-in legacy-peer-deps setting, with lifecycle scripts, audit and update notices disabled. No populated npm cache or network is required. The checkout does not require a sibling TSAAT folder or vendored host runtime. The [offline compilation contract](offline-builds.md) remains a product requirement; repeat fresh-install/both-build evidence for dependency/build changes and releases, not unrelated routine edits. node_modules, .next-sql and .next-nosql are local outputs. NoSQL/data is mutable local data and is also ignored.

Both builds open directly without application credentials. SQL setup creates a dedicated login with SSL disabled and can replace an existing database only after exact-target acknowledgement. It is not an upgrade tool. Advanced configuration preserves saved TLS/Strict policies. See [database setup](database.md#one-command-database-setup). The lower-level db:bootstrap requires a new database.

## Select checks before running them

Use the [SDLC impact matrix](sdlc.md) before selecting validation. node scripts/change-impact.mjs prints a conservative plan for local changes; --base <commit> compares committed changes and --run executes selected source checks. Use --data, --docs or --full to broaden it. For a mixed working tree, assess the actual task separately from unrelated existing edits.

UI-only changes normally need lint/types, focused tests and relevant visual/keyboard checks. Data/provider checks and live SQL parity are not routine UI gates. Skip documentation checks when neither documentation nor generated inventories are affected. Record reasons and limitations in the PR; choose the explicit full gate for releases, dependency/build risk or uncertain broad behavior.

## Commands

| Command | Purpose |
| --- | --- |
| npm run install:offline | Stop checkout app servers and perform guarded npm ci from repository archives, even with an empty cache |
| npm ci --offline | Underlying locked install; stop app servers manually before using this bare command |
| npm run offline:check | Verify local lockfile closure, archive integrity and provenance |
| npm run offline:refresh | Explicit connected maintenance only: vendor reviewed locked packages |
| npm run dev:sql / dev:nosql | Development server using the selected provider |
| npm run docs:generate | Regenerate affected inventories; refresh the informational source snapshot |
| npm run docs:check | Verify links/inventories; suggest PR documentation review areas |
| npm run repo:check | Reject tracked secrets, generated folders, oversized files and unreachable runtime modules |
| npm run lint | Supported ESLint CLI with the Next Core Web Vitals rules and existing React 18 policy |
| npm run typecheck | Strict checking of app, scripts and tests, including unused locals/parameters |
| npm test | Full default suite; SQL integration remains opt-in |
| npm run check | Explicit comprehensive source/documentation gate; not the routine default |
| npm run build:all | Both production compilations with network access blocked and local archives verified |
| npm run build:sql / build:nosql | Compile a single provider |
| npm run test:nosql | Direct-access production browser/API smoke and restart persistence |
| npm run populate:nosql | Preview current-store enrichment; --source selects a SQL export and --apply --demo publishes with backup |
| npm run setup:nosql | Initialize missing JSON storage without replacing existing data |
| npm run storage:check | Require review when SQL calculation contracts change |
| npm run start:sql / start:nosql | Serve the corresponding compiled artifact; deployment uses HTTPS |
| npm run seed:validate / evidence:check | Validate the shared eight-week retained-inventory bundle |
| npm run migrate:inventory | Preview the explicitly selected existing JSON store upgrade; apply requires a new external backup |

## Validation strategy

`eslint.config.mjs` replaces the legacy ESLint configuration. `scripts/lint.mjs` checks app, components and lib, including TypeScript declarations. Both build providers run this same mandatory CLI check under the network guard before storage initialization or compilation; Next 14's incompatible embedded lint adapter is disabled only because this preflight replaces it. Missing ESLint, lint errors or even caught network attempts fail the build. TypeScript checking remains enabled. See [ADR 0026](adr/0026-maintained-eslint-build-gate.md).

Use `npm test -- tests/name.test.ts` for focused checks. The CI planner uses Vitest related tests for changed imports plus explicitly changed tests. Add tests that use dynamic imports or read source files when relevant; import-based selection cannot find all of them. The full suite limits workers to four and permits 30 seconds per test/hook because native PowerShell/DPAPI processes are slower under load. Retired-login tests check safe redirects and endpoints without creating credentials. Retired-page tests assert redirects; risk-profile tests cover replacement behavior. Fix fixture types instead of suppressing compiler errors.

Set TSAAT_SQL_INTEGRATION=1 only against an explicitly selected disposable compatible database. Review each SQL suite: temporary migration/mapping fixtures roll back, while the entity-panel coverage test expects populated demo snapshots. Record database/schema and results separately. Default CI does not provision or mutate SQL Server.

Inventory parity compares all eight selected dates and identical network/system/domain scopes against an explicitly disposable TSAAT_EvidenceParity_* database. CMDB integration covers asset and model-CI mappings in rollback transactions. See [retirement validation](feature-retirement.md).

For UI work, check representative snapshot data, desktop/narrow layouts, keyboard use, loading/error/retry/empty states and retained scope. For reports, inspect PDF pages, endpoint columns, filenames, totals and date scope. Unit tests do not replace these checks.

## Troubleshooting

If dev, start or build reports that Next.js is missing or incomplete (or an older launcher reports `Cannot find module 'next/dist/bin/next'`), run `npm run install:offline` from the repository root, then retry the original command. This stops the checkout's recognized app servers and repairs `node_modules` from committed archives without changing credentials or JSON data. It also resolves SWC `EPERM unlink` failures caused by a running Next.js server. The launcher checks for Next.js before JSON initialization or build setup and prints this recovery command when it is absent. Bare npm ci cannot stop servers before its dependency removal; see [installer limits and interrupted-install recovery](offline-builds.md#failure-and-recovery).

Create missing DPAPI files under the runtime identity. Configure sqlcmd if absent. Hard-refresh stale Next hot-update references after a restart; stop the corresponding server before clearing its .next-sql or .next-nosql output. Never clear NoSQL/data as a build fix. Fix build errors rather than bypassing them. Deployment troubleshooting is in [operations](operations.md).

## Provider development

Security Vulnerability Explorer uses `populate:vulnerabilities` to preview existing-store CVE additions and `populate:vulnerabilities -- --apply --demo` to publish with backup. SQL migration 028 is required before running the SQL app. Actual SQL parity requires an explicitly selected disposable `TSAAT_VulnerabilityParity_*` database and trusted TLS; the commands and source catalogue are in [the feature contract](security-vulnerability-explorer.md).

SQL remains the default for npm run dev/build/start. compileApp.cmd accepts sql, nosql or all and uses install:offline to stop checkout servers and run npm ci --offline before checks/builds. No-SQL initialization/build/start retains existing JSON data. Use TSAAT_JSON_DATA_DIR for isolated test stores and a stable absolute runtime path. See [provider contracts](data-providers.md) for schema evolution, equivalent calculations and settings writes.

The No-SQL smoke needs installed Chrome or Edge; TSAAT_TEST_BROWSER overrides its executable. It starts the compiled app with isolated data without application credentials and an unavailable SQL executable, exercises both scope types, reports and saved settings, then restarts to verify persistence. It does not touch local DB_config, logindetails or NoSQL/data. Unit tests also use temporary stores. Set TSAAT_TEST_SQL_EXPORT to an authorized local export file to run the same compiled smoke against imported/enriched SQL records in isolation; it never writes the active store. Population tests cover field coverage, history preservation, stable identities, idempotence, backup/publication, failure safety and source conversion.

All new feature code uses the shared data facades. Type checking requires the JSON operation set to match SQL. Add behavior tests for both providers when data or rule semantics change; review the SQL calculation hash guard only after implementation and regression validation. The No-SQL provider does not execute arbitrary SQL text.

Retired analytics maintenance commands are removed. Existing stores require the explicit [paired inventory v2 upgrade](feature-retirement.md); compilation preserves installed data.

Real SQL parity: provision a separate TSAAT_EvidenceParity_* database, set TSAAT_EVIDENCE_PARITY_DATABASE and an isolated TSAAT_JSON_DATA_DIR, then run tests/inventory-provider-parity.test.ts. Select the same dates/scopes; skipped SQL tests are not evidence. Use scripts/test-sql-evidence.mjs for the compiled SQL browser checks against that selected disposable database.

The production No-SQL smoke follows all eight row drill-throughs on each risk-profile explorer in real new tabs. It checks keyboard activation, selected-item/date presets, severity/duration filters, detail-panel loading, and unchanged source-table search/order/scope. This shared navigation has no provider-specific SQL behavior.


Security-domain changes add no dependencies. Run tests/security-domain*.test.ts plus provider/navigation tests and the production smoke gate. Live SQL migration verification requires explicitly configured TSAAT_DOMAIN_PARITY_SERVER and an empty TSAAT_DomainParity_* database; absence skips it. See [scope and migration](security-domains.md).

The shared pure domain module is native ESM for use by offline setup/migration scripts. Its .d.mts declaration uses the TypeScript parser in the flat ESLint configuration, keeping declaration files linted.
