# ICT System Risk Profile

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

ICT System Risk Profile parallels the network profile for systems selected in the header. Tabs are ICT System Risk Profile, ICT System Explorer and Compliance Heatmap. The explorer is unpaginated and scrollable, with standard table search/filters and APP-ID immediately after DIIS. Selecting a system opens its details panel.

Risk summaries, finding drill-through and the expandable critical/high trend use the same scoped model. The device/SPI heatmap follows the network contract: 40px initial cells, scale control, dynamic text search, compliant/non-compliant/unknown filtering, grouped device order and highest SPI severity at the right. The old system-to-SPI aggregate heatmap is removed.

Header scope controls network/system-specific sidebar visibility. /systems redirects to the current risk profile with preserved scope/date. Sources: app/ict-system-risk-profile/page.tsx, lib/ict-system-risk-profile.ts, shared risk-profile model/component and compliance heatmap. Tests: ict-system-risk-profile, ict-system-risk-profile-page, compliance-heatmap, workspace-scope and posture-page-redirects.
