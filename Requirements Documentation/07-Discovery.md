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
- `/api/discovery-coverage/target-state-template`
- `/api/discovery-coverage/network-report`
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
- **System behaviour:** the server strips `criticality` for all discovery views, strips the synthetic loader-only `net-unassigned` network from Discovery network filter options and all Discovery network/asset calculations, treats a manually supplied `network=net-unassigned` query as `All`, and additionally strips `system` and `environment` when the target-state tab is active; asset type options use the shared six-type taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
- **Outcome:** some user-supplied filter state is intentionally ignored by the page.

### Feature: Summary Tab
- **What it does:** shows current coverage snapshot cards and discovery coverage by tool.
- **User perspective:** the user sees the current discovery gap picture first, with the coverage-by-tool analysis taking the available workspace.
- **System behaviour:** the page builds in-scope asset rows and calculates compliant, non-compliant, and tool coverage counts. The coverage-by-tool panel expands into the remaining tab height.
- **Outcome:** the summary tab acts as the operational view of current discovery coverage.

### Feature: Coverage-by-Tool Drillthrough
- **What it does:** shows tool-level coverage statistics, a radar chart, and a slideout of asset rows for one selected tool.
- **User perspective:** the user can click a tool, inspect assets missing that tool, filter within the slideout, and export CSV.
- **System behaviour:** the client fetches paged rows from `/api/discovery-coverage/tool-assets` using the current page filters plus `toolId`, `toolSearch`, `toolAssetType`, `page`, and `pageSize`.
- **Outcome:** discovery gaps can be traced to tool-by-asset detail without leaving the page.

### Feature: Coverage-by-Network Tab
- **What it does:** shows row-per-network tool coverage with network metadata, a per-network coverage-by-tool radar chart, a per-tool coverage table, a network drill-down link, and a per-network PDF report action.
- **User perspective:** the user can review discovery coverage posture across networks without opening a slideout, including owner, accreditation details, security domain, and a scoped discovery gaps report.
- **System behaviour:** rows are aggregated from scoped assets and tool coverage results per network; managed networks still render when no aggregate exists, excluding only the synthetic `net-unassigned` row. Discovery-enabled networks use network-detail resolver fallbacks where source values are blank, while discovery-disabled networks show only stored/available fields and leave unavailable owner, accreditation, DIIS/GRC, radar, and coverage-table sections blank. ATO and DIIS tiles show stored `ato_number` and `diis_id` values when present. Each row provides a drill-down link to `/networks/[networkId]` and a `Generate Network Discovery Report` link to `/api/discovery-coverage/network-report` while preserving `dataDate` and active filters. The filter container shows a right-aligned `Total Network` count based on the currently filtered row set.
- **Outcome:** network-level operational coverage review is available as a first-class tab.

### Feature: Network Discovery Tab
- **What it does:** shows `Network Discovery Summary` table only.
- **User perspective:** the user sees modelling status, discovery-enabled status, a drill-down link per network row, and per-asset-type target/discovered totals with charted target-vs-discovered comparisons. The tab can be filtered by modelling status and discovery-enabled state. Opening a row slideout exposes a `Generate Target State Template` workbook action.
- **System behaviour:** discovered assets are matched to target-state assets using trim+lowercase name matching plus exact asset type after removing the synthetic `net-unassigned` row and any unassigned assets from the Discovery scope; summary cells render grouped bars when either target or discovered sets exist, and one-sided cells show `Target State Missing` or `Discovery Missing` as a compact callout below the chart. The combined `Target State Missing + Discovery Missing` state remains message-only with no chart. The filter container shows a right-aligned `Total Network` count based on the currently filtered network-discovery rows. The `modellingStatus=modelled|not-modelled` and `discoveryEnabled=enabled|not-enabled` query filters reduce the network rows before target-state summaries are built. The template endpoint loads the selected snapshot, fills the Excel `Network Details` sheet from the same resolved network detail values used by the slideout, and pre-populates the `Assets` sheet with existing target-state asset names and asset types for the selected network.
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
| Discovery | Shared scope | Common filter scope with hidden stripping rules | Apply filters | Re-runs analytics after removing unsupported filter keys and excluding the loader-only `net-unassigned` bucket from Discovery network/asset calculations | filter query params | Filtered discovery view | `criticality` and `net-unassigned` are ignored everywhere; `system` and `environment` ignored for target-state | query parsing only | `FilterBar`, `getCoreAppData()` | Discovery-specific view scope | synthetic `Unassigned Systems` is not offered in the Discovery network filter or network rows |
| Discovery | Summary tab | Operational discovery dashboard | Open tab | Builds coverage snapshot cards and fills the remaining tab area with coverage-by-tool analysis | scoped assets, discovery settings | Snapshot cards and coverage-by-tool panel | reflects current filtered scope | none beyond scope parsing | `DiscoveryCoverageByToolSection` | Discovery gap summary | remediation report launcher removed from this tab |
| Discovery | Coverage-by-tool drillthrough | Tool-level asset detail slideout | Click tool, search, filter, paginate, export CSV | Calls tool-assets API and renders slideout rows | `toolId`, `toolSearch`, `toolAssetType`, pagination params | Slideout rows and CSV | pagination defaults to 200, export batches up to 5000 | invalid API params return client error messages | `/api/discovery-coverage/tool-assets` | Tool-specific gap evidence | non-route slideout |
| Discovery | Coverage-by-network | Row-based network coverage summary with accreditation facts, per-network radar visualisation, per-tool coverage table, and per-network PDF report action | Open tab, apply filters, drill down, generate network report | Aggregates covered/missing/applicable tool stats by network, includes managed networks that have no scoped asset aggregate, resolves descriptive metadata fallbacks only for discovery-enabled networks, renders only stored fields for discovery-disabled networks, renders radar/table coverage only when measured coverage is available, and provides data-date-aware drill-down and network report links | scoped asset coverage rows + managed network metadata + optional `dataDate` query | Network rows with available metadata, optional radar visual + per-tool table + overall coverage badges + drill-down link + PDF report link | report is forced to the selected tile network while preserving other active filters; discovery-disabled network tiles do not show zero-filled measured coverage | zero-safe percentages, zero-safe drill-down date handling, missing network returns API error | `DiscoveryCoverageByNetworkSection`, `CoverageByToolRadar`, `withDataDate`, network detail resolver, `/api/discovery-coverage/network-report` | First-class network coverage view with direct navigation into network drill-through and report export | PDF follows the SPI report visual style and includes target-state discovery, tool coverage, Annex A discovered assets, and Annex B gap assets; `net-disabled-reference` demonstrates blank unavailable-data rendering |
| Discovery | Network discovery summary | Compare DB-backed target state and matched discovered totals by network and asset type | Open tab, apply filters, use drill-down links, generate target-state template | Resolves target-state names from DB after excluding `net-unassigned`, applies modelling-status and discovery-enabled row filters, matches discovered assets by normalized name + asset type, renders per-cell totals + grouped bar chart when either side exists, provides row-level drill-down links to network detail, and fills a network-specific Excel target-state template from stored network fields | real networks, scoped non-unassigned assets, `modellingStatus`, `discoveryEnabled`, network target-state assets, optional `dataDate` | Network summary table with `Drill Down`, `Modelling Status`, `Discovery Enabled`, per-asset-type target/discovered visuals, and a target-state template download | target-state ignores system and environment filters; synthetic `Unassigned Systems` is not a network; template filename is `<network name> target state template.xlsx` | name normalization is trim+lowercase; matched count is 1:1 by name+type; missing template network returns API error; invalid status filter values are ignored | `NetworkDiscoverySummaryTableClient`, target-state matching helper, `withDataDate`, `/api/discovery-coverage/target-state-template` | Network discovery posture view with direct network navigation and target-state workbook creation | one-sided missing states render compact callouts below chart; combined missing state remains message-only; template uses `data/templates/network-target-state-template.xlsx` |
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
| Discovery | Network context | `tsaat` | `managed_network` | `network_id`, `name`, `diis_id`, `ato_number`, `modelling_status`, `discovery_status`, ownership and link columns | mixed | target-state rows, summary table, network slideout | Read | assets join to network via `network_id` | discovery status drives enabled vs not-enabled labels | direct display and grouping | network modelling status is shown as its own Network Discovery Summary column |
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
| Target-state Excel template | pre-fill a network-specific target-state import workbook | copy the bundled workbook template, write network details into `Network Details!B1:B6`, and write existing target-state asset rows into the `Assets` sheet | resolved network detail fields, `managed_network.diis_id`, `network_target_state_asset`, and `data/templates/network-target-state-template.xlsx` | Runtime | API layer | description, ATO, owner, and support mailbox use the same fallbacks as the slideout; asset rows are written in canonical asset-type order; `net-unassigned` is rejected |
| Tool-assets API pagination | limit slideout payload size | page and pageSize slice filtered rows; export loops through pages up to 5000 rows per request | query params plus runtime filtered rows | Runtime | API layer | pageSize defaults to 200 and maxes at 5000 |

## 8. Non-Database Calculations
- Tool coverage heuristics are application rules rather than stored facts. Examples include using vulnerability presence for SIEM coverage and asset type for Tanium or Elastic applicability.
- Slideout loading progress, open/close state, search debounce, and CSV assembly are client-side only.
- Network summary slideouts reuse resolved detail fields and may include fallback metadata where source columns are blank. The coverage-by-network ATO and DIIS tiles intentionally do not use generated fallbacks; blank source values render as `Missing`.

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
