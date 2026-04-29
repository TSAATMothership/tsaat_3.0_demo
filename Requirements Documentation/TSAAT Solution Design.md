# TSAAT Solution Design

This consolidated solution requirements specification combines the full contents of the Requirements Documentation source set.

## Consolidation Scope
- Source route pages reviewed from app/**/page.tsx.
- Source requirement files included: index plus sections 01 through 13.
- Consolidation date: 2026-04-21.
- Authentication/password settings update note: 2026-04-28.
## Consolidated Content

---

## Source: TSAAT-Solution-Design-Index.md


# TSAAT Solution Design Index

## Application Introduction
TSAAT is a Next.js web application that presents snapshot-based cyber posture, discovery coverage, findings, reporting, and configuration views over a SQL Server-backed data model in schema `tsaat`.

The application follows a shared runtime pattern:

1. Resolve the requested snapshot date from the `dataDate` query parameter when the route is date-scoped.
2. Load the selected dataset snapshot plus measures settings and discovery tool settings.
3. Parse filter query parameters into a common filter object.
4. Build analytics at runtime, including SPI evaluations, discovery coverage results, findings, and rollups.
5. Render page-specific summaries, drillthroughs, exports, and configuration actions.

## Coverage Method
This documentation set was produced by tracing:

- file-system routes under `app/**/page.tsx`
- global navigation in `app/layout.tsx` and `components/menu-navigation.tsx`
- drill-down links from summary tables and detail pages
- query-parameter-driven route states inside the page implementations

Non-route overlays and modal drillthroughs are documented inside the parent page specification where they are implemented. This includes:

- findings history drillthrough
- findings asset-details drillthrough
- compliance overview findings and CVE drillthroughs
- coverage-by-tool slideouts
- network and system summary slideouts
- detailed topology modal views

## Route Inventory
| Route | Navigation / Link Source | Standalone Specification | Notes |
| --- | --- | --- | --- |
| `/` | direct entry only | [01-Home-Redirect.md](01-Home-Redirect.md) | server redirect to `/cyber-cop` |
| `/login` | unauthenticated access gate | [13-Authentication-and-Login.md](13-Authentication-and-Login.md) | credential entry and session start |
| `/cyber-cop` | header navigation | [02-Cyber-COP.md](02-Cyber-COP.md) | client-side tabs inside the page |
| `/networks` | header navigation | [03-Networks.md](03-Networks.md) | query-param tab states |
| `/networks/[networkId]` | networks table drill down | [04-Network-Detail.md](04-Network-Detail.md) | visible tabs plus hidden `cyber-posture` route state |
| `/systems` | header navigation | [05-ICT-Systems.md](05-ICT-Systems.md) | query-param tab states |
| `/systems/[systemId]` | systems table drill down | [06-ICT-System-Detail.md](06-ICT-System-Detail.md) | visible tabs plus latent query-param scope filters |
| `/discovery-coverage` | operations menu | [07-Discovery.md](07-Discovery.md) | summary, coverage-by-network, tool-settings, network-discovery tabs (`target-state` route value retained) |
| `/measures` | operations menu | [08-Measures.md](08-Measures.md) | summary, measures-kpi, measures-spi, spi-settings, kpi-settings tabs |
| `/findings` | operations menu | [09-Findings-and-Evidence.md](09-Findings-and-Evidence.md) | overview/register tabs plus history drillthrough |
| `/report` | operations menu | [10-Report-Catalogue.md](10-Report-Catalogue.md) | report launcher page |
| `/settings` | operations menu | [11-Settings.md](11-Settings.md) | database + password settings plus one placeholder tab |

## Cross-Cutting Specifications
- [12-Asset-Taxonomy-and-SPI-Applicability.md](12-Asset-Taxonomy-and-SPI-Applicability.md): canonical six-type asset taxonomy, SPI applicability contract, settings normalization, and schema-domain requirements.

## Shared Runtime Dependencies
The page specifications repeatedly reference the following shared implementation elements:

- `lib/app-data.ts`: snapshot and settings loading orchestration
- `lib/data-loader.ts`: SQL Server reads and settings persistence
- `lib/analytics.ts`: runtime evaluation, rollup, finding, and compliance assembly
- `lib/asset-taxonomy.ts`: canonical asset type IDs, labels, and ordering
- `lib/selectors.ts`: query-parameter parsing and filter application
- `lib/db-config.ts`: encrypted `DB_config` envelope parsing/normalization/DPAPI encryption
- `lib/database-settings.ts`: database connection, SSL, and schema validation
- `lib/sql-server.ts`: runtime `sqlcmd` execution, bundled path fallback (`Dependencies/external/sqlcmd/win-x64/sqlcmd.exe`), local target normalization (`lpc:`), and SSL flag mapping
- `components/filter-bar.tsx`: common filter UI and loading overlay behaviour
- `components/menu-navigation.tsx`: global menu, route loading overlay, and date picker behaviour

## Shared Data Domains
The most frequently referenced tables across the pages are:

- `tsaat.dataset_snapshot`
- `tsaat.managed_network`
- `tsaat.managed_network_hierarchy`
- `tsaat.network_declared_system`
- `tsaat.network_declared_asset`
- `tsaat.network_target_state_asset`
- `tsaat.ict_system`
- `tsaat.ict_system_hierarchy`
- `tsaat.system_mission_capability`
- `tsaat.system_business_service`
- `tsaat.system_environment`
- `tsaat.system_environment_asset`
- `tsaat.asset`
- `tsaat.asset_operating_system`
- `tsaat.asset_network_os`
- `tsaat.asset_patch_state`
- `tsaat.asset_installed_software`
- `tsaat.asset_vulnerability`
- `tsaat.ci_dependency`
- `tsaat.finding`
- `tsaat.spi_definition`
- `tsaat.spi_applicable_asset_type`
- `tsaat.measures_settings_version`
- `tsaat.measures_severity_matrix`
- `tsaat.discovery_tools_settings_version`
- `tsaat.discovery_tool`
- `tsaat.discovery_tool_asset_scope`

## Known Cross-Page Design Gaps
Several code paths expose implementation gaps that are called out in the individual page specifications:

- `DPE` / `DSE` labels are not implemented consistently across pages.
- some detail pages synthesize fallback metadata and external URLs when source columns are blank.
- some query parameters affect server-rendered scope without a visible in-page control to set them.
- some route states exist in code but are not reachable from the visible tab controls.


---

## Source: 01-Home-Redirect.md


# Home Redirect

**Page Path:** `/`

## 1. Page Overview
- **Page name:** Home Redirect
- **Purpose:** provide a stable application entry point and send the user to the primary dashboard.
- **User outcome:** the user lands on `/cyber-cop` without interacting with a landing page.
- **Primary user roles:** all users entering the application through the root URL.

## 2. Page Summary
The route does not render UI. It immediately executes a server-side redirect to `/cyber-cop`.

Dependencies:

- Next.js `redirect()`
- `/cyber-cop`

## 3. Feature Breakdown
### Feature: Root Route Redirect
- **What it does:** redirects the root route to the Cyber COP dashboard.
- **User perspective:** browsing to `/` opens the Cyber COP page instead of a standalone home screen.
- **System behaviour:** the server component executes `redirect("/cyber-cop")` before rendering.
- **Outcome:** a single canonical landing page is enforced.
- **Rules / validations / error handling:** there is no conditional logic, filter preservation, or fallback path.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home Redirect | Root redirect | Redirects `/` to `/cyber-cop` | Open `/` | Executes `redirect("/cyber-cop")` in the server component | HTTP request to `/` | HTTP redirect response | Root URL always lands on Cyber COP | none | Next.js routing, `/cyber-cop` page | User reaches dashboard | Query parameters are not preserved |

## 5. Database Mapping
This route does not read or write application data. It performs no database access and does not resolve filters, snapshots, or settings.

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home Redirect | Root redirect | N/A | N/A | N/A | N/A | No persisted data used | None | None | Always redirect | None | No DB interaction |

## 7. Calculations and Derived Logic
No calculations are performed.

## 8. Non-Database Calculations
No runtime calculations are performed.

## 9. Rules, Assumptions, and Constraints
- The route is intentionally non-interactive.
- The redirect target is hard-coded to `/cyber-cop`.
- Any query string supplied to `/` is discarded because the redirect target is fixed.

## 10. Open Questions / Gaps
- **Open question:** should `dataDate` or other incoming query parameters be preserved when entering via `/`?
- **Needed to resolve:** product or UX decision for canonical landing-page parameter handling.


---

## Source: 02-Cyber-COP.md


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
- measures settings severity remap
- discovery coverage evaluation from discovery tool settings

## 3. Feature Breakdown
### Feature: Shared Filter Scope and Snapshot Date
- **What it does:** scopes the dashboard by network, ICT system, criticality, security domain, environment, asset type, mission capability, and business service.
- **User perspective:** the user changes filters and the dashboard reloads in place.
- **System behaviour:** query parameters are parsed by `parseFilters()`, date scope is resolved from `dataDate`, and analytics are rebuilt for the selected snapshot. Asset type filters use the shared canonical taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
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
- **System behaviour:** the page derives action counts from open findings, lifecycle data, discovery coverage results, and DIIS modelling flags.
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
- `tsaat.measures_settings_version` and `tsaat.measures_severity_matrix`
- `tsaat.discovery_tools_settings_version`, `tsaat.discovery_tool`, and `tsaat.discovery_tool_asset_scope`

If `tsaat.finding` has no rows for the selected snapshot, the page still shows findings by generating them at runtime from non-compliant SPI evaluations.

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cyber COP | Snapshot selection | `tsaat` | `dataset_snapshot` | `snapshot_id`, `snapshot_date`, `generated_at` | integer, date, datetime | Selects the dataset version | Read | root join for snapshot-aware tables | latest snapshot unless `dataDate` supplied | date-only conversion for display | Shared by all date-scoped pages |
| Cyber COP | Scope context | `tsaat` | `managed_network`, `ict_system` | IDs, names, `criticality`, `security_domain`, ownership columns | string, enum-like | Filter options and scope labels | Read | assets link to network and system IDs | fallback values possible in downstream views | used directly and in rollups | |
| Cyber COP | SPI posture | `tsaat` | `asset`, `asset_operating_system`, `asset_network_os`, `asset_patch_state`, `asset_installed_software`, `asset_vulnerability` | asset identity, OS, patch, software, vulnerability fields | mixed | Drives SPI evaluation and exposure logic | Read | joined by `asset_id` within one snapshot | empty related rows produce partial evidence or `Unknown` outcomes | runtime SPI evaluation | not stored as a precomputed fact table |
| Cyber COP | Findings | `tsaat` | `finding` | IDs, scope columns, `priority_rank`, `severity`, `workflow_status`, timestamps, `evidence` | mixed | Risk charts, counts, action plan | Read | finding scope joins back to asset, system, and network | synthetic fallback if no rows exist | severity may be remapped | |
| Cyber COP | Settings-driven logic | `tsaat` | measures and discovery settings tables | version, severity, tool metadata, scope settings | mixed | Severity remap and discovery compliance | Read | latest settings version applied | defaults if no saved settings exist | settings alter runtime analytics | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Overall compliance | headline posture score | `compliant SPI checks / all SPI checks * 100` | runtime asset evaluations | Runtime | backend | returns `0` when denominator is `0` |
| DPE compliance | dashboard tile | compliant statuses where `environmentType = Production` divided by production statuses | runtime evaluations | Runtime | backend | implementation uses environment type, not security domain |
| DSE compliance | dashboard tile | compliant statuses where `environmentType != Production` and not null divided by non-production statuses | runtime evaluations | Runtime | backend | naming differs from KPI page meaning |
| Networks compliance | dashboard tile | compliant counts across network rollups divided by total rollup counts | runtime rollups | Runtime | backend | returns `0` if no rollups |
| Immediate action | urgent work count | `open High Risk + open Critical Exposure` | findings | Runtime | backend | derived after severity remap |
| Planned remediation | backlog count | count of open findings where `priorityRank` is between `3` and `89` | findings | Runtime | backend | `90` is treated as data-gap / non-priority |
| Weekly risk trend | trend cards | sample every 7 days from a 365-day open-finding series | finding timestamps | Runtime | backend | future dates beyond snapshot show `null` |
| ICT systems modelled coverage | modelling summary | `DIIS-defined systems with modellingStatus = true / DIIS-defined systems * 100` | `ict_system.diis_defined`, `ict_system.modelling_status` | Runtime | backend | `0` if no DIIS-defined systems |
| Findings generation fallback | keep dashboard populated | derive findings from non-compliant or unknown SPI evaluations and assign deterministic severity, priority, and timestamps | asset evaluations and vulnerabilities | Runtime | backend | only used when dataset has no persisted findings |

## 8. Non-Database Calculations
- Client tab selection is held in component state and not persisted.
- Loading progress overlays use synthetic progress increments.
- Leaderboard search is client-side text matching over already-rendered impact rows.
- Daily trend chart labels are UTC-formatted display values derived from runtime date keys.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped through global navigation rather than an in-page date control.
- Severity shown on the page may differ from persisted `finding.severity` because measures settings remap severity by SPI and asset type across the shared six-type taxonomy.
- If the selected scope contains no persisted findings, the page still renders synthetic findings generated from SPI evaluations.
- Tab state is not addressable by URL.

## 10. Open Questions / Gaps
- **Open question:** are `DPE` and `DSE` intended to represent Production and non-Production or Protected and Secret? The dashboard implements the former, while KPI pages implement the latter.
- **Open question:** should the active Cyber COP tab be deep-linkable for reporting and bookmarking?
- **Open question:** are synthetic findings acceptable for production use when `tsaat.finding` is empty, or should the page signal that the findings register is simulated?


---

## Source: 03-Networks.md


# Networks

**Page Path:** `/networks`

## 1. Page Overview
- **Page name:** Networks
- **Purpose:** provide network-scoped overview, action planning, and roll-up posture reporting.
- **User outcome:** the user can compare managed networks, identify the highest-risk network scopes, and drill into network detail.
- **Primary user roles:** network owners, cyber operations analysts, remediation coordinators, reporting users.

## 2. Page Summary
The page is a date-scoped network workbench with three query-parameter-driven tabs: `overview`, `action`, and `posture`.

Major dependencies:

- `getTrendAppData()`
- `NetworksTabs`
- `NetworksOverviewPanel`, `NetworksActionPanel`, `NetworksPostureKpiSummary`
- `NetworksTable`
- `/api/networks/remediation-report`

## 3. Feature Breakdown
### Feature: Shared Network Filter Scope
- **What it does:** filters the page by network, security domain, asset type, mission capability, business service, and date.
- **User perspective:** the user narrows the network estate and all tab content changes together.
- **System behaviour:** the page uses the shared filter model, but intentionally hides ICT system, criticality, and environment selectors from the visible filter bar.
- **Outcome:** the page remains network-centric.

### Feature: Overview Tab
- **What it does:** shows network posture, modelling coverage, risk profile, and daily and weekly trends.
- **User perspective:** the user gets a network-level executive summary.
- **System behaviour:** compliance, modelling, and risk metrics are aggregated from filtered asset evaluations and findings.
- **Outcome:** users can identify whether network scope is improving or degrading.

### Feature: Action Tab
- **What it does:** shows remediation pressure, backlog aging, oldest open findings, quick wins, and a scoped remediation report link.
- **User perspective:** the user can move from network posture to action planning.
- **System behaviour:** the page builds action metrics from open findings, lifecycle data, discovery coverage, and discovery enablement status.
- **Outcome:** the user gets a tactical work queue and export path.

### Feature: Posture Tab
- **What it does:** shows KPI summary cards, blast-radius data, searchable network roll-up table, detail slideout, and drill-down links.
- **User perspective:** the user can compare networks and open either a summary slideout or the full network detail page.
- **System behaviour:** each row combines network metadata, rollup posture, P1/P2 counts, discovery compliance, and drill-down links.
- **Outcome:** the page acts as the routing surface for `/networks/[networkId]`.

### Feature: Blast Radius Selection
- **What it does:** filters the posture table from chart selections.
- **User perspective:** selecting a blast-radius element narrows the table to the chosen network until cleared.
- **System behaviour:** client-side event dispatch and listen links `NetworksPostureKpiSummary` and `NetworksTableClient`.
- **Outcome:** chart interaction and table interaction stay synchronised.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Networks | Tab routing | Switches among overview, action, posture | Click tab | Updates `networksTab` in query string and reloads page | `networksTab` | Different tab layout | overview is default | unsupported values fall back to overview | `NetworksTabs` | URL-addressable tabs | loading overlay displayed |
| Networks | Overview | Network posture summary | Open tab | Aggregates compliance, modelling, severity, and trends | dataset, findings, evaluations | Dashboard cards and charts | network scope only | zero-safe percentages | `getTrendAppData()`, analytics | Executive network view | |
| Networks | Action | Remediation planning | Open tab or generate report | Builds action metrics and remediation report link | findings, lifecycle, discovery status | Action board and PDF link | report reflects current filters | none beyond scope parsing | `/api/networks/remediation-report` | Action planning and export | |
| Networks | Posture table | Roll-up comparison across networks | Search, open slideout, drill down | Builds row model with posture and scores | network rows, rollups, findings | Table, slideout, drill-down link | network list is the primary drill-down source | search is client-side | `NetworksTable`, `NetworksTableClient` | Compare and navigate | slideout uses detail fallback fields |
| Networks | Blast radius filter | Links chart choice to table scope | Select or clear chart item | Event-based client filter | selected network ID | Filtered posture table | chart filter is temporary and client-side | cleared when selection no longer exists | custom browser event | Faster comparison workflow | |

## 5. Database Mapping
The page uses the shared snapshot dataset and findings analytics, then reshapes the data around network scope.

Primary data dependencies:

- `tsaat.managed_network`
- `tsaat.network_declared_system`, `tsaat.network_declared_asset`, and `tsaat.network_target_state_asset`
- `tsaat.asset` and related posture tables
- `tsaat.finding`
- `tsaat.asset_vulnerability`
- discovery and measures settings tables

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Networks | Network identity | `tsaat` | `managed_network` | `network_id`, `name`, `classification`, `criticality`, `discovery_status`, detail columns | string, enum-like | row identity, posture context, slideout metadata | Read | joined to assets and systems by `network_id` | fallback metadata allowed in slideouts | used directly and in drill-down hrefs | |
| Networks | Asset scope | `tsaat` | `asset` | `asset_id`, `asset_type`, `network_id`, lifecycle columns | mixed | network asset counts, discovery coverage, OS and warranty metrics | Read | asset belongs to one network | filtered through shared filter model | runtime counts and percentages | canonical `asset_type` values are `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other` |
| Networks | Findings | `tsaat` | `finding` | scope columns, `priority_rank`, `severity`, timestamps | mixed | overview risk profile and action metrics | Read | grouped by `network_id` | findings may be generated when table empty | severity remapped before use | |
| Networks | Relationships | `tsaat` | `network_declared_system`, `network_declared_asset`, `network_target_state_asset` | `network_id`, `system_id`, `asset_id`, `asset_type`, `asset_name` | string | declared/discovered scope and target-state planning context | Read | same snapshot joins | target-state rows are name-only by asset type | informational scope support | target-state records are consumed directly by discovery network summary matching |
| Networks | Discovery settings | `tsaat` | discovery settings tables | version and tool scope columns | mixed | discovery compliance score by network | Read | latest settings version applied to all evaluations | defaults if no saved settings exist | runtime evaluation only | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Networks compliance | overview posture tile | compliant network rollup counts divided by all network rollup counts | runtime network rollups | Runtime | backend | returns `0` with no rollups |
| Discovery compliance by network | posture table and KPI summary | `discovery-compliant asset evaluations / total asset evaluations in network * 100` | runtime evaluations | Runtime | backend | only assets with evaluations contribute |
| Modelled network coverage | overview modelling card | networks where `discoveryStatus != "Discovery Non Enabled"` divided by total networks | `managed_network.discovery_status` | Runtime | backend | implemented as discovery enablement proxy |
| Blast radius points | posture chart input | endpoint count per network plus high-risk P1/P2 finding count | assets, findings | Runtime | backend | sorted by endpoint count, then severe findings |
| Immediate action | action tab | open High Risk + open Critical Exposure findings | findings | Runtime | backend | severity remap already applied |
| Non-compliant OS count | action tab | count server and workstation evaluations with SPI 1 or 2 = `Non-compliant` | runtime evaluations | Runtime | backend | `network-device`, `storage-device`, `printer-device`, and `other` are excluded because they do not evaluate SPI 1/2 |
| Weekly throughput | action tab | weekly opened count, closed count, and `opened - closed` across last 13 weeks | finding timestamps | Runtime | backend | weekly buckets are fixed 7-day windows |
| Quick wins | action tab | group open findings by identical recommended action text | findings | Runtime | backend | missing actions grouped to a default label |

## 8. Non-Database Calculations
- Tab loading overlay progress is synthetic.
- Blast-radius selection and table search are client-side only.
- Posture slideout content is rendered from the already loaded row model.
- The remediation report URL is assembled from the current query string; no server call occurs until the user opens the link.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- ICT system, environment, and criticality are intentionally hidden from the visible filter bar.
- The posture tab is the source of drill-down navigation into network detail.
- Summary slideouts and posture rows may show fallback metadata when source fields are blank.

## 10. Open Questions / Gaps
- **Open question:** should the `DPE` and `DSE` labels in the overview reflect environment type or security domain? The implementation follows environment type.
- **Open question:** is `discovery_status` intended to be the authoritative proxy for modelled-network coverage on this page?
- **Open question:** should the posture slideout and full drill-down page always show the same metadata source, or should fallback-generated values be visually marked?


---

## Source: 04-Network-Detail.md


# Network Detail

**Page Path:** `/networks/[networkId]`

## 1. Page Overview
- **Page name:** Network Detail
- **Purpose:** provide a drill-through page for one managed network, combining metadata, compliance, discovery coverage, topology, and backlog views.
- **User outcome:** the user can inspect one network in depth and move from summary posture to asset-level and finding-level evidence.
- **Primary user roles:** network owners, cyber analysts, remediation coordinators, architecture and assurance teams.

## 2. Page Summary
The page is a date-scoped drill-through for a single managed network. It supports visible route states for `network-details`, `compliance-overview`, and `discovery-compliance`.

The page also contains a latent route state: `cyber-posture`.

Major dependencies:

- direct snapshot loading plus measures and discovery settings
- `NetworkDetailTabs`
- `NetworkComplianceOverview`
- `DetailedTopologyView`
- `/api/networks/[networkId]/discovery-coverage-export`
- `/api/networks/[networkId]/remediation-report`

## 3. Feature Breakdown
### Feature: Header, Breadcrumb, and Shared Drill-Through Scope
- **What it does:** identifies the selected network, exposes the back link, and shows current scope badges.
- **User perspective:** the user can confirm the network and return to the networks posture list.
- **System behaviour:** the page resolves the route parameter, scopes analytics to the network, and recalculates compliance and discovery scores for the active drill-through context.
- **Outcome:** all downstream tabs share one network anchor.

### Feature: Visible Tab Navigation and Detailed Topology Modal
- **What it does:** switches among visible tabs and opens a topology modal.
- **User perspective:** the user can move between metadata, compliance, and discovery views, and open a richer topology representation.
- **System behaviour:** `networkDetailTab` in the query string controls the main tab; the topology view is a client-side modal fed by runtime topology data built from snapshot relationships and CI dependencies.
- **Outcome:** tab states are bookmarkable; topology is not.

### Feature: Network Details Tab
- **What it does:** shows network metadata, service links, security accreditation links, and stacked risk charts.
- **User perspective:** the user sees descriptive context and current risk profile together.
- **System behaviour:** network detail fields are resolved from DB columns when present, otherwise synthesized from the network ID and name.
- **Outcome:** the tab acts as the narrative and ownership view for the network.

### Feature: Compliance Overview Tab
- **What it does:** shows per-SPI compliance rows and a deep drillthrough to findings, affected assets, and high-risk CVE details.
- **User perspective:** the user can inspect the reasons a network is non-compliant and open evidence-heavy side panels.
- **System behaviour:** runtime measure rows and findings are passed into `NetworkComplianceOverview`, which supports additional non-route drillthrough layers.
- **Outcome:** the page exposes evidence behind the network posture score.

### Feature: Discovery Compliance Tab
- **What it does:** shows discovery tool scorecards and a searchable asset coverage table, with CSV export.
- **User perspective:** the user can see exactly which assets fail required tool coverage and export that list.
- **System behaviour:** discovery coverage is evaluated per asset from runtime settings; query params support search, asset-type filtering, tool filtering, and pagination. Asset-type filtering uses the shared six-type taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
- **Outcome:** discovery remediation can be actioned at asset level.

### Feature: Hidden `cyber-posture` Route State
- **What it does:** renders KPI snapshot tiles, asset inventory, and P1/P2 findings filters when `networkDetailTab=cyber-posture`.
- **User perspective:** this state is not reachable from the visible tab strip, but it can be opened by direct URL.
- **System behaviour:** the server component accepts the route state and renders it fully, including KPI filters, pagination, and findings filtering.
- **Outcome:** latent behaviour exists in production code and must be documented.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Network Detail | Shared scope header | Identifies selected network and current KPI filter state | Open page or adjust query params | Rebuilds scoped analytics and badges | route param, `dataDate`, `kpiFilter` | Header scores and badges | all tabs share same network anchor | invalid route param returns not-found earlier in page load | snapshot loader, route param | Stable drill-through context | |
| Network Detail | Tab routing | Switches among visible tabs | Click tab | Updates `networkDetailTab` and reloads | `networkDetailTab` | Different drill-through layout | default tab is `network-details` | unsupported values fall back to default except hidden state is accepted explicitly | `NetworkDetailTabs` | Bookmarkable tab states | topology modal state is local |
| Network Detail | Network Details tab | Metadata and risk charts | Open tab | Resolves metadata, renders links and stacked risk charts | network detail fields, findings | Ownership and risk context | metadata may fall back when source columns blank | none | `resolveNetworkDetailFields()`, risk charts | Narrative network view | support and service links may be synthetic |
| Network Detail | Compliance Overview | SPI measure table with findings drillthroughs | Open tab, click a measure, click finding title, optionally click CVE count | Opens layered overlays for findings, linked assets, and CVE details | measures, findings, asset vulnerability index | Evidence drillthrough chain | evidence must reflect the selected `asOf` date | filtering is runtime only | `NetworkComplianceOverview` | Explains non-compliance | Non-route multi-step drillthrough |
| Network Detail | Discovery Compliance | Tool scorecards, search, filters, export | Filter table, click tool tiles, export CSV | Applies discovery filters via query string and exports current scope | `discoverySearch`, `discoveryAssetType`, `discoveryToolFilter`, `page` | Asset coverage table and CSV | coverage is based on required tools only | invalid tool filter ignored | discovery settings, export API | Discovery remediation list | `discoveryAssetType` accepts all six canonical asset types |
| Network Detail | Hidden cyber posture | KPI snapshot, asset inventory, P1/P2 findings | Directly navigate with `networkDetailTab=cyber-posture` | Renders hidden section with KPI filters and lists | `kpiFilter`, `inventoryPage`, `p12*` | Hidden drill-through surface | route is accepted even though UI tab is absent | unsupported KPI filters ignored | snapshot history, findings, assets | Additional analysis state | latent and undocumented UI state |

## 5. Database Mapping
This page reads a broad slice of the model because it combines metadata, evidence, discovery coverage, topology, and findings drillthrough.

Key dependencies:

- `tsaat.managed_network` and `tsaat.managed_network_hierarchy`
- `tsaat.network_declared_system` and `tsaat.network_declared_asset`
- `tsaat.ict_system` plus mission and service relationships
- `tsaat.asset` and all posture-related child tables
- `tsaat.finding`
- `tsaat.ci_dependency`
- measures and discovery settings tables

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Network Detail | Network metadata | `tsaat` | `managed_network` | `network_id`, `name`, `classification`, ownership and link columns, `discovery_status` | mixed | header, details tab, discovery summary | Read | root network record for page | fallback values generated when blank | direct display | |
| Network Detail | Network hierarchy and topology | `tsaat` | `managed_network_hierarchy`, `ict_system_hierarchy`, `network_declared_system`, `network_declared_asset`, `ci_dependency` | parent-child keys and dependency fields | string, enum-like | topology modal and relationship context | Read | combined into topology graph | no persisted graph view | runtime graph build | topology includes synthetic relation edges |
| Network Detail | Asset evidence | `tsaat` | `asset`, child posture tables, `asset_vulnerability` | asset identity, OS, patch, software, vulnerability fields | mixed | compliance overview, discovery table, asset inventory | Read | joined by `asset_id` inside one snapshot | assets filtered by network and optional KPI filters | runtime SPI, exposure, and discovery evaluation | |
| Network Detail | Findings | `tsaat` | `finding` | IDs, scope columns, `priority_rank`, `severity`, timestamps, `evidence`, `recommended_action` | mixed | compliance drillthroughs, hidden cyber posture, risk charts | Read | findings linked to assets, systems, and network | synthetic fallback if no rows loaded | severity remap applied at runtime | |
| Network Detail | Settings-driven logic | `tsaat` | measures and discovery settings tables | version and detail columns | mixed | compliance severity and discovery rules | Read | latest settings versions applied | defaults if settings tables are empty | runtime only | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Header compliance score | top-right summary donut | compliant statuses divided by total statuses in current drill-through context | runtime evaluations or compliance-overview subset | Runtime | backend | switches source when compliance overview tab is active |
| Discovery compliance score | top-right discovery donut | compliant discovery rows divided by compliant + non-compliant + other rows | runtime discovery coverage rows | Runtime | backend | `other` bucket covers N/A or no-applicability states |
| Compliance overview measure score | per-SPI analysis | compliant count divided by total evaluations for the SPI | runtime measure rows | Runtime | backend | zero-safe |
| KPI snapshot tiles | hidden cyber-posture analysis | count assets or findings matching each KPI filter over current network scope; trend uses last 12 snapshots | assets, findings, snapshot history | Runtime | backend | hidden route state only |
| Discovery tool scorecards | discovery tab tool summary | covered assets divided by applicable assets per tool | discovery coverage rows | Runtime | backend | asset type scope can mark a tool as N/A |
| Asset coverage compliance | discovery table | `coverageCompliance = missing required tools count == 0` | discovery settings plus asset evidence | Runtime | backend | N/A tools do not count against compliance |
| Asset inventory critical vulnerability count | hidden cyber-posture inventory | count vulnerabilities where `severity = Critical` per asset | `asset_vulnerability` | Runtime | backend | hidden route state only |
| Findings drillthrough history | compliance overview panel | reconstruct open count over two years from finding open and close timestamps | findings | Runtime | backend and client | uses `workflowStatusAtAsOf` |

## 8. Non-Database Calculations
- `DetailedTopologyView` creates runtime graph layouts and client-only interactions from already-loaded topology data.
- Compliance overview side panels, asset detail overlays, and CVE detail modal are client-only UI states.
- Hidden cyber-posture P1/P2 findings list caps visible rows at `80`.
- Discovery search, tool filter, and asset-type filter are query-parameter-driven view filters over the already selected snapshot.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- The visible tab strip does not expose every route state the page supports.
- Discovery CSV export is scoped to the current network and current discovery query state.
- Metadata fields may be synthetic when source columns are blank.
- The page combines server-rendered scope logic with client-only overlay drillthroughs.

## 10. Open Questions / Gaps
- **Open question:** should `networkDetailTab=cyber-posture` remain supported if it is not reachable from the visible tab bar?
- **Open question:** should generated fallback values for owner, support email, service catalogue URL, ATO, DIIS, and GRC be visually marked as inferred values?
- **Open question:** is the topology modal intended to be a read-only analysis surface, or should it support the same exports and filters as the parent page?


---

## Source: 05-ICT-Systems.md


# ICT Systems

**Page Path:** `/systems`

## 1. Page Overview
- **Page name:** ICT Systems
- **Purpose:** provide system-scoped overview, remediation, and posture roll-up reporting.
- **User outcome:** the user can compare ICT systems, identify modelling and discovery gaps, and drill into one system.
- **Primary user roles:** ICT system owners, cyber operations analysts, service delivery teams, governance users.

## 2. Page Summary
This page is the ICT-system equivalent of `/networks`. It provides `overview`, `action`, and `posture` tabs.

Major dependencies:

- `getTrendAppData()`
- `SystemsTabs`
- `SystemsOverviewPanel`, `SystemsActionPanel`, `SystemsPostureKpiSummary`
- `SystemsTable`
- `/api/systems/remediation-report`

Important hidden behaviour:

- the page explicitly strips the `network` query parameter before loading data so the systems view remains system-centric.

## 3. Feature Breakdown
### Feature: Shared ICT System Filter Scope
- **What it does:** filters the page by ICT system, criticality, security domain, environment, asset type, mission capability, business service, and date.
- **User perspective:** the user scopes the estate to the relevant systems and supporting context.
- **System behaviour:** the page hides the managed-network selector and removes any incoming `network` query parameter before data loading.
- **Outcome:** the page does not act as a network-filtered derivative view.

### Feature: Overview Tab
- **What it does:** shows overall posture, modelling coverage, risk profile, and trends for the current ICT system scope.
- **User perspective:** the user gets a system-focused summary.
- **System behaviour:** runtime calculations aggregate findings and evaluations by system.
- **Outcome:** users can compare posture and pressure at system level.

### Feature: Action Tab
- **What it does:** shows remediation pressure, backlog age, oldest findings, quick wins, and a remediation report link.
- **User perspective:** the user can turn posture into an action plan for ICT systems.
- **System behaviour:** the page calculates system-scoped backlog metrics and assembles a report URL using current filters.
- **Outcome:** the action surface matches current filters exactly.

### Feature: Posture Tab
- **What it does:** shows system KPI cards, blast radius chart inputs, a searchable system table, summary slideout, and drill-down links.
- **User perspective:** the user can compare systems, inspect a quick summary, or navigate to the full detail page.
- **System behaviour:** each row includes overall posture, production posture, compliance score, discovery score, and drill-down link.
- **Outcome:** this page is the main routing surface for `/systems/[systemId]`.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ICT Systems | Tab routing | Switches among overview, action, posture | Click tab | Updates `systemsTab` query parameter | `systemsTab` | Different tab layout | overview is default | unsupported values fall back to overview | `SystemsTabs` | Bookmarkable tab state | |
| ICT Systems | Shared scope | Common filter scope for systems | Apply filters | Re-runs analytics without using incoming `network` filter | filter query params except `network` | Filtered systems view | page ignores managed network as a controlling input | query parsing only | `FilterBar`, `getTrendAppData()` | System-centric view | hidden implementation rule |
| ICT Systems | Overview | System posture dashboard | Open tab | Builds system compliance, modelling, and risk summaries | systems, findings, evaluations | Dashboard cards and charts | system scope only | zero-safe percentages | analytics and trend snapshots | System summary | |
| ICT Systems | Action | Remediation board | Open tab or generate report | Calculates backlog and links to report endpoint | findings, lifecycle, modelling flags | Action board and PDF link | report reflects current filters | none beyond scope parsing | `/api/systems/remediation-report` | Action planning | |
| ICT Systems | Posture table | Roll-up comparison and drill-down surface | Search, open slideout, drill down | Builds row model for each system | system rows, rollups, scores | Table, slideout, drill-down link | one row per system | search is client-side | `SystemsTable`, `SystemsTableClient` | Compare systems and navigate | slideout uses fallback metadata |

## 5. Database Mapping
The page reads the shared snapshot dataset, then re-aggregates it around ICT systems rather than managed networks.

Primary data dependencies:

- `tsaat.ict_system`
- `tsaat.system_mission_capability` and `tsaat.system_business_service`
- `tsaat.system_environment` and `tsaat.system_environment_asset`
- `tsaat.asset` and child posture tables
- `tsaat.finding`
- measures and discovery settings tables

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ICT Systems | System identity | `tsaat` | `ict_system` | `system_id`, `name`, `criticality`, `security_domain`, `modelling_status`, `diis_defined`, detail columns | mixed | row identity, posture context, slideout data | Read | assets and findings join via `system_id` | fallback metadata allowed | direct display and rollups | |
| ICT Systems | Mission and service context | `tsaat` | `system_mission_capability`, `system_business_service` | IDs, names, criticality | string | posture table columns and slideout context | Read | one system to many capabilities and services | none | joined into comma-separated labels | |
| ICT Systems | Environment scope | `tsaat` | `system_environment`, `system_environment_asset` | `environment_id`, `environment_type`, `asset_id` | string | production posture and discovery scope | Read | environment rows tie systems to assets | none | environment-aware counts | |
| ICT Systems | Asset posture | `tsaat` | `asset` and child posture tables | asset identity, lifecycle, OS, software, vulnerability columns | mixed | compliance scores, discovery scores, action metrics | Read | system-scoped through asset context | filtered through shared scope | runtime evaluation and counts | canonical `asset_type` values are `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other` |
| ICT Systems | Findings | `tsaat` | `finding` | scope columns, severity, priority, timestamps | mixed | risk summaries and action metrics | Read | grouped by `system_id` | severity remap applies | runtime only | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Systems compliance | overview tile | compliant system rollup counts divided by total system rollup counts | runtime system rollups | Runtime | backend | zero-safe |
| Compliance score by system | posture table | compliant statuses in system divided by total statuses in system | runtime evaluations | Runtime | backend | separate from overall posture precedence |
| Discovery compliance by system | posture table | compliant discovery evaluations in system divided by total evaluations in system | runtime evaluations | Runtime | backend | requires at least one evaluated asset |
| Production posture | posture table | `deriveOverallStatus()` over production environment rollups for the system | environment rollups | Runtime | backend | returns `Unknown` if no production rollups |
| Modelled system coverage | overview modelling card | systems with `modellingStatus = true` divided by total systems | `ict_system.modelling_status` | Runtime | backend | not limited to `diis_defined` here |
| Immediate action | action tab | open High Risk + open Critical Exposure findings | findings | Runtime | backend | severity remap already applied |
| Non-compliant OS count | action tab | count server and workstation evaluations with SPI 1 or 2 = `Non-compliant` in system scope | runtime evaluations | Runtime | backend | `network-device`, `storage-device`, `printer-device`, and `other` are excluded because they do not evaluate SPI 1/2 |
| Quick wins | action tab | group open findings by identical recommended action text and count affected systems | findings | Runtime | backend | missing action text grouped to a default label |

## 8. Non-Database Calculations
- The page strips `network` from incoming query parameters before data loading.
- Blast-radius selection and table search are client-side only.
- Slideout data comes from the in-memory row model, not an extra API call.
- Report links are assembled from the current query string and executed only when opened.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- The visible filter bar intentionally hides the managed-network selector.
- The server implementation also ignores incoming `network` filters.
- Slideouts may show fallback-generated metadata where source system fields are blank.

## 10. Open Questions / Gaps
- **Open question:** should the page continue to ignore incoming `network` filters, or should cross-navigation from a network view be able to scope systems by parent network?
- **Open question:** should overview `DPE` and `DSE` labels use environment type or security domain? The implementation follows environment type, which differs from KPI definitions.
- **Open question:** should the production-posture column explain that it is calculated from production environment rollups rather than a separate stored field?


---

## Source: 06-ICT-System-Detail.md


# ICT System Detail

**Page Path:** `/systems/[systemId]`

## 1. Page Overview
- **Page name:** ICT System Detail
- **Purpose:** provide a drill-through page for one ICT system, combining metadata, accreditation context, compliance evidence, discovery coverage, and topology.
- **User outcome:** the user can inspect one system in depth, understand its operational and accreditation context, and trace posture issues to environment and asset level.
- **Primary user roles:** ICT system owners, service delivery teams, cyber analysts, remediation coordinators, architecture and assurance teams.

## 2. Page Summary
The page is a date-scoped drill-through for a single ICT system. It supports visible route states for `system-details`, `compliance-overview`, and `discovery-compliance`.

Major dependencies:

- direct snapshot loading plus measures and discovery settings
- `SystemDetailTabs`
- `NetworkComplianceOverview`
- `DetailedTopologyView`
- `NetworkDetailRiskCharts`
- runtime topology generation from dataset relationships and CI dependencies

Important hidden behaviour:

- the page accepts `environment`, `serverSearch`, and `kpiFilter` query parameters and applies them server-side even though no visible in-page control currently exposes them.
- several descriptive fields and reference URLs are synthesised when source columns are blank.
- KPI trend series and some scoped helper links are computed in code but not rendered in the visible UI.

## 3. Feature Breakdown
### Feature: Header, Breadcrumb, and Shared Drill-Through Scope
- **What it does:** identifies the selected ICT system, exposes the back link, shows scope badges, and recalculates headline scores.
- **User perspective:** the user confirms the selected system, its parent network, current scope, and whether hidden scope filters are active.
- **System behaviour:** the route parameter anchors the page to one system; optional `environment`, `serverSearch`, and `kpiFilter` parameters reduce the effective asset and finding scope before downstream tabs render.
- **Outcome:** every downstream tab shares one scoped system context.

### Feature: Visible Tab Navigation and Detailed Topology Modal
- **What it does:** switches between visible tabs and opens the detailed topology modal.
- **User perspective:** the user can move between metadata, compliance evidence, and discovery coverage, and open a richer topology surface for CI relationships.
- **System behaviour:** `systemDetailTab` in the query string controls the main visible tab; the topology modal is client-side only and receives runtime topology data built from the snapshot model.
- **Outcome:** tab states are bookmarkable; topology modal state is not.

### Feature: System Details Tab
- **What it does:** shows description, owner, support, service catalogue links, accreditation data, APM details, DIIS details, mission capabilities, business services, and risk charts.
- **User perspective:** the user gets the narrative and ownership context for the selected system.
- **System behaviour:** the page uses source columns where present and fills gaps with deterministic fallback values based on the system ID and name.
- **Outcome:** the tab acts as the business and support profile for the system.

### Feature: Compliance Overview Tab
- **What it does:** shows per-SPI compliance rows and deep drillthroughs to findings, affected assets, and high-risk CVE detail.
- **User perspective:** the user can inspect why the system is non-compliant and navigate from summary measures into evidence.
- **System behaviour:** the system detail page reuses `NetworkComplianceOverview`, passing system-scoped measures, findings, and high-risk CVE indexes.
- **Outcome:** the page exposes the evidence behind the system posture score.

### Feature: Discovery Compliance Tab
- **What it does:** shows discovery tool scorecards and a paginated asset coverage table for the current system scope.
- **User perspective:** the user can see which in-scope assets fail required discovery tool coverage.
- **System behaviour:** tool values are derived at runtime from discovery settings and asset evidence; pagination uses `coveragePage` and `coveragePageSize`. Asset rows and tool applicability respect the shared six-type asset taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
- **Outcome:** discovery gaps can be actioned at asset level.

### Feature: Latent Query-Driven Scope States
- **What it does:** accepts environment, KPI, server-search, and P1/P2 finding filter parameters through the URL.
- **User perspective:** users can reach narrower scopes by direct URL or linked query state, but not all controls are visibly rendered on the page.
- **System behaviour:** the server filters assets, counts, discovery rows, and findings before the visible tab content is rendered.
- **Outcome:** bookmarkable hidden scopes exist and materially change scores and lists.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ICT System Detail | Shared scope header | Identifies selected system and current hidden scope filters | Open page or alter query params | Rebuilds scoped analytics and header badges | route param, `dataDate`, `environment`, `serverSearch`, `kpiFilter` | Header scores and badges | all tabs share one system anchor | invalid system route returns not-found | snapshot loader, route param | Stable drill-through context | hidden scope filters are visible only as badges |
| ICT System Detail | Tab routing | Switches among visible tabs | Click tab | Updates `systemDetailTab` and reloads | `systemDetailTab` | Different drill-through layout | default tab is `system-details` | unsupported values fall back to default | `SystemDetailTabs` | Bookmarkable tab state | topology modal state is local |
| ICT System Detail | System Details tab | Metadata, accreditation, service context, risk charts | Open tab | Resolves details, links, and risk profile | system columns, mission and service links, findings | Narrative and ownership view | fallback metadata allowed when source columns blank | none | `NetworkDetailRiskCharts`, Link components | Operational context | several URLs are synthetic fallbacks |
| ICT System Detail | Compliance Overview | SPI table with findings and CVE drillthroughs | Open tab, click measure, finding, asset, or CVE count | Opens layered overlays over system-scoped evidence | measures, findings, asset vulnerability index | Evidence drillthrough chain | evidence respects selected `dataDate` | runtime filtering only | `NetworkComplianceOverview` | Explains non-compliance | non-route layered drillthrough |
| ICT System Detail | Discovery Compliance | Tool cards and asset coverage list | Open tab, paginate | Evaluates tool coverage per asset and paginates results | discovery settings, scoped assets, `coveragePage` | Coverage cards and table | coverage is based on required tools only | invalid page values clamp through pagination helper | discovery settings | Discovery remediation list | no export action is exposed here; all six canonical asset types are supported |
| ICT System Detail | Hidden scope parameters | Direct-URL scoping for environment, KPI, server search, and P1/P2 list | Navigate with query params | Narrows assets, counts, and findings before render | `environment`, `serverSearch`, `kpiFilter`, `p12*`, `page`, `findingsPage*` | Narrowed system view | server-side scope applies even without visible controls | invalid environment or KPI values are ignored | pagination helper, runtime analytics | Bookmarkable hidden scope states | calculated helper links exist even where not rendered |

## 5. Database Mapping
This page reads a broad slice of the model because it combines metadata, accreditation context, discovery coverage, topology, and evidence drillthrough.

Key dependencies:

- `tsaat.ict_system` and `tsaat.ict_system_hierarchy`
- `tsaat.system_mission_capability`, `tsaat.system_business_service`, `tsaat.system_environment`, and `tsaat.system_environment_asset`
- `tsaat.asset` and all posture-related child tables
- `tsaat.finding`
- `tsaat.ci_dependency`
- measures and discovery settings tables

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ICT System Detail | System metadata | `tsaat` | `ict_system` | `system_id`, `network_id`, `name`, `criticality`, `security_domain`, description, ownership and link columns, `diis_id`, `ato_number`, `modelling_status`, `diis_defined` | mixed | header, details tab, accreditation tables | Read | root record for the page | fallback values generated when blank | direct display | synthetic support and reference URLs may appear |
| ICT System Detail | Mission, service, and environment context | `tsaat` | `system_mission_capability`, `system_business_service`, `system_environment`, `system_environment_asset` | IDs, names, `criticality`, `environment_type`, `asset_id` | mixed | mission/service lists, scope badges, environment-aware counts | Read | one system to many related rows | environment filter must match a defined environment type | joined into lists and scoped counts | |
| ICT System Detail | Asset posture | `tsaat` | `asset`, `asset_operating_system`, `asset_network_os`, `asset_patch_state`, `asset_installed_software`, `asset_vulnerability` | asset identity, lifecycle, OS, patch, software, vulnerability fields | mixed | compliance rows, discovery rows, risk charts | Read | scoped to assets where `asset.system_id = system_id` | hidden query parameters may narrow further | runtime SPI and discovery evaluation | |
| ICT System Detail | Findings | `tsaat` | `finding` | IDs, scope columns, `priority_rank`, `severity`, timestamps, `evidence`, `recommended_action` | mixed | compliance drillthroughs, risk charts, P1/P2 filters | Read | findings linked to assets and system via scope columns | severity remap applies at runtime | workflow reconstructed for as-of logic in reused components | |
| ICT System Detail | Topology relationships | `tsaat` | `ict_system_hierarchy`, `ci_dependency`, `network_declared_asset`, `network_declared_system` | parent-child keys, dependency endpoints, declared relationship keys | mixed | topology modal and relationship context | Read | combined into a runtime graph | no persisted graph view | runtime topology layout only | |
| ICT System Detail | Settings-driven logic | `tsaat` | measures and discovery settings tables | version and detail columns | mixed | compliance severity and discovery rules | Read | latest settings version applied | defaults if settings tables are empty | runtime only | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Header compliance score | top summary donut | compliant statuses divided by total statuses in current system drill-through context | runtime evaluations | Runtime | backend | zero-safe; scope changes with hidden query params |
| Discovery compliance score | top discovery donut | compliant discovery rows divided by compliant + non-compliant + other rows | runtime discovery coverage rows | Runtime | backend | `other` covers N/A and non-applicable tool slots |
| Selected posture badge | header status badge | `Non-compliant` takes precedence over `Unknown`, otherwise `Compliant` | runtime scoped statuses | Runtime | backend | returns `Unknown` when no scoped statuses exist |
| Environment card posture | environment-level rollup | apply posture precedence across evaluations within each environment | runtime evaluations plus system environments | Runtime | backend | helper is calculated even where no visible control exposes environment drilldown |
| System weekly risk trend | stacked risk chart | for each of 13 weekly points, count High Risk and Critical Exposure findings open on that date | findings timestamps and close timestamps | Runtime | backend | future points beyond available data return `null` |
| Discovery tool scorecards | discovery tab summary | covered assets divided by total applicable assets per tool | discovery coverage rows | Runtime | backend | asset-type scope can make a tool N/A |
| Asset discovery compliance | discovery table | `coverageCompliance = missing required tools count == 0` | discovery settings plus asset evidence | Runtime | backend | N/A tools do not count against compliance |
| P1/P2 findings filters | hidden scoped list | filter by SPI, priority, severity, search term, environment, and KPI-matched assets | findings plus request params | Runtime | backend | page contains this logic even though the list is not exposed as a separate visible tab |

## 8. Non-Database Calculations
- `DetailedTopologyView` creates runtime graph layouts and modal-only interactions from already loaded topology data.
- The page synthesises description, owner, support email, service catalogue URL, ATO, DIIS, GRC, and APM values when source columns are blank.
- Query-driven scopes for `environment`, `serverSearch`, and `kpiFilter` are runtime view filters over the selected snapshot, not persisted state.
- Several helper links and KPI trend series are calculated in code but not currently rendered in the visible UI.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- The visible tab strip exposes only three tabs.
- Hidden query parameters materially affect counts, lists, and headline scores.
- Discovery coverage is evaluated from current discovery tool settings, not from persisted per-tool result rows.
- Fallback metadata and URLs may be synthetic rather than sourced from the database.

## 10. Open Questions / Gaps
- **Open question:** should the page expose visible controls for `environment`, `serverSearch`, and `kpiFilter`, or are these route states intended to remain hidden?
- **Open question:** should generated fallback values for support, accreditation, DIIS, GRC, and APM be visually marked as inferred values?
- **Open question:** should the currently calculated KPI trend series and scoped helper links be surfaced in the UI, or removed if they are not part of the intended design?


---

## Source: 07-Discovery.md


# Discovery

**Page Path:** `/discovery-coverage`

## 1. Page Overview
- **Page name:** Discovery
- **Purpose:** provide enterprise-level visibility of discovery tooling coverage, target-state coverage, and the configurable discovery tool model used by the application.
- **User outcome:** the user can understand current discovery gaps, compare networks against target-state expectations, and maintain the tool configuration that drives discovery compliance.
- **Primary user roles:** discovery tool owners, CMDB and asset inventory teams, cyber analysts, architecture teams, platform governance teams.

## 2. Page Summary
This page is the discovery-coverage workspace. It provides `summary`, `coverage-by-network`, `tool-settings`, and `target-state` route states. In UI labels this appears as:

- `Discovery Tool Coverage`
- `Discovery Tool Coverage - by Network`
- `Discovery Tools Setting`
- `Network Discovery Status` (route value remains `target-state`)

Major dependencies:

- `getCoreAppData()`
- `DiscoveryCoverageTabs`
- `DiscoveryCoverageByToolSection`
- `DiscoveryCoverageByNetworkSection`
- `NetworkDiscoverySummaryTableClient`
- `DiscoveryToolsSettingsPanel`
- `/api/discovery-coverage/remediation-report`
- `/api/discovery-coverage/tool-assets`
- `/api/discovery-tools/settings`

Important hidden behaviour:

- the page always removes `criticality` before loading analytics.
- when `discoveryCoverageTab=target-state`, the page also removes `system` and `environment` before loading analytics.
- network-discovery target-state comparisons are calculated from DB-backed target-state asset-name records using name + asset-type matching.

## 3. Feature Breakdown
### Feature: Shared Discovery Filter Scope
- **What it does:** filters the page by network, system, security domain, environment, asset type, mission capability, business service, and date.
- **User perspective:** the user scopes the discovery view to a subset of the estate.
- **System behaviour:** the server strips `criticality` for all discovery views and additionally strips `system` and `environment` when the target-state tab is active; asset type options use the shared six-type taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
- **Outcome:** some user-supplied filter state is intentionally ignored by the page.

### Feature: Summary Tab
- **What it does:** shows remediation-report access, current coverage snapshot cards, and discovery coverage by tool.
- **User perspective:** the user sees the current discovery gap picture first and can open a remediation report.
- **System behaviour:** the page builds in-scope asset rows, calculates compliant and non-compliant counts, and assembles a report URL that preserves the current discovery scope.
- **Outcome:** the summary tab acts as the operational view of current discovery coverage.

### Feature: Coverage-by-Tool Drillthrough
- **What it does:** shows tool-level coverage statistics, a radar chart, and a slideout of asset rows for one selected tool.
- **User perspective:** the user can click a tool, inspect assets missing that tool, filter within the slideout, and export CSV.
- **System behaviour:** the client fetches paged rows from `/api/discovery-coverage/tool-assets` using the current page filters plus `toolId`, `toolSearch`, `toolAssetType`, `page`, and `pageSize`.
- **Outcome:** discovery gaps can be traced to tool-by-asset detail without leaving the page.

### Feature: Coverage-by-Network Tab
- **What it does:** shows row-per-network tool coverage with network metadata, a per-network coverage-by-tool radar chart, a per-tool coverage table, and a network drill-down link.
- **User perspective:** the user can review discovery coverage posture across networks without opening a slideout, including owner, accreditation details, and security domain.
- **System behaviour:** rows are aggregated from scoped assets and tool coverage results per network; metadata uses network-detail resolver fallbacks where source values are blank; each row reuses the shared coverage-by-tool radar component with network-scoped data points and provides a drill-down link to `/networks/[networkId]` while preserving `dataDate` and opening in a new window. The filter container shows a right-aligned `Total Network` count based on the currently filtered row set.
- **Outcome:** network-level operational coverage review is available as a first-class tab.

### Feature: Network Discovery Tab
- **What it does:** shows `Network Discovery Summary` table only.
- **User perspective:** the user sees discovery-enabled status, a drill-down link per network row, and per-asset-type target/discovered totals with charted target-vs-discovered comparisons.
- **System behaviour:** discovered assets are matched to target-state assets using trim+lowercase name matching plus exact asset type; summary cells render grouped bars when either target or discovered sets exist, and one-sided cells show `Target State Missing` or `Discovery Missing` as a compact callout below the chart. The combined `Target State Missing + Discovery Missing` state remains message-only with no chart. The filter container shows a right-aligned `Total Network` count based on the currently filtered network-discovery rows.
- **Outcome:** the tab remains available for network discovery posture, with simplified table-only presentation.

### Feature: Tool Settings Tab
- **What it does:** allows editing of per-tool asset-type scope (`required` or `na`) across all six canonical asset types.
- **User perspective:** the user sees tools in a compact table, horizontally scans asset-type scope status, then opens a tool slideout to edit scope settings.
- **System behaviour:** the UI no longer supports add/remove/edit for tool metadata. A text-searchable dropdown filter allows filtering by tool name. Tool rows show scope status (`required` as green tick, `na` as red cross). Tool-name links open a right slideout for per-tool scope editing, save, reset, and close actions. Save submits the existing full payload contract and then refreshes settings from DB via GET.
- **Outcome:** discovery tool catalog is DB-driven and immutable from this page, while scope remains configurable for runtime coverage evaluation.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Discovery | Tab routing | Switches among summary, coverage-by-network, tool-settings, and network discovery status | Click tab | Updates `discoveryCoverageTab` query parameter | `discoveryCoverageTab` | Different layout | summary is default | unsupported values fall back to summary | `DiscoveryCoverageTabs` | Bookmarkable tab state | `target-state` route value is labeled `Network Discovery Status` |
| Discovery | Shared scope | Common filter scope with hidden stripping rules | Apply filters | Re-runs analytics after removing unsupported filter keys | filter query params | Filtered discovery view | `criticality` is ignored everywhere; `system` and `environment` ignored for target-state | query parsing only | `FilterBar`, `getCoreAppData()` | Discovery-specific view scope | hidden implementation rule |
| Discovery | Summary tab | Operational discovery dashboard | Open tab | Builds coverage snapshot cards and remediation report URL | scoped assets, discovery settings | Snapshot cards and report link | report reflects current filtered scope | none beyond scope parsing | remediation-report API | Discovery gap summary | |
| Discovery | Coverage-by-tool drillthrough | Tool-level asset detail slideout | Click tool, search, filter, paginate, export CSV | Calls tool-assets API and renders slideout rows | `toolId`, `toolSearch`, `toolAssetType`, pagination params | Slideout rows and CSV | pagination defaults to 200, export batches up to 5000 | invalid API params return client error messages | `/api/discovery-coverage/tool-assets` | Tool-specific gap evidence | non-route slideout |
| Discovery | Coverage-by-network | Row-based network coverage summary with accreditation facts, per-network radar visualisation, and per-tool coverage table | Open tab, apply filters, drill down | Aggregates covered/missing/applicable tool stats by network, resolves metadata fallbacks, renders one radar and one coverage-by-tool table per network, and provides data-date-aware drill-down links to network detail that open in a new window | scoped asset coverage rows + managed network metadata + optional `dataDate` query | Network rows with radar visual + per-tool table + overall coverage badges + drill-down link | tab is scoped by network/security-domain/environment/asset-type filters | zero-safe percentages and zero-safe drill-down date handling | `DiscoveryCoverageByNetworkSection`, `CoverageByToolRadar`, `withDataDate`, network detail resolver | First-class network coverage view with direct navigation into network drill-through | replaces prior aggregate-chip panel with the same table pattern used by summary coverage-by-tool |
| Discovery | Network discovery summary | Compare DB-backed target state and matched discovered totals by network and asset type | Open tab, apply filters, use drill-down links | Resolves target-state names from DB, matches discovered assets by normalized name + asset type, renders per-cell totals + grouped bar chart when either side exists, and provides row-level drill-down links to network detail | networks, scoped assets, network target-state assets, optional `dataDate` | Network summary table with `Drill Down`, `Discovery Enabled`, and per-asset-type target/discovered visuals | target-state ignores system and environment filters | name normalization is trim+lowercase; matched count is 1:1 by name+type | `NetworkDiscoverySummaryTableClient`, target-state matching helper, `withDataDate` | Network discovery posture view with direct network navigation | one-sided missing states render compact callouts below chart; combined missing state remains message-only |
| Discovery | Tool settings | Maintain per-tool asset-type scope only | Filter tools by name, open slideout from tool link, update scope, save/reset | Filters table rows by selected tool-name dropdown (with text search), displays scope status columns, opens per-tool slideout editor, validates tool IDs against current DB catalog, persists full payload, then refreshes settings from DB GET | `{ id, assetTypeScope }[]` payload | Updated discovery tool settings version and refreshed table state | `N/A` excludes an asset type from coverage checks; each tool carries all six canonical asset-type keys | unknown/missing/duplicate IDs rejected | `/api/discovery-tools/settings` | Updated scope rules for future coverage evaluation | add/remove and metadata edit removed from UI; table keeps scope section horizontally scannable |

## 5. Database Mapping
The page reads the shared snapshot dataset, the discovery tool settings tables, and related reference context. Most summary values are assembled at runtime from asset-level evidence and the configured tool model.

Primary data dependencies:

- `tsaat.asset`
- `tsaat.asset_vulnerability`
- `tsaat.asset_patch_state`
- `tsaat.asset_operating_system`
- `tsaat.asset_network_os`
- `tsaat.managed_network`
- `tsaat.network_target_state_asset`
- `tsaat.ict_system`
- `tsaat.discovery_tools_settings_version`
- `tsaat.discovery_tool`
- `tsaat.discovery_tool_asset_scope`

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Discovery | Network context | `tsaat` | `managed_network` | `network_id`, `name`, `discovery_status`, ownership and link columns | mixed | target-state rows, summary table, network slideout | Read | assets join to network via `network_id` | discovery status drives enabled vs not-enabled labels | direct display and grouping | some slideout metadata can use fallback network detail logic |
| Discovery | Network target state | `tsaat` | `network_target_state_asset` | `network_id`, `asset_type`, `asset_name` | mixed | per-network/asset-type target-state totals and match keys | Read | matched against scoped asset names by network + asset type | name normalization uses trim+lowercase | runtime matching determines discovered totals and coverage | list is name-only target-state records |
| Discovery | System context | `tsaat` | `ict_system` | `system_id`, `name`, `security_domain`, `criticality` | mixed | summary scope and system labels | Read | assets join to system through `asset.system_id` | ignored on target-state tab | direct display | |
| Discovery | Asset evidence | `tsaat` | `asset`, `asset_vulnerability`, lifecycle and OS-related child tables | asset identity, type, hostname, IP, lifecycle, vulnerability indicators | mixed | tool coverage evaluation and tool-assets API rows | Read | one asset to many evidence rows | evaluated within one snapshot only | runtime tool heuristics | |
| Discovery | Discovery tool settings | `tsaat` | `discovery_tools_settings_version`, `discovery_tool`, `discovery_tool_asset_scope` | version, tool metadata, `tool_id`, asset-type scope flags | mixed | defines required tools and tool labels | Read and Update | latest settings version plus child tool rows | `na` marks tool not applicable for an asset type | used directly in runtime coverage rules | scope covers `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other` |
| Discovery | Snapshot selection | `tsaat` | `dataset_snapshot` | `snapshot_id`, `snapshot_date` | mixed | selects the active data snapshot | Read | root snapshot join | latest snapshot unless `dataDate` supplied | display only | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Asset discovery coverage | decide whether an asset is discovery compliant | evaluate required tools for the asset type; asset is compliant when no required tool is missing | assets plus discovery tool settings | Runtime | backend | tools with asset-type scope `na` return null and do not count against compliance; applies consistently across all six asset types |
| Tool coverage percentage | tool summary cards and radar chart | covered applicable assets divided by applicable assets for a tool | runtime coverage rows | Runtime | backend | zero-safe |
| Overall tool coverage percent | summary snapshot card | covered tool slots divided by total applicable tool slots | runtime tool coverage rows | Runtime | backend | excludes N/A slots |
| Target-state matched discovered count | determine discovered totals against target-state list | multiset name matching by normalized `(network_id, asset_type, asset_name)` where names are trim+lowercase | scoped assets + `network_target_state_asset` | Runtime | backend | matched count is `min(target name count, discovered name count)` per normalized name |
| Target-state presence flag (internal) | derive whether any target-state exists per network | `true` when any target-state rows exist for the network, otherwise `false` | `network_target_state_asset` grouped by network | Runtime | backend | retained as an internal summary flag; not currently displayed as a dedicated column |
| Target-state coverage percent | compare matched discovered versus target | `matched_discovered / target_total * 100`, rounded to one decimal | matched discovered count + target totals | Runtime | backend | zero-safe; chart only renders when both totals are non-zero |
| Tool-assets API pagination | limit slideout payload size | page and pageSize slice filtered rows; export loops through pages up to 5000 rows per request | query params plus runtime filtered rows | Runtime | API layer | pageSize defaults to 200 and maxes at 5000 |

## 8. Non-Database Calculations
- Tool coverage heuristics are application rules rather than stored facts. Examples include using vulnerability presence for SIEM coverage and asset type for Tanium or Elastic applicability.
- Slideout loading progress, open/close state, search debounce, and CSV assembly are client-side only.
- Network summary slideouts reuse resolved detail fields and may include fallback metadata where source columns are blank.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- `criticality` is intentionally ignored for discovery analytics.
- `system` and `environment` are intentionally ignored on the target-state tab.
- Discovery compliance depends on the latest saved discovery tool settings.
- Discovery tool scope stores six canonical asset-type keys for every tool and defaults each key to `required`.
- The target-state tab uses DB-backed target-state asset-name records and name/type matching against scoped discovered assets.
- Discovery-enabled networks are expected to have matched discovered data for each modelled target-state asset type (no discovery-missing rows for modelled types).
- Tool settings changes affect subsequent runtime evaluations rather than historical snapshot facts.

## 10. Open Questions / Gaps
- **Open question:** should the page continue to silently ignore `criticality`, and on target-state also ignore `system` and `environment`, or should those filters be disabled in the UI to avoid ambiguity?
- **Open question:** should the network summary slideout explicitly label fallback metadata and generated URLs as inferred values?


---

## Source: 08-Measures.md


# Measures

**Page Path:** `/measures`

## 1. Page Overview
- **Page name:** Measures
- **Purpose:** provide the KPI and SPI measure catalogue, summary charts, tasking-report launch points, and configurable severity mapping.
- **User outcome:** the user can understand how performance is measured, inspect KPI and SPI scores for the current scope, generate tasking reports, and manage the severity model applied to findings.
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
- **What it does:** shows the SPI matrix, including descriptions, success measures, scores, and report links.
- **User perspective:** the user can inspect SPI score details and launch tasking reports.
- **System behaviour:** SPI rows come from `buildSpiRows()` and report links carry the active filter scope into `/api/tasking-report`.
- **Outcome:** SPI performance details are shown in a dedicated tab.

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
| Measures | Measures-SPI tab | SPI-only detailed measure table and report launch surface | Open tab, click report link | Builds SPI rows and carries filter scope into report URL | analytics, filters | SPI matrix and PDF report links | SPI rows respect SPI applicability rules | none beyond scope parsing | `KpiSpiMatrix`, `/api/tasking-report` | Detailed SPI view | |
| Measures | SPI settings | Maintain severity mapping by SPI and asset type | Edit rows, save, reset | Validates and persists latest settings version | measures settings rows | Updated measures settings | saved matrix affects future severity remap; matrix includes six canonical asset types per SPI; `Data Gap` values are normalized to `Moderate` | panel-level validation in component and API | `/api/measures/settings` | Updated severity model | non-applicable SPI/asset combinations remain harmless configuration entries |
| Measures | KPI settings placeholder | Reserved future KPI settings tab | Open tab | Renders placeholder only | none | Placeholder panel | intentionally no save behavior | none | measures route rendering | Future-ready tab model | no API usage |

## 5. Database Mapping
The page reads snapshot analytics plus the measures settings tables. Most KPI and SPI values are calculated at runtime from asset evaluations and findings rather than stored as facts.

Primary data dependencies:

- `tsaat.asset` and posture child tables
- `tsaat.finding`
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
- Tasking-report URLs are assembled from the current filter query string and are not stored.
- Summary chart points and matrix row formatting are runtime-only display artefacts.
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


---

## Source: 09-Findings-and-Evidence.md


# Findings and Evidence

**Page Path:** `/findings`

## 1. Page Overview
- **Page name:** Findings and Evidence
- **Purpose:** provide the findings history view, current register, export surface, and evidence drillthroughs for linked assets.
- **User outcome:** the user can review open or closed findings as of a selected date, analyse the trend over time, and export or inspect evidence at finding and asset level.
- **Primary user roles:** cyber analysts, remediation coordinators, governance teams, auditors, reporting users.

## 2. Page Summary
This page provides `overview` and `register` views, combined with `open` and `closed` status tabs.

Major dependencies:

- `getCoreAppData()`
- `FindingsViewTabs`
- `FindingsStatusTabs`
- `FindingsTimelineFilter`
- `FindingsHistoryDrillthrough`
- `FindingsTable`
- `/api/findings/export`
- `/api/findings/asset-details`
- `workflowStatusAtAsOf()`

Important hidden behaviour:

- the page clamps the selected `asOf` date to the last two years and no later than the snapshot date.
- workflow status is reconstructed at runtime from open and close timestamps rather than taken directly from the stored status field.
- the history drillthrough is a non-route overlay triggered by `historyDrillthrough=1`.
- if persisted findings are unavailable, the underlying analytics layer may generate synthetic findings from non-compliant or unknown evaluations.

## 3. Feature Breakdown
### Feature: Shared Findings Filter Scope
- **What it does:** filters the page by the shared scope plus findings-specific SPI, priority, severity, search, status, view, page, and as-of date parameters.
- **User perspective:** the user can narrow the findings set to the relevant scope and time slice.
- **System behaviour:** the page loads the shared filtered analytics, reconstructs open or closed status at `asOf`, and then applies findings-specific filters.
- **Outcome:** the findings set reflects both structural scope and time-based workflow reconstruction.

### Feature: Overview View
- **What it does:** shows findings history, summary cards, asset-type summaries, and SPI summaries.
- **User perspective:** the user gets a trend-focused understanding of findings pressure before looking at individual rows.
- **System behaviour:** the page builds a two-year daily history series, an SPI-specific history series, and card counts from the currently filtered findings set; asset-type summaries use the shared canonical asset taxonomy.
- **Outcome:** the page acts as the analytical overview for open or closed findings.

### Feature: Findings History Drillthrough
- **What it does:** opens a full-screen drillthrough with per-SPI trend lines.
- **User perspective:** the user can inspect how findings accumulated or closed by SPI over the last two years.
- **System behaviour:** the drillthrough preserves current filters and status tabs, and uses `historyDrillthrough=1` to toggle the overlay state.
- **Outcome:** users can inspect trend detail without leaving `/findings`.

### Feature: Register View
- **What it does:** shows a paginated findings table with evidence, exports, and linked-asset drillthrough.
- **User perspective:** the user can review finding rows, open asset detail evidence, and export the filtered register.
- **System behaviour:** the page paginates at 10 rows per page, builds export URLs for CSV or JSON, and loads asset detail rows from `/api/findings/asset-details`.
- **Outcome:** the register is the operational findings worklist and evidence source.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Findings and Evidence | View routing | Switches between overview and register | Click view tab | Updates `findingsViewTab` query parameter | `findingsViewTab` | Different layout | overview is default | unsupported values fall back to overview | `FindingsViewTabs` | Bookmarkable view state | |
| Findings and Evidence | Status routing | Switches between open and closed findings | Click status tab | Updates `findingsTab` query parameter | `findingsTab` | Open or closed scope | open is default | unsupported values fall back to open | `FindingsStatusTabs` | Bookmarkable workflow state | |
| Findings and Evidence | As-of timeline filter | Changes date used to reconstruct workflow state | Pick date | Clamps date and recomputes timeline status for each finding | `asOf` | Rebuilt findings set and charts | max date is current snapshot date; min date is two years earlier | invalid or out-of-range dates are corrected | `workflowStatusAtAsOf()` | Stable as-of reporting | hidden clamping rule |
| Findings and Evidence | Overview analytics | Two-year trend and summary cards | Open overview | Builds daily history points and summary cards | findings, reconstructed statuses | Trend chart, cards, summaries | overview can include SPI filter not shown on register | zero-safe counts | chart components | Analytical overview | |
| Findings and Evidence | History drillthrough | Full-screen SPI trend analysis | Click drillthrough action | Toggles `historyDrillthrough=1` and renders overlay | current filter state plus history series | Overlay charts | overlay preserves current findings scope | none beyond preserved query params | `FindingsHistoryDrillthrough` | Deep trend analysis | non-route overlay |
| Findings and Evidence | Register table | Paginated findings register with evidence | Open register, paginate, export, open asset details | Paginates rows, builds export URLs, fetches asset detail rows | filtered findings, `page`, `asOf`, search params | Table, export files, asset slideout | page size is fixed at 10 rows | invalid page values clamp through pagination logic | `FindingsTable`, export API, asset-details API | Operational findings list | asset detail slideout is client-side |

## 5. Database Mapping
The page reads the filtered findings set from runtime analytics. That set may come from persisted `tsaat.finding` rows or, when absent, from synthetic findings generated from evaluation outcomes.

Primary data dependencies:

- `tsaat.finding`
- `tsaat.asset`
- `tsaat.asset_vulnerability`
- `tsaat.ict_system`
- `tsaat.managed_network`
- measures settings tables used for severity remap

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Findings and Evidence | Findings register | `tsaat` | `finding` | `finding_id`, `spi_id`, `priority_rank`, `severity`, `compliance_status`, scope columns, `title`, `evidence`, `recommended_action`, `workflow_status`, `observed_at`, `closed_at` | mixed | main finding rows, trend input, exports | Read | findings join back to asset, system, and network by scope fields | severity may be remapped at runtime | as-of status reconstructed from timestamps | synthetic fallback may replace missing persisted rows |
| Findings and Evidence | Asset evidence drillthrough | `tsaat` | `asset`, `asset_vulnerability` | asset identity, type, IP, vulnerability fields | mixed | linked asset details for a selected finding | Read | asset-details API narrows rows by current findings context | scoped to active finding filters and as-of date | runtime aggregation for critical/high counts | |
| Findings and Evidence | Scope context | `tsaat` | `ict_system`, `managed_network` | IDs and names | mixed | scope labels, search text, export context | Read | findings link through scope columns | none | direct display | |
| Findings and Evidence | Severity remap context | `tsaat` | `measures_settings_version`, `measures_severity_matrix` | SPI and asset-type severity mapping | mixed | determines visible severity on page and exports | Read | latest settings version applied | defaults if settings are absent | runtime rewrite before display | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Workflow status at as-of date | decide whether a finding is open or closed on a selected date | if opened after `asOf`, exclude; if closed on or before `asOf`, status is closed; otherwise open | finding timestamps | Runtime | backend and shared utility | derived from timestamps, not stored workflow field |
| Findings history series | trend chart on overview | start from opening balance at history start date, then add opened findings and subtract closed findings per day | finding timestamps over two years | Runtime | backend | open and closed modes use different accumulation logic |
| SPI history series | drillthrough line chart | build a separate running count per SPI across each day in the history window | finding timestamps, SPI ID | Runtime | backend | one line per SPI present in catalogue |
| Summary cards | top-level status counts | count filtered findings by severity and priority classes | filtered findings | Runtime | backend | zero-safe |
| Asset-type summary | compare findings by asset type | group findings by `evidence.assetType` and count total, High Risk, Critical Exposure, and P1/P2 | findings evidence | Runtime | backend | dynamic grouping supports `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, and `other` |
| Register pagination | operational table slicing | page size fixed at 10; slice filtered rows by `page` | filtered findings, query params | Runtime | backend | clamps to valid page range |
| Findings export | filtered register output | re-run active filters and emit CSV or JSON rows, including as-of status | findings plus query params | Runtime | API layer | export uses same as-of reconstruction as page |
| Synthetic findings fallback | keep findings surfaces populated | create deterministic findings from non-compliant or unknown evaluations, assigning severity, priority, and timestamps | runtime evaluations and vulnerabilities | Runtime | backend | only used when no persisted findings exist |

## 8. Non-Database Calculations
- Overview cards, SPI summaries, and chart labels are runtime-only display aggregations.
- The history drillthrough open and close states are client-side overlay state controlled by a query parameter.
- Asset-details CSV generation is performed in the browser from the fetched slideout rows.
- Search matching is application logic over concatenated finding text and evidence content.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped through the underlying snapshot date and explicit `asOf` control.
- `asOf` is limited to the two-year history window ending at the active snapshot date.
- Register pagination is fixed at 10 rows per page.
- Visible severity may differ from persisted `finding.severity` due to measures severity remap.
- Asset-type summaries use the shared six-type taxonomy and do not assume a fixed 3-column model.
- Asset-details drillthrough is dependent on the separate API endpoint and current filter context.

## 10. Open Questions / Gaps
- **Open question:** should the page clearly indicate when the findings set is synthetic because `tsaat.finding` had no rows for the selected snapshot?
- **Open question:** should the stored `workflow_status` field continue to be ignored in favour of reconstructed as-of logic, or should discrepancies be surfaced?
- **Open question:** is the two-year history window a fixed business rule, or should it be configurable?


---

## Source: 10-Report-Catalogue.md


# Report Catalogue

**Page Path:** `/report`

## 1. Page Overview
- **Page name:** Report Catalogue
- **Purpose:** provide a filtered launcher page for the application's generated reports and briefs.
- **User outcome:** the user can apply scope filters, locate the required report, and open the generated document for the current scope.
- **Primary user roles:** executives, cyber analysts, governance teams, network owners, ICT system owners, reporting users.

## 2. Page Summary
This page is a report launcher rather than an analytical dashboard. It loads the current snapshot date and shared filter scope, lets the user search within the report catalogue, and constructs report URLs that preserve the active filter context.

Major dependencies:

- `getCoreAppData()`
- `FilterBar`
- report-generation APIs:
  - `/api/report/summary`
  - `/api/networks/remediation-report`
  - `/api/systems/remediation-report`
  - `/api/systems/out-of-support-os-report`
  - `/api/systems/modelling-status-report`
  - `/api/discovery-coverage/remediation-report`

Important hidden behaviour:

- the page does not calculate report contents itself; it only assembles and launches URLs.
- report search is client-entered but server-rendered through the route query parameter `reportSearch`.
- the `Cyber Posture Summary` link always forces `format=pdf`.

## 3. Feature Breakdown
### Feature: Shared Report Filter Scope
- **What it does:** filters the report launcher by network, system, criticality, security domain, environment, asset type, severity, mission capability, and business service.
- **User perspective:** the user sets the report scope before opening a report.
- **System behaviour:** the page converts the current filter object into query-string entries and reuses them in each report URL. Asset-type values use the shared six-type taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
- **Outcome:** all reports open against the same selected scope.

### Feature: Text Search Reports
- **What it does:** filters the visible report catalogue rows by report name, description, and audience.
- **User perspective:** the user can quickly find the right report without changing the underlying report scope.
- **System behaviour:** the route preserves current scope parameters and adds or removes `reportSearch`.
- **Outcome:** text search changes the visible catalogue list only.

### Feature: Report Catalogue Table
- **What it does:** lists report name, description, audience, and a launch link for each report.
- **User perspective:** the user selects a report and opens it in a new browser tab.
- **System behaviour:** each row builds a specific API URL and appends the current filter scope.
- **Outcome:** the page acts as the central report-launch surface.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Report Catalogue | Shared scope | Common report scope filters | Apply filters | Rebuilds report URLs with current scope | filter query params | Scoped report links | all links must preserve the same filter context | filter parsing only | `FilterBar`, `getCoreAppData()` | Consistent report scope | |
| Report Catalogue | Report text search | Search visible catalogue rows | Enter text and submit | Updates `reportSearch` and filters row list | `reportSearch` | Reduced or restored list | search affects only catalogue visibility | empty search restores all rows | route query string | Faster report selection | no separate API call |
| Report Catalogue | Report launcher table | Report list and launch actions | Click `Load Report` | Opens the report endpoint in a new tab | current filters, report type | PDF or generated response from endpoint | `posture-summary` always includes `format=pdf` | row link existence only | report APIs | Launch selected report | page does not inspect report response |
| Report Catalogue | Clear search | Remove text-search term while keeping report scope | Click `Clear` | Rebuilds URL without `reportSearch` | current filter query params | Reset catalogue list | report scope must remain intact | none | route query string | Restored full catalogue | |

## 5. Database Mapping
The page itself has a light data footprint. It reads the active snapshot date and filter options, but does not directly query report content tables. The actual report data is loaded by the downstream report endpoints.

Primary data dependencies for the page itself:

- `tsaat.dataset_snapshot`
- reference and scope tables used to populate filter options, including `tsaat.managed_network` and `tsaat.ict_system`

Downstream report endpoints depend on broader operational tables, but those are outside the page's direct implementation.

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Report Catalogue | Snapshot label | `tsaat` | `dataset_snapshot` | `snapshot_date` | date | displays active snapshot date in page header | Read | latest snapshot unless `dataDate` supplied | direct display | none | |
| Report Catalogue | Filter options | `tsaat` | `managed_network`, `ict_system`, related scope tables | IDs and names used in filter options | mixed | shared filter controls | Read | standard filter option relationships | same as shared filter bar | direct display | no report content loaded here |
| Report Catalogue | Report output | multiple | downstream report endpoints | endpoint-specific | mixed | generated report content | Read via API | depends on selected report type | outside this page's direct scope | assembled by report endpoint | document separately if report internals are required |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Filter query assembly | keep report scope consistent | convert non-empty filter fields into query entries | route filters | Runtime | backend | omitted filters are not added to links |
| Report launcher URL | open the correct report for current scope | append query entries to base API path; for posture summary also append `format=pdf` | filter query entries | Runtime | backend | if no filters are selected, link is base endpoint |
| Catalogue text search | reduce visible report rows | include row when report name, description, or audience contains normalized search text | hard-coded report catalogue rows | Runtime | backend | zero results show a no-match row |

## 8. Non-Database Calculations
- Report rows are a hard-coded catalogue in the page implementation.
- Search matching is runtime string matching over report metadata, not database-backed search.
- Launch links open in a new tab and the page does not validate the returned document content.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped through shared navigation state and snapshot selection.
- The page itself is not a report generator; it is a scoped launcher.
- The visible report catalogue is fixed in code.
- Report content completeness and performance depend on each downstream API, not on this page.

## 10. Open Questions / Gaps
- **Open question:** should the report catalogue remain hard-coded, or should available reports be driven from configurable metadata?
- **Open question:** should the page indicate expected file type or generation time for each report endpoint?
- **Open question:** if report endpoint behaviour changes, should this page perform any preflight validation before opening the link?


---

## Source: 11-Settings.md


# Settings

**Page Path:** `/settings`

## 1. Page Overview
- **Page name:** Settings
- **Purpose:** provide application-level configuration controls for database connectivity and file-backed authentication password lifecycle.
- **User outcome:** the user can validate and save database connectivity/SSL settings, and can change the current `logindetails` application password from the dedicated password settings tab.
- **Primary user roles:** application administrators, support teams, deployment engineers, maintainers.

## 2. Page Summary
This page provides `database-settings`, `password-settings`, and `placeholder-2` tabs.

Major dependencies:

- `loadDatabaseSettingsDefaults()`
- `DatabaseSettingsPanel`
- `SettingsTabs`
- `/api/settings/database/test-connection`
- `/api/settings/database/test-ssl`
- `/api/settings/database/test-schema`
- `/api/settings/database`
- `/api/settings/password`
- `DB_config`
- `logindetails`
- `scripts/ensure-db-config.ps1`
- `canSaveDatabaseSettings()`
- `buildSqlcmdSecurityArgs()`

Important hidden behaviour:

- database settings are persisted to encrypted local, git-ignored `DB_config` envelope file, not to the SQL Server database.
- when encrypted `DB_config` is missing, UI defaults resolve to fallback server/database values and SSL disabled.
- offline scripts run `scripts/ensure-db-config.ps1` before database build or compile: interactive runs confirm/change saved values, create missing files, or recreate files that cannot be decrypted by the current Windows identity; noninteractive runs accept a valid existing file or create/recreate one from `TSAAT_DB_CONFIG_ASSUME_YES=true` plus complete `TSAAT_SQL_*` values.
- schema validation checks for required tables, required columns, and that `tsaat.dataset_snapshot` contains at least one row.
- save remains disabled until required validation tests succeed:
  - SSL disabled: connection test + schema test
  - SSL enabled: connection test + SSL test + schema test
- any edit to server, database, auth mode, credentials, SSL toggle, or SSL type clears prior test status.
- save API re-validates connection, SSL (when enabled), and schema before writing encrypted `DB_config`.
- runtime and offline scripts decrypt/read confirmed settings from `DB_config` and apply SQL auth plus `sqlcmd` security flags (`-N`, `-C`) consistently; offline scripts stage bundled `sqlcmd` from `Dependencies/offline-artifacts/sqlcmd/sqlcmd-windows-amd64-1.10.0.zip` to `Dependencies/external/sqlcmd/win-x64/sqlcmd.exe` and normalize local named-instance server targets to `lpc:` when no protocol prefix is supplied.
- password changes are written to encrypted local `logindetails` as salted PBKDF2-HMAC-SHA256 hash material and session version is incremented.
- `placeholder-2` is routable but intentionally contains no operational settings.

## 3. Feature Breakdown
### Feature: Settings Tab Routing
- **What it does:** switches between database settings, password settings, and one placeholder tab.
- **User perspective:** the user can navigate to database and password settings surfaces and one reserved future tab.
- **System behaviour:** `settingsTab` in the query string controls which panel is rendered.
- **Outcome:** database and password settings are both active configuration surfaces.

### Feature: Database Settings Form
- **What it does:** captures server, database, authentication mode, user ID, password, SSL enabled flag, and SSL type.
- **User perspective:** the user edits the runtime connection and SSL behavior TSAAT should use.
- **System behaviour:** initial values are loaded from encrypted `DB_config` when present, otherwise fallback server/database defaults are used and SSL defaults to disabled; the same encrypted file is confirmed by offline scripts before database creation and compile validation.
- **Outcome:** the user can prepare a connection definition without saving immediately.

### Feature: Connection Test
- **What it does:** validates the supplied connection settings against SQL Server.
- **User perspective:** the user checks whether the supplied settings can connect successfully.
- **System behaviour:** the client posts the current draft settings to `/api/settings/database/test-connection` and logs diagnostics locally in the panel.
- **Outcome:** the panel records pass or fail status before schema testing.

### Feature: Schema Test
- **What it does:** validates that the target database has the required TSAAT schema.
- **User perspective:** the user confirms that the database is structurally suitable for TSAAT.
- **System behaviour:** the client posts the current draft settings to `/api/settings/database/test-schema`, which checks required tables, required columns, and snapshot data presence.
- **Outcome:** only schema-valid databases can proceed to save.

### Feature: SSL Test
- **What it does:** validates encrypted transport/handshake behavior for the selected SSL mode.
- **User perspective:** when SSL is enabled, the user confirms SSL works before saving.
- **System behaviour:** the client posts current draft settings to `/api/settings/database/test-ssl`, which first verifies connection success and then validates SQL connection encryption properties.
- **Outcome:** SSL-enabled settings cannot be saved unless SSL test succeeds.

### Feature: Save and Reset
- **What it does:** writes validated settings to encrypted `DB_config` or resets the draft to the last saved values.
- **User perspective:** the user either commits the validated settings or discards edits.
- **System behaviour:** save is enabled only when the form is not busy and all required tests have succeeded; reset restores the last saved state and clears transient statuses.
- **Outcome:** the application configuration file stays synchronized with validated input.

### Feature: Password Settings
- **What it does:** changes the current application password for the authenticated user.
- **User perspective:** the user enters current password, new password, and confirm password, then saves.
- **System behaviour:** `/api/settings/password` validates current credentials, writes new salted hash metadata into encrypted `logindetails`, increments file-backed session version, and clears the session cookie.
- **Outcome:** old credentials stop working immediately and the user must sign in with the new password.

### Feature: Diagnostics Log and Copy Action
- **What it does:** records connection, schema, and save diagnostics and lets the user copy them.
- **User perspective:** the user can review test output and share it with support teams.
- **System behaviour:** each action appends a timestamped log entry in client state; copy uses the browser clipboard.
- **Outcome:** troubleshooting output is available without leaving the page.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Settings | Tab routing | Switches among database settings, password settings, and one placeholder | Click tab | Updates `settingsTab` query parameter | `settingsTab` | Different settings panel | `database-settings` is default | unsupported values fall back to database settings | `SettingsTabs` | Bookmarkable tab state | `placeholder-2` has no operational logic |
| Settings | Database settings form | Edit connection and SSL definition | Change fields | Marks form dirty and clears prior validation results | server, database, auth mode, credentials, `sslEnabled`, `sslType` | Draft settings | save requires passing validation first | client checks auth mode completeness and valid SSL type | `DatabaseSettingsPanel`, defaults loader | Prepared connection definition | initial values can come from fallback resolution |
| Settings | Connection test | Validate connectivity | Click `Test Connection` | POSTs draft settings and stores result and diagnostics | current draft settings | connection status and diagnostics | connection test must pass before SSL test or schema test | endpoint returns success summary and diagnostics | `/api/settings/database/test-connection` | Verified connectivity | |
| Settings | SSL test | Validate SSL transport for selected SSL type | Click `Test SSL` | POSTs draft settings, checks connection precondition, validates encrypted transport | current draft settings | SSL status and diagnostics | required only when SSL is enabled | endpoint returns success summary and diagnostics | `/api/settings/database/test-ssl` | Verified SSL mode | skipped when SSL disabled |
| Settings | Schema test | Validate TSAAT schema readiness | Click `Test Schema` | POSTs draft settings and checks required tables, columns, and snapshot rows | current draft settings | schema status and diagnostics | schema test requires a successful connection test first | endpoint enforces required tables and columns | `/api/settings/database/test-schema`, schema validation helper | Verified schema readiness | |
| Settings | Save and reset | Persist or discard draft settings | Click `Save` or `Reset` | Saves to encrypted `DB_config` or restores last saved state | validated draft settings | updated file-backed settings or restored draft | SSL disabled requires connection + schema tests; SSL enabled requires connection + SSL + schema tests | save API re-validates all required checks | `/api/settings/database`, `DB_config`, `canSaveDatabaseSettings()` | Synchronized configuration | save does not write to SQL Server |
| Settings | Password settings | Change current app password | Enter current/new/confirm password then click `Save Password` | Validates current password and persists new salted hash metadata to encrypted `logindetails`; increments session version and clears session cookie | current password, new password, confirm password | password update status and re-login requirement | only authenticated session can change password; current password must match; new/confirm must match | new password length and current-password verification are enforced server-side | `/api/settings/password`, `logindetails` | Password rotation without plaintext storage | success forces sign-out |
| Settings | Diagnostics log | Review and copy technical diagnostics | Read log or click copy | Appends timestamped messages and copies log text to clipboard | test and save results | local diagnostics text | diagnostics are local to the browser session | copy fails gracefully | browser clipboard API | Support-friendly troubleshooting | not persisted |

## 5. Database Mapping
This page is file-backed for persisted settings. Database connection settings are stored in encrypted `DB_config`, while application login credentials are stored in encrypted `logindetails`. Both files are local generated artefacts and are not portable between Windows identities when encrypted with DPAPI `CurrentUser` scope; compile-time setup can recreate an undecryptable `logindetails` with new credentials. It interacts with SQL Server only to validate connectivity and schema suitability.

Primary dependencies:

- local configuration file `DB_config`
- local credential file `logindetails`
- SQL Server schema `tsaat` for validation checks
- required tables and columns listed in `lib/database-settings.ts`

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Settings | File-backed connection settings | local ignored file | `DB_config` | encrypted JSON envelope (`format`, `version`, `keyProvider`, `algorithm`, `ciphertextBase64`, `updatedAtUtc`) | text/json | source of saved database + SSL settings | Read and Update | no database join; file read/write only | UI missing-file defaults SSL to disabled; offline scripts can create encrypted file from confirmed input or recreate an undecryptable local file | DPAPI decrypt/encrypt + normalization before save or script confirmation | API never returns plaintext password; SQL mode uses stored-password placeholder token; confirmation helper redacts SQL passwords |
| Settings | Password settings storage | local ignored file | `logindetails` | encrypted payload containing `username`, password hash/salt, algorithm, iteration count, timestamps, and session version | text/json | stores application login credentials and invalidation metadata | Read and Update | lookup by username from authenticated session | session version increments on each password change; compile-time setup can recreate undecryptable local files with new credentials | DPAPI decrypt/encrypt + PBKDF2-HMAC-SHA256 salted hash verification + rewrite | plaintext password is never persisted or returned |
| Settings | Schema validation - required tables | `tsaat` | multiple required tables including `dataset_snapshot`, `managed_network`, `ict_system`, `asset`, `finding`, settings tables, and reference tables | table existence only | mixed | determines whether target DB is valid for TSAAT | Read | validation checks object existence in `tsaat` schema | all required tables must exist | SQL validation query | exact list maintained in code |
| Settings | Schema validation - required columns | `tsaat` | selected required tables | `snapshot_date`, `network_id`, `adf_platform`, `enterprise_platform`, `system_id`, `asset_id`, `asset_type`, `finding_id`, `spi_id`, `workflow_status`, `dependency_id`, `tool_id`, `severity` | mixed | confirms minimum structural contract | Read | validation checks column existence by table | all required columns must exist | SQL validation query | exact list maintained in code |
| Settings | Snapshot data check | `tsaat` | `dataset_snapshot` | row existence and `snapshot_date` | date | confirms usable data is present | Read | no join required | at least one row must exist | boolean check in validation SQL | schema can exist but still fail if no snapshots exist |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Defaults resolution | prefill database settings form and offline confirmation | use decrypted file values when present, otherwise resolve fallback SQL Server name and application DB name; offline unattended creation/recreation requires `TSAAT_DB_CONFIG_ASSUME_YES=true` plus complete `TSAAT_SQL_*` values | encrypted `DB_config`, runtime resolution helpers, optional environment provisioning | Runtime | backend and scripts | password is replaced with stored placeholder token in UI; scripts redact SQL password during confirmation |
| Dirty-state detection | enable reset and clear stale validations | compare draft settings to saved settings field by field | form state | Runtime | client | resets validation state on every field change |
| Connection validation | confirm database connectivity | execute lightweight SQL returning current DB and login | supplied connection settings | Runtime | API/backend | failure returns diagnostics instead of throwing into UI |
| SSL validation | confirm encrypted SQL transport | execute SQL connection-property checks and require encrypted transport when SSL enabled | supplied connection settings plus SQL connection properties | Runtime | API/backend | skipped when SSL disabled |
| Schema validation | confirm minimum TSAAT schema | check required tables, required columns, and that `dataset_snapshot` contains rows | target SQL Server database | Runtime | API/backend | stops at validation failure and returns diagnostics |
| Save enablement | prevent invalid configuration writes | save allowed only when connection and schema tests succeed, plus SSL test when SSL enabled, and no busy state is active | client validation state | Runtime | client | save button remains disabled until required checks pass |
| SSL mode mapping | normalize UI SSL settings into encrypted payload fields | `sslEnabled=false => sslType=strict`; `sslEnabled=true, sslType=strict`; `sslEnabled=true, sslType=trust-server-certificate` | form state, encrypted `DB_config` payload | Runtime | backend | `trust-server-certificate` implicitly enables SSL |
| SQLCMD SSL argument mapping | enforce runtime/script SSL mode | SSL disabled => no SSL flags; strict => `-N`; trust server certificate => `-N -C` | decrypted `DB_config` payload (`sslEnabled`, `sslType`) | Runtime | backend and scripts | used by runtime SQL execution and offline scripts (`compileApp.cmd`, `CreateDB.cmd`, loader PowerShell); `CreateDB.cmd` and `compileApp.cmd` confirm `DB_config` first, then stage bundled `sqlcmd` and normalize local server targets to `lpc:` when needed |
| Password change | rotate app login secret | verify current password hash, persist new salted hash, increment session version, clear cookie | encrypted `logindetails` payload + authenticated session cookie | Runtime | API/backend | old sessions become invalid after update |

## 8. Non-Database Calculations
- Status badges, dirty-state detection, copy-to-clipboard status, and diagnostics aggregation are client-side only.
- Timestamped diagnostics text is session-local and not persisted.
- Placeholder tabs are runtime route states with static placeholder content.

## 9. Rules, Assumptions, and Constraints
- Settings persist to local ignored `DB_config`, not to the database.
- `CreateDB.cmd` and `compileApp.cmd` must confirm, create, or recreate encrypted `DB_config` before using database settings.
- The page is marked `force-dynamic`, so it does not rely on static generation.
- Connection test must pass before schema test can run.
- Connection test must pass before SSL test can run.
- Save requires both connection and schema tests; SSL test is additionally required when SSL is enabled.
- `DB_config` is encrypted at rest; runtime SSL behavior is derived from decrypted payload fields:
  - `sslEnabled=false` means SSL disabled.
  - `sslEnabled=true` + `sslType=strict` means strict SSL validation.
  - `sslEnabled=true` + `sslType=trust-server-certificate` means trust-server-certificate SSL mode.
- Password updates require the current authenticated session and a valid current password.
- Password writes are one-way salted hashes in encrypted `logindetails`; plaintext is not persisted.
- Undecryptable copied `logindetails` files are not migrated; compile-time recreation creates a new credential.
- Successful password changes increment file-backed session version and force re-authentication.
- Placeholder tabs are present in navigation but intentionally contain no settings.
- The settings page handles credentials, so operational documentation should avoid exposing actual values.

## 10. Open Questions / Gaps
- **Open question:** should `placeholder-2` remain visible before it has real functionality?
- **Open question:** should save require a secondary confirmation because it writes runtime connection and SSL behavior used by app startup and scripts?
- **Open question:** should the schema validation contract be documented externally for deployment teams, since the required tables and columns are enforced in code?


---

## Source: 12-Asset-Taxonomy-and-SPI-Applicability.md


# Shared Asset Taxonomy and SPI Applicability

**Scope:** Cross-cutting requirements contract used by runtime logic, settings models, schema constraints, and UI filtering.

## 1. Overview
- **Specification name:** Shared Asset Taxonomy and SPI Applicability
- **Purpose:** define the canonical asset types, how SPI applicability is enforced per type, and where those rules are persisted and consumed.
- **Outcome:** all application layers use the same six asset-type IDs and the same applicability behavior.

## 2. Summary
This specification captures shared behavior used by discovery settings, measures settings, SPI evaluation, filters, topology summaries, and SQL schema constraints.

Primary implementation anchors:

- `lib/asset-taxonomy.ts`
- `lib/types.ts`
- `lib/spi-rules.ts`
- `lib/spi-metadata.ts`
- `lib/discovery-tools-settings.ts`
- `lib/measures-settings.ts`
- `components/filter-bar.tsx`
- `Database Schema/database-schema.sql`
- `Database Schema/migrations/004_expand_asset_type_taxonomy.sql`

Key cross-cutting rules:

- canonical asset types are exactly:
  - `server`
  - `workstation`
  - `network-device`
  - `storage-device`
  - `printer-device`
  - `other`
- `storage-device`, `printer-device`, and `other` evaluate SPI 10 only.
- discovery tool scope includes all six asset types for every tool and defaults to `required`.
- measures severity matrix includes all SPI IDs x all six asset types.

## 3. Contract Breakdown
### Feature: Canonical Asset Type Contract
- **What it does:** defines shared IDs, labels, and ordering for all asset-type-aware views and APIs.
- **System behaviour:** all filter options and type labels are rendered from `lib/asset-taxonomy.ts` rather than hard-coded 3-type lists.
- **Outcome:** one source of truth for taxonomy across backend and UI.

### Feature: SPI Applicability by Asset Type
- **What it does:** routes each asset type to applicable SPI evaluations.
- **System behaviour:** SPI evaluation flow enforces:
  - `server`: SPI 1, 2, 3, 4, 5, 10
  - `workstation`: SPI 1, 2, 6, 10
  - `network-device`: SPI 7, 8, 9, 10
  - `storage-device`, `printer-device`, `other`: SPI 10 only
- **Outcome:** new asset types participate in lifecycle controls without introducing unintended SPI checks.

### Feature: Discovery Tool Scope Contract
- **What it does:** stores per-tool applicability for every canonical asset type.
- **System behaviour:** each tool row carries all six asset-type scope keys with values `required` or `na`; normalization fills missing keys as `required`.
- **Outcome:** discovery compliance can be evaluated consistently for all asset types.

### Feature: Measures Severity Matrix Contract
- **What it does:** maps severity by SPI and asset type.
- **System behaviour:** matrix keys are `spiId:assetType` for all SPI IDs 1..10 and all six asset types.
- **Outcome:** severity remap remains deterministic even when a type is not applicable for a given SPI.

### Feature: SQL Schema and Migration Contract
- **What it does:** ensures database constraints accept all canonical asset types.
- **System behaviour:** CHECK constraints and related lookup/scope tables include the six-type domain, with migration support for upgraded databases.
- **Outcome:** fresh builds and upgraded environments share the same `asset_type` domain.

## 4. Feature Detail Table
| Area | Feature | Description | Inputs | Outputs | Business Rules | Dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| Shared taxonomy | Canonical IDs and labels | Defines six canonical asset types and display labels | `lib/asset-taxonomy.ts` | Filter options, labels, ordering | IDs are lowercase hyphenated and fixed | `lib/types.ts`, UI filter/summaries |
| SPI runtime | Applicability routing | Chooses SPI set by asset type | asset type + asset evidence | Per-asset SPI evaluations | `storage-device`, `printer-device`, `other` are SPI 10 only | `lib/spi-rules.ts` |
| Discovery settings | Asset-type scope | Stores tool scope per asset type | discovery tools settings payload | normalized scope record per tool | default scope is `required` for all six keys | `lib/discovery-tools-settings.ts` |
| Measures settings | Severity matrix keys | Stores severity by SPI and asset type | measures settings payload | normalized matrix | matrix includes all six asset types for each SPI | `lib/measures-settings.ts` |
| SQL schema | `asset_type` domain | Expands allowed asset types in constraints and related tables | schema SQL + migration SQL | validated inserts/updates | fresh schema and upgraded schema must match | `database-schema.sql`, migration `004_...sql` |
| UI analytics | Dynamic rendering by type | Uses canonical list for filters and summaries | runtime data + taxonomy | six-type filters/charts/tables | no hard-coded 3-column assumptions | filter, findings, discovery, topology components |

## 5. Data Mapping
Primary persistence surfaces for this contract:

- `tsaat.asset.asset_type`
- `tsaat.spi_applicable_asset_type.asset_type`
- `tsaat.discovery_tool_asset_scope.asset_type`
- `tsaat.measures_severity_matrix.asset_type`
- settings JSON payload keys:
  - discovery `assetTypeScope`
  - measures `severityMatrix`

## 6. Mapping Table
| Contract Element | Store | Keys / Columns | Rule |
| --- | --- | --- | --- |
| Asset identity type | `tsaat.asset` | `asset_type` | must be one of six canonical IDs |
| SPI applicability metadata | `tsaat.spi_applicable_asset_type` | `spi_id`, `asset_type` | new types are listed for SPI 10 only |
| Discovery tool scope | `tsaat.discovery_tool_asset_scope` | `tool_id`, `asset_type`, `scope_setting` | each tool has all six asset-type keys |
| Measures severity mapping | `tsaat.measures_severity_matrix` | `spi_id`, `asset_type`, `severity` | matrix persists six asset types for each SPI |
| Runtime typing | TypeScript domain | `AssetType` union | shared across analytics, filters, and API normalization |

## 7. Derived Logic
| Calculation / Logic | Formula / Behavior | Layer |
| --- | --- | --- |
| Type label rendering | canonical ID -> display label (`assetTypeLabel`) | runtime UI |
| SPI evaluation routing | branch by `asset.type`; append SPI 10 base evaluation | runtime backend |
| Measures key normalization | `severityMatrixKey(spiId, assetType)` for all SPI IDs and types | runtime backend + settings API |
| Discovery scope normalization | missing `assetTypeScope` keys backfilled as `required` | runtime backend + settings API |
| Dynamic type summaries | iterate canonical list instead of fixed 3-type arrays | runtime UI |

## 8. Non-Database Logic
- Synthetic/demo data generation includes all six asset types.
- New asset types are currently unmodelled in seeded/demo snapshots.
- Topology and findings summaries render using canonical type ordering rather than fixed columns.

## 9. Rules and Constraints
- Canonical IDs are lowercase hyphenated values and are treated as the stable contract.
- SPI applicability for `storage-device`, `printer-device`, and `other` is intentionally limited to SPI 10.
- Discovery defaults remain `required` for every tool and asset type unless explicitly changed to `na`.
- Measures severity matrix stores all combinations even when some SPI/type pairs are non-applicable.

## 10. Open Questions
- **Open question:** when business rules for new asset types are defined, should SPI applicability expand beyond SPI 10 or remain lifecycle-only?
- **Open question:** should seeded/demo distributions for the three new types become configurable by environment profile?
- **Open question:** should UI labels explicitly identify SPI-non-applicable type combinations inside measures settings?



