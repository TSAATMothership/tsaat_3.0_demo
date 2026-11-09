# Discovery Insights PDF report

Governance > Discovery Insights has a Generate PDF button alongside the snapshot. It generates a PDF using the applied network or ICT-system scope, selected Security Domains and the resolved snapshot date. The button reports progress, prevents duplicate submissions and provides a retryable error. It remains available for a valid scope with zero matching records; selecting no domains produces an explicit empty report. It supports keyboard activation and narrow layouts.

## Content and visual design

The A4 portrait report carries the Discovery Insights page's TSAAT logo, discovery-radar illustration and line icon, navy/mint masthead, teal coverage accents and restrained amber/rose evidence colours. The illustration is conceptual; the coverage ring, tool cards and distribution charts encode the recorded values. Light print surfaces retain readable text, measured tables and page numbers.

The opening page dedicates its upper half to an executive summary and its lower half to recommendations. The summary describes the selected snapshot's inventory, coverage and security evidence using the existing counts. Recommendations draw on the same positive-count actions as the page, retaining their counting units rather than inventing a risk score or combined issue total. Empty scopes instead explain the absence of evidence and recommend checking scope and collection. Full scope names, IDs and Security Domains remain on the following pages if they cannot fit in the opening scope strip.

Nine detailed sections follow, with continuation pages when needed. Each section and its substantive subsections include narrative paragraphs explaining the evidence, its significance for follow-up and its limitations:

1. Summary and scope: the six overview findings, counting units, inventory totals, scope names/IDs, domains and generation time in UTC.
2. Discovery tool coverage: the page's coverage-ring treatment for weighted overall coverage and a compact four-column report-card chart. Each tool card shows coverage percentage, covered/applicable checks, missing checks and a covered/missing bar. Complete means no missing required checks; gaps means at least one missing check. No invented letter grades or policy thresholds are used.
3. Tool detail and CI footprint: all tool values in a table and a CI-type distribution chart showing in-scope counts/shares with used-in-calculation counts in its labels. Full tool labels remain in the table when a card label must be shortened; a complete CI table is added if any chart label requires shortening.
4. Security vulnerabilities: recorded observations, distinct CVEs, affected endpoints, source-severity chart with every count/share and missing remediation. Long severity labels additionally receive a complete table.
5. Server patch management: all six status categories, verified percentage, overdue actions and unknown/stale evidence.
6. Endpoint discovery: snapshot-relative age buckets, missing dates and sources.
7. Software inventory: installation/product/endpoint totals and overlapping evidence-quality checks.
8. Shadow IT: IP Scan/ARP distribution, owner-endpoint totals and evidence quality.
9. Suggested actions and calculation notes: the same positive-count actions and notes as the page, with counts, units and next steps.

Zero denominators show N/A. Unmapped CIs remain compliant when no tool is required, but are excluded from the coverage denominator. Unknown patch statuses remain in the server denominator; exceptions do not suppress overdue actions. CVE observations are not remediation-case counts or proof of missing OS patches. Overlapping evidence checks are explicitly labelled. No repeated demo-data notices are introduced.

Interpretation appears before the relevant charts rather than as orphaned closing notes. Ordinary paragraphs stay together where they fit on a new page; longer paragraphs and tables continue safely. Fully labelled distribution charts carry category names, counts and shares, avoiding a duplicate table unless complete long labels require one. No category or counting unit is removed for layout.

## Data, API and compatibility

lib/discovery-overview-data.ts is shared by the page and GET /api/discovery-coverage/overview-report. It resolves the snapshot once through lib/data-loader.ts, pins all five explorer reads to it, and uses the existing overview/coverage aggregation. Only header filters apply; table facets or other page-specific filters do not change this summary. Existing report endpoints remain unchanged. Invalid or missing scope/date/domain input returns 400; provider/report failures return a sanitized 503. Responses are application/pdf attachments named discovery-insights-<resolved-date>.pdf with no-store caching. The API uses the application's direct-access model; input and provider validation remain enforced.

SQL and JSON use the same facade operations, aggregation, action list, notes and PDF renderer. No schema, migration, settings, stored observations, CMDB mapping or calculation-contract checksum changes are required. Existing SQL prerequisites remain migrations 028-030. There is no SQL bootstrap or data population during generation. Current saved tool mappings apply, matching Discovery Insights; historical settings versions are not reconstructed.

The renderer uses the already pinned pdf-lib, local standard fonts, the bundled TSAAT logo and local print derivatives of the Insights artwork through the shared Insights PDF theme. It needs no runtime browser, remote font, image download or new dependency. Runtime PDF generation and both compilation paths remain offline compatible. Unsupported standard-font glyphs are replaced with a question mark; the original labels remain available in explorers. Long unspaced labels are wrapped in tables, with row/header continuation across pages. Narrative copy is generated from the existing shared overview model and does not change evidence, denominators or provider queries.

## Verification

Unit tests verify snapshot pinning, domain/empty-scope behavior, shared counts/actions, API validation and sanitized errors, PDF sections/metadata, first-page summary/recommendations, embedded branding/artwork, section narratives, card totals and long-label pagination. The shared Discovery Insights browser check verifies keyboard export under network and historical ICT-system scopes, focus/retry, PDF contents, empty results and narrow layouts. Inspect rendered populated/empty reports after presentation changes. This PDF styling/narrative change selects focused report and shared-renderer consumer tests, lint/type checking, visual report inspection and docs:check. It changes no data, query, scope, calculation, schema, authentication, persistence or dependency contract, so it does not require provider parity, migrations, generated inventory refresh or the full release gate. Reassess if those boundaries change.
