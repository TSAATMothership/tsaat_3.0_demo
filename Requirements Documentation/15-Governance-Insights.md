# Governance Insights: Cyber Terrain Posture

The Cyber Terrain Insights sidebar link opens `/governance/insights`, an executive infographic read vertically within the existing workspace. Its stable persona page ID remains `governance-insights`. Governance Overview is retired; old bookmarks redirect to Trends. Trends presents a scoped executive history of compliance, lifecycle and discovery. No scope means no business-data load and the standard blank workspace. A selected scope without evidence shows an explicit empty state; a failed read shows a ready error state and scoped retry, never invented zero metrics.

## Executive narrative

The masthead identifies the resolved snapshot. A locally illustrated layered terrain, TSAAT branding, applied network/system names and security-domain chips introduce Cyber Terrain Posture. Four headline measures show endpoint records, system-linked Critical Exposure/High Risk findings, CVE observations and the verified-patched server percentage.

Five anchored chapters cover:

1. Visibility: required discovery-check coverage, CI composition, per-tool coverage cards, stale/undated endpoint evidence and unidentified IP nodes.
2. Exposure: configured open-finding severity counts, separate CVE observations and remediation-guidance completeness.
3. Service impact: recorded CI/system/service associations, the three services ranked by critical then high findings, and mission-capability exposure.
4. Resilience: existing patch statuses, overdue/unknown counts and software inventory/version completeness.
5. Leadership priorities: up to three nonzero triggers in explicit order: system-linked critical/high findings, overdue patching, discovery gaps, critical/high CVE observations, unknown patch status, unidentified IP nodes, stale/undated endpoint discovery. Each action links to its supporting analyser or explorer. This is an editorial order, not a risk-scoring rule.

## Data and interpretation

`loadGovernanceInsights` composes `loadDiscoveryOverview` and `getCoreAppData` through the shared data-loader facade. Discovery resolves the date first; Service Impact is pinned to it. A snapshot mismatch fails the briefing. Only header network/system, security-domain and date filters are forwarded; unrelated explorer filters cannot silently narrow the page. Evidence links retain the resolved date and scope.

`buildGovernanceInsights` uses the existing Service Impact model and Discovery Insights projection. It deduplicates findings by ID and retains configured severity labels. Critical/high finding counts use canonical severity keys; CVE source severity remains a separate measure. Service rows may share findings and are explicitly non-additive. Unattributed open findings are disclosed separately, without inferring system/service links.

Discovery percentages use required tool checks, not all endpoints. Patched percentage uses all scoped servers, including Unknown. Absent denominators display N/A. Discovery age is snapshot-relative. Existing CVE/patch definitions, SPI/KPI rules and calculations are unchanged. No new SQL query, provider operation, schema, migration, JSON format, persisted metric, package or external service is introduced. The calculation-contract guard remains unchanged.

The briefing makes no composite posture score, benchmark, trend, breach probability or outage prediction. Zero findings are not proof of compliance; CVE observations do not prove exploitability or a missing OS patch. The hero image is conceptual, not measured topology.

## Design and acceptance

The masthead's **Generate PDF** button downloads a print-friendly A4 executive infographic covering every chapter, including vector terrain artwork, coverage ring/tool report cards, severity and patch charts, service context and leadership actions. The PDF retains the applied networks/systems, security domains and resolved snapshot. Local vector branding and embedded standard fonts keep export independent of browser installations or network assets. Measured text wrapping and continuation pages accommodate long names and larger tool lists.

`GET /api/governance/insights/report` accepts only the header scope/domain/date context, validates it and uses the same `loadGovernanceInsights` result as the page. The attachment is named `cyber-terrain-insights-YYYY-MM-DD.pdf` and is not cached. The cover identifies the snapshot date, **Snapshot timestamp** (existing dataset `generatedAt`, normalized to UTC) and separate **PDF generated** export time. The recorded snapshot timestamp and page numbering repeat in the footer. Missing, invalid or timezone-less source timestamps say **Not recorded**; a date-only selection is never presented as an invented capture time. No new persisted fields or migrations are required.

During export the button announces progress and prevents duplicate requests; failures show an inline, retryable error. Download leaves the selected filters and page intact. Validate keyboard activation, busy/error/retry behavior, downloaded filename/content, scope/date propagation, timestamp semantics, empty data and PDF pagination; render and visually inspect all report pages as well as desktop/phone controls.

Use the existing dark-blue workspace with mint/cyan highlights and restrained rose/amber exposure accents. Include local TSAAT logos, original SVG imagery, accessible icons, rings/bars with text equivalents, large numerical typography and concise executive copy. All assets/fonts remain local. Chapter navigation is sticky on wide layouts and flows normally on narrow screens; the page scrolls as one document without nested panel scroll traps. Native links/details, keyboard focus indicators and responsive card stacking remain usable at 390px.

Validate counts/deduplication and action conditions, both scope kinds, domains including NONE, snapshot pinning and link propagation, empty/error states, complete vertical scrolling, anchor/keyboard navigation, local images and narrow overflow. Run relevant provider-model regressions and both compiled paths; use temporary stores for browser checks. See [UI design](../docs/ui-design.md), [architecture](../docs/architecture.md) and [validation evidence](../docs/validation.md).
