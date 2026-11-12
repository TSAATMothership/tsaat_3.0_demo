# CMDB attributes by asset type

## Model CI support

Mission Service is the displayed name of the existing mission model CI (formerly Mission Capability and briefly Mission System). The `mission-capability` API/mapping identifier, `missionCapabilities` JSON field and SQL table/column names remain compatible; this terminology update requires no storage migration.

Business Service and Mission Service are recorded model CI types. SQL stores their stable IDs, names and criticality in `system_business_service` and `system_mission_capability`; JSON snapshots carry the same records in each ICT system's `businessServices` and `missionCapabilities`. A shared projector resolves one CI per type/ID in the selected snapshot and scope. Their endpoint-independent CMDB types are `business-service` and `mission-capability`; endpoint measure applicability is unchanged. Repeated associations may record different criticalities. The panel shows those values and their related systems instead of choosing an undocumented global criticality. Related system security domains are explicitly labelled; the model CI is not assigned a fabricated domain or IP.

The existing `/api/assets/cmdb-details` route accepts optional `ciType=business-service|mission-capability` with `assetId` carrying the source CI ID. Omitted `ciType` retains the endpoint contract. Model requests also carry header network/system/security-domain scope and `dataDate`; each associated system and displayed network respects its own domain. Missing/out-of-scope CIs return 404, unsupported types 400, and missing mapping configuration 503. Response identity remains compatible with the existing panel and adds model `topologyId`/`systemIds` for navigation. Model fields are `ciId`, `ciName`, `ciType`, `criticality`, `relatedSystems`, `relatedNetworks` and `relatedSecurityDomains`. Model mappings reject endpoint-only fields.

Topology Explorer (both modes and full screen) offers the existing persona-controlled CMDB action for these CIs. Nested native dialogs retain Escape, focus return, loading/error/Retry, and the selected graph view. Explore Topology uses `business:`/`mission:` identity with the loaded snapshot. Both modes retain the workspace scope, Security Domains and selected snapshot.

### Existing-store upgrade and recovery

- SQL: back up the explicitly selected database, then apply `Database Schema/migrations/032_model_ci_cmdb_attributes.sql` using `sqlcmd -b` and its saved connection/certificate policy. It extends only CMDB metadata constraints/catalogue and adds seven default fields for each model type. An installation marker preserves later custom labels, order, disabled/deleted mappings and empty sets on rerun. It changes no endpoint or association records. Fresh SQL setup includes the same mappings.
- JSON: run `npm run migrate:cmdb-model-cis -- --target <absolute-store-directory>` to preview, then add `--apply`. The upgrade acquires the existing writer lock, backs up the original reference file outside the store, and atomically publishes only missing model type mappings in `references/cmdb-attributes.json`. Existing keys, custom rows and explicit empty arrays are preserved. It reports the backup path; snapshots, manifest and settings are untouched. Fresh stores include these mappings; builds preserve existing stores and never run the upgrade.
- Failed JSON publication leaves the old reference file intact. For rollback, stop app writers and restore the reported backup to that reference file, then restart. A crash can leave `.write-lock` and a uniquely named temporary file; verify the recorded process is stopped before removing those exact files. SQL changes are transactional; after a successful upgrade, keep the additive metadata for an application rollback, or restore the database backup if complete reversal is required. Avoid rerunning base schema/seed loaders on existing databases.

## Endpoint fields

The CMDB drill-through panel now uses SQL configuration for its fields. All seven asset types initially have the same 18 fields, labels and order as the previous panel. Asset values stay in the existing snapshot-aware `asset`, operating system, network OS, patch, software and vulnerability tables; they are not copied into an untyped attribute-value store.

- `tsaat.cmdb_attribute_definition`: approved attribute key and display label.
- `tsaat.cmdb_asset_type_attribute`: asset type, attribute key, display order and enabled flag. Its composite primary key prevents duplicates, its foreign key requires a defined attribute, and checks restrict asset types and display order.

The canonical types are `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other` and `ip-node`. Mappings are global configuration; displayed values still use the selected snapshot. The API reads the mapping for the selected device's actual type on every request. The panel reloads on reopening, so mapping changes do not require an app restart. No fallback adds fields to a deliberately empty set.

| Attribute key | Current label | Order |
| --- | --- | --- |
| assetId | Asset ID | 10 |
| assetName | Name | 20 |
| assetHostname | Hostname | 30 |
| assetType | Asset Type | 40 |
| assetIpAddress | IP Address | 50 |
| networkName | Network | 60 |
| systemName | ICT System | 70 |
| environmentType | Environment | 80 |
| securityDomain | Security Domain | 90 |
| lifecycleEolStatus | Lifecycle EOL | 100 |
| lifecycleWarrantyStatus | Warranty | 110 |
| operatingSystemSummary | Operating System | 120 |
| networkOsSummary | Network OS | 130 |
| patchStateSummary | Patch Status | 140 |
| installedSoftwareCount | Installed Software | 150 |
| vulnerabilityCount | Vulnerabilities | 160 |
| criticalVulnerabilityCount | Critical Vulnerabilities | 170 |
| cmdbRecordUrl | CMDB Record | 180 |

These are the current CMDB detail fields, including summaries derived from related tables. Existing inventory fields used elsewhere in the app (such as device model and discovery metadata) remain stored as before. A future mapping can enable/disable or reorder these fields per type; introducing a new field also needs an approved value resolver and catalogue entry. Attribute mappings do not change measure applicability or delete underlying historical values.

Apply `Database Schema/migrations/025_cmdb_asset_type_attributes.sql` to an existing database with `sqlcmd -b`. It installs defaults only when the mapping table is first created. Rerunning it preserves custom labels, order, disabled fields and deleted mappings, including an empty set. Fresh builds receive the same defaults from `database-schema.sql`.

For a future mapping, update only the required asset types inside a transaction. For example, this **illustrative change has not been applied**:

```sql
BEGIN TRANSACTION;
UPDATE [tsaat].[cmdb_asset_type_attribute]
SET [is_enabled] = 0
WHERE [asset_type] = N'printer-device' AND [attribute_key] = N'operatingSystemSummary';
COMMIT TRANSACTION;
```

Run the focused app tests with `vitest run tests/cmdb-drill-through.test.ts tests/cmdb-attributes.test.ts tests/cmdb-details-route.test.ts`. For database regression checks, set `TSAAT_SQL_INTEGRATION=1` and run `tests/cmdb-attributes-sql.test.ts`; its temporary changes roll back.

Both builds use lib/cmdb-attribute-loader.ts. SQL mappings are read by lib/sql-cmdb-attribute-loader.ts; No-SQL reads per-type mappings from references/cmdb-attributes.json in the configured JSON store. NoSQL/cmdb-attributes.json supplies initial defaults. Updates must align labels, canonical keys, order and enabled fields in both stores without overwriting existing data. The shared drill-through retains the selected snapshot and header scope.

The CMDB API continues to return canonical networkId alongside asset identity and snapshot metadata for response compatibility. This metadata is independent of configurable attribute rows and already exists in both providers. The former Network Impact Analyser launch action is retired; this removal requires no schema, mapping or JSON migration.
