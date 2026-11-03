# Changelog

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
