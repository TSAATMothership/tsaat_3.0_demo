# SQL and No-SQL data providers

Both compilations use lib/data-loader.ts and lib/cmdb-attribute-loader.ts. Feature code never chooses a provider. SQL uses encrypted DB_config; JSON uses the absolute TSAAT_JSON_DATA_DIR or NoSQL/data. Access remains login-free and SQL transport policy remains unchanged.

## Inventory storage v2

Fresh SQL and JSON stores consume the same eight weekly snapshots (2026-09-19 through 2026-11-07), discovery settings/rules, persona defaults and CMDB attributes. Snapshot IDs/dates, inventory observation dates, unknown/inapplicable states and scope relationships are preserved. Existing JSON stores are never overwritten by setup or builds; v1 stores require the explicit [paired upgrade](feature-retirement.md).

Retained data includes managed networks/system hierarchy, environments, mission services/business services, endpoint identities, lifecycle status, OS family/vendor/version/support/patch level, installed software, vulnerability observations, ARP ownership and directed CI communication. Model metadata remains available to scoped CMDB details. Network-device patch state remains a CMDB/discovery input.

Retired data includes findings/history, SPI/KPI definitions/evaluations/calculation/task/report metadata, severity/priority matrices, reference-version matrices, network target-state inventories, server patch observations and OS major-version/N-minus calculation inputs. The exact SQL object/column inventory is Database Schema/retired-storage-v2.json. JSON projection is lib/inventory-schema.mjs.

## Shared read paths

Inventory context resolves one snapshot, then loads endpoint, vulnerability and Shadow IT rows from that exact date with shared discovery coverage. Installed Software Insights reuses software Explorer rows. Topology uses a scoped detail projection through the shared facade for recorded model relationships, software and CVE lookup evidence, without discovery evaluation or CI communication reads. CMDB reads only the requested endpoint (or model associations); software report labels use snapshot metadata. Complete-dataset reads remain available to existing consumers. JSON still parses a complete snapshot file on a cold read, with bounded raw/evaluated caches. Dependencies expands member CIs, then model ancestors, within header scope and independently applied domains. System environment membership and endpoint system context supply deduplicated environment evidence. Both providers retain CI-to-CI dependency records for future use; Topology does not consume them. No storage upgrade is needed for this projection change. ARP observation context remains confined to Business Impact.

Personas retain payload version 3 and source-defined IDs/names/order. The parser strips only known retired permissions and preserves intentional empty selections. SQL stores every revision; JSON preserves settings/history files. Discovery settings retain their versioned rules and write-conflict/cache behavior for explicit maintenance. Menu/Settings retirement leaves these shared data contracts intact. Persona GET remains required by header/sidebar consumers and its PUT stays read-only (405); the removed discovery-settings viewer API returns 410 before provider access. No storage migration or evidence rewrite is required.

CMDB uses the common field catalogue for endpoint, Business Service and Mission Service details. Migration 032 and migrate:cmdb-model-cis remain the historical additive metadata upgrade. See [CMDB contracts](cmdb-asset-type-attributes.md).

## Validation and operations

Data changes require storage:check, relevant regression/provider tests, both offline guarded builds, compiled No-SQL smoke and real SQL parity on an explicitly disposable database. Compare the same selected dates and scopes. A skipped SQL test is not parity evidence. The reviewed NoSQL/calculation-contract.json fingerprints the retained schema, discovery rules and shared provider/upgrade contract.

Run npm run setup:nosql only for a new empty store. populate:nosql and populate:vulnerabilities remain explicit sample-only operations with previews, backups and apply/demo acknowledgements; they cannot reintroduce retired fields. SQL exports need retained inventory tables. Migrate old stores to v2 before current population tools. See [sample evidence](sample-evidence.md), [database lifecycle](database.md), [offline builds](offline-builds.md) and [SDLC](sdlc.md).
