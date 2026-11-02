# Changelog

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
