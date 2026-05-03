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
- **What it does:** identifies the selected network, exposes the back link, and shows headline score cards without header pills.
- **User perspective:** the user can confirm the network and return to the networks posture list.
- **System behaviour:** the page resolves the route parameter, scopes analytics to the network, and recalculates compliance and discovery scores for the active drill-through context.
- **Outcome:** all downstream tabs share one network anchor.

### Feature: Visible Tab Navigation and Detailed Topology Modal
- **What it does:** switches among visible tabs and opens a topology modal.
- **User perspective:** the user can move between metadata, compliance, and discovery views, and open a richer topology representation.
- **System behaviour:** `networkDetailTab` in the query string controls the main tab; the topology view is a client-side modal fed by runtime topology data built from snapshot relationships and CI dependencies.
- **Outcome:** tab states are bookmarkable; topology is not.

### Feature: Details Tab
- **What it does:** shows Details Overview, Impact Overview, and Risk Overview sections.
- **User perspective:** the user sees descriptive context, network impact, and current risk profile in a compact three-column layout.
- **System behaviour:** Details Overview contains bounded description, owner, support email, service catalogue actions, and an ATO-only Security Accreditation tile. Impact Overview lists linked ICT systems, opening each system drill-through in a new browser tab/window, and asset-type footprint counts. Risk Overview embeds the existing risk profile and trend charts. Persisted network APM/DIIS values remain in the data contract for compatibility, but the Network Details tab does not render APM or Defence ICT Inventory tiles and does not display DIIS ID.
- **Outcome:** the tab acts as the narrative and ownership view for the network.

### Feature: Compliance Overview Tab
- **What it does:** shows per-SPI compliance rows and a deep drillthrough to findings, affected assets, and CVE vulnerability details.
- **User perspective:** the user can inspect the reasons a network is non-compliant and open evidence-heavy side panels.
- **System behaviour:** runtime measure rows, findings, all asset CVE vulnerabilities, and six-type asset counts are passed into `NetworkComplianceOverview`, which supports additional non-route drillthrough layers, a severity-visible compliance details table, and a CVE criticality filter.
- **Outcome:** the page exposes evidence behind the network posture score.

### Feature: Discovery Compliance Tab
- **What it does:** shows discovery tool scorecards and a searchable asset coverage table, with CSV export.
- **User perspective:** the user can see exactly which assets fail required tool coverage and export that list.
- **System behaviour:** discovery coverage is evaluated per asset from runtime settings; scorecards and table tool columns are generated from tools required for at least one asset type in the current network scope. Query params support search, asset-type filtering, dynamic tool filtering, and pagination. Asset-type filtering uses the shared six-type taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`), and non-applicable asset/tool cells display `N/A`.
- **Outcome:** discovery remediation can be actioned at asset level.

### Feature: Hidden `cyber-posture` Route State
- **What it does:** renders KPI snapshot tiles, asset inventory, and P1/P2 findings filters when `networkDetailTab=cyber-posture`.
- **User perspective:** this state is not reachable from the visible tab strip, but it can be opened by direct URL.
- **System behaviour:** the server component accepts the route state and renders it fully, including KPI filters, pagination, and findings filtering.
- **Outcome:** latent behaviour exists in production code and must be documented.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Network Detail | Shared scope header | Identifies selected network and current KPI filter state | Open page or adjust query params | Rebuilds scoped analytics and headline score cards | route param, `dataDate`, `kpiFilter` | Header title and scores | all tabs share same network anchor | invalid route param returns not-found earlier in page load | snapshot loader, route param | Stable drill-through context | scope pills are intentionally not rendered under the heading |
| Network Detail | Tab routing | Switches among visible tabs | Click tab | Updates `networkDetailTab` and reloads | `networkDetailTab` | Different drill-through layout | default tab is `network-details` | unsupported values fall back to default except hidden state is accepted explicitly | `NetworkDetailTabs` | Bookmarkable tab states | topology modal state is local |
| Network Detail | Details tab | Details, impact, and risk overview sections | Open tab | Resolves metadata, linked systems, asset-type footprint, ATO accreditation, and risk profile into three bounded columns | network detail fields, network-scoped systems, network assets, findings | Narrative, impact, and risk context | metadata may fall back when source columns blank; ATO displays from stored/backfilled value; network APM and DIIS references remain loaded but are not shown as Details tab tiles or fields | none | `resolveNetworkDetailFields()`, `NetworkDetailRiskCharts`, Link components | Narrative network view | support and service links may be synthetic; DIIS is not shown in the Network Details tab |
| Network Detail | Compliance Overview | SPI measure table with findings drillthroughs | Open tab, click a measure, click finding title, optionally click CVE count | Opens layered overlays for findings, linked assets, and CVE details with criticality filtering; compliance detail rows show severity next to timestamp and omit the scope column; shows all six asset-type tiles even where counts are zero | measures, findings, asset vulnerability index, scoped assets | Evidence drillthrough chain | evidence must reflect the selected `asOf` date; CVE export follows active search and criticality filters | filtering is runtime only | `NetworkComplianceOverview` | Explains non-compliance | Non-route multi-step drillthrough |
| Network Detail | Discovery Compliance | Dynamic tool scorecards, search, filters, export | Filter table, click tool tiles, export CSV | Applies discovery filters via query string and exports current scope with configured tool columns | `discoverySearch`, `discoveryAssetType`, `discoveryToolFilter`, `page` | Asset coverage table and CSV | coverage is based on tools required by current scope asset types only | invalid or non-applicable tool filter ignored | discovery settings, export API | Discovery remediation list | `discoveryAssetType` accepts all six canonical asset types; `N/A` cells are excluded from denominators |
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
| Network Detail | Network metadata | `tsaat` | `managed_network` | `network_id`, `name`, `classification`, ownership and link columns, `diis_id`, `ato_number`, `apm_number`, `modelling_status`, `discovery_status` | mixed | header, details tab, discovery summary | Read | root network record for page | deterministic ATO, DIIS, and APM values are loaded/backfilled; legacy blank references display as `Missing`; descriptive blanks may use fallback display values | direct display | network modelling status is persisted for future use |
| Network Detail | Network hierarchy and topology | `tsaat` | `managed_network_hierarchy`, `ict_system_hierarchy`, `network_declared_system`, `network_declared_asset`, `ci_dependency` | parent-child keys and dependency fields | string, enum-like | topology modal and relationship context | Read | combined into topology graph | no persisted graph view | runtime graph build | topology includes synthetic relation edges |
| Network Detail | Asset evidence | `tsaat` | `asset`, child posture tables, `asset_vulnerability` | asset identity, OS, patch, software, vulnerability fields including CVE `criticality` | mixed | compliance overview, discovery table, asset inventory | Read | joined by `asset_id` inside one snapshot | assets filtered by network and optional KPI filters | runtime SPI, exposure, discovery evaluation, and CVE criticality filtering | |
| Network Detail | Findings | `tsaat` | `finding` | IDs, scope columns, `priority_rank`, `severity`, timestamps, `evidence`, `recommended_action` | mixed | compliance drillthroughs, hidden cyber posture, risk charts | Read | findings linked to assets, systems, and network | synthetic fallback if no rows loaded | severity and non-compliant priority remap applied at runtime | |
| Network Detail | Settings-driven logic | `tsaat` | measures and discovery settings tables | version and detail columns | mixed | compliance severity and discovery rules | Read | latest settings versions applied | defaults if settings tables are empty | runtime only | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Header compliance score | top-right summary donut | compliant statuses divided by total statuses in current drill-through context | runtime evaluations or compliance-overview subset | Runtime | backend | switches source when compliance overview tab is active |
| Discovery compliance score | top-right discovery donut | compliant discovery rows divided by compliant + non-compliant + other rows | runtime discovery coverage rows | Runtime | backend | `other` bucket covers N/A or no-applicability states |
| Compliance overview measure score | per-SPI analysis | compliant count divided by total evaluations for the SPI | runtime measure rows | Runtime | backend | zero-safe |
| KPI snapshot tiles | hidden cyber-posture analysis | count assets or findings matching each KPI filter over current network scope; trend uses last 12 snapshots | assets, findings, snapshot history | Runtime | backend | hidden route state only |
| Discovery tool scorecards | discovery tab tool summary | covered assets divided by applicable assets per tool; only tools required for at least one scoped asset type are shown | discovery coverage rows and discovery settings | Runtime | backend | asset type scope can mark a tool as N/A, which is excluded from tool denominators |
| Asset coverage compliance | discovery table | `coverageCompliance = missing required tools count == 0` | discovery settings plus asset evidence | Runtime | backend | N/A tools do not count against compliance |
| Asset inventory critical vulnerability count | hidden cyber-posture inventory | count vulnerabilities where `severity = Critical` per asset | `asset_vulnerability` | Runtime | backend | hidden route state only |
| Findings drillthrough history | compliance overview panel | reconstruct open count over two years from finding open and close timestamps | findings | Runtime | backend and client | uses `workflowStatusAtAsOf` |

## 8. Non-Database Calculations
- `DetailedTopologyView` creates runtime graph layouts and client-only interactions from already-loaded topology data.
- Compliance overview side panels, asset detail overlays, and the all-CVE detail modal with criticality filtering are client-only UI states.
- Hidden cyber-posture P1/P2 findings list caps visible rows at `80`.
- Discovery search, tool filter, and asset-type filter are query-parameter-driven view filters over the already selected snapshot.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- The visible tab strip does not expose every route state the page supports.
- Discovery CSV export is scoped to the current network and current discovery query state.
- Metadata fields may be synthetic when source columns are blank. Persisted network reference fields remain loaded/backfilled for compatibility, but the Details tab only displays the ATO reference in Security Accreditation.
- The page combines server-rendered scope logic with client-only overlay drillthroughs.

## 10. Open Questions / Gaps
- **Open question:** should `networkDetailTab=cyber-posture` remain supported if it is not reachable from the visible tab bar?
- **Open question:** should generated fallback values for owner, support email, service catalogue URL, and GRC be visually marked as inferred values?
- **Open question:** is the topology modal intended to be a read-only analysis surface, or should it support the same exports and filters as the parent page?
