# UI design contract

Use the discovery/risk-profile dark blue and cyan theme, compact panel headings and consistent explanatory scope text. The workspace header owns network/system selection and date. Do not restore removed page-wide filter blocks on Measures, Findings or Briefs & Reports.

## Tables

Use FindingsDataTable and ExplorerColumn definitions for shared search, facets, numeric ranges, sorting, matching counts and empty states. Buttons open in-place details; anchors navigate. Network/ICT explorers use scrollable unpaginated tables. CMDB keeps searchable field/value rows with plain headers. KPI/SPI result pills have consistent widths and report links fit on one line.

## Dialogs and panels

Use native dialogs for focus containment and modal layering. `settings-popup` defines Settings dimensions: 150px desktop margins, 16px at the existing small-screen/short-height breakpoint. Shared asset compliance uses that class and WorkspaceTabs. Entity/CMDB details use the existing right-hand measure-scope panel styles.

Return focus to the invoking control. Escape closes a filter menu before an inner detail, then the main dialog. Include loading, error/Retry and empty states. Evidence and remediation remain available without clipped text.

## Charts

Compliance is green, non-compliance red and unknown orange, with visible numbers/text. Severity colors are Critical Exposure red, High Risk orange, Major yellow, Moderate blue and Data Gap purple. Summary exception lists scroll after approximately five rows and retain total compliance bars when no exceptions appear.

Device/SPI heatmaps default to 40px cells, support resizing, search and status filters, group devices by result and place the highest SPI severity at the right. Zero observations must not be presented as 100% compliance.

## Accessibility and responsive acceptance

Tabs support Arrow keys and Home/End with aria-selected/controls. Controls have labels and visible focus. Long names/evidence wrap or scroll inside their region; tables can scroll horizontally without overflowing the viewport. Verify desktop and a 390px viewport, keyboard traversal, layering, focus return and loading/error/empty states.

Shared implementation: FindingsDataTable, FilterHeader, WorkspaceTabs, SettingsPopup, ServerComplianceView, RiskEntityDetailsPanel, ComplianceHeatmap and app/globals.css. Update this contract when shared interactions change.
