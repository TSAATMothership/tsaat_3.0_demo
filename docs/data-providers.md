# SQL and No-SQL data providers

## One app, two builds

The current Next.js app compiles with SQL or JSON storage. Pages, API URLs, scope/date behavior, authentication, reports, workers and visual components are shared. Both require the normal Node app server, Windows and PowerShell for existing DPAPI authentication. No-SQL has no SQL Server/sqlcmd/configuration dependency.

scripts/run-app.mjs selects TSAAT_DATA_PROVIDER before compilation. next.config.mjs embeds NEXT_PUBLIC_TSAAT_DATA_PROVIDER and uses .next-sql or .next-nosql, allowing both artifacts to coexist. Changing a variable after compilation does not convert an artifact; rebuild and use the matching start command. The default npm build/start/dev commands select SQL. NoSQL is the user-facing name for file storage, not a separate database product.

lib/data-loader.ts and lib/cmdb-attribute-loader.ts select typed providers. SQL code remains in lib/sql-data-loader.ts and lib/sql-cmdb-attribute-loader.ts; JSON implementations live in lib/json-store. The JSON operation object must satisfy the SQL loader's exported operation types. Feature code must import the shared facades. New storage operations require implementations in both providers. The SQL execution adapter rejects calls in a No-SQL build, and SQL settings APIs return 409 there.

Both builds share the root logindetails file independently of the selected storage provider. npm run setup:login creates or replaces its encrypted username/password metadata and invalidates existing sessions when replacing a usable login. It does not change SQL data, JSON snapshots/settings, credential envelope version or calculation contracts; no SQL or JSON migration is required.

## JSON store, format version 1

Set TSAAT_JSON_DATA_DIR to an absolute directory, or use NoSQL/data under the working directory. Run from the repository root. npm run setup:nosql initializes a missing store; the No-SQL dev/build/start commands also initialize it. Existing stores are retained, including edited settings. A nonempty directory without a valid manifest is rejected. Initialization builds a sibling staging directory and renames it into place only when complete.

| Path within the store | Contents |
| --- | --- |
| store.json | format tsaat-json-store, schemaVersion 1, snapshots with positive unique id, YYYY-MM-DD date and relative file path |
| snapshots/week-*.json | Dataset-shaped networks, ICT systems, assets, relationships and persisted finding history for a snapshot |
| references/*.json | SPI/KPI definitions, rules, parameters, outcomes, report/tasking metadata, severity/priority definitions and discovery rules |
| references/cmdb-attributes.json | Canonical attribute keys, labels and display order for each asset type |
| settings/measures-settings.json | Current severity and priority matrices, including updatedAt |
| settings/discovery-tools-settings.json | Current tool applicability settings, including updatedAt |
| settings/history/*.json | Saved setting revisions; current settings files are authoritative |
| .write-lock | Temporary single-host writer lock, containing PID and start time |

Initialization uses the eight repository data/snapshots files, substituting data/current.json for its matching latest date. References come from Database Schema/data and NoSQL/cmdb-attributes.json. These are sample datasets, not a read/export from the running SQL database. Initialization enriches these samples deterministically using the reviewed explorer and entity-profile demonstration rules. Known endpoints receive addresses, models, discovery details, software paths/patch labels and example.test CMDB links. Network/system profiles receive clearly marked sample contacts and catalogue links; existing nonblank values remain authoritative. Missing host OS records needed for installed software retain Unknown support metadata. IP Nodes remain unidentified and never acquire invented MAC/model/OS/software values. Keep runtime data outside Git and outside public/. The data directory must be writable by the service identity.

## Explicit SQL import and sample enrichment

The version-1 store format is unchanged. Optional sampleDataProfile and dataProvenance metadata record the enrichment revision and source export database/time/SHA-256. Builds only initialize missing stores; they never migrate existing data. The enrichment code uses repository assets and Node built-ins and needs no SQL service or network during installation/compilation.

An export JSON object has databaseName, exportedAtUtc and a tables object containing arrays keyed by SQL table name. scripts/sql-export-datasets.mjs requires all snapshot, network/system hierarchy/membership, environment, inventory, software/OS/patch, vulnerability, dependency and finding tables it maps, including empty arrays for empty tables. SQL exports must use an explicitly selected source and read-only queries; keep normal certificate validation. Credentials and runtime exports are excluded from Git. An approved one-off local certificate exception was used for the 2026-11-02 TSAAT extraction; no exception was saved in application configuration or build code.

~~~powershell
npm run populate:nosql -- --source .local/source-export.json
npm run populate:nosql -- --source .local/source-export.json --apply --demo
~~~

The first command previews counts and missing fields without writing. The second explicitly authorizes sample enrichment after SQL conversion. Without --source, it enriches the current sample snapshots. --target chooses another store; --backup-directory chooses another backup root outside that store. Use this only for demonstration data when enabling --demo; example.test links/contacts are placeholders, not verified operational records. Preserve deliberate unmodelled systems, unknown support states and non-applicable attributes.

Stop app processes using the target store before applying. The command obtains the existing writer lock, validates snapshot IDs, dates and entity references, creates a full backup, writes and flushes new snapshot files under snapshots/populated-<revision>, then atomically replaces store.json. Existing snapshot files remain available; settings, their history, reference definitions and per-type CMDB mappings are left intact. Source records replace the matching-date snapshot, local-only dates remain, and conflicting source-only snapshot IDs fail. The backup's original manifest/data are the recovery authority; the accompanying prepared report alone is not proof of publication. The active manifest identifies the committed revision. Repeated population with identical data makes no changes.

On failure before publication the old manifest remains authoritative. If recovery is needed after publication, stop the app, preserve the current store, then restore the entire selected backup and verify its manifest/snapshots/settings before restarting. Backups deliberately exclude the transient writer lock. No SQL migration is needed: the source database is read-only and its schema, rules and configurable measures remain unchanged. NoSQL/calculation-contract.json was reviewed and its hashes are unchanged.

## Explicit sample finding coverage

Run npm run enrich:nosql to preview, then npm run enrich:nosql -- --apply --demo to publish. The optional --target and --backup-directory select the store and backup location. Stop app processes first. This command reuses the validated backup, writer-lock and atomic snapshot-publication workflow above. It reads that store's configured SPI definitions, rule parameters, classifications and risk/priority settings under the writer lock. Existing snapshots are never repaired automatically at runtime or during builds. Run this command again after replacing sample snapshots from a new SQL export when complete finding coverage is required.

Every known endpoint receives missing MAC/model details and an open observation for each applicable Non-compliant or Unknown result lacking an effective open finding at that snapshot date. Closed or future findings cannot satisfy coverage. All-compliant endpoints receive no new finding; historical findings remain. The pure SPI evaluator is shared with the JSON runtime, and classification/matrix precedence matches SQL. Newly persisted sample findings have deterministic IDs, snapshot-date timestamps and explicit Sample enrichment evidence; they are not presented as original SQL observations. Repeating the command makes no changes. Missing applicability for a known endpoint fails instead of implying compliance. The 240 sample Shadow IT IP nodes remain unidentified, without fabricated MAC/model data or changed measure applicability, per the requested scope.

The version-1 format and calculation contracts are unchanged; the sampleDataProfile records tsaat-sample-measure-coverage-v1. No SQL migration is needed because no SQL data, schema, applicability or rule definitions change. Preserve the backup for recovery using the procedure above. See [ADR 0009](adr/0009-explicit-sample-finding-coverage.md).

## Calculations and scope

Both providers expose the same selected-date, network/system scope, catalogue, explorer, settings and KPI operations. The JSON provider evaluates the ten current SPI rules and discovery detection rules using the same registered JSON definitions and parameters. Shared analytics apply severity and priority settings. KPI-1 uses presence of a nonblank ICT-system ATO number; KPI-2 uses the stored DIIS registration flag. Network scoping resolves systems using infrastructure in scope through shared models.

SQL calculation text is retained as reference metadata; JSON storage does not execute arbitrary SQL. NoSQL/calculation-contract.json pins the reviewed SQL schema and rule contracts. npm run storage:check fails if they change, requiring an equivalent JSON implementation and meaningful regression/parity review before refreshing hashes. Unsupported rule/calculation keys fail explicitly. Review applicable parameters, scope, empty/unknown states, historical dates, evidence, finding counts and report results in both providers.

Snapshot finding arrays are authoritative persisted history. JSON does not synthesize missing historical finding events using SQL's fallback history generator. Imports must supply finding history, including open/closed timestamps and valid asset IDs; an absent array is rejected. Date views reconstruct status from these events. A data migration must supply history rather than invent it. Explicit SQL exports can now supply these records through the population workflow above. Exported finding workflow and timestamps remain persisted history; the importer does not synthesize findings from current evaluations. The separate, explicitly requested sample coverage command can append clearly labelled observations for the selected snapshot without rewriting source history.

## Persistence and operations

Saving risk, priority or discovery settings writes JSON on the server and invalidates evaluation caches. New file revisions also participate in cache keys. Settings are shared across browser sessions and survive server restarts. Each save acquires an exclusive file lock, writes a complete temporary file, flushes it and renames it into place. A saved revision is written before replacing the current file; if replacement fails, current settings remain authoritative and a history entry may be orphaned. Concurrent whole-form saves are last-successful-save-wins, matching the settings form contract.

Deploy on one Windows host with local storage. File locks are not a distributed database or a network-filesystem transaction system. Stop all app processes before bulk snapshot/reference edits, upgrades or backup/restore. Back up the entire data directory with the compatible release. Preserve stable snapshot IDs and dates. Validate changed JSON, references and scope/report results before restarting traffic. Never copy seed files over an existing store during a routine build.

If a writer crashes, first stop every app process using that store and back it up. Inspect the PID/time in .write-lock and confirm no writer remains. Validate current settings JSON, restore a known-good revision if necessary, remove the stale lock and abandoned .tmp files within that exact store, then restart and verify saves. Never clear another active writer's lock.

A future incompatible JSON format requires an explicit versioned migration and backup/recovery plan alongside the SQL migration. Old/unknown versions fail instead of silently resetting user data. Deployment requires both implementations and reviewed upgrade instructions, not just new seed data.

## Validation and future work contract

Run npm run check, npm run build:all and npm run test:nosql. CI performs these gates. The No-SQL smoke launches the compiled app in an isolated directory with its own login, JSON store, no DB_config and an invalid sqlcmd path. It exercises normal HTTP pages, heatmaps, analysers, CMDB, reports/workbooks and settings across an app restart. Unit tests cover rule behavior, settings, dates/scope and safe initialization/writes. SQL integration remains explicit against a disposable database; default CI does not provision one.

For every change, update both providers, migrations/data fixtures, tests, relevant requirements and operational documentation together. See [SDLC](sdlc.md) and [ADR 0006](adr/0006-dual-data-provider-builds.md). The removed browser-only Demo app is not a third supported build.

## Offline compilation requirement

Both providers compile using only repository source, assets and vendor/npm archives, after an offline npm ci. Compilation must not contact SQL Server, registry services or remote asset/code hosts. The same guard and dependency verification apply to build:sql and build:nosql. No-SQL still initializes only a missing store and preserves existing data/settings. SQL runtime still requires access to its configured SQL Server and strict TLS; the compilation guarantee does not remove runtime database or authentication requirements. No schema, calculation rule or JSON format/data migration is introduced by offline packaging. See [offline builds](offline-builds.md).

Risk-profile explorer new-tab navigation is shared by SQL and JSON builds. Selected-row, snapshot and destination-filter presets use the existing URLs and shared data facades. This interaction change introduces no SQL/JSON migration or calculation-contract change and leaves stored snapshots/settings untouched.
