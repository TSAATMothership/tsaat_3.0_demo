# CMDB attributes by asset type

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

The CMDB API also returns canonical `networkId` alongside asset identity and snapshot metadata for the Network Impact Analyser action. This is routing context, not an additional configurable attribute: an empty mapping still returns no field rows and can still open the analyser for that asset. SQL and JSON already supply networkId through the shared Dataset contract, so no schema, mapping or JSON migration is required. The destination validates the exact asset within the retained scope/snapshot before loading, and both diagram and finding APIs retain that restriction.
