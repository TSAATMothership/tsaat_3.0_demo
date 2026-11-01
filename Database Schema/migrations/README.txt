Place ordered SQL migration scripts here (example: 001_add_index.sql). The loader applies *.sql in filename order after database-schema.sql.
023_system_ato_diis_kpis.sql retains only the former KPI-7 (now KPI-1, ATO provided) and KPI-8 (now KPI-2, DIIS registration). It replaces KPI definitions and tasking bindings without changing snapshot data. Apply it to existing databases with sqlcmd error handling (-b); the standard build-and-load workflow also applies it in order.

KPI-1 passes when ict_system.ato_number is non-blank. KPI-2 passes when ict_system.diis_defined is true. Both use the explicit, deduplicated system scope, including selected systems with no assets. The application resolves network selections through asset ownership and system environment memberships rather than the system's assigned network. KPI current and trend reports use the same scope resolution as the page.

SQL integration checks: set TSAAT_SQL_INTEGRATION=1 and run vitest run tests/kpi-sql.test.ts. These tests apply the migration and temporary system fixtures inside an outer transaction that always rolls back.

024_remove_ci_assignment_and_owner_fields.sql removes the retired CI change assignment group, incident assignment group, and owner display definitions. It preserves finding evidence and the separate ICT system and managed network owner attributes. Apply it to existing databases with sqlcmd error handling (-b).

025_cmdb_asset_type_attributes.sql adds cmdb_attribute_definition and cmdb_asset_type_attribute. It initially maps the same 18 current CMDB panel attributes to all seven asset types (126 mappings). Apply this migration to existing databases with sqlcmd error handling (-b); do not rebuild the database to apply it. It preserves asset values and snapshots. The fresh-install schema includes the same tables and defaults.

Each mapping controls inclusion (is_enabled) and display_order for one asset_type and attribute_key. Labels come from cmdb_attribute_definition. The CMDB API reads these mappings on each request; reopening a device loads the current mapping. Empty sets stay empty. Migration reruns preserve changed, disabled and deleted mappings. Existing typed attribute values remain in asset and related snapshot tables; this mapping does not delete values or change SPI/KPI calculations. See docs/cmdb-asset-type-attributes.md for keys and future mapping instructions.

CMDB SQL integration checks: set TSAAT_SQL_INTEGRATION=1 and run vitest run tests/cmdb-attributes-sql.test.ts. Migration and mapping tests run inside a transaction that rolls back.
