# Briefs & Reports and export contracts

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Briefs & Reports uses the discovery-style presentation and a standard searchable catalogue with category, description and audience. The former page-level filter section is removed. Briefings, Remediation and Assurance categories come from lib/report-catalogue.ts. Report links inherit applied header scope and the actual loaded snapshot.

KPI/SPI current, non-compliance-only and trend PDF contracts are described in 08-Measures.md. Current/non-compliance reports share their respective template and charts; restricting results must not change header scope, dates or denominators silently. Endpoint lists include Device Name, Device IP, Device Model, Last Discovered Date and Discovered By. Findings workbooks include affected CIs and their canonical six-column drill-through fields.

Server API handlers validate requests, build the relevant model and generate PDF/workbook/CSV responses with correct content type, disposition and filenames. Compatibility APIs remain even where a former page link was removed. Review API removal separately; absent navigation is not evidence that an endpoint is unused.

Sources: app/report/page.tsx, lib/report-catalogue.ts, report-template-pdf.ts, report-pdf-visuals.ts, KPI/SPI/performance report builders and workbook helpers. The generated application inventory lists export routes/methods. Tests: report-catalogue, report-snapshot-scope, tasking-report-links, performance-report-model, KPI/SPI report models and workbook/export suites. Inspect real PDF pagination, charts and long device values after layout changes.


Discovery Overview has its own summary PDF download at /api/discovery-coverage/overview-report. It summarizes all overview sections, with per-tool report cards and chart/table pairs. Page and report share one snapshot-pinned facade loader and aggregation. Existing catalogue and report APIs are unchanged. See [Discovery Overview report](../docs/discovery-overview-report.md).
