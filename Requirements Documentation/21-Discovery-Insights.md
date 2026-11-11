# Discovery Insights

Governance places **Discovery Insights** immediately below Installed Software Insights at `/governance/discovery-insights`. It replaces Discovery > Overview; `/discovery-coverage?discoveryView=overview` redirects to the new page with header scope, security domains and snapshot retained. Bare `/discovery-coverage` remains Discovery Tool Coverage. No inventory loads before the user selects a network or ICT system.

## Infographic experience

The page uses the Cyber Terrain and Installed Software Insights visual system: navy/mint masthead and illustrated hero, scope/snapshot strip, four headline figures, numbered chapter anchors, coverage ring, tool cards, distribution bars and evidence actions. The local discovery radar illustration is conceptual, not measured topology. The workspace scrolls through the briefing; narrow layouts stack cards without horizontal page overflow. Values have visible text equivalents and links work by keyboard, with persona-aware destinations.

Five chapters tell the existing discovery story:

1. **Footprint:** CI composition with mapped/in-scope counts, endpoints, software products/installations and represented endpoints. These inventories have different counting units and must not be added together. Software product values retain the existing Not recorded grouping.
2. **Tool coverage:** weighted required checks covered/missing, compliant CIs, CIs with gaps and every applicable tool. No-mapping CIs remain compliant but outside the percentage denominator. No applicable checks means N/A.
3. **Evidence quality:** all six endpoint discovery-age buckets, missing sources, old/undated/future evidence, software version/source/date quality and Shadow IT IP Scan/ARP counts, owners and quality checks. Checks can overlap; age is relative to the snapshot and does not redefine compliance.
4. **Security follow-up:** CVE observations, distinct CVEs, affected endpoints, all source severities, missing remediation and all server patch statuses, verified percentage and overdue actions. Unknown patch evidence stays in the denominator; observations are not remediation cases or proof of missing OS patches.
5. **Next actions:** the unchanged positive-count action list, with matching Explorer links and expandable calculation notes. No records and no positive actions have distinct explanations; zeros never imply full assurance.

All Explorer filters retain the resolved snapshot and only applied header scope/domain. The PDF action reads the same model and remains available for a scoped empty selection, with progress, duplicate-submit prevention, focus return and retry. Its existing API path remains compatible; the document is named Discovery Insights Report and downloads as `discovery-insights-YYYY-MM-DD.pdf`. The nine-section PDF retains its existing charts, tables, actions and calculation notes. See [report contract](../docs/discovery-overview-report.md).

## Data and preferences

The page calls the existing `loadDiscoveryOverview` loader. SQL and JSON continue through `lib/data-loader.ts`, using identical snapshot-pinned Explorer reads and the unchanged overview aggregation. No new score, persisted evidence, query, schema, migration or calculation-contract checksum is introduced. Failed reads show a sanitized error with a scoped Retry, not empty metrics.

The stable persona page ID remains `discovery-overview`, now labelled Discovery Insights in Governance. Saved section/page selections are not rewritten. Existing users need both Governance and the existing page permission enabled; moving the page does not silently grant Governance access. New default configurations include it. Legacy URLs resolve to the same permission, and direct access continues to follow the existing application model.

## Validation

For this presentation/navigation change, select focused shared-model/report and page/redirect/persona tests, lint/types, one guarded compiled build and browser checks for both scope kinds, historical/domain filtering, Explorer count reconciliation, anchors, PDF generation/retry/focus and narrow layouts. Review the rendered report after naming changes and regression-check the shared Insight styles. Refresh navigation/route inventories and check docs. Data/provider changes would additionally require the coordinated SQL/JSON gate; this move does not change those contracts or dependencies.
