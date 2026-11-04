# Changelog

## 2026-11-04 - Preserve impact graph zoom on selection

- Keep the current zoom and pan when selecting graph nodes, search results or connected-node links. Fit graph and the 0 key remain explicit view resets.

## 2026-11-04 - Default impact graph severities

- Open and reset the Impact graph with Critical Exposure and High Risk selected and a minimum of one matching finding per node. Other severities and Select all remain available.

## 2026-11-04 - Expand all affected CIs

- Added an Expand all affected CIs / Collapse all affected CIs toggle to the Impact graph Filters card, preserving severity and finding-count filters.
- Bulk expansion leaves connection focus and fits the scene; existing rendering limits and individual system expansion remain supported.

## 2026-11-04 - Left CMDB drawer and nested findings

- Move CMDB drill-through to the left edge and reduce its width by 20% on desktop and narrow screens.
- Keep Service Impact finding details open when launching CMDB from a device, preserving the active tab, filters, scroll and expanded evidence. Closing CMDB returns focus to that device.

## 2026-11-04 - Graph focus control position

- Moved Focus connections / Show scope to the top-right corner of the graph workspace, retaining its selection, toggle and keyboard behavior.

## 2026-11-04 - Default impact graph layout

- Open the Impact graph in Hierarchical layout with Top down direction. Other layouts remain selectable.
- Presentation default only; no SQL/JSON data, schema, provider or dependency changes.

## 2026-11-04 - Impact graph control alignment

- Grouped severity/count/reset controls under Filters and layout/direction/zoom/fit controls under Layout & view, with aligned fields and responsive stacking.
- Aligned range limits, exact node badges and finding details with the selected risk severities. Removed the 99+ badge cap and added the selected severity breakdown and counting context.
- No SQL/JSON data, schema, provider or dependency changes.

## 2026-11-04 - Remove application login

- Open pages, data, settings and report APIs directly without a login or session cookie in both providers.
- Removed Signed in, Logout, Password Settings, credential provisioning and background session polling.
- Retained safe legacy-login redirects and explicit retired-API responses; SQL credential protection and TLS remain unchanged. Existing logindetails files are ignored and left untouched.


## 2026-11-04 - Impact graph filters and animated layouts

- Added dynamic severity selection and an inclusive finding-count range with sliders and numeric inputs. Graph counts, search and finding details follow the selected severities and range.
- Keep matching devices visible when count filters exclude their parent system, without restoring excluded nodes or connections.
- Added Force-Directed, four Hierarchical directions, Circular/Radial and Coordinate/Spatial layouts with interruptible transitions and reduced-motion support.
- Generate stable X/Y workspace positions for spatial views, with optional node edits retained while the popup is open. No geographic locations are inferred or persisted.
- Retained header/table scope, modal sizing and keyboard behavior. No SQL/JSON schema, provider, package or build changes.

## 2026-11-04 - Service Impact graph popup

- Replaced the Explore the Impact tab with a Settings-sized Impact graph popup opened by Explore selection.
- Added interactive service, capability, ICT system and affected-device nodes with risk counts, search, connection inspection, expansion, focus, pan/zoom and finding details.
- Preserved applied scope, table filters, selections, snapshot and severity calculations, with keyboard controls, focus return and narrow layouts. No SQL/JSON data, schema or dependency changes.

## 2026-11-04 - Retire Network Impact Analyser

- Removed Network Impact Analyser from navigation, the workspace and the CMDB launch actions.
- Redirected old bookmarks to the matching risk profile while retaining header scope, security domains and snapshot date.
- Kept existing analyser data APIs compatible. No SQL/JSON data or schema changes are required.


## 2026-11-04 - ICT impact sidebar visibility

- Hide ICT System Impact Analyser whenever the applied header scope contains a managed network, including when that analyser was already active.
- Restore the entry when managed-network scope is cleared or replaced with ICT-system scope.

## 2026-11-04 - Standalone ICT System Dependencies

- Moved ICT System Dependencies from the impact analyser overlay into its own sidebar view, directly beneath ICT System Impact Analyser.
- Defaulted dependency Environment to Production and ICT impact Findings Severity to Critical Exposure and High Risk, with editable filters.
- Retained scoped systems without findings, snapshot/domain scope, dependency exports and drill-throughs. No SQL/JSON data or structure changes.


## 2026-11-04 - Validation by change impact

- Require an impact assessment before selecting checks; skip SQL/JSON and documentation gates when those areas are unaffected.
- Added conditional CI selection and escalation labels, preserving full offline validation for releases and dependency/build changes.
- Made documentation path mappings and source fingerprints informational so unchanged behavior does not force documentation edits.


## 2026-11-04 - Discovery Overview PDF

- Added Download overview PDF with charts and tables covering all Overview sections, per-tool coverage report cards, suggested actions and calculation notes.
- Shared the page/report data loader to preserve scope, security domains, resolved snapshot and existing calculations in SQL and No-SQL.
- Added accessible progress/error handling, empty-scope N/A values, full-label tables, pagination and PDF/browser regression coverage. No data or schema migration is required.


## 2026-11-03 - Global Security Domain filter

- Added PROTECTED, SECRET and UNKNOWN to the header, all selected by default, with staged Update and retained scope/date across pages, impact windows and exports.
- Added canonical domains to every endpoint, ICT system and network model, including historical JSON snapshots; displayed domains in endpoint/model views.
- Added forward SQL migration 030, matching fresh-schema/import/export handling, and a backed-up, idempotent JSON migration that preserves settings and observations.


## 2026-11-03 - Remove demo-data notices

- Removed the sample-observation and simulated-patch notices from Discovery Overview and related notices in the vulnerability and patch explorers.
- Kept the existing records, calculations, evidence fields and exports unchanged in both providers.

## 2026-11-03 - Consistent vulnerability and patch explorer design

- Aligned Security Vulnerability Explorer and Patch Management Explorer with End Point Explorer's hero, interactive chart cards, toolbar, table spacing and pagination.
- Constrained patch results to the available panel height with internal scrolling and the same narrow-layout table cap as End Point Explorer.
- Connected chart selections to table filters and Excel export, preserving patch-tab filters, scope/date, sample labels, evidence and CMDB actions in both providers.

## 2026-11-03 - Governance navigation placeholders

- Added Governance as the first sidebar section, with empty Overview, Trends and Insights pages.
- Preserved authentication, applied scope/date, active-page highlighting, keyboard navigation and blank content without scope. Both providers use the same pages with no data migration.
- Corrected the root legacy-dependency ignore rule so the existing impact-analyser dependency API is included in fresh checkouts.

## 2026-11-03 - Discovery Overview security and patch summaries

- Added vulnerability observation/severity/remediation summaries and server patch status, verified percentage, overdue and unknown-evidence summaries to Discovery Overview.
- Added matching explorer drill-throughs and suggested actions, preserving header scope, the resolved snapshot, sample labels and existing discovery calculations.
- Patch Management Explorer now accepts validated Overview filter presets, retaining them across tab switches and Excel export. Both providers use existing data; no migration or population is required for this update.

## 2026-11-03 - Patch Management Explorer

- Added a Discovery page below Security Vulnerability Explorer for server patch status, installation/restart dates, patch levels, missing updates, overdue actions, ownership, maintenance windows and exceptions.
- Added evidence-aware status and three searchable/filterable table views with CMDB impact navigation and full-field Excel export. Missing/stale evidence stays Unknown; exceptions do not hide overdue work.
- Added optional JSON observations, forward SQL migration 029 and explicit backed-up, labelled sample population. Existing inventory, settings, findings and network-device patch rules are preserved; both builds remain offline.

## 2026-11-03 - CMDB asset impact navigation

- Added Open Network Impact Analyser to CMDB slide-out panels. It requests a new window, retains the selected snapshot/header scope and automatically loads the selected asset's network.
- Added exact asset filtering for diagrams, finding counts and drill-throughs, a visible selection banner and Clear asset filter. Unavailable assets show an empty state; normal sidebar entry keeps manual Run behavior.
- Shared behavior across SQL and No-SQL without schema or stored-data changes.

## 2026-11-03 - Security Vulnerability Explorer

- Added a Discovery view below Installed Software Explorer with CVE metadata, remediation, affected software and endpoint/OS context, searchable column facets, CMDB drill-through and filtered Excel export.
- Added four sourced public CVEs matched to seven exact inventory versions, with explicit sample-exposure provenance and backed-up No-SQL population. Existing observations and settings are preserved; ambiguous versions remain unmatched.
- Added forward SQL migration 028, matching SQL/JSON loaders and a separate opt-in SQL sample population script. Creation/reservation dates remain distinct from detection dates. Builds remain offline and preserve existing stores.

## 2026-11-03 - Missing dependency startup recovery

- SQL and No-SQL dev/start/build commands now explain how to repair a missing or incomplete Next.js installation with `npm ci --offline` instead of an unhandled module stack trace.
- Dependency validation happens before JSON initialization or build setup; existing data, settings and credentials are preserved.

## 2026-11-02 - Risk explorer drill-through tabs

- Network and ICT System Explorer names, CI counts, compliance links and finding counts now open new browser tabs with the selected row, snapshot and matching filters preset. Name links open the existing details panel in the new tab.
- Preserved the originating explorer's scope, search and order, native keyboard/context-menu behavior and accessible new-tab announcements. Both SQL and No-SQL builds use the shared implementation.


## 2026-11-02 - Complete known-endpoint finding coverage

- Added explicit backed-up No-SQL sample enrichment that fills missing known-endpoint inventory fields and ensures an open finding for each non-compliant or unknown applicable SPI result across every snapshot. Fully compliant endpoints receive no new findings.
- Preserved original finding history, local settings, and unidentified Shadow IT nodes; new sample observations include provenance and deterministic identities.
- Shared the JSON SPI evaluator with maintenance tooling and added historical/open-state, configurable-rule, coverage and idempotence tests plus enriched-data browser/report validation.


## 2026-11-02 - SQL data population for No-SQL

- Added explicit SQL-export conversion and backed-up No-SQL population, preserving source snapshots, entity relationships, inventory metadata, vulnerabilities and persisted finding history while retaining local settings/reference mappings.
- Enriched fresh sample stores and explicitly populated stores with endpoint/software details, entity profiles, example CMDB links and 240 Shadow IT observations per sample snapshot. Builds retain existing data.
- Fixed No-SQL Shadow IT system filtering to include ARP observations through their owner, consistent with SQL. Added data-preservation, coverage, recovery and import tests and an imported-data production smoke option.

## 2026-11-02 - Login setup correction

- Fixed npm run setup:login to set or replace the application username and password when logindetails already exists. Typed passwords are hidden and confirmed.
- Invalid input preserves existing credentials; successful updates invalidate old sessions. Automatic validation still retains usable credentials. SQL and No-SQL share the same behavior and encrypted file format.

## 2026-11-02 - Mandatory offline compilation

- Included all locked application, development and native compiler package archives in vendor/npm with original source URLs and SHA-512 verification. npm ci installs offline without a prewarmed cache.
- Enforced local archive verification and network-denied compilation for SQL and No-SQL; disabled npm lifecycle downloads and build telemetry. compileApp.cmd now performs the offline install before validation.
- Added archive/network regression tests, empty-cache offline CI, and mandatory SDLC, agent, contribution, release and review obligations for every future change. No SQL schema, JSON format or calculation changes.

## 2026-11-02 - SQL and No-SQL compilation paths

- Removed the rejected standalone Demo app and folder.
- Added SQL and JSON-backed No-SQL builds of the same authenticated app, with separate output directories and shared pages, APIs, reports and settings.
- Added persistent server-side JSON snapshots/reference data, atomic settings saves, restart persistence and per-type CMDB mappings. Existing SQL data and strict TLS are unchanged.
- Updated SDLC, contribution/agent guidance, CI, build scripts and release/data documentation to require both builds and No-SQL runtime validation for future changes.

## 2026-11-02 - Standalone browser demo

- Added Demo/index.html: a portable, offline JSON-backed version of the current workspace, reports, risk profiles and impact analysers.
- Reused shared UI/report code with browser data/settings/navigation adapters and synthetic historical data.
- Added demo build/freshness/browser tests, SQL calculation review checks and SDLC/CI obligations to keep both versions aligned.

## Unreleased

- Removed 42 unreachable legacy modules, obsolete private helpers, an unused logo and the unused direct zod dependency; current navigation, APIs and report behavior are preserved.
- Added migration 027 to remove retired KPI structures/configuration and the unused network APP-ID field. ICT-system APP-ID remains available. KPI procedures retain current results while avoiding retired calculations.
- Added unused-code gates and aligned fresh-install validation, tests, ERD and operational documentation with the current two-KPI app.

## 1.0.0 — 2026-11-02 development baseline

- Imported the latest TSAAT app, including Settings-sized compliance dialogs, Security Posture/Findings/Discovery Coverage tabs, standard tables and evidence/remediation drill-through.
- Added locked installation, source/documentation quality gates, CI and lifecycle documentation.
- Aligned retired-page assertions and typed fixtures with current routes and contracts; bounded Windows test concurrency.
- Retained schema, migrations through 026, reference configuration, snapshots and design documentation. Excluded local credentials, vendored packages and generated outputs.

This baseline identifies source readiness, not production deployment approval.
