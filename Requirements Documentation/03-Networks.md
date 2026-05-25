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
- **System behaviour:** the page uses the shared filter model, but intentionally hides ICT system, criticality, and environment selectors from the visible filter bar. The synthetic loader-only `net-unassigned` / `Unassigned Systems` bucket is excluded from the network selector and treated as `All` if supplied manually.
- **Outcome:** the page remains network-centric.

### Feature: Overview Tab
- **What it does:** shows network posture, modelling coverage, risk profile, and daily and weekly trends.
- **User perspective:** the user gets a network-level executive summary.
- **System behaviour:** compliance, modelling, and risk metrics are aggregated from filtered asset evaluations and findings after excluding the synthetic `net-unassigned` bucket from network-model calculations.
- **Outcome:** users can identify whether network scope is improving or degrading.

### Feature: Action Tab
- **What it does:** shows remediation pressure, backlog aging, oldest open findings, quick wins, and a scoped remediation report link.
- **User perspective:** the user can move from network posture to action planning.
- **System behaviour:** the page builds action metrics from open findings, lifecycle data, SQL-produced discovery coverage, and discovery enablement status.
- **Outcome:** the user gets a tactical work queue and export path.

### Feature: Posture Tab
- **What it does:** shows KPI summary cards, blast-radius data, searchable network roll-up table, detail slideout, and drill-down links.
- **User perspective:** the user can compare networks and open either a summary slideout or the full network detail page.
- **System behaviour:** each row combines real network metadata, rollup posture, P1/P2 counts, SQL-produced discovery compliance, and drill-down links.
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
| Networks | Overview | Network posture summary | Open tab | Aggregates compliance, modelling, severity, and trends for real networks only | dataset, findings, evaluations | Dashboard cards and charts | network scope only; `net-unassigned` excluded | zero-safe percentages | `getTrendAppData()`, analytics | Executive network view | |
| Networks | Action | Remediation planning | Open tab or generate report | Builds action metrics and remediation report link | findings, lifecycle, discovery status | Action board and PDF link | report reflects current filters | none beyond scope parsing | `/api/networks/remediation-report` | Action planning and export | |
| Networks | Posture table | Roll-up comparison across networks | Search, open slideout, drill down | Builds row model with posture and scores | real network rows, rollups, findings | Table, slideout, drill-down link | network list is the primary drill-down source; `Unassigned Systems` is not a network | search is client-side | `NetworksTable`, `NetworksTableClient` | Compare and navigate | slideout uses detail fallback fields |
| Networks | Blast radius filter | Links chart choice to table scope | Select or clear chart item | Event-based client filter | selected network ID | Filtered posture table | chart filter is temporary and client-side | cleared when selection no longer exists | custom browser event | Faster comparison workflow | |

## 5. Database Mapping
The page uses the shared snapshot dataset and findings analytics, then reshapes the data around network scope.

Primary data dependencies:

- `tsaat.managed_network`
- `tsaat.network_declared_system`, `tsaat.network_declared_asset`, and `tsaat.network_target_state_asset`
- `tsaat.asset` and related posture tables
- `tsaat.finding`
- `tsaat.asset_vulnerability`
- discovery settings, discovery coverage rule metadata, and measures settings tables

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Networks | Network identity | `tsaat` | `managed_network` | `network_id`, `name`, `classification`, `criticality`, `diis_id`, `ato_number`, `apm_number`, `modelling_status`, `discovery_status`, detail columns | string, enum-like | row identity, posture context, slideout metadata | Read | joined to assets and systems by `network_id` | ATO, DIIS, and APM references are loaded/backfilled; fallback descriptive metadata allowed in slideouts | used directly and in drill-down hrefs for real networks only | `modelling_status` is persisted but current overview modelling card still uses the discovery-status proxy; `net-unassigned` remains loader-only |
| Networks | Asset scope | `tsaat` | `asset` | `asset_id`, `asset_type`, `network_id`, lifecycle columns | mixed | network asset counts, discovery coverage, OS and warranty metrics | Read | asset belongs to one network | filtered through shared filter model | runtime counts and percentages | canonical `asset_type` values are `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other` |
| Networks | Findings | `tsaat` | `finding` | scope columns, `priority_rank`, `severity`, timestamps | mixed | overview risk profile and action metrics | Read | grouped by `network_id` | findings may be generated when table empty | severity and non-compliant priority remapped before use | |
| Networks | Relationships | `tsaat` | `network_declared_system`, `network_declared_asset`, `network_target_state_asset` | `network_id`, `system_id`, `asset_id`, `asset_type`, `asset_name` | string | declared/discovered scope and target-state planning context | Read | same snapshot joins | target-state rows are name-only by asset type | informational scope support | target-state records are consumed directly by discovery network summary matching |
| Networks | Discovery settings | `tsaat` | discovery settings and discovery coverage rule tables | version, tool scope columns, detection keys, rule values | mixed | discovery compliance score by network, drill-through tool values, exports, reports | Read | latest settings version and DB detection rules applied to all evaluations | defaults if no saved settings exist | SQL evaluation through `usp_evaluate_discovery_coverage_snapshot` | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Networks compliance | overview posture tile | compliant network rollup counts divided by all network rollup counts | runtime network rollups | Runtime | backend | returns `0` with no rollups |
| Discovery compliance by network | posture table and KPI summary | compliant SQL discovery coverage rows divided by total asset coverage rows in network | `usp_evaluate_discovery_coverage_snapshot`, discovery settings, discovery detection metadata | Runtime SQL result | SQL Server/backend | only assets with SQL coverage rows contribute |
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
- `net-unassigned` / `Unassigned Systems` remains in the database for loader integrity but is excluded from network filters, network-model counts, drill-down routes, and network reports.
- ICT system, environment, and criticality are intentionally hidden from the visible filter bar.
- The posture tab is the source of drill-down navigation into network detail.
- Summary slideouts and posture rows may show fallback descriptive metadata when source fields are blank; loaded ATO, DIIS, and APM reference values are populated by seed data, loader fallback, and migration backfill.

## 10. Open Questions / Gaps
- **Open question:** should the `DPE` and `DSE` labels in the overview reflect environment type or security domain? The implementation follows environment type.
- **Open question:** should the overview modelling card migrate from the current discovery-status proxy to persisted `managed_network.modelling_status`?
- **Open question:** should the posture slideout and full drill-down page always show the same metadata source, or should fallback-generated values be visually marked?
