# TSAAT Solution Design Index

## Consolidated Specification
- Primary single-document specification: [TSAAT Solution Design](TSAAT%20Solution%20Design.md)
- Consolidation date: 2026-04-21
- Legacy per-page files in this folder remain as source sections and traceability references.

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
| `/settings` | operations menu | [11-Settings.md](11-Settings.md) | database settings plus placeholder tabs |

## Cross-Cutting Specifications
- [12-Asset-Taxonomy-and-SPI-Applicability.md](12-Asset-Taxonomy-and-SPI-Applicability.md): canonical six-type asset taxonomy, SPI applicability contract, settings normalization, and schema-domain requirements.
- [13-Authentication-and-Login.md](13-Authentication-and-Login.md): app-wide login gate, server/client session checks, logout, and password lifecycle controls.

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
- `scripts/ensure-db-config.ps1`: offline compile/database DB_config confirmation, encrypted creation/recreation, and unattended environment provisioning
- `Database Schema/loaders/build-and-load-database.ps1`: database schema/bootstrap loader, including client-payload and SQL-server-file seed load modes for local or remote SQL Server targets
- `middleware.ts`: server-side session enforcement for direct page/API access
- `components/authenticated-session-guard.tsx`: client-side session revalidation for already-loaded authenticated pages
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
