# UI design contract

The sidebar contains Governance (Installed Software, End Point and Security Vulnerability Insights) and Discovery (End Point, Installed Software, Security Vulnerability, Shadow IT and Topology Explorers). Groups start collapsed, preserve their open state during client navigation and reset on full reload. Section controls support keyboard activation, visible focus and aria-expanded; hidden links leave the tab order. Installed Software Dashboard retains its compatibility URL.

Retired sections, Briefs & Reports and SPI settings have no navigation entry. Legacy pages show a retirement notice with a scoped Explorer destination; retired APIs return 410 without loading retired data. Header network/system/security-domain and snapshot controls remain authoritative across links and reports.

## Insights and documents

Three Governance briefings retain illustrated mastheads, chapter anchors, explicit counts and persona-aware Explorer links. Count links preserve resolved scope/date. Disclosures show complete distributions, including missing/unknown evidence. Retired coverage Explorer links become contextual text or an in-page coverage anchor.

Generate PDF remains beside the snapshot with busy/progress/cancel/retry and focus handling. Four inventory Explorers retain Excel downloads. Renderers use local workers/assets and the active provider's selected evidence. See [document contract](client-document-generation.md) and [report design](inventory-insights-reports.md).

## Tables, CMDB and Topology

Retained inventory uses FindingsDataTable as a shared table component; its historical name does not imply a Findings feature. Keep native column filters, searchable facets, summary-chart filtering, pagination, export and horizontal scrolling inside the table. Labels and values complement chart colors. Unknown/inapplicable evidence remains explicit.

CMDB uses native modal behavior, loading/error/Retry/empty states and Escape/focus return. Endpoints, networks, systems, services and capabilities keep applicable inventory fields and Topology links. Retired analyser/finding actions are removed.

Topology preserves its Business Impact and Dependencies modes, layouts/directions, scope/date/domain filters, direct external peers, ARP ownership, search, selection, zoom/pan, Fit, full-screen and responsive controls. Shared graph styles remain where used by this feature. See the [Topology specification](../Requirements%20Documentation/20-Topology-Explorer.md).

## Settings and accessibility

Both compilations show exactly two read-only tabs: Personas and Discovery Tools Settings. Persona selection and tool-name filters remain interactive. Saved names, ordering, mappings, timestamps and empty catalogues stay visible; public writes return 405. Database configuration remains a command-line operation.

Use WorkspaceTabs, native dialogs and app/globals.css conventions. Tabs support arrows/Home/End and aria-selected/controls. Narrow/short Settings retains its group selector and paged rows. Verify keyboard traversal, Escape/focus return, 390px layouts, long names, layering and loading/error/empty states. SQL and JSON render the same interface; personas do not add authentication.
