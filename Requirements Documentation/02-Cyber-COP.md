# Cyber COP

**Page Path:** `/cyber-cop`

## 1. Page Overview
- **Page name:** Cyber COP
- **Purpose:** provide the executive and operational dashboard for overall cyber posture, impact, and action planning.
- **User outcome:** the user understands current compliance, finding pressure, blast radius, and immediate remediation priorities for the filtered scope.
- **Primary user roles:** cyber operations leadership, cyber analysts, risk managers, network owners, ICT system owners. These roles are inferred from page function rather than explicitly modelled in code.

## 2. Page Summary
This page is the main operational dashboard. It applies the shared filter model, loads the requested dataset snapshot, computes analytics at runtime, and renders seven in-page tabs: `Overview`, `Impact`, `Networks - SPI Heatmap`, `ICT System - SPI Heatmap`, `ICT System Impact Analyser`, `Network Impact Analyser`, and `Action`.

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

### Feature: ICT System Impact Analyser Tab
- **What it does:** provides the run-gated ICT System Impact Analyser as a main Cyber COP tab immediately after `ICT System - SPI Heatmap`.
- **User perspective:** the user selects one or more scoped ICT systems by selecting either the checkbox or anywhere on the ICT system option row, then explicitly runs the analyser from its own full-size tab.
- **System behaviour:** selecting an ICT system option row ticks or unticks its checkbox without closing the selector prematurely; native checkbox and keyboard operation remain available. The analyser starts with no systems selected, does not request analyser data until Run is selected, and scopes its data and SPI drill-through requests to the applied ICT system selection.
- **Outcome:** detailed ICT system impact paths can be investigated without occupying an Impact chart sub-tab.

### Feature: ICT System Dependencies View
- **What it does:** adds an `ICT System Dependencies` control at the far right of the Cyber COP ICT System Impact Analyser filters and opens an in-diagram overlay without replacing the applied Run scope.
- **User perspective:** after the analyser is ready, the user opens a dependency view with the columns `ICT System`, `Environment`, `Server`, `Dependent Server`, `Dependent Environment`, and `Dependent ICT System`. The user can filter by one or more `Dependent ICT Systems`, export the currently filtered six-column diagram data to an Excel-readable `.xls` document, then select Close or press Escape to return to the unchanged impact diagram.
- **System behaviour:** opening the dependency view hides the parent `ICT System Impact Analyser Diagram` filter row while retaining its state; closing the view restores that row. Dependency data loads only when the view opens and uses real directed server-to-server CI dependency records whose source server belongs to an applied ICT system model. The dependent ICT system filter is applied worker-side, including exact `Not Modelled` selection, and the exported rows use the same accepted worker-filtered row indexes as the diagram. The dependent endpoint retains its actual model and environment; targets outside a modelled ICT system environment terminate at one red circular `Not Modelled` node placed first in the final column. Self-links, dangling endpoints, non-server relationships, and duplicate dependency IDs are excluded.
- **Outcome:** cross-system and unmodelled server dependencies can be traced without leaving the current Cyber COP analyser run.

### Feature: Network Impact Analyser Tab
- **What it does:** provides a run-gated multi-network impact analyser immediately after `ICT System Impact Analyser`.
- **User perspective:** the user selects one or more real networks by selecting either the checkbox or anywhere on the network option row, then explicitly selects Run to build the aggregate network report.
- **System behaviour:** selecting a network option row ticks or unticks its checkbox without closing the selector prematurely; native checkbox and keyboard operation remain available. Pending selection is local and is not written to the URL; the analyser starts with no selection, Run remains disabled until a network is selected, and changing or clearing the pending selection removes the previously applied report. On Run, each selected network uses the same topology, declared-asset, direct-asset, finding, Network axis, Assets axis, Asset Type filter, Asset Details, and SPI findings model as the single-network drill-through. Overlapping model assets are de-duplicated while their real network names are retained.
- **Outcome:** one or more network impact scopes can be compared in a full-size Cyber COP report without opening separate network drill-through tabs.

### Feature: Action Tab
- **What it does:** separates the remediation view into `Threat Surface Area Action Plan`, `Discovery Action Plan`, and `ICT System Modelling Action Plan` sub-tabs.
- **User perspective:** the user selects one plan and sees only that plan's action data and `Quick Wins by Recommended Action`.
- **System behaviour:** the Threat Surface plan derives finding, OS, lifecycle, critical-server, and strict `> 60` whole-UTC-day Critical/High ageing counts; the Discovery plan derives discovery enablement, discovery compliance, and target-state gaps; the ICT System Modelling plan derives DIIS definition, modelling, and modelled-system discovery gaps. The former `Oldest Open Findings` table is not rendered. Finding recommendations are used only for Threat Surface quick wins, while Discovery and Modelling quick wins are derived from their own measured plan gaps.
- **Performance behaviour:** Cyber COP continues to use the full data profile because its topology and impact-analysis surfaces require dependency and detailed asset payloads.
- **Outcome:** the page produces a tactical remediation view.

### Feature: Client-Side Tab State
- **What it does:** switches among the Cyber COP overview, impact, SPI heatmap, ICT System Impact Analyser, Network Impact Analyser, and action tabs.
- **User perspective:** the dashboard changes without navigating to a new route.
- **System behaviour:** top-level tab state and the nested Action plan tab state are local React state inside `CyberCopDashboard`; neither is encoded in the URL.
- **Outcome:** interaction is fast, but tabs cannot be deep-linked directly.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cyber COP | Filter scope | Shared cross-page filter bar | Select filters or date | Re-runs `getCoreAppData()` for the new query state | `dataDate`, filter query params | Filtered dataset and analytics | All tiles and charts must share one scope | filter values must match supported IDs and enums | `FilterBar`, `lib/selectors.ts`, `lib/app-data.ts` | Consistent dashboard scope | Shared route loading overlay remains open until the page-ready marker is rendered |
| Cyber COP | Overview tab | Compliance and risk briefing | Open tab | Renders compliance tiles, risk charts, severity mix, daily trends | runtime analytics | Briefing dashboard | default tab | zero-safe values | `CyberCopDashboard` | Executive posture view | tab state is local only |
| Cyber COP | Impact tab | Operational impact rollups | Open tab and optionally select leaderboard rows | Filters impact charts by selected service, mission, or system | open findings, system relationships | Impact charts and leaderboards | impact is based on open findings | selection clears when source leaves scope | mission/service tables | Business and mission prioritisation | search is client-side |
| Cyber COP | ICT System Impact Analyser tab | Run-gated selected-system impact analysis | Open the main analyser tab, select an ICT system option row or checkbox, then select Run | Ticks the corresponding checkbox from either interaction and mounts the analyser only after Run with the applied ICT system IDs | current Impact ICT system scope, analyser selection, open findings | Selected-system analyser diagram and SPI drill-throughs | defaults to no ICT system selection; Run requires at least one selection | unavailable systems are removed when the current Impact scope changes; changing or clearing the pending selection removes the previous diagram | `CyberCopDashboard`, impact analyser API | Intentional full-size ICT system impact analysis | positioned immediately after `ICT System - SPI Heatmap`; selection is local state and is not written to the URL |
| Cyber COP | Network Impact Analyser tab | Run-gated selected-network impact analysis | Open the main analyser tab, select a network option row or checkbox, then select Run | Ticks the corresponding checkbox, unions and de-duplicates the selected network topology models, then mounts the analyser with the applied network IDs | current real-network scope, analyser selection, topology and asset relationships, open findings | Aggregate network analyser diagram, Asset Details, and SPI drill-throughs | defaults to no network selection; Run requires at least one selection; selection alone never loads data | invalid or out-of-scope network IDs are excluded; changing or clearing selection removes the previous diagram; an empty applied scope fails closed | `CyberCopDashboard`, shared impact analyser and Cyber COP analyser API | Full-size multi-network impact analysis with single-network drill-through semantics | positioned immediately after `ICT System Impact Analyser`; pending and applied selection are local state and are not written to the URL |
| Cyber COP | Action tab | Three plan-specific remediation views | Open Action and select a plan sub-tab | Renders only the active plan matrix and its matching recommended quick wins | findings, lifecycle, discovery, target-state and DIIS modelling data | Threat Surface, Discovery, or ICT System Modelling action plan | Critical/High ageing uses strict whole UTC days `> 60`; quick wins cannot leak across plans | zero-safe counts and rates | findings plus lifecycle, discovery, target-state and modelling inputs | Focused remediation planning | Threat quick wins group open-finding recommendations; Discovery and Modelling quick wins come from measured domain gaps |
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
| Critical/High findings over 60 days | escalation breach count | open `Critical Exposure` or `High Risk` findings where whole UTC days from opened date to selected snapshot date is strictly greater than `60` | finding status, severity and timestamp | Runtime | backend | 60 days does not count; invalid, future, closed and lower-severity findings do not count |
| Plan-specific quick wins | connect measured gaps to recommended work | group open-finding recommendation text for Threat Surface; map discovery predicates to Discovery actions; map DIIS modelling predicates to Modelling actions | findings, networks, discovery evaluations, target states, ICT systems | Runtime | backend and client presentation | blank finding recommendations and zero-count Discovery or Modelling recommendations are omitted; DIIS-defined baseline is not itself a quick win |
| Weekly risk trend | trend cards | sample every 7 days from a 365-day open-finding series | finding timestamps | Runtime | backend | future dates beyond snapshot show `null` |
| ICT systems modelled coverage | modelling summary | `DIIS-defined systems with modellingStatus = true / DIIS-defined systems * 100` | `ict_system.diis_defined`, `ict_system.modelling_status` | Runtime | backend | `0` if no DIIS-defined systems |
| Findings generation fallback | keep dashboard populated | SQL Server derives findings from non-compliant or unknown SPI evaluations and assigns deterministic severity, priority, status, and timestamps | SQL SPI evaluations, SPI classification rules, finding generation policy | Runtime SQL result | SQL Server | only used when dataset has no persisted findings |
| Discovery coverage | discovery gap and action inputs | SQL Server evaluates enabled discovery tool rules for each in-scope asset and returns per-tool values, missing tools, and compliance | discovery settings, discovery coverage rule tables, asset/system/network facts | Runtime SQL result | SQL Server | unrestricted formula/script execution is not supported |

## 8. Non-Database Calculations
- Client tab selection is held in component state and not persisted.
- Loading progress uses optimistic increments and completes only after the target route-ready marker is present.
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
