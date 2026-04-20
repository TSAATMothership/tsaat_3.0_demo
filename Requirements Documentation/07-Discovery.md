# Discovery

**Page Path:** `/discovery-coverage`

## 1. Page Overview
- **Page name:** Discovery
- **Purpose:** provide enterprise-level visibility of discovery tooling coverage, target-state coverage, and the configurable discovery tool model used by the application.
- **User outcome:** the user can understand current discovery gaps, compare networks against target-state expectations, and maintain the tool configuration that drives discovery compliance.
- **Primary user roles:** discovery tool owners, CMDB and asset inventory teams, cyber analysts, architecture teams, platform governance teams.

## 2. Page Summary
This page is the discovery-coverage workspace. It provides `summary`, `target-state`, and `tool-settings` tabs.

Major dependencies:

- `getCoreAppData()`
- `DiscoveryCoverageTabs`
- `DiscoveryCoverageByToolSection`
- `NetworkDiscoverySummaryTableClient`
- `DiscoveryCoverageTargetStateSection`
- `DiscoveryToolsSettingsPanel`
- `/api/discovery-coverage/remediation-report`
- `/api/discovery-coverage/tool-assets`
- `/api/discovery-tools/settings`

Important hidden behaviour:

- the page always removes `criticality` before loading analytics.
- when `discoveryCoverageTab=target-state`, the page also removes `system` and `environment` before loading analytics.
- target-state values are partly synthetic and are calculated in the application layer rather than sourced from stored target records.

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

### Feature: Target-State Tab
- **What it does:** shows target-state coverage by network and the network summary slideout.
- **User perspective:** the user compares current discovered asset counts against expected target counts per network and asset type.
- **System behaviour:** actual counts come from scoped assets, but target counts are inferred using deterministic runtime percentages and adjustment logic.
- **Outcome:** the page presents a target-state comparison even though target numbers are not stored in the database.

### Feature: Tool Settings Tab
- **What it does:** lets users add, remove, edit, and save discovery tool definitions and required asset-type mappings across all six canonical asset types.
- **User perspective:** the user maintains the discovery tool master data used by compliance evaluation.
- **System behaviour:** the client enforces required-field validation and saves the tool list through `/api/discovery-tools/settings`.
- **Outcome:** future discovery evaluations immediately use the saved tool configuration.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Discovery | Tab routing | Switches among summary, target-state, and tool-settings | Click tab | Updates `discoveryCoverageTab` query parameter | `discoveryCoverageTab` | Different layout | summary is default | unsupported values fall back to summary | `DiscoveryCoverageTabs` | Bookmarkable tab state | |
| Discovery | Shared scope | Common filter scope with hidden stripping rules | Apply filters | Re-runs analytics after removing unsupported filter keys | filter query params | Filtered discovery view | `criticality` is ignored everywhere; `system` and `environment` ignored for target-state | query parsing only | `FilterBar`, `getCoreAppData()` | Discovery-specific view scope | hidden implementation rule |
| Discovery | Summary tab | Operational discovery dashboard | Open tab | Builds coverage snapshot cards and remediation report URL | scoped assets, discovery settings | Snapshot cards and report link | report reflects current filtered scope | none beyond scope parsing | remediation-report API | Discovery gap summary | |
| Discovery | Coverage-by-tool drillthrough | Tool-level asset detail slideout | Click tool, search, filter, paginate, export CSV | Calls tool-assets API and renders slideout rows | `toolId`, `toolSearch`, `toolAssetType`, pagination params | Slideout rows and CSV | pagination defaults to 200, export batches up to 5000 | invalid API params return client error messages | `/api/discovery-coverage/tool-assets` | Tool-specific gap evidence | non-route slideout |
| Discovery | Target-state comparison | Compare actual counts with target counts per network | Open tab, open network slideout | Derives target counts from deterministic percentages and actual counts | networks, scoped assets | Network summary table, charts, slideout | target-state ignores system and environment filters | zero-safe percentages | target-state section components | Target-state planning view | uses synthetic target values |
| Discovery | Tool settings | Maintain discovery tool master data | Add/edit/remove tools, save | Validates required fields and persists settings | tool definitions and asset-type scope | Updated discovery tool settings | `N/A` excludes an asset type from coverage checks; each tool carries all six canonical asset-type keys | tool name, description, owner, and operations manager required | `/api/discovery-tools/settings` | Updated rules for future coverage evaluation | defaults normalize to `required` for every asset type key |

## 5. Database Mapping
The page reads the shared snapshot dataset, the discovery tool settings tables, and related reference context. Most summary values are assembled at runtime from asset-level evidence and the configured tool model.

Primary data dependencies:

- `tsaat.asset`
- `tsaat.asset_vulnerability`
- `tsaat.asset_patch_state`
- `tsaat.asset_operating_system`
- `tsaat.asset_network_os`
- `tsaat.managed_network`
- `tsaat.ict_system`
- `tsaat.discovery_tools_settings_version`
- `tsaat.discovery_tool`
- `tsaat.discovery_tool_asset_scope`

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Discovery | Network context | `tsaat` | `managed_network` | `network_id`, `name`, `discovery_status`, ownership and link columns | mixed | target-state rows, summary table, network slideout | Read | assets join to network via `network_id` | discovery status drives enabled vs not-enabled labels | direct display and grouping | some slideout metadata can use fallback network detail logic |
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
| Discovery target percent | derive target-state baseline | `deterministicDiscoveryPercent(seed)` returns a stable value from 90 to 100 based on `networkId:assetType` | network ID plus asset type | Runtime | backend | synthetic; not DB-backed |
| Target count for actual | convert current counts to expected total counts | if actual <= 0 then 0; if actual < 10 then actual; otherwise back-calculate target from actual / percent and reduce until coverage stays >= 90% | actual counts plus synthetic percent | Runtime | backend | synthetic planning logic |
| Target-state coverage percent | compare actual versus target | `actual / target * 100`, rounded to one decimal | actual and target counts | Runtime | backend | zero-safe |
| Tool-assets API pagination | limit slideout payload size | page and pageSize slice filtered rows; export loops through pages up to 5000 rows per request | query params plus runtime filtered rows | Runtime | API layer | pageSize defaults to 200 and maxes at 5000 |

## 8. Non-Database Calculations
- Tool coverage heuristics are application rules rather than stored facts. Examples include using vulnerability presence for SIEM coverage and asset type for Tanium or Elastic applicability.
- The target-state model is synthetic. No stored target table is used.
- Slideout loading progress, open/close state, search debounce, and CSV assembly are client-side only.
- Network summary slideouts reuse resolved detail fields and may include fallback metadata where source columns are blank.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- `criticality` is intentionally ignored for discovery analytics.
- `system` and `environment` are intentionally ignored on the target-state tab.
- Discovery compliance depends on the latest saved discovery tool settings.
- Discovery tool scope stores six canonical asset-type keys for every tool and defaults each key to `required`.
- The target-state tab mixes real asset counts with synthetic target values.
- Tool settings changes affect subsequent runtime evaluations rather than historical snapshot facts.

## 10. Open Questions / Gaps
- **Open question:** should the page continue to silently ignore `criticality`, and on target-state also ignore `system` and `environment`, or should those filters be disabled in the UI to avoid ambiguity?
- **Open question:** is the synthetic target-state model an accepted business rule, or should target values come from persisted planning data?
- **Open question:** should the network summary slideout explicitly label fallback metadata and generated URLs as inferred values?
