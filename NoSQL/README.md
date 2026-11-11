# No-SQL inventory storage

This folder holds reviewed CMDB mappings and the shared SQL/JSON calculation contract. The same TSAAT application compiles with the JSON provider through lib/data-loader.ts and lib/cmdb-attribute-loader.ts.

Run build:nosql and start:nosql through tsaat-npm.cmd. TSAAT_JSON_DATA_DIR selects an absolute mutable store; otherwise NoSQL/data is used. Runtime data is ignored by Git. Setup/build/start initialize a missing store only and never replace or enrich existing data.

Current stores use schemaVersion 2. Existing v1 stores need the explicit, backed-up [inventory upgrade](../docs/feature-retirement.md). The shared sample contains eight weekly snapshots, each with 1,000 identified endpoints and 240 deliberate IP Scan/ARP observations. Unknown/inapplicable fields remain deliberate.

The store retains snapshots, discovery rules/settings, persona revisions and CMDB references. Retired Findings, measures/KPI/SPI, patch analytics, matrix/tasking/report metadata and network target-state data are removed. Endpoint patch level, lifecycle inventory and network-device patch state remain when used by Explorers/CMDB.

populate:nosql previews an authorized retained-inventory import; --apply publishes a backed-up revision. --demo explicitly fills missing demonstration fields and must not be used to invent operational evidence. The old findings-enrichment command is removed. See [storage format, maintenance and recovery](../docs/data-providers.md).
