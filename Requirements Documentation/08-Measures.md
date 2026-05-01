# Measures

**Page Path:** `/measures`

## 1. Page Overview
- **Page name:** Measures
- **Purpose:** provide the KPI and SPI measure catalogue, summary charts, SPI tasking/trend report launch points, and configurable severity mapping.
- **User outcome:** the user can understand how performance is measured, inspect KPI and SPI scores for the current scope, generate tasking and trend reports, and manage the severity model applied to findings.
- **Primary user roles:** cyber governance users, assurance teams, reporting users, cyber analysts, product administrators.

## 2. Page Summary
This page provides `summary`, `measures-kpi`, `measures-spi`, `spi-settings`, and `kpi-settings` tabs.

Major dependencies:

- `getCoreAppData()`
- `buildKpiRows()`
- `KpiComplianceChart`
- `SecurityPerformanceIndicatorComplianceChart`
- `KpiSpiMatrix`
- `MeasuresSettingsMatrix`
- `/api/tasking-report`
- `/api/measures/settings`

Important hidden behaviour:

- KPI-7 and KPI-8 are calculated from deterministic hash functions, not from persisted ATO or DIIS status data.
- KPI tasking reports are disabled for `KPI-1`, `KPI-2`, and `KPI-3`.
- the KPI definitions for DPE and DSE use `securityDomain = Protected` and `securityDomain = Secret`, which differs from the Cyber COP dashboard labels that are implemented using environment type.
- legacy query compatibility is normalized at route load:
  - `measuresTab=measures` maps to `summary`
  - `measuresTab=settings` maps to `spi-settings`
  - unknown or empty values map to `summary`
- SPI severity settings no longer allow selecting `Data Gap`; legacy saved `Data Gap` matrix entries are normalized to `Moderate` during load/save normalization.

## 3. Feature Breakdown
### Feature: Shared Measures Filter Scope
- **What it does:** filters the page by network, system, criticality, security domain, environment, asset type, mission capability, business service, date, and severity.
- **User perspective:** the user narrows KPI and SPI reporting to the relevant scope.
- **System behaviour:** the page uses the shared filter pipeline and adds a measures-specific severity selector.
- **Outcome:** charts and matrix rows all recalculate from one consistent scope.

### Feature: Summary Tab
- **What it does:** shows KPI compliance and SPI compliance charts for the current scope.
- **User perspective:** the user sees the overall measure picture before opening the detailed matrix.
- **System behaviour:** the page builds KPI rows from runtime analytics and derives SPI compliance points by scanning evaluation statuses per SPI.
- **Outcome:** the page provides a compact performance summary.

### Feature: Measures-KPI Tab
- **What it does:** shows the KPI matrix, including descriptions, success measures, scores, and report links.
- **User perspective:** the user can inspect measure definitions and launch tasking reports.
- **System behaviour:** KPI rows come from `buildKpiRows()` and report links carry the active filter scope into `/api/tasking-report`.
- **Outcome:** KPI performance details are shown in a dedicated tab.

### Feature: Measures-SPI Tab
- **What it does:** shows the SPI report index, including descriptions, success measures, scores, asset-type impact summaries, and report links.
- **User perspective:** the user can inspect SPI score details and launch the all-SPI report, a current single-SPI report, or the 12-month single-SPI trend report.
- **System behaviour:** SPI rows come from the shared SPI report model and report links carry the active filter scope and selected `dataDate` into `/api/tasking-report`.
- **Outcome:** SPI performance details and per-SPI PDF report actions are shown in a dedicated tab.

### Feature: SPI-Settings Tab
- **What it does:** lets users maintain the severity matrix that maps SPI and asset type combinations to finding severity across all six canonical asset types.
- **User perspective:** the user can tune how findings are classified without changing code.
- **System behaviour:** the settings panel loads the latest saved measures settings, validates edits, and saves through `/api/measures/settings`; matrix keys cover every SPI and every canonical asset type; legacy `Data Gap` values normalize to `Moderate`.
- **Outcome:** future analytics and findings displays use the updated severity mapping.

### Feature: KPI-Settings Tab
- **What it does:** reserves a future settings panel for KPI configuration.
- **User perspective:** the user can see where KPI-specific settings will appear.
- **System behaviour:** renders placeholder content only, with no API calls or persistence.
- **Outcome:** tab model supports future KPI settings without impacting current save flows.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Measures | Tab routing | Switches among summary, KPI matrix, SPI matrix, SPI settings, and KPI settings | Click tab | Updates `measuresTab` query parameter | `measuresTab` | Different layout | summary is default; legacy `measures` maps to summary; legacy `settings` maps to SPI settings | unsupported values fall back to summary | `MeasuresTabs` | Bookmarkable tab state | |
| Measures | Shared scope | Common measure filter scope plus severity selector | Apply filters | Re-runs analytics and KPI/SPI rows | shared filters plus `severity` | Filtered charts and matrix | one scope for all visible scores | supported values come from filter options or severity list | `FilterBar`, `getCoreAppData()` | Consistent measures scope | |
| Measures | Summary charts | KPI and SPI compliance charts | Open tab | Derives compliance points from runtime rows | analytics, systems, networks | Charts | charts show recalculated runtime scores | zero-safe percentages | chart components, `buildKpiRows()` | Compact summary view | |
| Measures | Measures-KPI tab | KPI-only detailed measure table and report launch surface | Open tab, click report link | Builds KPI rows and carries filter scope into report URL | analytics, filters | KPI matrix and PDF report links | KPI reports for 1-3 are disabled | none beyond scope parsing | `KpiSpiMatrix`, `/api/tasking-report` | Detailed KPI view | disabled KPI reports show `Not available` |
| Measures | Measures-SPI tab | SPI-only detailed report index and report launch surface | Open tab, click report link | Builds SPI report rows and carries filter scope plus `dataDate` into report URLs | analytics, filters, dataset snapshots | SPI tiles and PDF report links | SPI rows respect SPI applicability rules; all-SPI report summarizes every SPI in current scope; trend report uses available snapshots in the 12 calendar months ending at the selected snapshot | none beyond scope parsing | `KpiSpiMatrix`, `/api/tasking-report` | Detailed SPI view with all-SPI, current, and trend reports | |
| Measures | SPI settings | Maintain severity mapping by SPI and asset type | Edit rows, save, reset | Validates and persists latest settings version | measures settings rows | Updated measures settings | saved matrix affects future severity remap; matrix includes six canonical asset types per SPI; `Data Gap` values are normalized to `Moderate` | panel-level validation in component and API | `/api/measures/settings` | Updated severity model | non-applicable SPI/asset combinations remain harmless configuration entries |
| Measures | KPI settings placeholder | Reserved future KPI settings tab | Open tab | Renders placeholder only | none | Placeholder panel | intentionally no save behavior | none | measures route rendering | Future-ready tab model | no API usage |

## 5. Database Mapping
The page reads snapshot analytics plus the measures settings tables. Most KPI and SPI values are calculated at runtime from asset evaluations and findings rather than stored as facts.

Primary data dependencies:

- `tsaat.asset` and posture child tables
- `tsaat.finding`
- `tsaat.dataset_snapshot`
- `tsaat.ict_system`
- `tsaat.managed_network`
- `tsaat.measures_settings_version`
- `tsaat.measures_severity_matrix`
- `tsaat.spi_definition`
- `tsaat.spi_applicable_asset_type`

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Measures | Runtime evaluations | `tsaat` | `asset`, `asset_operating_system`, `asset_network_os`, `asset_patch_state`, `asset_installed_software`, `asset_vulnerability` | asset identity and evidence fields | mixed | drives SPI compliance and several KPI calculations | Read | evaluation rows are built by asset within one snapshot | applicable SPI rules depend on asset type | runtime SPI evaluation | `storage-device`, `printer-device`, and `other` evaluate SPI 10 only |
| Measures | Findings | `tsaat` | `finding` | scope columns, `priority_rank`, `severity`, timestamps | mixed | KPI counts tied to urgent work and exposure | Read | finding scope joins back to asset and system | severity may be remapped at runtime | runtime aggregation only | |
| Measures | System and network context | `tsaat` | `ict_system`, `managed_network` | IDs, `criticality`, `security_domain`, `diis_defined`, `modelling_status`, `discovery_status` | mixed | KPI denominators and scope grouping | Read | assets and findings roll up through these relationships | some KPIs use system and network counts directly | direct grouping and filtering | |
| Measures | SPI metadata | `tsaat` | `spi_definition`, `spi_applicable_asset_type` | SPI IDs, descriptions, applicable asset types | mixed | explanatory context and applicability rules | Read | joins by SPI ID and asset type | metadata shapes evaluation applicability | reference lookup | new asset types are currently scoped to SPI 10 applicability |
| Measures | SPI trend report snapshots | `tsaat` | `dataset_snapshot` | `snapshot_date` | date | selects historical snapshots for SPI trend PDFs | Read | trend report loads snapshots within the 12 calendar months ending at selected `dataDate` | latest selected snapshot when no date is supplied | date-window filtering | no monthly points are fabricated when snapshots are unavailable |
| Measures | Severity settings | `tsaat` | `measures_settings_version`, `measures_severity_matrix` | versioning, SPI ID, asset type, severity | mixed | finding severity remap and settings maintenance | Read and Update | latest settings version plus detail rows | defaults apply if tables are empty | runtime severity rewrite | matrix keys include all SPI IDs x all six canonical asset types |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| KPI-1 Overall SPI Compliance | overall control performance | compliant statuses divided by all applicable statuses | runtime evaluations | Runtime | backend | zero-safe |
| KPI-2 Overall DPE Compliance | Protected domain performance | compliant statuses where `securityDomain = Protected` divided by total Protected statuses | runtime evaluations | Runtime | backend | differs from Cyber COP DPE label implementation |
| KPI-3 Overall DSE Compliance | Secret domain performance | compliant statuses where `securityDomain = Secret` divided by total Secret statuses | runtime evaluations | Runtime | backend | differs from Cyber COP DSE label implementation |
| KPI-4 Critical ICT System Compliance | critical-system performance | compliant statuses for assets whose `systemCriticality = Critical` divided by total such statuses | runtime evaluations | Runtime | backend | zero-safe |
| KPI-5 Critical Exposure in Production | urgent exposure volume | count findings whose remapped severity is `Critical Exposure`; score percent is derived as non-critical-exposure findings over all findings | findings | Runtime | backend | denominator is total findings, not only production findings |
| KPI-6 Discovery Coverage Compliance | discovery control performance | discovery-compliant assets divided by total evaluated assets | runtime evaluations | Runtime | backend | zero-safe |
| KPI-7 ICT Systems have an active ATO | ATO coverage | stable hash of `systemId:ato`; compliant when hash mod 5 is not 0 | system IDs | Runtime | backend | synthetic, not DB-backed |
| KPI-8 ICT Systems are registered within DIIS | DIIS registration coverage | stable hash of `systemId:diis`; compliant when hash mod 4 is not 1 | system IDs | Runtime | backend | synthetic, not DB-backed |
| KPI-9 DIIS Systems Modelled Coverage | DIIS modelling coverage | `DIIS-defined systems with modellingStatus = true / DIIS-defined systems` | `ict_system.diis_defined`, `ict_system.modelling_status` | Runtime | backend | zero-safe |
| KPI-10 Networks Discovery Enablement | network discovery readiness | `networks with discoveryStatus = Discovery Enabled / total networks` | `managed_network.discovery_status` | Runtime | backend | zero-safe |
| SPI compliance rows | per-SPI scorecards | compliant count divided by total applicable count for each SPI | runtime evaluations | Runtime | backend | zero-safe; applicability follows SPI metadata per asset type |

## 8. Non-Database Calculations
- KPI-7 and KPI-8 are entirely runtime calculations using deterministic hash functions.
- Tasking, all-SPI, and trend report URLs are assembled from the current filter query string and selected `dataDate`; they are not stored.
- Summary chart points and matrix row formatting are runtime-only display artefacts.
- SPI trend PDF points are runtime-only aggregations from available historical snapshots in the selected 12-month window.
- Severity remap is applied at runtime to findings before they are counted or displayed on dependent pages.

## 9. Rules, Assumptions, and Constraints
- The page is not date-scoped through a local control, but it respects shared route date state where supplied.
- KPI and SPI values are recalculated at runtime for the current scope.
- KPI tasking reports are disabled for `KPI-1`, `KPI-2`, and `KPI-3`.
- The saved severity matrix affects downstream findings analytics and page displays.
- SPI settings dropdown options exclude `Data Gap`.
- persisted SPI settings values of `Data Gap` are normalized to `Moderate` during settings normalization.
- Severity matrix settings are stored for all six canonical asset types (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`) across SPI 1..10.
- New asset types (`storage-device`, `printer-device`, `other`) are currently evaluated against SPI 10 only.
- KPI-7 and KPI-8 currently represent synthetic proxy logic rather than persisted accreditation or DIIS data.

## 10. Open Questions / Gaps
- **Open question:** are KPI-7 and KPI-8 intentionally synthetic placeholders, or should they be replaced with persisted ATO and DIIS source data?
- **Open question:** should KPI-5 explicitly state in the UI that its score percentage is derived against total findings rather than a direct production-only denominator?
- **Open question:** should DPE and DSE terminology be aligned across Measures and Cyber COP so both pages use the same business meaning?
