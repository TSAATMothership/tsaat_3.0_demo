# Development and validation

## Environment

Use Windows, Node 24.13.1, npm and the committed package-lock.json. `npm ci` uses the checked-in legacy-peer-deps setting. The checkout does not require a sibling TSAAT folder or vendored runtime. node_modules and .next are local outputs.

`npm run setup:database` and `npm run setup:login` provision local DPAPI files. Choose an existing development database for ordinary work. `npm run db:bootstrap` requires a new database name and refuses an existing one. sqlcmd must be on PATH or selected by SQLCMD_PATH.

## Commands

| Command | Purpose |
| --- | --- |
| npm ci | Locked installation |
| npm run dev | Standard Next development server |
| npm run docs:generate | Regenerate inventories/checksums after documentation review |
| npm run docs:check | Verify links, inventories, source freshness and PR documentation impact |
| npm run repo:check | Reject tracked secrets, generated folders, oversized files and unreachable runtime modules |
| npm run lint | ESLint/Next checks |
| npm run typecheck | Strict checking of app, scripts and tests, including unused locals/parameters |
| npm test | Full default suite; SQL integration remains opt-in |
| npm run check | All source/documentation gates |
| npm run build | Production compilation and route generation |
| npm start | Serve compiled app; production login requires HTTPS |
| npm run seed / seed:validate | Regenerate/validate sample JSON; generation intentionally changes fixture data |

## Validation strategy

Use `npm test -- tests/name.test.ts` for focused checks. The full suite limits workers to four and permits 30 seconds per test/hook because native PowerShell/DPAPI processes are slower under load. Authentication tests use isolated temporary credentials. Retired-page tests assert redirects; risk-profile tests cover replacement behavior. Fix fixture types instead of suppressing compiler errors.

Set TSAAT_SQL_INTEGRATION=1 only against an explicitly selected disposable compatible database. Review each SQL suite: temporary migration/mapping fixtures roll back, while the entity-panel coverage test expects populated demo snapshots. Record database/schema and results separately. Default CI does not provision or mutate SQL Server.

KPI integration targets the current cleanup migration 027. Run it after provisioning/upgrading the disposable database; never reapply 023 to a cleaned installation. CMDB integration validates mappings for all supported asset types and exercises API values for every type actually present in the snapshot. Demo data need not contain every supported type.

For UI work, check representative snapshot data, desktop/narrow layouts, keyboard use, loading/error/retry/empty states and retained scope. For reports, inspect PDF pages, endpoint columns, filenames, totals and date scope. Unit tests do not replace these checks.

## Troubleshooting

Create missing DPAPI files under the runtime identity. Configure sqlcmd if absent. Hard-refresh stale Next hot-update references after a restart; stop the dev server before removing .next. Fix build errors rather than bypassing them. Deployment troubleshooting is in [operations](operations.md).

## Demo development

Run `npm run demo:build` to package JSON fixtures, shared UI, reports and assets into Demo/index.html. Open that file directly or run `npm run demo:test` with installed Chrome/Edge (override with DEMO_BROWSER_PATH). `npm run check` includes deterministic demo freshness verification. Commit the HTML and manifest with source changes; see [demo development](demo.md) for data and calculation review.
