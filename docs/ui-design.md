# UI design contract

Use the discovery/risk-profile dark blue and cyan theme, compact panel headings and consistent explanatory scope text. The workspace header owns network/system selection and date. Do not restore removed page-wide filter blocks on Measures, Findings or Briefs & Reports.

Governance is the first sidebar group. Overview, Trends and Insights use normal keyboard-accessible links, active-page highlighting and group collapse behavior. Their pages contain only the Governance context and selected heading when scope is applied; the remaining content area is empty. Empty scope retains the standard blank workspace behavior. No charts, tables, sample metrics or coming-soon controls are introduced.

## Tables

Use FindingsDataTable and ExplorerColumn definitions for shared search, facets, numeric ranges, sorting, matching counts and empty states. Buttons open in-place details; anchors navigate. Network/ICT explorers use scrollable unpaginated tables. All row drill-throughs are native links with target=_blank and rel=noopener noreferrer, with accessible names announcing the new tab. Names open the existing entity-details panel in the destination tab; counts and coverage links preselect the row, actual snapshot and matching severity/duration/view. The originating table retains its filters, order and focus. CMDB keeps searchable field/value rows with plain headers. KPI/SPI result pills have consistent widths and report links fit on one line.

## Dialogs and panels

Use native dialogs for focus containment and modal layering. `settings-popup` defines Settings dimensions: 150px desktop margins, 16px at the existing small-screen/short-height breakpoint. Shared asset compliance uses that class and WorkspaceTabs. Entity/CMDB details use the existing right-hand measure-scope panel styles.

Return focus to the invoking control. Escape closes a filter menu before an inner detail, then the main dialog. Include loading, error/Retry and empty states. Evidence and remediation remain available without clipped text.

The loaded CMDB panel includes Open Network Impact Analyser (new window), a native button that requests a separate browser window with opener isolation. It carries the selected asset, actual snapshot and applied header scope, leaving the source panel open. The analyser shows a wrapping asset-filter banner and Clear asset filter control, auto-loads the selected asset's network and disables network selection until the asset filter is cleared. Invalid selections show an explicit unavailable state. The button and banner use the existing cyan palette, visible focus and narrow-layout wrapping; close/focus return remains unchanged.

## Charts

Compliance is green, non-compliance red and unknown orange, with visible numbers/text. Severity colors are Critical Exposure red, High Risk orange, Major yellow, Moderate blue and Data Gap purple. Summary exception lists scroll after approximately five rows and retain total compliance bars when no exceptions appear.

Device/SPI heatmaps default to 40px cells, support resizing, search and status filters, group devices by result and place the highest SPI severity at the right. Zero observations must not be presented as 100% compliance.

## Accessibility and responsive acceptance

Tabs support Arrow keys and Home/End with aria-selected/controls. Controls have labels and visible focus. Long names/evidence wrap or scroll inside their region; tables can scroll horizontally without overflowing the viewport. Verify desktop and a 390px viewport, keyboard traversal, layering, focus return and loading/error/empty states.

Shared implementation: FindingsDataTable, FilterHeader, WorkspaceTabs, SettingsPopup, ServerComplianceView, RiskEntityDetailsPanel, ComplianceHeatmap and app/globals.css. Update this contract when shared interactions change.

## Shared SQL and No-SQL interface

Discovery Overview now places vulnerability and server patch panels below six headline findings, preserving its tool coverage and inventory panels. Counts link to matching explorer rows using native anchors with visible keyboard focus and the resolved scope/date. Severity and patch status remain explicit text; redundant demo-data notices are omitted. Unknown patch evidence is visible rather than counted as healthy, and no-server scopes show N/A. Cards use three columns on wide layouts, two on narrower layouts and one where needed; the security panels stack below 820px of content width. Patch drill-through filters initialize the posture tab and survive switching away and back.

Patch Management Explorer follows End Point Explorer's hero, four interactive bar-chart cards and bounded table with the same toolbar/cell/pagination spacing. Scope-wide verified and overdue figures stay in the hero. WorkspaceTabs sit beside the chart caption on desktop and select Patch posture, Restart & evidence and Planning & ownership; each retains independent search, chart/column selections and ranges and shares canonical full-field export. Text-labelled status pills distinguish patched, failed, restart and unknown states without relying on color alone. A native details disclosure retains evidence/export guidance below the table, without a demo-data notice. The table fills remaining desktop space with internal scrolling and uses End Point Explorer's 34rem body cap below 1250px. Charts stack and tabs wrap on narrow screens. CMDB device controls retain the global modal and impact-window action. See [the patch feature contract](patch-management-explorer.md).

Both artifacts render the same workspace, URL navigation, scope/date filters, tables, dialogs and reports. No-SQL replaces the Database Settings tab with JSON Data Files, showing the server store path, snapshot inventory and persistence explanation. Password, SPI risk, SPI priority and discovery editors remain available. Their saves persist on the server across browser sessions and restarts. Apply desktop, narrow-layout, keyboard and loading/error-state checks to both builds. See [data providers](data-providers.md).

Security Vulnerability Explorer uses the same End Point Explorer layout and table sizing as Patch Management Explorer. Four SummaryChart cards cover severity, software, source and OS; scope-wide CVE/endpoint/missing-date totals remain labelled in the hero. Both pages use FindingsDataTable's optional chart summaries, which share its facet calculations and filter state; keyboard-operated bars toggle selections, reset pagination and update filter chips/export. Other FindingsDataTable consumers keep their existing layout. Native column-filter popovers, endpoint CMDB dialogs and loading/error boundaries remain. Long descriptions/actions wrap within the horizontally scrolling table. Its export retains an actionable error. See [the feature contract](security-vulnerability-explorer.md).


The header begins with a Security Domain multi-select: PROTECTED, SECRET and UNKNOWN, all selected by default. It uses the existing staged Update, search, Select All, clear, Escape/focus-return and responsive popover patterns. Domain changes retain network/system and snapshot selections; selected entities stay available to clear even if their model domain is outside the new selection. End Point Explorer includes Security Domain in its table/export; model rows and drill-through details show it.

Select All remains focusable with aria-disabled after selecting every option. This avoids closing the popover through a disabled-control blur before the user can press Update. The production smoke test verifies the none-to-all sequence and Escape focus return.
