# Installed Software Insights

Governance opens **Installed Software Insights** at `/governance/installed-software-insights`, including Generate PDF. Header network/ICT system, Security Domain and selected snapshot govern the page; no inventory is read before a workspace scope is selected.

## Retired Dashboard URL

**Installed Software Dashboard** has been removed from the application, including its rendering, exclusive styles and active page catalogue entry. `/discovery-coverage?discoveryView=installed-software-insights` now shows the shared retirement notice, with or without a selected scope, and never loads software inventory. The return link preserves network/system/domain/date context and opens End Point Explorer. Installed Software Insights, Installed Software Explorer and the Governance PDF endpoint remain available.

## Software Insights briefing

The briefing uses the shared Insights visual system: dark navy surfaces, cyan/mint accents, a large illustrated masthead, scope strip, four headline metrics, anchored chapter navigation and evidence action cards. It opens directly with the infographic masthead; the hero's Software Insights title is the primary heading, with no duplicate workspace title above it. The local software terrain illustration is conceptual, not a measured topology.

Four numbered chapters connect the footprint (products, installations, endpoints), concentration (share of installations in the three largest named products), variation (multiple recorded versions) and evidence improvement (missing versions, dates, sources and paths, stale or future-dated discoveries). Large figures, a product-to-installation-to-endpoint flow, ranked product bars and a version-completeness ring have visible text equivalents. Six evidence action cards show their individual counts, including zero counts. The main CTA, chapter links and back-to-top link use in-page anchors. Narratives use the selected data; no version variation or missing evidence is invented when counts are zero. Evidence actions retain the resolved snapshot and shared scope. Persona restrictions apply to all destinations.

## Generate PDF

The Governance briefing has a **Generate PDF** action beside the snapshot. An empty briefing does not show an export button. The shared **Generating Document** animation reports preparation and rendering, supports cancellation, disables repeated activation, preserves keyboard focus and offers a retryable error. The masthead wraps on narrow screens.

The read-only `GET /api/discovery/installed-software-insights/report` endpoint validates network/system, security domains and snapshot date. It reloads the same scoped software projection through `lib/data-loader.ts`, then pins summary metadata to the resolved date. Unrelated Explorer/page filters are ignored; missing/invalid scope returns 400 and provider failure returns a sanitized 503. Responses are uncached, versioned JSON document jobs; the browser worker generates and downloads `software-insights-YYYY-MM-DD.pdf`. Existing HTML report bookmarks redirect to browser generation. The backend never produces the PDF bytes.

The printable A4 briefing matches the Governance page with the actual TSAAT logo, its local software-terrain illustration, package/layers/endpoint icons, navy mastheads, mint accents and light evidence cards. Charts retain vector product bars, the version-completeness ring and the product-to-installation-to-endpoint flow. The artwork remains conceptual, not a measured topology. All assets are bundled with the app and loaded by the browser worker; no external rendering service, remote asset or Node filesystem is used to generate the PDF.

The first page divides the available content area equally between **Executive summary** and **Recommendations**. Both contain narrative paragraphs grounded in the selected inventory, including explicit no-evidence wording when empty. The following four chapters explain footprint, concentration, version variation and six overlapping evidence priorities. Each chapter and each evidence-action card includes prose explaining the counts, their interpretation and the next useful verification step; zero counts do not manufacture a gap or claim assurance.

Scope labels, domains, selected snapshot date, recorded snapshot timestamp and separately labelled export time provide context. The opening page may condense unusually long scope labels, but the footprint chapter preserves them in full. Page numbers and the recorded timestamp repeat in the footer; an unavailable or timezone-less capture timestamp is **Not recorded**. Ordinary reports use five pages; long labels flow to continuation pages without truncation. Empty API results show explicit no-evidence and N/A denominators. Standard embedded PDF fonts normalize unsupported glyphs to question marks.

## Count definitions and limits

- Each Explorer row is one installation; repeated installations on the same endpoint remain separate. Endpoint counts deduplicate by asset ID, not display name. Endpoints with no software inventory are excluded, so this is not overall endpoint coverage.
- Product and version names use the Explorer's trimmed recorded values, without merging spelling/case variants. Missing names are excluded from named-product counts and concentration, but their installations remain in the overall denominator. Multiple versions means at least two distinct non-missing versions for a named product. Missing versions are excluded from variation.
- Version completeness is installations with a recorded version divided by all installations. No records means no denominator, never 100% assurance. Counts are inventory evidence, not licences, support status, version currency or CVE findings.
- Discovery age reuses Explorer logic relative to the resolved snapshot: last 7 days, 8–30, 31–90, over 90, after snapshot and missing/invalid date. Stale means over 30 days; future and undated records remain separate. Evidence-gap counts overlap.
- Top lists use descending counts with name tie-breaks; variation uses descending distinct versions, then installations, then name. Missing values remain explicit in the inventory evidence.

## Data, access and validation

The Governance page calls `loadInstalledSoftwareExplorerData` through `lib/data-loader.ts` and summarizes its already scoped rows in `lib/installed-software-insights.ts`. SQL's scoped installation query and JSON's inventory projection remain unchanged. The page does not read a separate dataset or store a new field. No SQL migration, JSON upgrade, seed change or calculation-contract checksum update is required. The existing application access model and Explorer compatibility route remain intact.

The Governance briefing uses the `governance-software-insights` persona preference. The obsolete `discovery-software-insights` value remains accepted and preserved only as inactive compatibility data in existing/default SQL and JSON preferences, including legacy parsing and canonical ordering. It is absent from active page metadata and cannot enable the retired Dashboard. No replacement page is granted and no settings are rewritten on read.

Empty records show an explicit no-evidence state on the Governance page; failed loading shows an alert and scoped retry, never zero metrics. The workspace owns vertical scrolling; hero, cards and metrics reflow at narrow widths. Sidebar links and chapter anchors support keyboard navigation and visible focus, and chart values are available without hover or colour interpretation. Existing workspace loading feedback applies.

Navigation/presentation changes require focused render, link-count reconciliation, sidebar/persona/keyboard/anchor and narrow-layout checks, including retirement-route checks with and without scope. The obsolete Dashboard component and its styles must remain absent. Provider validation is required when data/provider behavior changes, as described in the SDLC. The original feature validation covers aggregation boundaries, Explorer count reconciliation, scope/date forwarding, empty/error states, navigation/persona behavior, both provider builds, storage contracts and the compiled No-SQL browser smoke. Report validation covers scope/date rejection, projection-to-report count agreement, timestamps, empty data, long-label pagination and rendered page geometry, plus compiled download/error/retry/keyboard/narrow-layout checks. The existing Explorer continues to provide filtered Excel export.
