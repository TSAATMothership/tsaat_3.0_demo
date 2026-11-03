# Workspace, navigation and scope

Current contract: TSAAT UI 3 baseline, 2026-11-03. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

The application login gate protects pages and APIs. After sign-in the workspace is empty until a managed-network or ICT-system header scope is applied. The two scope types are mutually exclusive, accept multiple IDs and retain the selected snapshot date. Pending header edits are applied with Update; navigating away discards unapplied edits. Empty applied scope empties the content while retaining the active item.

Sidebar order and visibility are defined in lib/workspace-navigation.ts. Governance is first, with Overview, Trends and Insights at `/governance/overview`, `/governance/trends` and `/governance/insights`. These are empty placeholders: with an applied scope they show only the Governance context and page heading; without scope the content remains empty. All three remain available under either scope kind and retain scope/date during navigation. They add no business data, metrics, APIs or storage requirements.

Cyber Security follows Governance with Network Risk Profile then ICT System Risk Profile, followed by Service Impact and the two entity impact analysers. Discovery contains Overview, coverage and inventory explorers. Observed Measures has Summary, KPIs and SPIs. Findings contains only Findings Register; Briefs & Reports is separate. Settings is a header-menu modal. The Cyber COP overview, old posture pages, entity/SPI heatmaps, Findings Summary and Target State Analyser are not sidebar destinations.

Navigation preserves applied scope/date, displays the shared loading overlay and supports cancellation to the previous view. Risk-profile scope changes select the compatible network/system route. Retired posture and entity URLs redirect to current risk profiles/details rather than rendering the previous page design.

Acceptance: verify initial empty state, both scope types, multiple selection, Update/cancel, date preservation, visibility and compatibility redirects. Governance acceptance includes its first position, ordered links, distinct active-page selection, keyboard navigation and empty content. Sources: lib/workspace-navigation.ts; workspace/header/loading components; app/page.tsx; app/governance; components/governance-placeholder.tsx; middleware.ts. Tests: workspace-scope, loading-route-readiness, production No-SQL smoke, posture-page-redirects, network/ICT detail redirects.


Security Domain is the first header scope filter with PROTECTED, SECRET and UNKNOWN selected initially. It is independent of mutually exclusive network/system scope, applies with Update and persists with snapshot dates across navigation and redirects. Clearing all domains produces empty results. Verify default/all/subset/none, retained entity selections, keyboard dismissal, reports and exports; see docs/security-domains.md.
