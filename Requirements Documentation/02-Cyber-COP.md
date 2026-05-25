# Cyber COP

**Page Path:** `/cyber-cop`

## 1. Page Overview
- **Page name:** Cyber COP
- **Purpose:** provide the executive and operational dashboard for overall cyber posture, impact, and action planning.
- **User outcome:** the user understands current compliance, finding pressure, blast radius, and immediate remediation priorities for the filtered scope.
- **Primary user roles:** cyber operations leadership, cyber analysts, risk managers, network owners, ICT system owners. These roles are inferred from page function rather than explicitly modelled in code.

## 2. Page Summary
This page is the main operational dashboard. It applies the shared filter model, loads the requested dataset snapshot, computes analytics at runtime, and renders three in-page tabs: `Overview`, `Impact`, and `Action`.

Major dependencies:

- `getCoreAppData()`
- `CyberCopDashboard`
- `FilterBar`
- runtime analytics in `lib/analytics.ts`
- measures settings severity and priority remap
- SQL-produced discovery coverage rows from discovery tool settings and database detection rules

## 3. Feature Breakdown
### Feature: Shared Filter Scope and Snapshot Date
- **What it does:** scopes the dashboard by network, ICT system, criticality, security domain, environment, asset type, mission capability, and business service.
- **User perspective:** the user changes filters and the dashboard reloads in place.
- **System behaviour:** query parameters are parsed by `parseFilters()`, date scope is resolved from `dataDate`, and analytics are rebuilt for the selected snapshot. The synthetic loader-only `net-unassigned` bucket is treated as `All` when supplied as a network query and is not offered as a network filter option. Asset type filters use the shared canonical taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
- **Outcome:** every dashboard number reflects one scope.

### Feature: Overview Tab
- **What it does:** shows compliance score tiles, risk profile charts, findings detail, and daily trends.
- **User perspective:** the user sees top-line posture and current risk pressure first.
- **System behaviour:** the page calculates overall compliance, DPE/DSE scores, critical ICT system compliance, network compliance, severity summaries, and open-finding trend lines.
- **Outcome:** the user gets a briefing-style posture snapshot.

### Feature: Impact Tab
- **What it does:** shows mission, business-service, and ICT-system impact leaderboards plus blast-radius and impact-driver charts.
- **User perspective:** the user can identify which services, missions, and systems carry the most severe current risk.
- **System behaviour:** open findings are grouped by linked ICT system and rolled up to missions and business services.
- **Outcome:** remediation can be prioritised by operational impact.

### Feature: Action Tab
- **What it does:** shows immediate action, remediation backlog, discovery gaps, modelling gaps, throughput, aging, oldest findings, and quick wins.
- **User perspective:** the user can move from posture awareness to remediation planning.
- **System behaviour:** the page derives action counts from open findings, lifecycle data, SQL-produced discovery coverage results, and DIIS modelling flags.
- **Performance behaviour:** Cyber COP continues to use the full data profile because its topology and impact-analysis surfaces require dependency and detailed asset payloads.
- **Outcome:** the page produces a tactical remediation view.

### Feature: Client-Side Tab State
- **What it does:** switches between `Overview`, `Impact`, and `Action`.
- **User perspective:** the dashboard changes without navigating to a new route.
- **System behaviour:** tab state is local React state inside `CyberCopDashboard`; it is not encoded in the URL.
- **Outcome:** interaction is fast, but tabs cannot be deep-linked directly.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cyber COP | Filter scope | Shared cross-page filter bar | Select filters or date | Re-runs `getCoreAppData()` for the new query state | `dataDate`, filter query params | Filtered dataset and analytics | All tiles and charts must share one scope | filter values must match supported IDs and enums | `FilterBar`, `lib/selectors.ts`, `lib/app-data.ts` | Consistent dashboard scope | Loading overlay shown during replace navigation |
| Cyber COP | Overview tab | Compliance and risk briefing | Open tab | Renders compliance tiles, risk charts, severity mix, daily trends | runtime analytics | Briefing dashboard | default tab | zero-safe values | `CyberCopDashboard` | Executive posture view | tab state is local only |
| Cyber COP | Impact tab | Operational impact rollups | Open tab and optionally select leaderboard rows | Filters impact charts by selected service, mission, or system | open findings, system relationships | Impact charts and leaderboards | impact is based on open findings | selection clears when source leaves scope | mission/service tables | Business and mission prioritisation | search is client-side |
| Cyber COP | Action tab | Remediation planning view | Open tab | Aggregates backlog, throughput, aging, and quick wins | findings, lifecycle, discovery, modelling data | Action summary and trend charts | immediate action reflects highest-severity open work | zero-safe calculations | findings plus lifecycle and discovery inputs | Remediation planning | quick wins grouped by action text |
| Cyber COP | Severity remap | Applies configured severity matrix | Load page | Rewrites finding severity by SPI and asset type before display | findings, assets, measures settings | Severity-aware charts and counts | configured settings apply globally across all six canonical asset types | defaults used if no saved settings exist | measures settings tables | Configurable severity model | applies even when findings come from DB |

## 5. Database Mapping
The page depends on the shared dataset snapshot loader and analytics builder. Most visible content is assembled from:

- `tsaat.dataset_snapshot`
- `tsaat.managed_network`
- `tsaat.ict_system`
- `tsaat.asset` plus operating system, patch, software, and vulnerability tables
- `tsaat.finding`
- `tsaat.system_mission_capability`
- `tsaat.system_business_service`
- `tsaat.measures_settings_version`, `tsaat.measures_severity_matrix`, and `tsaat.measures_priority_matrix`
- `tsaat.discovery_tools_settings_version`, `tsaat.discovery_tool`, `tsaat.discovery_tool_asset_scope`, and discovery coverage detection metadata tables

If `tsaat.finding` has no rows for the selected snapshot, SQL Server still returns effective findings by generating deterministic fallback rows from non-compliant or unknown SQL SPI evaluations.

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cyber COP | Snapshot selection | `tsaat` | `dataset_snapshot` | `snapshot_id`, `snapshot_date`, `generated_at` | integer, date, datetime | Selects the dataset version | Read | root join for snapshot-aware tables | latest snapshot unless `dataDate` supplied | date-only conversion for display | Shared by all date-scoped pages |
| Cyber COP | Scope context | `tsaat` | `managed_network`, `ict_system` | IDs, names, `criticality`, `security_domain`, ownership columns | string, enum-like | Filter options and scope labels | Read | assets link to network and system IDs | fallback values possible in downstream views | used directly and in rollups | |
| Cyber COP | SPI posture | `tsaat` | `asset`, `asset_operating_system`, `asset_network_os`, `asset_patch_state`, `asset_installed_software`, `asset_vulnerability`, SPI calculation metadata | asset identity, OS, patch, software, vulnerability fields | mixed | Drives SPI evaluation and exposure logic | Read | joined by `asset_id` within one snapshot | empty related rows produce partial evidence or `Unknown` outcomes | SQL SPI evaluation through `usp_evaluate_spi_snapshot` | not stored as a precomputed fact table |
| Cyber COP | Findings | `tsaat` | `finding`, `usp_get_effective_findings_snapshot` | IDs, scope columns, display priority/severity, workflow status, timestamps, `evidence` | mixed | Risk charts, counts, action plan | Read | finding scope joins back to asset, system, and network | SQL-generated fallback if no persisted rows exist | severity and non-compliant priority are applied by SQL effective findings | |
| Cyber COP | Settings-driven logic | `tsaat` | measures settings, discovery settings, and discovery coverage rule tables | version, severity, tool metadata, scope settings, detection rules | mixed | Severity remap and discovery compliance | Read | latest settings version applied; discovery rows are returned by `usp_evaluate_discovery_coverage_snapshot` | defaults if no saved settings exist | SQL discovery coverage alters runtime analytics | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Overall compliance | headline posture score | `compliant SPI checks / all SPI checks * 100` | runtime asset evaluations | Runtime | backend | returns `0` when denominator is `0` |
| DPE compliance | dashboard tile | compliant statuses where `environmentType = Production` divided by production statuses | runtime evaluations | Runtime | backend | implementation uses environment type, not security domain |
| DSE compliance | dashboard tile | compliant statuses where `environmentType != Production` and not null divided by non-production statuses | runtime evaluations | Runtime | backend | naming differs from KPI page meaning |
| Networks compliance | dashboard tile | compliant counts across network rollups divided by total rollup counts | runtime rollups | Runtime | backend | returns `0` if no rollups |
| Immediate action | urgent work count | `open High Risk + open Critical Exposure` | findings | Runtime | backend | derived after severity remap |
| Planned remediation | backlog count | count of open findings where `priorityRank` is between `3` and `89` | findings | Runtime | backend | priority remap applies before counting; `90` is treated as data-gap / non-priority |
| Weekly risk trend | trend cards | sample every 7 days from a 365-day open-finding series | finding timestamps | Runtime | backend | future dates beyond snapshot show `null` |
| ICT systems modelled coverage | modelling summary | `DIIS-defined systems with modellingStatus = true / DIIS-defined systems * 100` | `ict_system.diis_defined`, `ict_system.modelling_status` | Runtime | backend | `0` if no DIIS-defined systems |
| Findings generation fallback | keep dashboard populated | SQL Server derives findings from non-compliant or unknown SPI evaluations and assigns deterministic severity, priority, status, and timestamps | SQL SPI evaluations, SPI classification rules, finding generation policy | Runtime SQL result | SQL Server | only used when dataset has no persisted findings |
| Discovery coverage | discovery gap and action inputs | SQL Server evaluates enabled discovery tool rules for each in-scope asset and returns per-tool values, missing tools, and compliance | discovery settings, discovery coverage rule tables, asset/system/network facts | Runtime SQL result | SQL Server | unrestricted formula/script execution is not supported |

## 8. Non-Database Calculations
- Client tab selection is held in component state and not persisted.
- Loading progress overlays use synthetic progress increments.
- Leaderboard search is client-side text matching over already-rendered impact rows.
- Daily trend chart labels are UTC-formatted display values derived from runtime date keys.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped through global navigation rather than an in-page date control.
- Severity shown on the page may differ from persisted `finding.severity` because measures settings remap severity by SPI and asset type across the shared six-type taxonomy.
- If the selected snapshot contains no persisted findings, the page still renders SQL-generated fallback findings returned by the effective findings procedure.
- Tab state is not addressable by URL.

## 10. Open Questions / Gaps
- **Open question:** are `DPE` and `DSE` intended to represent Production and non-Production or Protected and Secret? The dashboard implements the former, while KPI pages implement the latter.
- **Open question:** should the active Cyber COP tab be deep-linkable for reporting and bookmarking?
- **Open question:** should generated fallback findings be visibly labelled when `tsaat.finding` is empty for the selected snapshot?
