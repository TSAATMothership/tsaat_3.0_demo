# Shared sample evidence

Both setup paths use eight weekly snapshots, **2026-09-19 through 2026-11-07**. Each contains 1,000 known endpoints, 240 unidentified IP nodes, 4,277 installations and 27,441 dependencies. Network/system ownership, endpoint and discovery attributes, software paths/dates/sources, OS/lifecycle evidence, patch workflows, vulnerability metadata and findings for applicable failed/unknown checks are populated. These are demonstration observations, not an assessment of the host PC.

Unknown/inapplicable states remain meaningful: IP-only nodes have no invented MAC, model, OS or software; unfinished patch workflows have no completion dates; logical dependencies need no transport ports. Fictional vulnerabilities use `SAMPLE-CVE-*`; reviewed catalogue CVEs retain their metadata. Historical snapshots exclude later detections.

## Validate and author

~~~powershell
npm run evidence:check
npm run evidence:prepare
# Explicit authoring after review:
npm run evidence:prepare -- --as-of 2026-11-07 --apply
~~~

Preparation previews by default. `--apply` changes tracked fixtures only. Review generated evidence before committing. `seed` also runs common preparation. `storage:check` audits weekly history, applicable attributes, finding coverage and current/latest equality without refreshing calculation checksums.

Fresh setup consumes this bundle. Existing JSON initialization and builds preserve stores. `setup:database` resets an existing database after acknowledgement; use the append procedure to retain history.

## Append to existing sample stores

Use only for an explicitly selected demonstration database/store with current SQL migrations. SQL uses Windows administrator authentication and the chosen connection policy. It never runs base schema or the seed loader, deletes rows, changes settings/reference data or replaces an existing date. Preview first:

~~~powershell
powershell -NoProfile -File scripts/append-sample-evidence.ps1 -ServerInstance 'tcp:127.0.0.1,14333' -DatabaseName TSAATDB
powershell -NoProfile -File scripts/append-sample-evidence.ps1 -ServerInstance 'tcp:127.0.0.1,14333' -DatabaseName TSAATDB -Apply -SampleDatabaseAcknowledgement TSAATDB -ReportPath .local/sql-evidence-catalogue.json
node scripts/append-sample-evidence.mjs --target NoSQL/data --sql-catalogue .local/sql-evidence-catalogue.json
node scripts/append-sample-evidence.mjs --target NoSQL/data --sql-catalogue .local/sql-evidence-catalogue.json --apply --demo
~~~

Use the actual endpoint/database/store. SQL defaults to the current setup policy of encryption disabled; boolean parameters allow an explicitly required encrypted connection. A `COPY_ONLY` backup with checksum is verified before inserting all missing dates in one serializable transaction. JSON uses the SQL IDs and refuses conflicts; without a catalogue, a JSON-only store allocates IDs after its existing maximum. JSON backs up under `.local/nosql-backups`, retains original snapshot files and publishes its manifest atomically. Repeat runs append nothing. Older dates retain their original evidence quality; the new eight-week window is complete.

Backup locations are reported. SQL errors roll back the append; recovery uses the verified native backup through normal database restore procedures. JSON recovery restores the backed-up `store.json` while the app is stopped; original snapshots and settings/reference files are retained. Do not use synthetic-data tools on operational stores.

## Cross-provider validation

Create an explicitly disposable database with `bootstrap-demo-database.ps1`. Set `TSAAT_EVIDENCE_PARITY_DATABASE` to its `TSAAT_EvidenceParity_*` name, `TSAAT_SQL_TRUSTED_CONNECTION=true`, `TSX_TSCONFIG_PATH=scripts/tsconfig.database-cli.json` and `TSAAT_JSON_DATA_DIR` to a new absolute isolated directory. Run:

~~~powershell
node --import tsx scripts/check-evidence-parity.ts
npm run build:all
npm run test:nosql
node scripts/test-sql-evidence.mjs
~~~

Parity compares all supplied weeks, full entities, findings/calculations and scoped endpoint/software/vulnerability/patch/Shadow IT views, including unknown/empty domains. The compiled SQL browser check uses the saved server/transport policy with Windows authentication against the selected disposable database. It exercises pages, historical/domain scopes, keyboard/narrow interactions, trends and PDFs. Keep settings, schema and fixtures identical for meaningful parity. See [SDLC](sdlc.md) for required checks and paired upgrades.
