# Measures

**Page Path:** `/measures`

## 1. Page Overview
- **Page name:** Measures
- **Purpose:** provide the database-backed KPI catalogue, SPI measure catalogue, summary charts, tasking/trend report launch points, and configurable severity mapping.
- **User outcome:** the user can understand how performance is measured, inspect KPI and SPI scores for the current scope, generate tasking and trend reports, and manage the severity model applied to findings.
- **Primary user roles:** cyber governance users, assurance teams, reporting users, cyber analysts, product administrators.

## 2. Page Summary
This page provides `summary`, `measures-kpi`, `measures-spi`, and `spi-settings` tabs.

Major dependencies:

- `getCoreAppData()`
- `loadKpiDefinitions()`
- `buildKpiRows()`
- `KpiComplianceChart`
- `SecurityPerformanceIndicatorComplianceChart`
- `KpiSpiMatrix`
- `MeasuresSettingsMatrix`
- `/api/tasking-report`
- `/api/measures/settings`

Important hidden behaviour:

- KPI-7 and KPI-8 are calculated by SQL Server using deterministic hash-equivalent logic, not from persisted ATO or DIIS status data.
- KPI definitions, display order, success measures, calculation keys, enabled state, report availability, tasking metadata, report detail bindings, and SQL calculation catalogue rows are loaded from KPI database metadata tables.
- Discovery coverage results are produced by SQL Server from discovery tool scope plus DB-backed detection rules, then consumed by the page, reports, drill-throughs, and exports.
- SPI definitions, display order, applicability, rule catalogues, SQL calculation expressions, evidence expressions, feature bindings, rule parameter schemas/defaults, outcome reason templates, generated finding classification rules, report detail catalogues, tasking metadata, default severity, and recommended actions are loaded from database SPI metadata tables.
- application-side SPI rule execution has been removed; runtime SPI status, outcome, and evidence rows are produced by SQL Server and consumed by the app.
- The seed KPI catalogue disables tasking and trend reports for `KPI-1`, `KPI-2`, `KPI-3`, and `KPI-4`.
- the KPI definitions for DPE and DSE use `securityDomain = Protected` and `securityDomain = Secret`, which differs from the Cyber COP dashboard labels that are implemented using environment type.
- legacy query compatibility is normalized at route load:
  - `measuresTab=measures` maps to `summary`
  - `measuresTab=settings` maps to `spi-settings`
  - unknown or empty values map to `summary`
- SPI severity settings are built from `tsaat.finding_severity_definition`; `Data Gap` remains non-selectable and legacy saved `Data Gap` matrix entries are normalized to `Moderate` during load/save normalization.
- SPI priority settings are built from `tsaat.finding_priority_definition`; current selectable options are P1-P7 and Unknown/Data Gap findings remain the non-selectable P90.

## 3. Feature Breakdown
### Feature: Shared Measures Filter Scope
- **What it does:** filters the page by network, system, criticality, security domain, environment, asset type, mission capability, business service, date, and severity.
- **User perspective:** the user narrows KPI and SPI reporting to the relevant scope.
- **System behaviour:** the page uses the shared filter pipeline and adds a measures-specific severity selector.
- **Outcome:** charts and matrix rows all recalculate from one consistent scope.

### Feature: Summary Tab
- **What it does:** shows KPI compliance and SPI compliance charts for the current scope.
- **User perspective:** the user sees the overall measure picture before opening the detailed matrix.
- **System behaviour:** the page builds KPI rows from database KPI definitions plus SQL-produced KPI evaluations and derives SPI compliance points by scanning SQL-produced evaluation statuses for active database SPI definitions.
- **Outcome:** the page provides a compact performance summary.

### Feature: Measures-KPI Tab
- **What it does:** shows the KPI report index, including descriptions, success measures, scores, status counts, and report links.
- **User perspective:** the user can inspect KPI score details and launch current and trend reports for database-defined KPIs where reporting is enabled.
- **System behaviour:** KPI rows come from SQL-produced KPI evaluations joined to database KPI metadata; report links carry the active filter scope and selected `dataDate` into `/api/tasking-report`.
- **Outcome:** KPI performance details and per-KPI PDF report actions are shown in a dedicated tab.

### Feature: Measures-SPI Tab
- **What it does:** shows the SPI report index, including descriptions, success measures, scores, asset-type impact summaries, and report links.
- **User perspective:** the user can inspect SPI score details and launch the all-SPI report, a current single-SPI report, or the 12-month single-SPI trend report.
- **System behaviour:** SPI rows come from active database SPI definitions and SQL-produced SPI evaluation rows plus the shared SPI report model; report links carry the active filter scope and selected `dataDate` into `/api/tasking-report`.
- **Outcome:** SPI performance details and per-SPI PDF report actions are shown in a dedicated tab.

### Feature: SPI-Settings Tab
- **What it does:** lets users maintain nested SPI severity and priority matrix settings.
- **User perspective:** the user can tune finding severity and non-compliant finding priority without changing code.
- **System behaviour:** the settings panel loads active SPI definitions, severity definitions, priority definitions, and the latest saved measures settings, validates edits, and saves through `/api/measures/settings`; severity matrix keys cover every active SPI and every canonical asset type, while priority matrix keys cover every active SPI mapped to selectable priority definitions.
- **Outcome:** future analytics and findings displays use the updated severity and priority mappings.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Measures | Tab routing | Switches among summary, KPI report index, SPI report index, and SPI settings | Click tab | Updates `measuresTab` query parameter | `measuresTab` | Different layout | summary is default; legacy `measures` maps to summary; legacy `settings` maps to SPI settings; legacy `kpi-settings` falls back to summary | unsupported values fall back to summary | `MeasuresTabs` | Bookmarkable tab state | |
| Measures | Shared scope | Common measure filter scope plus severity selector | Apply filters | Re-runs analytics and KPI/SPI rows | shared filters plus `severity` | Filtered charts and matrix | one scope for all visible scores | supported values come from filter options or severity list | `FilterBar`, `getCoreAppData()` | Consistent measures scope | |
| Measures | Summary charts | KPI and SPI compliance charts | Open tab | Derives KPI and SPI compliance points from database definitions plus SQL-produced runtime rows | KPI definitions, SQL KPI evaluations, SPI definitions, analytics | Charts | charts show recalculated runtime scores for configured KPI and SPI rows | zero-safe percentages | chart components, `buildKpiRows()`, `usp_evaluate_kpi_snapshot` | Compact summary view | removed definitions disappear from the chart |
| Measures | Measures-KPI tab | KPI-only detailed report index and report launch surface | Open tab, click report link | Builds KPI report rows from database definitions and SQL KPI evaluations, then carries filter scope plus `dataDate` into report URLs | KPI definitions, SQL KPI evaluations, filters, dataset snapshots | KPI tiles and PDF report links | report buttons follow `kpi_definition.report_available`; current seed enables KPI-5 through KPI-10 and leaves KPI-1 through KPI-4 unavailable | invalid or incomplete KPI calculation metadata fails validation/load normalization | `KpiSpiMatrix`, `/api/tasking-report`, `usp_evaluate_kpi_snapshot` | Detailed KPI view with current and trend reports | |
| Measures | Measures-SPI tab | SPI-only detailed report index and report launch surface | Open tab, click report link | Builds SPI report rows from active database definitions and SQL evaluation output, then carries filter scope plus `dataDate` into report URLs | SPI definitions, SQL SPI evaluations, analytics, filters, dataset snapshots | SPI tiles and PDF report links | SPI rows respect database enabled/report flags and applicability rules; all-SPI report summarizes every active reportable SPI in current scope; trend report uses available snapshots in the 12 calendar months ending at the selected snapshot | invalid or incomplete calculation metadata fails validation/load normalization | `KpiSpiMatrix`, `/api/tasking-report` | Detailed SPI view with all-SPI, current, and trend reports | |
| Measures | SPI settings | Maintain nested severity and priority mappings | Edit rows, switch nested settings tab, save, reset | Validates and persists latest settings version with both matrices | active SPI definitions, severity definitions, priority definitions, measures settings rows | Updated measures settings | severity matrix affects future severity remap; priority matrix affects non-compliant finding priority only; Unknown/Data Gap stays P90 | panel-level validation in component and API | `/api/measures/settings` | Updated severity and priority model | non-applicable SPI/asset combinations remain harmless severity entries |

## 5. Database Mapping
The page reads snapshot analytics, KPI definitions, SPI definitions, severity/priority definitions, SQL KPI evaluation rows, SQL SPI evaluation rows, SQL discovery coverage rows, and measures settings tables. KPI definitions and KPI calculation metadata are stored in the database; SQL Server evaluates KPI score rows on demand for the selected scope. SPI definitions and SPI calculation expressions are stored in the database; SQL Server evaluates SPI status/outcome/evidence on demand for the selected snapshot.

Primary data dependencies:

- `tsaat.asset` and posture child tables
- `tsaat.finding`
- `tsaat.dataset_snapshot`
- `tsaat.ict_system`
- `tsaat.managed_network`
- `tsaat.measures_settings_version`
- `tsaat.measures_severity_matrix`
- `tsaat.measures_priority_matrix`
- `tsaat.kpi_definition`
- `tsaat.kpi_calculation_source`
- `tsaat.kpi_calculation_definition`
- `tsaat.kpi_calculation_parameter`
- `tsaat.kpi_report_detail_definition`
- `tsaat.kpi_report_detail_binding`
- `tsaat.kpi_tasking_team`
- `tsaat.kpi_tasking_action_template`
- `tsaat.kpi_tasking_condition_template`
- `tsaat.discovery_coverage_source`
- `tsaat.discovery_tool_detection_definition`
- `tsaat.discovery_tool_detection_rule`
- `tsaat.discovery_tool_detection_rule_value`
- `tsaat.finding_severity_definition`
- `tsaat.finding_priority_definition`
- `tsaat.spi_rule_definition`
- `tsaat.spi_rule_parameter_definition`
- `tsaat.spi_rule_outcome_template`
- `tsaat.spi_report_detail_definition`
- `tsaat.spi_calculation_source`
- `tsaat.spi_calculation_definition`
- `tsaat.spi_calculation_evidence_expression`
- `tsaat.spi_feature_binding`
- `tsaat.spi_finding_classification_rule`
- `tsaat.spi_definition`
- `tsaat.spi_applicable_asset_type`
- `tsaat.spi_rule_parameter`
- `tsaat.spi_tasking_team`
- `tsaat.spi_tasking_action_template`
- `tsaat.spi_tasking_condition_template`

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Measures | Runtime evaluations | `tsaat` | `asset`, `asset_operating_system`, `asset_network_os`, `asset_patch_state`, `asset_installed_software`, `asset_vulnerability`, SPI calculation tables, KPI calculation tables, discovery coverage rule tables | asset identity, evidence fields, SPI status/outcome SQL, KPI calculation metadata, discovery detection rules | mixed | drives SPI compliance, KPI rows, and discovery coverage measures | Read | SQL procedures evaluate active database definitions within one snapshot/scope | applicable rules depend on DB metadata and tool scope | SQL Server SPI, KPI, and discovery evaluation | `storage-device`, `printer-device`, and `other` evaluate rows that are DB-applicable |
| Measures | Findings | `tsaat` | `finding` | scope columns, `priority_rank`, `severity`, timestamps | mixed | KPI counts tied to urgent work and exposure | Read | finding scope joins back to asset and system | severity may be remapped at runtime | runtime aggregation only | |
| Measures | System and network context | `tsaat` | `ict_system`, `managed_network` | IDs, `criticality`, `security_domain`, `diis_defined`, system/network `modelling_status`, `discovery_status` | mixed | KPI denominators and scope grouping | Read | assets and findings roll up through these relationships | some KPIs use system and network counts directly | SQL KPI procedure grouping and filtering | KPI-10 remains discovery-status based |
| Measures | KPI metadata | `tsaat` | `kpi_definition`, `kpi_calculation_source`, `kpi_calculation_definition`, `kpi_calculation_parameter`, `kpi_report_detail_definition`, `kpi_report_detail_binding`, `kpi_tasking_team`, `kpi_tasking_action_template`, `kpi_tasking_condition_template` | KPI IDs, display order, names, descriptions, success measures, calculation keys, enabled/report flags, calculation parameters, report/tasking metadata | mixed | KPI catalogue rows, SQL score rows, charts, report availability, tasking text, performance report columns | Read | calculation keys join to enabled SQL calculation metadata; report and tasking metadata join by KPI ID | database rows are source of truth for KPI visibility, order, and report/tasking metadata | SQL Server evaluation via `usp_evaluate_kpi_snapshot` | added KPI rows require valid DB calculation metadata |
| Measures | SPI metadata | `tsaat` | `spi_rule_definition`, `spi_rule_parameter_definition`, `spi_rule_outcome_template`, `spi_report_detail_definition`, `spi_calculation_source`, `spi_calculation_definition`, `spi_calculation_evidence_expression`, `spi_feature_binding`, `spi_finding_classification_rule`, `spi_definition`, `spi_applicable_asset_type`, `spi_rule_parameter`, `spi_tasking_team`, `spi_tasking_action_template`, `spi_tasking_condition_template` | rule keys, parameter schemas/defaults, outcome templates, calculation SQL, evidence SQL, feature keys, classification rules, SPI IDs, descriptions, display order, enabled flags, parameters, report flags, report detail keys, tasking templates, applicable asset types | mixed | explanatory context, applicability rules, report availability, outcome text, generated finding classification, tasking report text, SQL evaluation | Read | joins by rule key, report detail key, SPI ID, source key, feature key, and asset type | metadata shapes SQL evaluation applicability and rendering | DB-selected constrained SQL engine plus controlled condition-key evaluator | invalid calculation metadata fails validation; new configured SPI IDs can render dynamically |
| Measures | SPI trend report snapshots | `tsaat` | `dataset_snapshot` | `snapshot_date` | date | selects historical snapshots for SPI trend PDFs | Read | trend report loads snapshots within the 12 calendar months ending at selected `dataDate` | latest selected snapshot when no date is supplied | date-window filtering | no monthly points are fabricated when snapshots are unavailable |
| Measures | Severity settings | `tsaat` | `finding_severity_definition`, `measures_settings_version`, `measures_severity_matrix` | severity taxonomy, selectable flag, versioning, SPI ID, asset type, severity | mixed | finding severity remap and settings maintenance | Read and Update | latest settings version plus detail rows | defaults come from active SPI `default_severity` and severity definitions | runtime severity rewrite | matrix keys include active SPI IDs x all six canonical asset types |
| Measures | Priority settings | `tsaat` | `finding_priority_definition`, `spi_definition`, `measures_settings_version`, `measures_priority_matrix` | priority taxonomy, selectable flag, default priority, versioning, SPI ID, priority rank | mixed | non-compliant finding priority remap and settings maintenance | Read and Update | latest settings version plus detail rows | defaults come from active `spi_definition.priority_order` and selectable priority definitions | runtime priority rewrite | matrix keys include active SPI IDs with selectable priority values; P90 is non-selectable |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| KPI definition catalogue | KPI visibility, wording, calculation metadata, tasking metadata, and report metadata | database rows define id, order, name, description, success measure, enabled flag, calculation key, SQL calculation metadata, report detail binding, tasking teams/actions/conditions, and report availability | KPI metadata tables | Stored | database/backend | invalid calculation metadata fails validation/load normalization |
| KPI-1 through KPI-10 SQL evaluation | KPI score rows | `tsaat.usp_evaluate_kpi_snapshot` evaluates enabled KPI definitions against the selected scope using DB calculation metadata, SQL SPI evaluations, SQL discovery coverage rows, effective findings JSON, systems, and networks | KPI metadata tables plus snapshot tables and effective findings | Runtime SQL result, stored definition | SQL Server | zero-safe counts; KPI-7/8 use SQL deterministic hash-equivalent proxy logic |
| KPI-6 Discovery Coverage Compliance | discovery control performance | compliant SQL discovery coverage rows divided by total evaluated assets in scope | `usp_evaluate_discovery_coverage_snapshot`, discovery detection metadata, `kpi_definition.calculation_key = discovery-coverage-compliance` | Runtime SQL result, stored definition | SQL Server | zero-safe; changes to discovery tool scope or detection rules affect KPI-6 without app calculation changes |
| SPI definition catalogue | SPI visibility, wording, order, applicability, SQL calculation, outcome text, generated finding classification, tasking text, feature bindings, and report availability | database rows define SPI ID, order, enabled flag, rule key, rule parameter schema/defaults, rule parameters, status/outcome/evidence SQL, outcome templates, report flags, detail key, default severity, applicability, classification rules, feature bindings, and tasking templates | SPI metadata and calculation tables | Stored definition and SQL calculation config | database/backend | invalid or disabled rows are not rendered |
| SPI SQL evaluation | per-asset SPI status, outcome key, and evidence | active DB SPI definitions are evaluated by `tsaat.usp_evaluate_spi_snapshot` using constrained SQL expressions over `tsaat.vw_spi_asset_evaluation_context` plus parameter helper functions | SPI metadata/calculation tables and asset posture tables | Runtime SQL result | SQL Server | no unrestricted formula engine; expressions are read-only fragments constrained by schema/load validation |
| SPI compliance rows | per-SPI scorecards | compliant count divided by total applicable count for each active SPI | SQL-produced SPI evaluations plus active SPI definitions | Runtime score, stored definition | backend | zero-safe; applicability follows database SPI metadata per asset type |

## 8. Non-Database Calculations
- Tasking, all-SPI, and trend report URLs are assembled from the current filter query string and selected `dataDate`; URLs are not stored.
- SPI score execution is performed by SQL Server through `usp_evaluate_spi_snapshot`; the application consumes returned status, outcome key, evidence, and DB-rendered metadata.
- KPI score execution is performed by SQL Server through `usp_evaluate_kpi_snapshot`; the application consumes returned score rows and DB-rendered metadata.
- Discovery coverage execution is performed by SQL Server through `usp_evaluate_discovery_coverage_snapshot`; the application consumes returned per-asset tool values.
- SPI reason wording uses DB-backed templates during application rendering; generated finding severity/priority classification is SQL-produced as part of the effective findings result.
- Summary chart points and matrix row formatting are runtime-only display artefacts.
- SPI trend PDF points are runtime-only aggregations from available historical snapshots in the selected 12-month window.
- KPI trend PDF points are runtime-only aggregations from available historical snapshots in the selected 12-month window.
- Severity remap is applied at runtime to findings before they are counted or displayed on dependent pages.
- Priority remap is applied at runtime to non-compliant findings before they are counted or displayed on dependent pages.

## 9. Rules, Assumptions, and Constraints
- The page is not date-scoped through a local control, but it respects shared route date state where supplied.
- KPI and SPI values are recalculated at runtime for the current scope by SQL Server procedures.
- KPI definitions are database-driven through `tsaat.kpi_definition` and related KPI metadata tables; removed or disabled rows disappear from KPI charts, tables, and reports.
- KPI tasking and trend report availability follows database KPI report/tasking metadata; current seed data disables `KPI-1`, `KPI-2`, `KPI-3`, and `KPI-4`.
- New KPI definitions require valid DB calculation metadata evaluated by the constrained SQL procedure; unrestricted formulas, JavaScript, and arbitrary SQL batches are not supported.
- SPI definitions are database-driven through `tsaat.spi_definition` and related SPI metadata tables; removed or disabled rows disappear from SPI charts, settings, findings generation, tables, and reports.
- New SPI definitions require DB catalogue, applicability, parameter, outcome template, and constrained SQL calculation rows. The SQL engine does not support unrestricted batches, JavaScript, or arbitrary formula execution.
- The saved severity matrix affects downstream findings analytics and page displays.
- The saved priority matrix affects downstream non-compliant finding analytics and page displays.
- SPI settings dropdown options exclude `Data Gap`.
- persisted SPI settings values of `Data Gap` are normalized to `Moderate` during settings normalization.
- Severity matrix settings are stored for all six canonical asset types (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`) across the active database SPI set.
- Priority matrix settings are stored for the active database SPI set using selectable `finding_priority_definition` rows; Unknown/Data Gap findings remain P90.
- New asset types (`storage-device`, `printer-device`, `other`) are currently evaluated against SPI 10 only.
- KPI-7 and KPI-8 currently represent synthetic proxy logic rather than persisted accreditation or DIIS data.

## 10. Open Questions / Gaps
- **Open question:** are KPI-7 and KPI-8 intentionally synthetic placeholders, or should they be replaced with persisted ATO and DIIS source data?
- **Open question:** should KPI-5 explicitly state in the UI that its score percentage is derived against total findings rather than a direct production-only denominator?
- **Open question:** should DPE and DSE terminology be aligned across Measures and Cyber COP so both pages use the same business meaning?
