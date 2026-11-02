# Database lifecycle and data contracts

## Authoritative artifacts

- `Database Schema/database-schema.sql`: fresh-install objects, constraints and routines. It drops/recreates existing schema objects and is destructive on an existing TSAAT database.
- `Database Schema/migrations/`: ordered upgrades through 027; retain history for existing installations.
- `Database Schema/data/`: reference/configuration JSON and build manifest.
- `Database Schema/loaders/`: import and validation. The low-level loader rebuilds schema and imports demo data; it is not a production migration runner.
- [ERD](../Database%20Schema/ERD.md), schema description and data mapping: domain relationships and source mappings.
- [Generated catalogue](generated/database-catalogue.md): base-schema fields, foreign keys, routines and migration inventory. It documents source, not the actual deployed schema.

## Data model

Snapshot-aware keys relate dataset_snapshot, managed_network, ict_system, asset and environment/membership tables. Include snapshot keys in joins. Assets have OS, network OS, patch, software, vulnerability and discovery evidence. Findings retain workflow, timestamps, scope, priority, severity and evidence. Service/mission links drive impact analysis.

KPI/SPI definitions, calculations, SPI parameters, outcome text, report bindings and tasking templates are SQL configuration. KPI-1 checks presence of an ICT-system ATO; KPI-2 uses DIIS registration. Network header scope resolves systems using selected infrastructure and deduplicates them. SPI applicability and risk/priority matrices remain configurable and version-aware.

Seven asset types are supported. CMDB presentation uses cmdb_attribute_definition and cmdb_asset_type_attribute; canonical values remain typed. Migration 025 initially maps 18 fields to each type and preserves later custom mappings on rerun. See [CMDB attributes](cmdb-asset-type-attributes.md).

## New development database

Run `npm run db:bootstrap -- -DatabaseName TSAAT_UI3_Dev`, adding TrustServerCertificate only for appropriate local TLS configuration. This Windows-authenticated entrypoint requires an explicit name and refuses an existing database. It applies schema, ordered migrations, reference data and eight demo snapshots, then reapplies demo-only 026 after import to populate panel metadata. Configure DB_config separately.

Repository JSON is demo/test material, not an export of the running database. Database cleanup is validated using isolated restored/fresh databases; the original database is not implicitly rebuilt or migrated.

## Cleanup migration 027

The current schema has 66 tables. Migration 027 removes the unused KPI parameter table and synthetic hash function, eight retired calculation rows, three unused report-detail definitions and managed_network.apm_number. System APP-ID, active KPI definitions/tasking, hierarchy, snapshots, findings, settings and report reference URLs remain. See [cleanup audit](cleanup-audit.md) and [ADR 0004](adr/0004-retired-runtime-cleanup.md).

Apply only 027 to a database already through 026, using an explicit target, verified backup and sqlcmd -b. It refuses custom/retired KPI bindings that need review and is transactional/rerunnable. Never replay 001-026 on an upgraded database. The fresh bootstrap runs the entire historical chain followed by 027; it then imports only current reference data. Older app loaders require the removed network column, so use a separate restored database if the older app must continue running. Recovery restores the backup and matching old app together.

## Existing database upgrade

Back up and verify restore. Compare deployed schema/configuration, select missing approved migrations in numeric order and run sqlcmd with `-b` against the explicit target. Retain execution evidence outside Git. Validate schema, references, settings, snapshots, KPI/SPI results and reports before release. Use the approved restore/recovery plan; no automatic down migrations or migration ledger are claimed.

Do not apply 026 to operational imports: its Sample metadata and example.test addresses are demonstration values, not verified contacts. Future migrations must state schema/config/demo scope, preconditions, row impact, idempotence and recovery. Review both fresh-install and upgrade paths.

Regenerate docs after SQL/reference changes and inspect ERD/mappings. Run validation SQL and integration suites on a disposable target. Keep deployed migration evidence and live schema comparisons with the release record.
