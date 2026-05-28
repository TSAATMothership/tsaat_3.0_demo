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
- `/api/systems/[systemId]/discovery-coverage-export`
- runtime topology generation from dataset relationships and CI dependencies

Important hidden behaviour:

- the page accepts `environment`, `serverSearch`, and `kpiFilter` query parameters and applies them server-side even though no visible in-page control currently exposes them.
- several descriptive fields are synthesised when source columns are blank; Details Overview reference tiles use stored ATO, APM, and DIIS fields, which are populated during load/migration and display `Missing` only for legacy/non-DB objects where absent.
- KPI trend series and some scoped helper links are computed in code but not rendered in the visible UI.

## 3. Feature Breakdown
### Feature: Header, Breadcrumb, and Shared Drill-Through Scope
- **What it does:** identifies the selected ICT system, exposes the back link, and recalculates headline score cards without header pills.
- **User perspective:** the user confirms the selected system, its parent network, current scope, and whether hidden scope filters are active.
- **System behaviour:** the route parameter anchors the page to one system; optional `environment`, `serverSearch`, and `kpiFilter` parameters reduce the effective asset and finding scope before downstream tabs render.
- **Outcome:** every downstream tab shares one scoped system context.

### Feature: Visible Tab Navigation and Detailed Topology Modal
- **What it does:** switches between visible tabs and opens the detailed topology modal.
- **User perspective:** the user can move between metadata, compliance evidence, and discovery coverage, and open a richer topology surface for CI relationships.
- **System behaviour:** `systemDetailTab` in the query string controls the main visible tab; the topology modal is client-side only and receives runtime topology data built from the snapshot model. The embedded impact analyser labels the SPI axis as Security Posture Indicator, exposes CI Analyser focus only for selected assets with CI links, and opens a read-only Asset Details slide-out from selected asset nodes; the CI Focus analyser exposes the same details action for selected Asset and Related Asset nodes.
- **Outcome:** tab states are bookmarkable; topology modal state is not.

### Feature: Details Tab
- **What it does:** shows three left-to-right sections: Details Overview, Impact Overview, and Risk Overview.
- **User perspective:** the user gets the narrative, ownership, business impact, and risk context for the selected system without the tab becoming vertically oversized.
- **System behaviour:** Details Overview contains the bounded description panel, owner, support email, service catalogue items, accreditation data, APM details, and DIIS details; Impact Overview contains mission capabilities and business services; Risk Overview embeds the existing risk profile and risk trend charts. The page uses source columns where present and fills descriptive gaps with deterministic fallback values based on the system ID and name; Details Overview ATO, APM, and DIIS reference values display stored database values or `Missing`, and DIIS links are not rendered in the Details tab.
- **Outcome:** the tab acts as the business and support profile for the system while keeping long text and lists contained with internal scrolling.

### Feature: Compliance Overview Tab
- **What it does:** shows per-SPI compliance rows and deep drillthroughs to findings, affected assets, and CVE vulnerability detail.
- **User perspective:** the user can inspect why the system is non-compliant and navigate from summary measures into evidence.
- **System behaviour:** the system detail page reuses `NetworkComplianceOverview`, passing system-scoped measures, findings, all asset CVE vulnerabilities, and six-type asset counts with a severity-visible compliance details table and CVE criticality filtering.
- **Outcome:** the page exposes the evidence behind the system posture score.

### Feature: Discovery Compliance Tab
- **What it does:** shows discovery tool scorecards and a paginated asset coverage table for the current system scope, with CSV export.
- **User perspective:** the user can see which in-scope assets fail required discovery tool coverage and export the scoped asset list.
- **System behaviour:** tool values are derived at runtime from discovery settings and asset evidence; scorecards and table tool columns are generated from tools required for at least one asset type in the current system scope. Pagination uses `coveragePage` and `coveragePageSize`. Asset rows and tool applicability respect the shared six-type asset taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`), and non-applicable asset/tool cells display `N/A`.
- **Outcome:** discovery gaps can be actioned at asset level.

### Feature: Latent Query-Driven Scope States
- **What it does:** accepts environment, KPI, server-search, and P1/P2 finding filter parameters through the URL.
- **User perspective:** users can reach narrower scopes by direct URL or linked query state, but not all controls are visibly rendered on the page.
- **System behaviour:** the server filters assets, counts, discovery rows, and findings before the visible tab content is rendered.
- **Outcome:** bookmarkable hidden scopes exist and materially change scores and lists.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ICT System Detail | Shared scope header | Identifies selected system and current hidden scope filters | Open page or alter query params | Rebuilds scoped analytics and headline score cards | route param, `dataDate`, `environment`, `serverSearch`, `kpiFilter` | Header title and scores | all tabs share one system anchor | invalid system route returns not-found | snapshot loader, route param | Stable drill-through context | hidden scope filters still apply but are not rendered as header pills |
| ICT System Detail | Tab routing | Switches among visible tabs | Click tab | Updates `systemDetailTab` and reloads | `systemDetailTab` | Different drill-through layout | default tab is `system-details` | unsupported values fall back to default | `SystemDetailTabs` | Bookmarkable tab state | topology modal state is local |
| ICT System Detail | Details tab | Details, impact, and risk overview sections | Open tab | Resolves details, stored accreditation references, impact lists, links, and risk profile into three bounded columns | system columns, mission and service links, findings | Narrative, impact, and risk view | fallback descriptive metadata allowed when source columns blank; Details Overview ATO, APM, and DIIS values display stored values or `Missing`; long description and list content scrolls within its section | none | `NetworkDetailRiskCharts`, Link components | Operational context | DIIS links are not rendered in the Details tab; missing reference values are not generated |
| ICT System Detail | Compliance Overview | SPI table with findings and CVE drillthroughs | Open tab, click measure, finding, asset, or CVE count | Opens layered overlays over system-scoped evidence, including all CVEs with criticality filtering; compliance detail rows show severity next to timestamp and omit the scope column; shows all six asset-type tiles even where counts are zero | measures, findings, asset vulnerability index, scoped assets | Evidence drillthrough chain | evidence respects selected `dataDate`; CVE export follows active search and criticality filters | runtime filtering only | `NetworkComplianceOverview` | Explains non-compliance | non-route layered drillthrough |
| ICT System Detail | Discovery Compliance | Dynamic tool cards, asset coverage list, and CSV export | Open tab, paginate, export CSV | Evaluates tool coverage per asset, paginates configured tool columns, and exports current scope | discovery settings, scoped assets, `coveragePage` | Coverage cards, table, and CSV | coverage is based on tools required by current scope asset types only | invalid page values clamp through pagination helper | discovery settings, export API | Discovery remediation list | all six canonical asset types are supported; `N/A` cells are excluded from denominators |
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
| ICT System Detail | System metadata | `tsaat` | `ict_system` | `system_id`, `network_id`, `name`, `criticality`, `security_domain`, description, ownership and link columns, `diis_id`, `ato_number`, `apm_number`, `modelling_status`, `diis_defined` | mixed | header, details tab, accreditation tables | Read | root record for the page | ATO, APM, and DIIS reference values are loaded/backfilled; legacy blank Details Overview references display as `Missing`; descriptive blank fields may use fallback values | direct display | synthetic support and service catalogue URLs may appear |
| ICT System Detail | Mission, service, and environment context | `tsaat` | `system_mission_capability`, `system_business_service`, `system_environment`, `system_environment_asset` | IDs, names, `criticality`, `environment_type`, `asset_id` | mixed | mission/service lists, scope badges, environment-aware counts | Read | one system to many related rows | environment filter must match a defined environment type | joined into lists and scoped counts | |
| ICT System Detail | Asset posture | `tsaat` | `asset`, `asset_operating_system`, `asset_network_os`, `asset_patch_state`, `asset_installed_software`, `asset_vulnerability` | asset identity, optional `cmdb_record_url`, lifecycle, OS, patch, software, vulnerability fields including CVE `criticality` | mixed | compliance rows, discovery rows, risk charts, Asset Details slide-out | Read | scoped to assets where `asset.system_id = system_id` | hidden query parameters may narrow further; CMDB link shows `Not supplied` when absent | runtime SPI, discovery evaluation, and CVE criticality filtering | |
| ICT System Detail | Findings | `tsaat` | `finding`, `usp_get_effective_findings_snapshot` | IDs, scope columns, display priority/severity, timestamps, `evidence`, `recommended_action` | mixed | compliance drillthroughs, risk charts, P1/P2 filters | Read | findings linked to assets and system via scope columns | severity and non-compliant priority remap is applied by SQL effective findings | SQL-produced workflow status is used by reused components | |
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
| Discovery tool scorecards | discovery tab summary | covered assets divided by total applicable assets per tool; only tools required for at least one scoped asset type are shown | discovery coverage rows and discovery settings | Runtime | backend | asset-type scope can make a tool N/A, which is excluded from tool denominators |
| Asset discovery compliance | discovery table | `coverageCompliance = missing required tools count == 0` | discovery settings plus asset evidence | Runtime | backend | N/A tools do not count against compliance |
| P1/P2 findings filters | hidden scoped list | filter by SPI, priority, severity, search term, environment, and KPI-matched assets | findings plus request params | Runtime | backend | page contains this logic even though the list is not exposed as a separate visible tab |

## 8. Non-Database Calculations
- `DetailedTopologyView` creates runtime graph layouts and modal-only interactions from already loaded topology data; the Asset Details slide-out is a read-only renderer over the selected analyser row, including CI Focus Asset and Related Asset rows, and optional asset `cmdb_record_url`.
- The page synthesises description, owner, support email, and service catalogue URL when source columns are blank; Details Overview ATO, APM, and DIIS reference values are shown from database fields or as `Missing`.
- Compliance overview side panels, asset detail overlays, and the all-CVE detail modal with criticality filtering are client-only UI states.
- Query-driven scopes for `environment`, `serverSearch`, and `kpiFilter` are runtime view filters over the selected snapshot, not persisted state.
- Several helper links and KPI trend series are calculated in code but not currently rendered in the visible UI.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- The visible tab strip exposes only three tabs.
- Hidden query parameters materially affect counts, lists, and headline scores.
- Discovery coverage is evaluated from current discovery tool settings, not from persisted per-tool result rows.
- Fallback descriptive metadata and service URLs may be synthetic rather than sourced from the database.

## 10. Open Questions / Gaps
- **Open question:** should the page expose visible controls for `environment`, `serverSearch`, and `kpiFilter`, or are these route states intended to remain hidden?
- **Open question:** should generated fallback values for support metadata be visually marked as inferred values?
- **Open question:** should the currently calculated KPI trend series and scoped helper links be surfaced in the UI, or removed if they are not part of the intended design?
