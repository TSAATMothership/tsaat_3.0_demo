# Database lifecycle and data contracts

## Authoritative artifacts

- `Database Schema/database-schema.sql`: fresh-install objects, constraints and routines. It drops/recreates existing schema objects and is destructive on an existing TSAAT database.
- `Database Schema/migrations/`: ordered upgrades through 031; retain history for existing installations.
- `Database Schema/data/`: reference/configuration JSON and build manifest.
- `Database Schema/loaders/`: import and validation. The low-level loader creates schema and imports demo data, requiring a new database by default; it is not a production migration runner. Explicitly disabling its new-database guard is destructive and is never appropriate for an operational database.
- [ERD](../Database%20Schema/ERD.md), schema description and data mapping: domain relationships and source mappings.
- [Generated catalogue](generated/database-catalogue.md): base-schema fields, foreign keys, routines and migration inventory. It documents source, not the actual deployed schema.

## Data model

Migration 029 adds server_patch_observation with one nullable evidence record per snapshot/server, a composite asset FK, nonnegative update counts and bounded deployment statuses. It is separate from existing network-device asset_patch_state. The shared SQL payload, JSON import and loader support all fields; old JSON records remain compatible. Upgrade before running the new full SQL loader. A separately opted-in sample population script and guarded NEW database bootstrap supply labelled examples without replacing observations. See [patch data contract and rollback](patch-management-explorer.md).

Snapshot-aware keys relate dataset_snapshot, managed_network, ict_system, asset and environment/membership tables. Include snapshot keys in joins. Assets have OS, network OS, patch, software, vulnerability and discovery evidence. Findings retain workflow, timestamps, scope, priority, severity and evidence. Service/mission links drive impact analysis.

KPI/SPI definitions, calculations, SPI parameters, outcome text, report bindings and tasking templates are SQL configuration. KPI-1 checks presence of an ICT-system ATO; KPI-2 uses DIIS registration. Network header scope resolves systems using selected infrastructure and deduplicates them. SPI applicability and risk/priority matrices remain configurable and version-aware.

Seven asset types are supported. CMDB presentation uses cmdb_attribute_definition and cmdb_asset_type_attribute; canonical values remain typed. Migration 025 initially maps 18 fields to each type and preserves later custom mappings on rerun. See [CMDB attributes](cmdb-asset-type-attributes.md).

## One-command database setup

After `npm ci --offline`, run `npm run setup:database` under the Windows identity that will run the app. Supply a TCP-enabled SQL Server endpoint (`tcp:server,port` avoids reliance on SQL Browser), an application database name, and Windows or SQL authentication. SQL Server and sqlcmd must already be installed. The account needs permission to create the new database and its objects. Setup does not install SQL Server, create server logins, enable network protocols or restart services.

New connections default to SSL/TLS encryption with Trust Server Certificate. This encrypts traffic but skips certificate validation. Choose `strict` to validate the server certificate; existing saved choices are preserved. Runtime, setup and data import use the same TLS policy, with no retry that disables encryption or certificate validation. Encrypted connections require TCP; shared memory is not a TLS endpoint. The SSL diagnostic reads the current session's `sys.dm_exec_connections` encryption state (requiring VIEW SERVER STATE, or VIEW SERVER PERFORMANCE STATE on SQL Server 2022+).

For a missing database, setup confirms the target, creates it with a race-safe CREATE, applies the base schema and ordered migrations, streams local reference JSON and eight sample snapshots through the connection, and populates the existing sample entity/CVE/patch details. No SQL Server file shares are needed. The data is bundled demonstration material. It then runs the application's connection, TLS and current-schema checks. Only after success does it save DPAPI-encrypted DB_config. Run `npm run dev:sql`, or `npm run build:sql` followed by `npm run start:sql` for a compiled app.

For an existing database, setup performs read-only connection/TLS/schema/snapshot validation and saves the selected configuration only on success. It never reapplies the base schema, replays migrations or replaces data. An incomplete or old database produces a failure with migration guidance; apply reviewed missing migrations separately. A failed new build may leave an incomplete database for inspection; setup never automatically drops it or silently rebuilds it on retry. Choose a new name or have the database owner review recovery. A failed setup leaves the previous DB_config unchanged.

Unattended setup requires `TSAAT_DB_CONFIG_ASSUME_YES=true`, `TSAAT_SQL_SERVER`, `TSAAT_APP_DATABASE`, and either `TSAAT_SQL_TRUSTED_CONNECTION=true` or both `TSAAT_SQL_USER`/`TSAAT_SQL_PASSWORD`. These supply new configuration; an existing readable DB_config takes precedence. Set `TSAAT_SQL_TRUST_SERVER_CERTIFICATE=false` for strict validation. Explicit legacy `TSAAT_SQL_ENCRYPT=false` remains supported when certificate trust is not enabled. Use process environment variables for secrets, never command-line password arguments. `-- -DbConfigPath <path>` supports an isolated setup configuration; the app itself reads DB_config in its working directory.

The lower-level `npm run db:bootstrap -- -DatabaseName TSAAT_UI3_Dev` remains available with encrypted certificate-trust defaults and refuses an existing database. For strict validation, invoke the PowerShell script with `-TrustServerCertificate:$false`. It does not save DB_config; use `setup:database` for the complete workflow. Direct `ensure-db-config.ps1` without `-SetupDatabase` remains configuration-only for compatibility.

Repository JSON is demo/test material, not an export of the running database. Database cleanup is validated using isolated restored/fresh databases; the original database is not implicitly rebuilt or migrated.

Fresh guarded bootstrap also applies the reviewed CVE inventory population after sample import. This is limited to the new disposable database and is separate from additive migration 028; existing/operational databases are never populated by an application build.

## Cleanup migration 027

The schema after migration 027 had 66 tables; migration 029 adds server_patch_observation. Migration 027 removes the unused KPI parameter table and synthetic hash function, eight retired calculation rows, three unused report-detail definitions and managed_network.apm_number. System APP-ID, active KPI definitions/tasking, hierarchy, snapshots, findings, settings and report reference URLs remain. See [cleanup audit](cleanup-audit.md) and [ADR 0004](adr/0004-retired-runtime-cleanup.md).

Apply only 027 to a database already through 026, using an explicit target, verified backup and sqlcmd -b. It refuses custom/retired KPI bindings that need review and is transactional/rerunnable. Never replay 001-026 on an upgraded database. The fresh bootstrap runs the entire historical chain followed by 027; it then imports only current reference data. Older app loaders require the removed network column, so use a separate restored database if the older app must continue running. Recovery restores the backup and matching old app together.

## Existing database upgrade

For Personas, apply additive migration 031 before deploying the new SQL application. It creates persona_settings_version without changing inventory, existing settings or calculations; Database Settings schema diagnostics check the new table and columns. Empty tables supply all-enabled defaults, and saves append complete shared configurations. See [Personas upgrade and recovery](personas.md).

For Security Vulnerability Explorer, apply additive migration 028 before deploying the new SQL application. It adds nullable `cve_name`, `cve_created_date`, `software_name`, `software_version` and `reference_url` to `asset_vulnerability`, retaining its key and all original observations. No rule/configuration or sample data is changed. The separate sample-only population script is explicitly opt-in and never part of a production migration. See [CVE mapping and SQL/JSON rollout](security-vulnerability-explorer.md).

Back up and verify restore. Compare deployed schema/configuration, select missing approved migrations in numeric order and run sqlcmd with `-b` against the explicit target. Retain execution evidence outside Git. Validate schema, references, settings, snapshots, KPI/SPI results and reports before release. Use the approved restore/recovery plan; no automatic down migrations or migration ledger are claimed.

Do not apply 026 to operational imports: its Sample metadata and example.test addresses are demonstration values, not verified contacts. Future migrations must state schema/config/demo scope, preconditions, row impact, idempotence and recovery. Review both fresh-install and upgrade paths.

Regenerate docs after SQL/reference changes and inspect ERD/mappings. Run validation SQL and integration suites on a disposable target. Keep deployed migration evidence and live schema comparisons with the release record.

## No-SQL build relationship

The same app also compiles with a JSON data provider. SQL implementation remains behind lib/data-loader.ts in lib/sql-data-loader.ts; CMDB SQL access similarly remains behind the shared attribute-loader facade. The setup/TLS changes add no schema or JSON format change, so no new SQL migration, JSON upgrade or calculation-contract checksum refresh is needed. Existing JSON stores are untouched.

No-SQL loads snapshots, references and settings from its own server directory. Initial seed JSON is sample material, not an export of this database. Existing SQL data is not accessed or mutated during builds. Explicit authorized read-only SQL exports can populate No-SQL snapshots through the backed-up import workflow; the source database is not modified. Imported values, dates, relationships and persisted findings are preserved, with only missing demonstration attributes enriched when --demo is selected. Runtime extracts stay outside Git. See [data-provider population and recovery](data-providers.md). SQL rule/schema changes require equivalent JSON calculations and regression review before updating NoSQL/calculation-contract.json. Per-type defaults are in NoSQL/cmdb-attributes.json; runtime overrides live in the store references directory.

Future schema changes require reviewed SQL migrations plus a JSON schema/data upgrade plan. Do not update only fresh-install seeds. See [data provider contracts](data-providers.md) for persistence, supported calculations and historical finding import requirements.

Known-endpoint sample coverage repair is a separate explicit No-SQL maintenance operation. It preserves SQL-exported history and appends labelled sample observations using existing configured evaluations. No SQL schema/data migration or certificate exception is involved; SQL findings generation and rule definitions remain unchanged. Recovery restores the selected complete JSON-store backup.


Migration 030_security_domains.sql adds managed-network security_domain, normalizes all three entity tables and enforces canonical domain values/defaults. Apply it after 029 using the selected database and trusted TLS; fresh schema/loader and SQL export mappings align. See [upgrade instructions and opt-in disposable parity](security-domains.md).
