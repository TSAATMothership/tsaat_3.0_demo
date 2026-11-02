# SQL and No-SQL data providers

## One app, two builds

The current Next.js app compiles with SQL or JSON storage. Pages, API URLs, scope/date behavior, authentication, reports, workers and visual components are shared. Both require the normal Node app server, Windows and PowerShell for existing DPAPI authentication. No-SQL has no SQL Server/sqlcmd/configuration dependency.

scripts/run-app.mjs selects TSAAT_DATA_PROVIDER before compilation. next.config.mjs embeds NEXT_PUBLIC_TSAAT_DATA_PROVIDER and uses .next-sql or .next-nosql, allowing both artifacts to coexist. Changing a variable after compilation does not convert an artifact; rebuild and use the matching start command. The default npm build/start/dev commands select SQL. NoSQL is the user-facing name for file storage, not a separate database product.

lib/data-loader.ts and lib/cmdb-attribute-loader.ts select typed providers. SQL code remains in lib/sql-data-loader.ts and lib/sql-cmdb-attribute-loader.ts; JSON implementations live in lib/json-store. The JSON operation object must satisfy the SQL loader's exported operation types. Feature code must import the shared facades. New storage operations require implementations in both providers. The SQL execution adapter rejects calls in a No-SQL build, and SQL settings APIs return 409 there.

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

Initialization uses the eight repository data/snapshots files, substituting data/current.json for its matching latest date. References come from Database Schema/data and NoSQL/cmdb-attributes.json. These are sample datasets, not a read/export from the running SQL database. Initialization does not fabricate missing CMDB values or operational contacts. Keep runtime data outside Git and outside public/. The data directory must be writable by the service identity.

## Calculations and scope

Both providers expose the same selected-date, network/system scope, catalogue, explorer, settings and KPI operations. The JSON provider evaluates the ten current SPI rules and discovery detection rules using the same registered JSON definitions and parameters. Shared analytics apply severity and priority settings. KPI-1 uses presence of a nonblank ICT-system ATO number; KPI-2 uses the stored DIIS registration flag. Network scoping resolves systems using infrastructure in scope through shared models.

SQL calculation text is retained as reference metadata; JSON storage does not execute arbitrary SQL. NoSQL/calculation-contract.json pins the reviewed SQL schema and rule contracts. npm run storage:check fails if they change, requiring an equivalent JSON implementation and meaningful regression/parity review before refreshing hashes. Unsupported rule/calculation keys fail explicitly. Review applicable parameters, scope, empty/unknown states, historical dates, evidence, finding counts and report results in both providers.

Snapshot finding arrays are authoritative persisted history. JSON does not synthesize missing historical finding events using SQL's fallback history generator. Imports must supply finding history, including open/closed timestamps and valid asset IDs; an absent array is rejected. Date views reconstruct status from these events. A data migration must supply history rather than invent it. No SQL-to-JSON operational-data migration is performed by this change.

## Persistence and operations

Saving risk, priority or discovery settings writes JSON on the server and invalidates evaluation caches. New file revisions also participate in cache keys. Settings are shared across browser sessions and survive server restarts. Each save acquires an exclusive file lock, writes a complete temporary file, flushes it and renames it into place. A saved revision is written before replacing the current file; if replacement fails, current settings remain authoritative and a history entry may be orphaned. Concurrent whole-form saves are last-successful-save-wins, matching the settings form contract.

Deploy on one Windows host with local storage. File locks are not a distributed database or a network-filesystem transaction system. Stop all app processes before bulk snapshot/reference edits, upgrades or backup/restore. Back up the entire data directory with the compatible release. Preserve stable snapshot IDs and dates. Validate changed JSON, references and scope/report results before restarting traffic. Never copy seed files over an existing store during a routine build.

If a writer crashes, first stop every app process using that store and back it up. Inspect the PID/time in .write-lock and confirm no writer remains. Validate current settings JSON, restore a known-good revision if necessary, remove the stale lock and abandoned .tmp files within that exact store, then restart and verify saves. Never clear another active writer's lock.

A future incompatible JSON format requires an explicit versioned migration and backup/recovery plan alongside the SQL migration. Old/unknown versions fail instead of silently resetting user data. Deployment requires both implementations and reviewed upgrade instructions, not just new seed data.

## Validation and future work contract

Run npm run check, npm run build:all and npm run test:nosql. CI performs these gates. The No-SQL smoke launches the compiled app in an isolated directory with its own login, JSON store, no DB_config and an invalid sqlcmd path. It exercises normal HTTP pages, heatmaps, analysers, CMDB, reports/workbooks and settings across an app restart. Unit tests cover rule behavior, settings, dates/scope and safe initialization/writes. SQL integration remains explicit against a disposable database; default CI does not provision one.

For every change, update both providers, migrations/data fixtures, tests, relevant requirements and operational documentation together. See [SDLC](sdlc.md) and [ADR 0006](adr/0006-dual-data-provider-builds.md). The removed browser-only Demo app is not a third supported build.
