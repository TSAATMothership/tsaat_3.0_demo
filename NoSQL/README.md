# No-SQL build support

This folder holds the reviewed CMDB mapping and SQL calculation contract for the JSON-backed build of the main TSAAT app. It does not contain a second UI or standalone demo.

Run npm run build:nosql then npm run start:nosql from the repository root. Provision the normal login with npm run setup:login. The app uses NoSQL/data for mutable snapshots, reference definitions and saved settings, unless TSAAT_JSON_DATA_DIR selects another directory. Setup/build/start initialize missing stores from sample JSON and preserve existing data.

Fresh stores have 1,000 identified endpoints plus 240 IP Scan/ARP observations per snapshot, populated endpoint/software fields and network/system profiles. Existing stores are never enriched automatically during build/start.

Use npm run populate:nosql for a read-only preview. To populate from an authorized SQL export and enrich missing demonstration fields, use npm run populate:nosql -- --source <export.json> --apply --demo. The command backs up the complete store under .local/nosql-backups, retains existing settings/reference mappings, stages new snapshot files and publishes them through one manifest rename. Imported snapshot dates and existing catalogue IDs are preserved; source-only dates are added when their IDs do not conflict.

Runtime data is ignored by Git. Never delete it to update the app or overwrite it with seeds. Back it up and use reviewed format/data migrations. See [storage format, maintenance and recovery](../docs/data-providers.md).

For complete known-endpoint finding coverage, run `npm run enrich:nosql` to preview and `npm run enrich:nosql -- --apply --demo` to publish a backed-up revision. Known endpoints must have MAC/model values and an open finding for each non-compliant or unknown applicable measure. Fully compliant endpoints receive no new findings. Shadow IT IP nodes remain unidentified and keep their configured applicability. Existing source history and settings stay intact.
