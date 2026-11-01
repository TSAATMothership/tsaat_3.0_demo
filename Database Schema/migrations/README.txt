Place ordered SQL migration scripts here (example: 001_add_index.sql). The loader applies *.sql in filename order after database-schema.sql.
023_system_ato_diis_kpis.sql retains only the former KPI-7 (now KPI-1, ATO provided) and KPI-8 (now KPI-2, DIIS registration). It replaces KPI definitions and tasking bindings without changing snapshot data. Apply it to existing databases with sqlcmd error handling (-b); the standard build-and-load workflow also applies it in order.

KPI-1 passes when ict_system.ato_number is non-blank. KPI-2 passes when ict_system.diis_defined is true. Both use the explicit, deduplicated system scope, including selected systems with no assets. The application resolves network selections through asset ownership and system environment memberships rather than the system's assigned network. KPI current and trend reports use the same scope resolution as the page.

SQL integration checks: set TSAAT_SQL_INTEGRATION=1 and run vitest run tests/kpi-sql.test.ts. These tests apply the migration and temporary system fixtures inside an outer transaction that always rolls back.

024_remove_ci_assignment_and_owner_fields.sql removes the retired CI change assignment group, incident assignment group, and owner display definitions. It preserves finding evidence and the separate ICT system and managed network owner attributes. Apply it to existing databases with sqlcmd error handling (-b).
