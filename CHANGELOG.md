# Changelog

## 2026-11-07 - Business service and mission capability CMDB

- Added CMDB support for the existing Business Service and Mission Capability model CI records, with identity, type, recorded criticality and scoped system/network associations.
- Both Impact Topology views now offer CMDB drill-through for these CIs, including full screen, with Explore Topology returning to the same model CI and snapshot.
- Added SQL migration 032 and the explicit, backed-up `migrate:cmdb-model-cis` JSON reference upgrade. Existing endpoint fields, custom mappings and empty field sets are preserved.

## 2026-11-07 - Topology mouse-wheel zoom

- Added mouse-wheel zoom over the Impact Topology canvas in Topology Explorer, in both modes and full screen. Scroll up to zoom in and down to zoom out; scrolling outside the canvas remains available.

## 2026-11-07 - Impact Topology naming

- Standardised the name Impact Topology across Topology Explorer, Service Impact, accessible controls, persona settings, Cyber Terrain briefing/PDF and documentation.

## 2026-11-07 - Compact topology navigation controls

- Replaced the Topology Explorer's padded Layout & navigation card with a slim toolbar. Layout, zoom and Fit graph share a row where space permits and wrap on narrow screens, leaving more room for the graph.

## 2026-11-07 - Centred topology filter counts

- Centred the selected-count badge within each Find a configuration item filter, independently of its label width, while keeping labels readable and chevrons aligned right.

## 2026-11-07 - Graph mode controls inside Impact Topology

- Moved Business Impact and Dependencies into the Impact Topology header and removed their separate page row. Both tabs remain available in full screen, with mode changes keeping the expanded graph open.

## 2026-11-07 - Filter popup opening position

- Fixed the brief top-left flash when opening Topology lookup and shared Explorer filters by positioning each popup before paint and preventing its initial focus from scrolling the page.

## 2026-11-07 - Topology full-screen graph

- Added Full screen / Exit full screen to Topology Explorer's Impact Topology, with Escape and focus return. Layout, zoom, moved nodes, graph search and selection are retained; CMDB remains available while expanded.

## 2026-11-07 - Aligned Topology panels

- Matched the Impact Topology panel height to Matching CIs, with internal scrolling and aligned edges on desktop. Phone panels retain their stacked layout.

## 2026-11-07 - Consistent Impact Topology styling

- Matched Topology Explorer's Impact Topology to the Service Impact Analyser with shared node visuals, canvas, relationship labels, controls, summary and inspector styling.
- Added graph-local CI search and connected-CI badges. Both topology modes retain their scope, communication direction and external-peer indicators; the inspector adapts to narrow panels.

## 2026-11-07 - Topology graph modes

- Added Business Impact and Dependencies modes, preserving the selected CI, filters and snapshot when switching.
- Business Impact now includes model relationships upstream and downstream. Dependencies shows incoming/outgoing communication and each peer's business context, including direct peers outside the selected network/system while respecting Security Domains.
- Added communication evidence with protocol, ports, source and observation time, outside-scope indicators, and explicit navigation into a peer's scope.

## 2026-11-07 - Topology lookup filters

- Updated Find a configuration item to use the End Point Explorer table-header filter menus, with searchable values, checkboxes, counts, multiple selection and clear controls.
- Added removable filter chips and reloadable selections while retaining legacy lookup bookmarks, selected CI, scope and snapshot.

## 2026-11-07 - Software dashboard sidebar removal

- Removed Installed Software Dashboard from the Discovery sidebar for every scope.
- Retained Installed Software Insights in Governance, the dashboard bookmark URL and existing persona preferences.

## 2026-11-07 - Software Insights in Governance

- Moved the Software Insights briefing into its own Installed Software Insights page below Cyber Terrain Insights in Governance, retaining Generate PDF.
- Kept the compact Installed Software Dashboard in Discovery above Installed Software Explorer and removed the tab strip.
- Preserved header scope, snapshot selection, evidence links and the existing dashboard URL. The new Governance page has its own persona preference; saved selections remain unchanged.

## 2026-11-07 - Software Insights PDF

- Added Generate PDF to the Software Insights tab, matching Cyber Terrain Insights' download interaction.
- The printable infographic includes software footprint, product concentration, version variation and evidence priorities for the selected scope and snapshot, with timestamps and page numbers.
- Downloads provide progress feedback, keyboard focus retention and retryable errors.

## 2026-11-07 - Discovery Compliance Explorer styling

- Aligned Discovery Compliance Explorer with Installed Software Explorer's header, four interactive chart cards, table controls and responsive layout.
- Chart bars filter compliance status, missing tools, discovery sources and discovery dates using the existing filters. Matching tool coverage, CMDB links and Excel export remain available.

## 2026-11-07 - Discovery Compliance Explorer filters

- Removed the Environment and Asset Type controls and their filter row from Discovery Compliance Explorer.

## 2026-11-07 - Discovery Tool Coverage filters

- Removed the Environment and Asset Type controls and their filter row from Discovery Tool Coverage.

## 2026-11-07 - Compact software dashboard

- Reduced the software dashboard header, metric cards and chart spacing; all six charts now share a three-column, two-row desktop layout.
- Kept evidence links and counts available, with responsive layouts for smaller screens. Software Insights retains its existing briefing design.

## 2026-11-07 - Software Insights visual refresh

- Renamed the Installed Software Insights tabs to Insalled Sofware Dashboard and Software Insights.
- Restyled Software Insights to match Cyber Terrain Insights, with an illustrated masthead, headline metrics, chapter navigation and evidence action cards. Existing scope, snapshot counts and Explorer links are preserved.

## 2026-11-07 - Explore Topology from CMDB

- Added an Explore Topology button to the CMDB popup. It opens Topology Explorer with the CI selected and preserves the originating scope, security domains and loaded snapshot.
- The action respects persona page access and remains disabled until CI details load. Stale lookup filters are cleared when opening the selected CI.

## 2026-11-07 - Topology Explorer

- Added Topology Explorer below Shadow IT Explorer in Discovery, with combined CI name/hostname/ID, installed software/version, CVE and IP lookup plus CI type filtering.
- Endpoint CIs trace upstream to recorded systems, networks, business services and mission capabilities. Model CIs show downstream systems and networks, including CIs without findings.
- Added interactive Impact Topology layouts, node inspection/CMDB, keyboard pan/zoom, a compact phone layout and exact path evidence. Header scope, security domains, snapshot and saved persona choices remain respected in both SQL and No-SQL builds.

## 2026-11-07 - Measures Trends

- Added Measures Trends above Measures Summary, with separate KPI and SPI tabs and 1 week, 4 weeks, 3 months, 6 months and 12 months ranges.
- Search and select any configured indicator to view dated compliance charts, percentage-point changes, populations, snapshot results and CSV evidence. Header scope, security domains and selected dates are preserved.
- Longer ranges show available history explicitly; missing evidence and empty denominators remain distinct from zero compliance. Both providers reuse the existing measure calculations.

## 2026-11-07 - Aligned weekly evidence

- SQL and JSON setup use the same eight weekly samples, from 19 September to 7 November, with endpoint/software discovery, ownership, patch, vulnerability, Shadow IT and applicable finding evidence.
- Fixed missing SQL software discovery/OS patch attributes, empty inventory scopes and raw finding classification parity. Meaningful unknowns remain visible; fictional vulnerability scenarios are labelled as samples.
- Added audited, backed-up append commands that preserve existing sample dates and settings. Builds preserve existing stores.
- SDLC now requires SQL and JSON data, structures, schema, snapshots and upgrades to evolve together, supported by cross-provider regression evidence.

## 2026-11-07 - Installed Software Insights

- Added Installed Software Insights immediately above Installed Software Explorer in Discovery.
- Dashboard Summary charts software footprint, discovery freshness, recorded versions, operating systems and discovery sources. Infographic Story explains concentration, version variation and evidence gaps in four visual chapters.
- Both tabs follow header scope and snapshot; chart/evidence links open matching Explorer records. Keyboard tabs, narrow layouts, empty/error states and persona preferences are supported in SQL and No-SQL builds.

## 2026-11-07 - Simplify Database Settings

- Removed the SSL/TLS checkbox, certificate-mode selector and separate Test SSL button from Database Settings.
- Connection testing automatically validates the saved transport policy when needed. Reset and save retain that policy; the form keeps connection/schema validation, masked-password handling and diagnostics.

## 2026-11-06 - Replace existing database during setup

- `setup:database` now detects an existing target, asks for its exact name, then deletes and rebuilds it with schema and bundled data. Replacement disconnects active sessions, discards existing data/settings, and does not create a backup.
- Unattended replacement requires `TSAAT_DB_REPLACE_EXISTING` to match the target name. Cancellation preserves the database and configuration; verified app logins retain their SID/password across a successful rebuild.

## 2026-11-06 - SQL username/password setup without SSL

- Database setup asks for a new application username/password and separate administrator connection, creates a dedicated SQL login/user for TSAATDB, and disables SSL for setup and the saved app connection.
- Existing data is preserved; reruns validate setup-managed logins without resetting passwords or adopting unrelated accounts. Administrator credentials are never saved, and DB_config is published only after app-login validation succeeds.
- Runtime SQL passwords use a child environment instead of process arguments. Falling back from a failed SQL login to Windows authentication now requires explicit opt-in.
- Fresh SQL databases correctly load default persona settings before the first settings save.

## 2026-11-06 - Database endpoint prompt and TSAATDB

- Ask whether the endpoint is `localhost\SQLEXPRESS` on each interactive database setup; ask for another endpoint after No.
- Resolve the local instance's configured TCP port when available and prepare `TSAATDB`, retaining the encrypted TLS default and validation before saving.
- Leave other databases intact and preserve explicit unattended configuration targets.

## 2026-11-06 - Complete database setup

- Explain that existing connection settings are reused, and provide server/port and certificate-policy recovery steps when setup cannot connect.
- Make `npm run setup:database` prompt for connection details, create a missing database, apply schema/migrations and bundled data, validate it, and save encrypted configuration so the app is ready to run.
- Default new database settings and database builds to SSL/TLS with Trust Server Certificate. Preserve saved policies and the Strict option; use TCP and correct the encryption diagnostic.
- Validate existing databases without rebuilding or reseeding them, and preserve DB_config if setup fails.

## 2026-11-05 - Weekly and monthly Trends history

- Replace snapshot-count history choices with 1 week and 1 month, defaulting to 1 month and ending on the selected header date.
- Update chart dates/points, baseline comparisons, snapshot inspection and CSV evidence together for the selected period; exclude older and future observations.

## 2026-11-05 - Remove Governance Overview

- Remove Governance Overview from the sidebar and persona page configuration. Governance now starts with Trends, followed by Cyber Terrain Insights.
- Redirect old Overview bookmarks to Trends while retaining query selections. Discard the retired permission from older persona settings without enabling any replacement page.

## 2026-11-05 - Executive Trends briefing

- Replace the Governance Trends placeholder with an infographic covering compliance, lifecycle and discovery direction, counts and management priorities.
- Compare 6, 12 or 24 recorded snapshots within the selected scope/date, with interactive charts, explicit evidence gaps, population changes and downloadable CSV evidence.
- Preserve persona-controlled navigation and support keyboard and narrow-screen use.

## 2026-11-05 - Compact Personas layout

- Group persona permissions into section and popup views, with compact grids, visible Save/Discard actions and more usable dialog space.
- Use a group selector and Previous/Next permission pages on smaller screens so the controls fit without vertical scrolling at standard laptop and phone sizes.

## 2026-11-05 - Business Reporting persona

- Add Business Reporting to Menu → Settings → Personas with configurable sections, pages and popups, and a browser-remembered active selection in the header.
- Start the new persona with all options enabled. Preserve existing four-persona configurations on read and reject incomplete saves from stale clients.

## 2026-11-05 - Cyber Terrain Insights navigation label

- Rename the Governance page link from Insights to Cyber Terrain Insights, including its label in Personas settings.

## 2026-11-05 - Focused persona configuration

- Show only the selected persona's configuration in Menu → Settings → Personas. Keep unsaved edits when switching personas and save or discard them together.
- Display the active persona immediately to the left of Security Domain in the header, while keeping persona selection exclusively in Settings.

## 2026-11-05 - Discovery Life Cycle Management

- Add a server attention queue and hardware warranty, software support and OS-version registers under Discovery.
- Highlight overlapping lifecycle issues, include exactly N-2 and older OS versions, and distinguish missing evidence from confirmed problems.
- Preserve scope/snapshot and persona controls; support keyboard navigation, narrow layouts and matching CSV exports using existing SQL/JSON evidence.

## 2026-11-05 - Impact Topology view controls

- Add a Full screen / Exit full screen toggle to expand the Impact Topology across the browser window and restore its normal dialog size. Escape exits full screen before closing the graph.
- Minimise Filters and Layout & view by default, with a Show/Hide filters & layout toggle. Both view toggles preserve filters, graph layout, node selection, zoom, pan and applied scope/date.

## 2026-11-05 - Persona pages and popup permissions

- Configure individual sidebar pages within each section, with mixed-state section checkboxes. Disable drill-through links to unavailable pages, including new-tab links.
- Configure twelve popup families independently of page visibility; disable their buttons/chart actions while keeping Menu and Settings available.
- Upgrade existing section-only settings without changing their visible pages or popup behavior. Both providers write version 2 only on explicit save; no additional SQL migration is required.

## 2026-11-05 - Persona navigation settings

- Add Menu → Settings → Personas for Analyst, Life Cycle Management, Configuration Management and DSOC Analyst, with per-section checkboxes, Show all/Hide all, Save and Discard.
- Keep persona selection and configuration exclusively in Menu → Settings → Personas. The browser-remembered selection filters the left navigation while preserving scope, date, direct page access and access to Settings. All sections are enabled initially.
- Persist shared configurations in both providers: SQL forward migration 031 and an optional No-SQL persona settings file created on the first save. Preserve existing stores, calculations and the login-free access model.

## 2026-11-04 - Insights infographic PDF

- Add Generate PDF to Governance Insights, with progress and retry handling, preserving applied scope, security domains and snapshot.
- Export every infographic chapter as a clean A4 report with vector artwork/charts, tool coverage cards, page numbering and the recorded snapshot timestamp. Label PDF generation time separately; unavailable source timestamps remain Not recorded.

## 2026-11-04 - Executive Governance Insights

- Replace the Insights placeholder with a vertically scrolling Cyber Terrain Posture infographic: local branding/terrain imagery, coverage rings and tool cards, finding/CVE exposure, service context, patch assurance and leadership priorities.
- Use existing scoped data at one resolved snapshot, retain domains/date in evidence links, and distinguish empty evidence, unavailable data and zero findings. Overview and Trends remain placeholders.
- Support desktop and narrow layouts with keyboard chapter navigation and accessible text for all charts. No schema, provider-rule, package or persistent-data changes.

## 2026-11-04 - Preserve Impact Topology zoom on selection

- Keep the current zoom and pan when selecting graph nodes, search results or connected-node links. Fit graph and the 0 key remain explicit view resets.

## 2026-11-04 - Default Impact Topology severities

- Open and reset the Impact Topology with Critical Exposure and High Risk selected and a minimum of one matching finding per node. Other severities and Select all remain available.

## 2026-11-04 - Expand all affected CIs

- Added an Expand all affected CIs / Collapse all affected CIs toggle to the Impact Topology Filters card, preserving severity and finding-count filters.
- Bulk expansion leaves connection focus and fits the scene; existing rendering limits and individual system expansion remain supported.

## 2026-11-04 - Left CMDB drawer and nested findings

- Move CMDB drill-through to the left edge and reduce its width by 20% on desktop and narrow screens.
- Keep Service Impact finding details open when launching CMDB from a device, preserving the active tab, filters, scroll and expanded evidence. Closing CMDB returns focus to that device.

## 2026-11-04 - Graph focus control position

- Moved Focus connections / Show scope to the top-right corner of the graph workspace, retaining its selection, toggle and keyboard behavior.

## 2026-11-04 - Default Impact Topology layout

- Open the Impact Topology in Hierarchical layout with Top down direction. Other layouts remain selectable.
- Presentation default only; no SQL/JSON data, schema, provider or dependency changes.

## 2026-11-04 - Impact Topology control alignment

- Grouped severity/count/reset controls under Filters and layout/direction/zoom/fit controls under Layout & view, with aligned fields and responsive stacking.
- Aligned range limits, exact node badges and finding details with the selected risk severities. Removed the 99+ badge cap and added the selected severity breakdown and counting context.
- No SQL/JSON data, schema, provider or dependency changes.

## 2026-11-04 - Remove application login

- Open pages, data, settings and report APIs directly without a login or session cookie in both providers.
- Removed Signed in, Logout, Password Settings, credential provisioning and background session polling.
- Retained safe legacy-login redirects and explicit retired-API responses; SQL credential protection and TLS remain unchanged. Existing logindetails files are ignored and left untouched.


## 2026-11-04 - Impact Topology filters and animated layouts

- Added dynamic severity selection and an inclusive finding-count range with sliders and numeric inputs. Graph counts, search and finding details follow the selected severities and range.
- Keep matching devices visible when count filters exclude their parent system, without restoring excluded nodes or connections.
- Added Force-Directed, four Hierarchical directions, Circular/Radial and Coordinate/Spatial layouts with interruptible transitions and reduced-motion support.
- Generate stable X/Y workspace positions for spatial views, with optional node edits retained while the popup is open. No geographic locations are inferred or persisted.
- Retained header/table scope, modal sizing and keyboard behavior. No SQL/JSON schema, provider, package or build changes.

## 2026-11-04 - Service Impact Topology popup

- Replaced the Explore the Impact tab with a Settings-sized Impact Topology popup opened by Explore selection.
- Added interactive service, capability, ICT system and affected-device nodes with risk counts, search, connection inspection, expansion, focus, pan/zoom and finding details.
- Preserved applied scope, table filters, selections, snapshot and severity calculations, with keyboard controls, focus return and narrow layouts. No SQL/JSON data, schema or dependency changes.

## 2026-11-04 - Retire Network Impact Analyser

- Removed Network Impact Analyser from navigation, the workspace and the CMDB launch actions.
- Redirected old bookmarks to the matching risk profile while retaining header scope, security domains and snapshot date.
- Kept existing analyser data APIs compatible. No SQL/JSON data or schema changes are required.


## 2026-11-04 - ICT impact sidebar visibility

- Hide ICT System Impact Analyser whenever the applied header scope contains a managed network, including when that analyser was already active.
- Restore the entry when managed-network scope is cleared or replaced with ICT-system scope.

## 2026-11-04 - Standalone ICT System Dependencies

- Moved ICT System Dependencies from the impact analyser overlay into its own sidebar view, directly beneath ICT System Impact Analyser.
- Defaulted dependency Environment to Production and ICT impact Findings Severity to Critical Exposure and High Risk, with editable filters.
- Retained scoped systems without findings, snapshot/domain scope, dependency exports and drill-throughs. No SQL/JSON data or structure changes.


## 2026-11-04 - Validation by change impact

- Require an impact assessment before selecting checks; skip SQL/JSON and documentation gates when those areas are unaffected.
- Added conditional CI selection and escalation labels, preserving full offline validation for releases and dependency/build changes.
- Made documentation path mappings and source fingerprints informational so unchanged behavior does not force documentation edits.


## 2026-11-04 - Discovery Overview PDF

- Added Download overview PDF with charts and tables covering all Overview sections, per-tool coverage report cards, suggested actions and calculation notes.
- Shared the page/report data loader to preserve scope, security domains, resolved snapshot and existing calculations in SQL and No-SQL.
- Added accessible progress/error handling, empty-scope N/A values, full-label tables, pagination and PDF/browser regression coverage. No data or schema migration is required.


## 2026-11-03 - Global Security Domain filter

- Added PROTECTED, SECRET and UNKNOWN to the header, all selected by default, with staged Update and retained scope/date across pages, impact windows and exports.
- Added canonical domains to every endpoint, ICT system and network model, including historical JSON snapshots; displayed domains in endpoint/model views.
- Added forward SQL migration 030, matching fresh-schema/import/export handling, and a backed-up, idempotent JSON migration that preserves settings and observations.


## 2026-11-03 - Remove demo-data notices

- Removed the sample-observation and simulated-patch notices from Discovery Overview and related notices in the vulnerability and patch explorers.
- Kept the existing records, calculations, evidence fields and exports unchanged in both providers.

## 2026-11-03 - Consistent vulnerability and patch explorer design

- Aligned Security Vulnerability Explorer and Patch Management Explorer with End Point Explorer's hero, interactive chart cards, toolbar, table spacing and pagination.
- Constrained patch results to the available panel height with internal scrolling and the same narrow-layout table cap as End Point Explorer.
- Connected chart selections to table filters and Excel export, preserving patch-tab filters, scope/date, sample labels, evidence and CMDB actions in both providers.

## 2026-11-03 - Governance navigation placeholders

- Added Governance as the first sidebar section, with empty Overview, Trends and Insights pages.
- Preserved authentication, applied scope/date, active-page highlighting, keyboard navigation and blank content without scope. Both providers use the same pages with no data migration.
- Corrected the root legacy-dependency ignore rule so the existing impact-analyser dependency API is included in fresh checkouts.

## 2026-11-03 - Discovery Overview security and patch summaries

- Added vulnerability observation/severity/remediation summaries and server patch status, verified percentage, overdue and unknown-evidence summaries to Discovery Overview.
- Added matching explorer drill-throughs and suggested actions, preserving header scope, the resolved snapshot, sample labels and existing discovery calculations.
- Patch Management Explorer now accepts validated Overview filter presets, retaining them across tab switches and Excel export. Both providers use existing data; no migration or population is required for this update.

## 2026-11-03 - Patch Management Explorer

- Added a Discovery page below Security Vulnerability Explorer for server patch status, installation/restart dates, patch levels, missing updates, overdue actions, ownership, maintenance windows and exceptions.
- Added evidence-aware status and three searchable/filterable table views with CMDB impact navigation and full-field Excel export. Missing/stale evidence stays Unknown; exceptions do not hide overdue work.
- Added optional JSON observations, forward SQL migration 029 and explicit backed-up, labelled sample population. Existing inventory, settings, findings and network-device patch rules are preserved; both builds remain offline.

## 2026-11-03 - CMDB asset impact navigation

- Added Open Network Impact Analyser to CMDB slide-out panels. It requests a new window, retains the selected snapshot/header scope and automatically loads the selected asset's network.
- Added exact asset filtering for diagrams, finding counts and drill-throughs, a visible selection banner and Clear asset filter. Unavailable assets show an empty state; normal sidebar entry keeps manual Run behavior.
- Shared behavior across SQL and No-SQL without schema or stored-data changes.

## 2026-11-03 - Security Vulnerability Explorer

- Added a Discovery view below Installed Software Explorer with CVE metadata, remediation, affected software and endpoint/OS context, searchable column facets, CMDB drill-through and filtered Excel export.
- Added four sourced public CVEs matched to seven exact inventory versions, with explicit sample-exposure provenance and backed-up No-SQL population. Existing observations and settings are preserved; ambiguous versions remain unmatched.
- Added forward SQL migration 028, matching SQL/JSON loaders and a separate opt-in SQL sample population script. Creation/reservation dates remain distinct from detection dates. Builds remain offline and preserve existing stores.

## 2026-11-03 - Missing dependency startup recovery

- SQL and No-SQL dev/start/build commands now explain how to repair a missing or incomplete Next.js installation with `npm ci --offline` instead of an unhandled module stack trace.
- Dependency validation happens before JSON initialization or build setup; existing data, settings and credentials are preserved.

## 2026-11-02 - Risk explorer drill-through tabs

- Network and ICT System Explorer names, CI counts, compliance links and finding counts now open new browser tabs with the selected row, snapshot and matching filters preset. Name links open the existing details panel in the new tab.
- Preserved the originating explorer's scope, search and order, native keyboard/context-menu behavior and accessible new-tab announcements. Both SQL and No-SQL builds use the shared implementation.


## 2026-11-02 - Complete known-endpoint finding coverage

- Added explicit backed-up No-SQL sample enrichment that fills missing known-endpoint inventory fields and ensures an open finding for each non-compliant or unknown applicable SPI result across every snapshot. Fully compliant endpoints receive no new findings.
- Preserved original finding history, local settings, and unidentified Shadow IT nodes; new sample observations include provenance and deterministic identities.
- Shared the JSON SPI evaluator with maintenance tooling and added historical/open-state, configurable-rule, coverage and idempotence tests plus enriched-data browser/report validation.


## 2026-11-02 - SQL data population for No-SQL

- Added explicit SQL-export conversion and backed-up No-SQL population, preserving source snapshots, entity relationships, inventory metadata, vulnerabilities and persisted finding history while retaining local settings/reference mappings.
- Enriched fresh sample stores and explicitly populated stores with endpoint/software details, entity profiles, example CMDB links and 240 Shadow IT observations per sample snapshot. Builds retain existing data.
- Fixed No-SQL Shadow IT system filtering to include ARP observations through their owner, consistent with SQL. Added data-preservation, coverage, recovery and import tests and an imported-data production smoke option.

## 2026-11-02 - Login setup correction

- Fixed npm run setup:login to set or replace the application username and password when logindetails already exists. Typed passwords are hidden and confirmed.
- Invalid input preserves existing credentials; successful updates invalidate old sessions. Automatic validation still retains usable credentials. SQL and No-SQL share the same behavior and encrypted file format.

## 2026-11-02 - Mandatory offline compilation

- Included all locked application, development and native compiler package archives in vendor/npm with original source URLs and SHA-512 verification. npm ci installs offline without a prewarmed cache.
- Enforced local archive verification and network-denied compilation for SQL and No-SQL; disabled npm lifecycle downloads and build telemetry. compileApp.cmd now performs the offline install before validation.
- Added archive/network regression tests, empty-cache offline CI, and mandatory SDLC, agent, contribution, release and review obligations for every future change. No SQL schema, JSON format or calculation changes.

## 2026-11-02 - SQL and No-SQL compilation paths

- Removed the rejected standalone Demo app and folder.
- Added SQL and JSON-backed No-SQL builds of the same authenticated app, with separate output directories and shared pages, APIs, reports and settings.
- Added persistent server-side JSON snapshots/reference data, atomic settings saves, restart persistence and per-type CMDB mappings. Existing SQL data and strict TLS are unchanged.
- Updated SDLC, contribution/agent guidance, CI, build scripts and release/data documentation to require both builds and No-SQL runtime validation for future changes.

## 2026-11-02 - Standalone browser demo

- Added Demo/index.html: a portable, offline JSON-backed version of the current workspace, reports, risk profiles and impact analysers.
- Reused shared UI/report code with browser data/settings/navigation adapters and synthetic historical data.
- Added demo build/freshness/browser tests, SQL calculation review checks and SDLC/CI obligations to keep both versions aligned.

## Unreleased

- Removed 42 unreachable legacy modules, obsolete private helpers, an unused logo and the unused direct zod dependency; current navigation, APIs and report behavior are preserved.
- Added migration 027 to remove retired KPI structures/configuration and the unused network APP-ID field. ICT-system APP-ID remains available. KPI procedures retain current results while avoiding retired calculations.
- Added unused-code gates and aligned fresh-install validation, tests, ERD and operational documentation with the current two-KPI app.

## 1.0.0 — 2026-11-02 development baseline

- Imported the latest TSAAT app, including Settings-sized compliance dialogs, Security Posture/Findings/Discovery Coverage tabs, standard tables and evidence/remediation drill-through.
- Added locked installation, source/documentation quality gates, CI and lifecycle documentation.
- Aligned retired-page assertions and typed fixtures with current routes and contracts; bounded Windows test concurrency.
- Retained schema, migrations through 026, reference configuration, snapshots and design documentation. Excluded local credentials, vendored packages and generated outputs.

This baseline identifies source readiness, not production deployment approval.
