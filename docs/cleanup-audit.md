# Runtime and database cleanup - 2026-11-02

Baseline: UI 3 commit `673452d`. The original TSAAT repository is outside this cleanup.

## Removed code

The import graph and compiler cleanup identified 42 modules unreachable from every app route, middleware and maintenance script. Removed groups include the old detailed topology screen; retired network/system posture tables, panels and tabs; obsolete discovery-by-network views; former KPI cards, history/trend widgets, footer and associated helpers. The current risk profiles, Service Impact, diagram worker, compliance popup, CMDB, discovery, findings and PDF/workbook routes remain reachable.

Seven test files exercised only retired modules and were removed with those modules. Mixed suites retain current-route, report, analyser, scope and CMDB assertions. Current risk-profile, heatmap, service-impact and compliance tests remain. Private unused helpers/state/imports were removed from retained files. The unused dct-mark.svg asset and direct zod dependency were removed; the current shield logo and background remain.

`repo:check` now traces local module references, including dynamic imports and worker URLs. App/API files and maintenance scripts are roots; tests are not. TypeScript rejects unused locals and parameters. These checks are deliberately conservative and do not infer that an existing API is unused because it lacks a sidebar link.

## Database decisions

| Object | Decision and evidence |
| --- | --- |
| kpi_calculation_parameter | Remove: its three records parameterised retired calculations; neither active KPI reads parameters. |
| fn_kpi_stable_hash | Remove: former synthetic ATO/DIIS evaluation was replaced by stored attributes in 023. |
| Eight retired kpi_calculation_definition records | Remove: neither remaining KPI references them. Stop migration if a custom/bound retired calculation exists. |
| Three legacy kpi_report_detail_definition records | Remove: both active bindings use generic-kpi-summary. |
| managed_network.apm_number | Remove: only loaded/seeded/validated; no current panel, report or topology consumer. |
| ict_system.apm_number | Keep: APP-ID explorer/panel, Service Impact and report consumers. |
| managed_network_hierarchy / ict_system_hierarchy | Keep: loader and topology support parent/child structures even when the current data has no rows. |
| Entity grc_url / diis_url | Keep: still used by report/topology models. |
| network_target_state_asset and declared memberships | Keep: discovery comparison, scope and target-state export APIs. |
| Snapshots, findings/evidence, settings, audit/version fields | Keep: history, configured behavior, cache invalidation and integrity. |

Migration 027 is transactional and rerunnable. It preserves active definitions/tasking and snapshot data; it does not seed contacts or rebuild the database. Public KPI procedure parameters and outputs remain compatible. Asset and finding scopes still contribute to highPriorityCount. A null system scope retains the existing global meaning, while an explicit empty array evaluates zero systems. The app continues to resolve network selections to deduplicated ICT-system IDs before calling SQL.

The current base schema has 66 tables, down from 67. Seed JSON, loaders, schema validation, runtime types and ERD are aligned. Fresh-install validation now checks the four current evidence purposes and two current KPI bindings, replacing stale checks for retired fields/KPIs.

## Validation and recovery

Validation evidence is recorded in [validation](validation.md). Local raw logs, SQL captures and backup locations are excluded from Git under .local/cleanup-audit. Do not mistake the repository demo JSON for a backup of live data.

Restore the verified pre-upgrade backup with the previous application if rollback is required. Do not replay migrations 001-026 on a cleaned database; they can reintroduce obsolete structures or replace configured KPI tasking. See [database lifecycle](database.md).

The approved local app database is TSAAT_UI3, restored from existing TSAAT data and upgraded through 027. DB_config is encrypted and excluded from Git. Strict certificate validation remains enabled at the user?s request; the user will supply a trusted SQL Server certificate. The original TSAAT database and repository remain unchanged. Temporary validation databases were removed after verification.
