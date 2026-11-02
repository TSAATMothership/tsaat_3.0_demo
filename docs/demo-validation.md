# Standalone demo validation — 2026-11-02

The requested browser distribution is Demo/index.html (approximately 10.3 MiB), built from shared source and eight synthetic JSON snapshots. No SQL database or connection configuration was changed by this work.

Validation performed:

- Full repository check: hygiene, documentation freshness/links, ESLint, TypeScript, 569 passing unit/regression tests, four tooling tests and deterministic demo freshness. Eleven opt-in SQL integration tests remain skipped.
- Next.js production build completed successfully.
- Direct-file Chrome smoke test: 16 workspace views, 44 parseable PDF reports and six Excel workbooks, including Findings plus Affected CIs.
- Both risk profile heatmaps: default 40-pixel cells, search and status filtering.
- Network/ICT system entity panels and reciprocal links opening scoped app views in new tabs.
- Live CMDB drill-through and both impact analyser Blob workers.
- Risk/priority/discovery calculation tests, local settings persistence after reload, actual PDF download and narrow viewport layout.
- Zero external network requests and no browser errors during the automated demo checks.
- Desktop summary and native settings dialog visually inspected.

The delivered file uses synthetic historical data. These checks do not certify live SQL connectivity, ingestion, authentication or multi-user persistence for the demo. Those features belong to the operational app.
