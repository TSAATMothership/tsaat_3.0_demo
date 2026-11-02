# Changelog

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
