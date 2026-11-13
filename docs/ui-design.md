# UI design contract

Topology Explorer supports **Show all results in Impact Topology** across pagination and **Generate Impact Report** from the inline/full-screen graph. The PDF uses a consistent print theme, vector topology/category graphics, executive decisions and complete analyst registers. Captured positions match the displayed layout; the full graph fits to paper. Empty selections disable export; the shared document dialog preserves progress, cancellation, retry and focus return. See [Topology Impact Report](topology-impact-report.md).

The sidebar contains Governance (Installed Software, End Point and Security Vulnerability Insights) and Discovery (End Point, Installed Software, Security Vulnerability, Shadow IT and Topology Explorers). Groups start collapsed, preserve their open state during client navigation and reset on full reload. Section controls support keyboard activation, visible focus and aria-expanded; hidden links leave the tab order. Installed Software Dashboard has been removed; its old URL shows the standard retirement notice with a scoped return link.

Retired sections, Briefs & Reports and SPI settings have no navigation entry. Legacy pages show a retirement notice with a scoped Explorer destination; retired APIs return 410 without loading retired data. Header network/system/security-domain and snapshot controls remain authoritative across links and reports.

Selecting a retained page without at least one applied managed network or ICT system displays an illustrated notice inside the workspace. Its two keyboard-accessible actions open the corresponding header selector; the notice stays until the user chooses records and applies Update. It preserves the selected page, date and security domains and distinguishes a missing selection from a selected scope with no records. On narrow screens, selecting an unscoped sidebar page closes the sidebar to reveal the notice. The initial landing workspace stays empty until a page is selected. Known unscoped workspace navigation, clearing the last selected entity, and unscoped date/domain changes do not start the full-screen loading animation. Scoped route loading still waits for actual route readiness and supports cancellation; local option-loading feedback remains in the selector.

## Insights and documents

Three Governance briefings retain illustrated mastheads, chapter anchors, explicit counts and persona-aware Explorer links. Count links preserve resolved scope/date. Disclosures show complete distributions, including missing/unknown evidence. Retired coverage Explorer links become contextual text or an in-page coverage anchor.

Generate PDF remains beside the snapshot with busy/progress/cancel/retry and focus handling. Four inventory Explorers retain Excel downloads. Renderers use local workers/assets and the active provider's selected evidence. See [document contract](client-document-generation.md) and [report design](inventory-insights-reports.md).

## Tables, CMDB and Topology

Retained inventory uses FindingsDataTable as a shared table component; its historical name does not imply a Findings feature. Keep native column filters, searchable facets, summary-chart filtering, pagination, export and horizontal scrolling inside the table. Labels and values complement chart colors. Unknown/inapplicable evidence remains explicit.

CMDB uses native modal behavior, loading/error/Retry/empty states and Escape/focus return. Endpoints, networks, ICT systems, business services and mission services keep applicable inventory fields and Topology links. Retired analyser/finding actions are removed.

Topology uses Business Impact for higher-level model context and Dependencies for recorded model relationships down to member CIs, with a source/relationship/target/environment evidence table. Both retain scope/date/domain filters, layouts, search, selection, zoom/pan, Fit, full-screen and responsive controls. ARP ownership remains labelled Business Impact context only; Dependencies excludes CI-to-CI links. Shared graph styles remain where used by this feature. See the [Topology specification](../Requirements%20Documentation/20-Topology-Explorer.md).

## Header selection and accessibility

The header retains its compact wrapping layout and original control styling: a native Persona select with a cyan divider, boxed scope filters and an unboxed Date input. Controls on the same row align by their vertical centres while retaining their individual heights and widths. Branding and controls wrap naturally as space narrows. Long values remain available through native options, scope search and hover titles. Scope dropdowns reposition within the viewport on opening, resizing and header reflow, and scroll on short screens; Escape returns focus to their trigger.

Both compilations remove Menu and the Settings modal/viewers. The header Persona selector retains All sections, saved labels/order, browser-local selection and loading/retry recovery. Old Settings bookmarks show a scoped retirement page. Shared rules and definitions remain available to retained runtime features; configuration maintenance remains outside the application UI.

Use WorkspaceTabs, native dialogs and app/globals.css conventions. Tabs support arrows/Home/End and aria-selected/controls. The header selector fits narrow layouts without obscuring scope/date controls. Verify keyboard traversal, Escape/focus return, 390px layouts, long names, layering and loading/error/empty states. SQL and JSON render the same interface; personas do not add authentication.
