# Feature retirement and data alignment

Requested 2026-11-11. This records the removal boundary, selected checks and coordinated deployment procedure.

Follow-up, 2026-11-12: Menu and the remaining Settings viewers are now retired under [ADR 0033](adr/0033-remove-menu-and-settings.md). Persona selection is in the header. Discovery rules and persona revisions remain shared runtime data; this UI removal needs no further SQL/JSON upgrade and does not alter the earlier migration or validation history below.

## Approved scope

Retire Governance Trends, Cyber Terrain Insights and Discovery Insights; all Cyber Security views (including ICT System Impact Analyser); Discovery Tool Coverage, Discovery Compliance Explorer, Patch Management Explorer and Life Cycle Management; all Observed Measures/KPI/SPI views; Findings Register; Briefs & Reports; and SPI risk/priority Settings. Remove the Cyber Security, Observed Measures and Findings sidebar sections.

Retain Installed Software Insights, End Point Insights and Security Vulnerability Insights; End Point, Installed Software, Security Vulnerability, Shadow IT and Topology Explorers; the existing Installed Software Dashboard compatibility view; their PDF/Excel exports; CMDB details; header network/system/domain/snapshot controls; and read-only Personas/Discovery Tools Settings.

## Dependency boundary

Remove feature-exclusive pages, APIs, report generators, assets, tests, maintenance commands and stored structures. Compatibility URLs must provide an explicit retirement response or safe scoped destination and must not execute retired queries.

Topology still needs network/system hierarchy, services/capabilities, environment membership, ARP ownership and directed CI communication observations. Retained Insights still need discovery-source/applicability rules, scope labels and coverage context. Endpoint, software, vulnerability, CMDB and historical snapshot evidence remain authoritative. Shared fields cannot be dropped merely because a retired page once consumed them.

The existing discovery overview loader unnecessarily loads patch observations for retained endpoint/vulnerability briefings. Extract a retained inventory context without patch analytics. Remove SPI/KPI evaluations, findings/history/policies, measure matrices, calculation/report/tasking metadata and their SQL/JSON references once retained consumers are separated. Review lifecycle, target-state, patch and reference-version fields against retained CMDB and inventory consumers before dropping them.

## Execution order

1. Inventory retained entry points and their transitive imports, SQL objects, JSON collections, fields, commands and assets. Record retained shared dependencies and review deletion candidates.
2. Separate retained inventory/coverage/topology/document helpers from retired analytics. Retire navigation, pages, APIs, permission IDs and settings together. Preserve scope/date, keyboard and direct-access behavior.
3. Align the shared types and both provider readers/writers. Reduce fresh SQL schema/loaders/reference files and the shared eight-snapshot bundle together. Remove unreachable runtime modules and feature-only package dependencies.
4. Add a new forward SQL migration; never rewrite published migrations. Provide a paired versioned JSON upgrade with preview, explicit target, full backup, validation, lock/atomic publication and recovery. Builds never modify existing operational stores; deployment uses separately selected targets. Exercise both upgrades on disposable copies, including repeat/failure safety.
5. Regenerate current application/schema inventories, update maintained feature/design/data/operations documentation and changelog, and audit references, imports, SQL dependencies, JSON keys and unused assets.
6. Validate fresh setup and existing-store upgrade on a uniquely named disposable SQL database and isolated JSON stores, comparing identical dates and network/system/domain scopes. Run retained feature/regression tests, evidence/storage checks, both offline guarded builds and compiled browser/report checks for both providers.

## Impact and selected checks

UI/navigation, shared runtime/document helpers, SQL/JSON schemas/data/persistence, calculation retirement, permission catalogue, tooling, documentation and inventories are affected. Full source/regression and real SQL/JSON parity checks are required. Keep all eight complete weekly snapshots and deliberate missing/inapplicable evidence. Do not refresh contract hashes before reviewing retained behavior and parity results.

The login-free access model and saved SQL transport policy do not change. No operational database reset is authorized or needed. Fresh empty-cache offline installation is selected if unused dependency removal changes the package graph; all builds retain archive/network guards. A skipped or unavailable SQL test is a limitation, never parity evidence.

## Upgrading an existing installation

Application changes do not delete data from an installed database or JSON store. Fresh setup creates inventory v2. Existing installations require the explicit steps below. JSON initialization refuses incompatible stores; SQL inventory loading requires v2. Builds never upgrade existing stores or connect to SQL for setup. SQL and JSON are separate targets: apply the relevant upgrade to each installed provider.

### SQL

1. Identify the exact server/database, stop application traffic and writers, and retain the compatible previous application. The database must have the applicable schema through migration 032. Review missing prerequisites individually; never replay published migrations or use base DDL, seed loaders or `setup:database` to upgrade operational data.
2. Take a native full backup with `COPY_ONLY, CHECKSUM` to a new file accessible to the SQL Server service. Run `RESTORE VERIFYONLY ... WITH CHECKSUM` and confirm the installation's restore procedure. Keep the backup outside the app directory. Record retained row counts, snapshot IDs/dates and settings revisions.
3. Save a SQLCMD input file such as `.local/upgrade-inventory.sql`, replacing the example database and checkout path with the reviewed target. Acknowledgement and migration must run in the **same connection**:

```sql
USE [YourSelectedDatabase];
GO
EXEC sys.sp_set_session_context
  @key = N'TSAAT_RETIRE_FEATURES_DATABASE',
  @value = N'YourSelectedDatabase';
GO
:r "C:\ShuffyNet\VS Code\DSMR_TSAAT\Database Schema\migrations\033_retire_analytics_features.sql"
GO
SELECT [version] FROM tsaat.storage_schema_version;
SELECT snapshot_id, snapshot_date FROM tsaat.dataset_snapshot ORDER BY snapshot_date;
```

4. Run `sqlcmd -S "YourSelectedServer" -d "YourSelectedDatabase" -E -b -i ".local/upgrade-inventory.sql"` using an authorized Windows administrator and the installation's existing transport/certificate options. SQL authentication can use its normal protected credential mechanism instead. Do not bypass certificate validation or disable TLS to work around a failure. A nonzero exit stops rollout.
5. The transaction refuses custom routines/views/triggers or foreign keys depending on retired objects, and resolves column dependencies before removing old fields from retained tables. Resolve those consumers deliberately before retrying; do not bypass the guard. Dynamic SQL and external consumers still require deployment review. Compare retained counts/dates/permissions and the removal inventory in `Database Schema/retired-storage-v2.json`. The bundled validation SQL also checks weekly evidence and discovery evaluation; use it where its evidence prerequisites apply.
6. Start the matching application and verify retained scopes/history, CMDB, settings and PDF/Excel downloads. Repeating 033 is safe. It never recreates retired data or changes the saved connection policy.

### JSON-backed No-SQL

Stop every process using the selected store. Use an absolute existing store path and a new backup directory outside it, whose parent exists and is not a junction. Replace these examples with the installation's paths:

```powershell
.\tsaat-npm.cmd run migrate:inventory -- --target "D:\TSAAT\store"
.\tsaat-npm.cmd run migrate:inventory -- --target "D:\TSAAT\store" --apply --backup-directory "D:\TSAAT-Backups\pre-inventory-v2"
.\tsaat-npm.cmd run migrate:inventory -- --target "D:\TSAAT\store"
```

The first command is a no-write preview. Apply takes a writer lock, validates the store, copies a complete backup, projects active and historical snapshots, prunes retired persona permissions/references/settings history, validates staged v2 data and publishes it by directory rename. Retained IDs, dates, evidence and persona metadata stay intact. Unknown references, malformed evidence, active writers, links and unsafe backup paths cause refusal. Existing backups are never merged or overwritten. Repeat runs validate v2 and report no further change.

Set `TSAAT_JSON_DATA_DIR` to that same store and start the matching No-SQL compilation. Check the same dates/scopes as SQL when both represent the same source. Never substitute new sample fixtures for installed data.

## Recovery

Keep existing operational stores untouched during implementation. For deployment, stop writers, back up the exact selected database/store, apply its explicit upgrade and verify retained features before opening traffic. Restore the matching pre-upgrade application and complete backup for rollback. Removed feature data must not be silently regenerated by setup, builds, imports or old maintenance commands.

Restore SQL using the installation's native database recovery process. For JSON, preserve the failed/current store for diagnosis, restore the complete backup to the original path and select the compatible old application. Do not combine files from different schema versions. If an interruption leaves `.upgrade-<UUID>` or `.recovery-<UUID>` siblings, preserve them until a validated complete store is selected; the external full backup is authoritative. Remove a stale lock only after all writers are stopped and its owner is inactive. Failures before publication leave active data unchanged; caught rename failures restore the prior directory.

## Validation results

Validation uses disposable SQL databases `TSAAT_EvidenceParity_Retirement_20261111_211347` (fresh) and the same name with `_Upgrade` (existing-schema upgrade), plus isolated JSON directories under `.local`. These are not the configured operational installation.

- Fresh SQL bootstrap and schema/evidence validation passed. The old-schema backup restored successfully through SQL Server; the final 033 upgrade and repeat run passed. Twenty-four untouched retained tables kept identical row counts/checksums; all eight snapshot IDs/dates and persona revision identities/timestamps/retained permissions survived. Every table/routine named in the retirement inventory is absent.
- SQL refusal/rollback tests passed for missing target acknowledgement, custom table consumers, non-schema-bound views using retired columns and triggers using retired tables. JSON preview/backup/preservation/repeat, malformed data, writer lock, escaping paths and unsafe backup tests passed.
- Real SQL/JSON inventory parity passed across every bundled weekly date from 2026-09-19 through 2026-11-07 and identical network/system/domain scopes, both fresh and after upgrade. Topology/CMDB integration (five tests) and persona persistence parity (four tests) passed on the selected disposable databases. Final guard tests passed separately (four tests).
- The general suite passed 530 tests; opt-in SQL tests are reported separately rather than treating skips as passes. Unchanged historical migrations 028/030 retain their opt-in tests; their current vulnerability/domain behavior is covered by the eight-date parity and browser runs. Retained report/scope regression checks passed after final wording cleanup.
- Both offline guarded builds, an isolated fresh empty-cache lifecycle-disabled npm ci, archive/provenance verification, evidence/storage, lint/type, repository and documentation checks were selected. Compiled SQL and JSON checks cover nine retained views, current/historical/empty scopes, retired routes/APIs, four workbook downloads, three PDF reports, CMDB/Topology, keyboard/mobile/error behavior, read-only Settings and restart persistence. Feature groups were rerun selectively after stale assertions were corrected; the default smoke still selects every group.
- Rendered current software, endpoint and vulnerability PDFs were visually reviewed, including charts, appendices and page continuations. Implementation validation used disposable stores. The subsequent authorized local NoSQL deployment is recorded below; other installations still require explicit target selection, backup and the procedure above.

See [validation records](validation.md) for the final commands and local evidence locations. These checks establish source/fixture readiness, not a deployed production upgrade.

## Local deployment outcome - 2026-11-11

The user approved updating the installed NoSQL data while leaving SQL available for a later rebuild. `NoSQL/data` is now storage v2, with a verified full backup under `.local/nosql-backups`; all eight weekly snapshots and retained inventory/settings were preserved. A copy passed eight-date parity with the rebuilt disposable SQL database and compiled browser/report/Settings checks. Exact local evidence is in `.local/installed-json-upgrade-result.json` and the [validation record](validation.md).

The configured SQL `TSAATDB` remains unchanged. To rebuild it with the revised schema and bundled data, run `.\tsaat-npm.cmd run setup:database` and follow the explicit target acknowledgement. This setup replaces the selected existing database; it is not a preservation upgrade. Fresh setup uses the reduced v2 schema and the manifest-selected additions and does not recreate the retired analytics structures.
