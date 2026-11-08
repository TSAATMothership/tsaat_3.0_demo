# Discovery Insights PDF report

Governance > Discovery Insights has a Generate PDF button alongside the snapshot. It generates a PDF using the applied network or ICT-system scope, selected Security Domains and the resolved snapshot date. The button reports progress, prevents duplicate submissions and provides a retryable error. It remains available for a valid scope with zero matching records; selecting no domains produces an explicit empty report. It supports keyboard activation and narrow layouts.

## Content and visual design

The A4 portrait report uses the existing navy/cyan report header, vector charts, readable tables and page numbers. It has nine sections, with continuation pages when needed:

1. Summary and scope: the six overview findings, counting units, inventory totals, scope names/IDs, domains and generation time in UTC.
2. Discovery tool coverage: weighted overall coverage and a three-column report-card chart. Each tool card shows coverage percentage, covered/applicable checks, missing checks and a covered/missing bar. Complete means no missing required checks; gaps means at least one missing check. No invented letter grades or policy thresholds are used.
3. Tool detail and CI footprint: all tool values in a table, a CI-type distribution chart and in-scope/used-in-calculation counts. Full tool labels remain in the table when a card label must be shortened.
4. Security vulnerabilities: recorded observations, distinct CVEs, affected endpoints, source-severity chart/table and missing remediation.
5. Server patch management: all six status categories, verified percentage, overdue actions and unknown/stale evidence.
6. Endpoint discovery: snapshot-relative age buckets, missing dates and sources.
7. Software inventory: installation/product/endpoint totals and overlapping evidence-quality checks.
8. Shadow IT: IP Scan/ARP distribution, owner-endpoint totals and evidence quality.
9. Suggested actions and calculation notes: the same positive-count actions and notes as the page, with counts, units and next steps.

Zero denominators show N/A. Unmapped CIs remain compliant when no tool is required, but are excluded from the coverage denominator. Unknown patch statuses remain in the server denominator; exceptions do not suppress overdue actions. CVE observations are not remediation-case counts or proof of missing OS patches. Overlapping evidence checks are explicitly labelled. No repeated demo-data notices are introduced.

## Data, API and compatibility

lib/discovery-overview-data.ts is shared by the page and GET /api/discovery-coverage/overview-report. It resolves the snapshot once through lib/data-loader.ts, pins all five explorer reads to it, and uses the existing overview/coverage aggregation. Only header filters apply; table facets or other page-specific filters do not change this summary. Existing report endpoints remain unchanged. Invalid or missing scope/date/domain input returns 400; provider/report failures return a sanitized 503. Responses are application/pdf attachments named discovery-insights-<resolved-date>.pdf with no-store caching. The API uses the application's direct-access model; input and provider validation remain enforced.

SQL and JSON use the same facade operations, aggregation, action list, notes and PDF renderer. No schema, migration, settings, stored observations, CMDB mapping or calculation-contract checksum changes are required. Existing SQL prerequisites remain migrations 028-030. There is no SQL bootstrap or data population during generation. Current saved tool mappings apply, matching Discovery Insights; historical settings versions are not reconstructed.

The renderer uses the already pinned pdf-lib and local standard fonts. It needs no browser, remote font, image download or new dependency. Runtime PDF generation and both compilation paths remain offline compatible. Unsupported standard-font glyphs are replaced with a question mark; the original labels remain available in explorers. Long unspaced labels are wrapped in tables, with row/header continuation across pages.

## Verification

Unit tests verify snapshot pinning, domain/empty-scope behavior, shared counts/actions, API validation and sanitized errors, PDF sections/metadata, card totals and long-label pagination. The shared Discovery Insights browser check verifies keyboard export under network and historical ICT-system scopes, focus/retry, PDF contents, empty results and narrow layouts. Inspect rendered populated/empty reports after presentation changes. Naming/navigation-only changes use focused tests, one guarded build and browser/report/documentation checks. Provider, dependency or release changes require the broader gates in docs/sdlc.md.
