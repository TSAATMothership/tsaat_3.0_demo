# Changelog

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
