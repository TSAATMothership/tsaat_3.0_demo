# Validation records

Historical evidence below describes the releases/dates recorded at the time. Application login was retired on 2026-11-04; current access behavior and validation are defined in [ADR 0014](adr/0014-retire-application-login.md).

## Insights infographic PDF - 2026-11-04

Impact assessment: new report download control, scoped GET API, PDF presentation and timestamp exposure from the existing dataset metadata. The report reuses the Insights loader and current Discovery/Service Impact projections. SQL/JSON queries, storage formats, schemas, calculation rules, packages and compiler configuration are unchanged. No migrations, sample population, checksum refresh, fresh installation or live SQL integration was selected. The full application suite and full No-SQL regression were not repeated; focused report/runtime checks cover this change. Both guarded builds were selected for the new API and renderer. New API inventory and affected feature/design/architecture/data documentation were reviewed and regenerated.

All 22 Insights loader/rollup/PDF/API tests passed, covering snapshot pinning, timestamp provenance and timezone handling, missing metadata, complete chapters, long-name/tool-list pagination, empty denominators, invalid requests, safe failures and response headers. Lint, strict type checking, script syntax, documentation inventories/links, repository hygiene and whitespace checks passed. Both SQL and No-SQL production builds passed with all 618 dependency archives verified and Node build network access blocked.

Compiled No-SQL browser checks used an isolated store and confirmed actual seven-page downloads for network scope, historical ICT-system scope and NONE/empty selection. PDF metadata matched the selected store's recorded snapshot timestamp. Checks passed for keyboard activation, progress/duplicate prevention, simulated failure and retry, focus recovery, filename, unchanged scope/date, desktop and 390px layouts. An initial keyboard check exposed focus loss during button disable; restoring focus only when it had fallen to the document body fixed the regression. The shared regression helper is included in test:nosql for subsequent full runs.

All seven populated-report pages were rendered locally with Windows.Data.Pdf and visually inspected for typography, charts, spacing, page breaks and timestamp footers; empty-data cover, coverage and priorities were also inspected. Screenshots and PDFs remain under ignored .local and tmp/pdfs paths. No operational data/configuration was changed. SQL evidence is shared-model coverage and compilation, not live database parity.

## Governance Insights executive briefing - 2026-11-04

Impact assessment: new server-rendered presentation and a pure executive summary of existing Discovery/Service Impact models, plus local SVG artwork, scoped evidence links and affected documentation. Both provider consumers were reviewed; no SQL query, schema, JSON format, persisted rule, dependency or compiler configuration changed. The calculation contract was reviewed and left unchanged. New schemas, migrations, sample population and fresh npm installation were not needed. Existing route/API/navigation inventories are unchanged, so regeneration was not selected.

The 57 focused tests passed across executive rollups, snapshot pinning, scope/domain links, deduplication, empty/error states, discovery/report models, service impact, workspace scope and route readiness. Lint, strict type checking, documentation checks, repository hygiene, script syntax and storage:check passed. Both guarded SQL and No-SQL production builds passed using repository dependencies with network access blocked.

Focused browser checks passed for network and ICT-system scope, historical snapshots, PROTECTED and all-domain selections, NONE/empty data, no-scope behavior, endpoint count agreement with Discovery Overview, local images, all five chapter links, keyboard navigation, evidence links, vertical scrolling and 390px layouts. Desktop chapter and phone screenshots were visually reviewed under ignored .local/governance-insights-artifacts. The production No-SQL regression also passed: direct access, 21 views, 16 explorer drill-through tabs, heatmaps/analysers including graph controls, Settings/CMDB, 44 PDFs, seven workbooks, settings persistence and restart. Smoke data and runtime configuration were disposable; operational stores were untouched.

Live SQL business-data integration was not repeated because provider operations and queries are unchanged; SQL compatibility evidence here is compilation and shared-model regression, not a live parity claim. Documentation and implementation retain the existing offline/provider contracts.

## Preserve impact graph zoom on selection - 2026-11-04

Impact assessment: client camera interaction only; SQL/JSON data, schemas, providers, calculations, dependencies and generated inventories are unchanged. No data checks, migrations, SQL parity, fresh installation, dual build, full-suite run or inventory regeneration was selected.

A browser regression reproduced selection resetting a panned graph from 125% to 100%. After removing the selection-triggered camera reset, the isolated guarded No-SQL build and browser regression passed. Pointer, Enter, Space, connected-node and search-result selections retained both the zoom value and SVG viewBox; Fit graph and the 0 key still reset zoom. Existing graph controls, layouts, nested dialogs and narrow-screen behavior passed. The 30 focused graph/route tests, component lint, type checking, documentation and smoke-script syntax checks also passed. Operational data and configuration were untouched.

## Default impact graph severities - 2026-11-04

Impact assessment: client filter defaults only; SQL/JSON data, schemas, provider operations, calculations, dependencies and generated inventories are unchanged. No migrations, SQL parity, fresh installation, dual build, full-suite run or inventory regeneration was selected.

The 30 focused graph/route tests, component lint, type checking, documentation checks and smoke-script syntax passed. An isolated guarded No-SQL build and focused browser regression passed. Browser checks verified Critical Exposure/High Risk on open, reopen and reset, Min 1, matching node counts, manual Select all with Min 0, and existing expansion, layout and nested-dialog behavior. The smoke waits for the number field to refresh before asserting reset values. Desktop and 390px screenshots were reviewed. Operational data and configuration were untouched.

## Expand all affected CIs - 2026-11-04

Impact assessment: client graph expansion and control presentation only. SQL/JSON data, structures, providers, calculations, dependencies and generated inventories are unchanged. No data migration, SQL parity, fresh installation, dual build, inventory regeneration or full-suite rerun was selected.

The 30 focused graph/route tests, component lint, type checking, documentation checks and smoke-script syntax passed. An isolated guarded No-SQL build and focused browser regression passed. Keyboard checks verified expansion of all matching nodes within the existing 140-node limit, collapse, pressed state, leaving connection focus, unchanged severity/range values and totals, and disabling the toggle when no CIs match. Existing layouts, nested findings/CMDB and focus behavior also passed. Desktop and 390px screenshots were reviewed; the button fits below Risk severity without overflow. Browser data was temporary; operational data and configuration were untouched.

## Left CMDB drawer and nested findings - 2026-11-04

Impact assessment: shared drawer presentation and Service Impact modal navigation only. SQL/JSON data, schemas, provider operations, CMDB attribute mappings, calculations and dependencies are unchanged; no migration, SQL parity, fresh installation or full-suite run was selected. Feature/UI documentation changed, but generated inventories did not.

The 36 focused CMDB/Service Impact/graph tests, component lint, type checking, documentation checks and smoke-script syntax passed. An isolated guarded No-SQL production build and focused browser regression passed. Browser checks verified left-edge placement and an exact 20% width reduction at 1600px and 390px, no drawer overflow, nested Findings/Affected CIs searches and expanded evidence retained after CMDB closes, preserved scroll/tab state, focus containment/return, Escape closing only the top dialog, and a standalone End Point Explorer launch. Existing graph controls/layouts also passed. Desktop/phone screenshots were visually reviewed under ignored .local/impact-controls-artifacts. Operational data and configuration were not changed.

## Graph focus control placement - 2026-11-04

UI-only positioning change: Focus connections / Show scope is anchored to the top-right of the graph canvas. Lint, type checking, documentation checks, smoke-script syntax and an isolated guarded No-SQL build passed. The focused browser regression verified corner placement at desktop and 390px widths, keyboard activation/toggle state, focus return, graph interactions and the Hierarchical / Top down default. Screenshots were visually reviewed. The smoke now waits for Settings to close and return focus before opening the graph. No data/provider, schema, calculation, dependency or generated-inventory changes were made; SQL parity, fresh installation and the full application suite were not repeated.

## Impact graph controls - 2026-11-04

Impact assessment: scoped client presentation filtering, control layout, graph regression coverage and feature/design documentation. SQL/JSON data, schemas, queries, persisted calculations, dependencies and build configuration are unchanged. No migrations, SQL parity, fresh installation or full-suite rerun was selected. Generated inventories are unaffected; docs:generate was not needed.

The 27 graph tests and two service-impact route tests passed, along with lint, type checking, documentation checks and smoke-script syntax checks. A guarded No-SQL production build passed in the isolated validation copy to support focused browser testing. The graph browser regression passed on enriched temporary sample data: selected critical and combined critical/high counts, severity-dependent range maxima, exact badges above 99, matching inspector details, inclusive ranges, grouped controls, all layout families, animation/reduced motion, scope/search/expansion, nested findings, keyboard/focus and narrow layouts. Desktop and 390px screenshots were visually reviewed and remain ignored under .local/impact-controls-artifacts. Operational data was not changed.

## Application login retirement - 2026-11-04

Impact assessment: shared page/API access, header and Settings behavior, legacy routes, setup tooling and current documentation are affected. The breadth of the access change justified the comprehensive gate, fresh offline installation, both production compilations and runtime smoke. SQL/JSON queries, schemas, persisted data, calculation rules and package dependencies are unchanged; no migration or live SQL parity run was needed. SQL credentials and strict TLS remain unchanged.

Validation used Windows, Node 24.13.1 and installed Chrome. Builds and runtime checks used an isolated source copy and temporary stores without operational DB_config, logindetails or NoSQL/data.

| Check | Result |
| --- | --- |
| Comprehensive source gate | npm run check passed: 618 dependency archives, repository/documentation checks, lint/types, 674 tests passed with 15 skipped, 11 tooling tests and the existing SQL/JSON calculation contract |
| Offline installation | npm ci --offline --ignore-scripts installed 571 packages from a new empty cache with the Node network guard enabled |
| Production builds | Both SQL and No-SQL builds passed with network access blocked; rebuilt after the graph scene correction below |
| Focused regression after correction | 53 tests passed across login retirement, graph projection/layouts, service-impact page and workspace popups; builds also repeated lint/type checking |
| Both compiled shells | Direct page/API access, safe legacy-login destination, header controls at 1600px and 390px, Settings keyboard/focus return, no account controls and no session polling passed |
| Compiled No-SQL smoke | Passed without cookies or application credentials: 21 views, 16 explorer drill-through tabs, both heatmaps/analysers, Settings, CMDB, 44 PDFs, seven workbooks, settings writes and restart persistence |
| Compatibility | Legacy login redirects retain scope/date/domains and reject external destinations; obsolete cookies do not gate data APIs; login/password writes return 410; old logout expires its cookie |
| Final documentation/tooling review | docs:generate, docs:check, smoke-script syntax checks and git diff --check passed |

Broader validation found matching graph devices could remain collapsed after count filtering removed their parent system. A failing regression test reproduced this; the scene now shows those matching devices without restoring excluded parents or edges. The browser smoke now uses an observed finding count instead of assuming the enriched store contains exactly two critical findings, waits for focus restoration, and checks that the retired Network Impact Analyser action is absent from patch CMDB details. Legacy-login checks verify the browser destination because Next.js can deliver redirects through a streamed shell.

Live SQL business-data integration was not run. SQL shell checks used an unavailable SQL executable and exercised only access/header/Settings-shell behavior. Existing local credential files and operational data were left untouched. Screenshots and test artifacts remain ignored under .local/login-removal-artifacts. Existing Browserslist, optional sharp and chart-size notices did not fail the checks.

## Dual-provider builds - 2026-11-02

Validation used Windows, Node 24 and installed Chrome. No operational SQL data or configuration was changed. The original TSAAT repository remained clean.

| Check | Result |
| --- | --- |
| Source/documentation gates | npm run check passed: hygiene, reachability, docs, lint, strict types, 573 regression tests passed; 11 opt-in SQL tests skipped |
| Tooling | Four tests passed |
| Production compilation | npm run build:all passed; distinct .next-sql and .next-nosql artifacts contain the expected compiled provider constants |
| Compiled No-SQL runtime | Authentication and 16 views passed with no DB_config and an unavailable SQL executable |
| Interactions | Both heatmaps/searches, entity details, CMDB, both worker analysers and all Settings tabs passed; no SQL administration fetches from No-SQL UI |
| Reports/exports | 44 PDF responses parsed with pages and six XLSX exports validated, including findings Affected CIs |
| Persistence | Risk, priority and discovery settings saved to JSON; priority affected findings; settings survived a fresh app process and login |
| File-store safety | Unit tests covered concurrent writers, traversal rejection, unknown schema versions, nonempty-directory protection, preservation of existing stores and per-type mapping reloads |
| SQL preservation | Both SQL implementations match their previous content exactly behind the new facades; schema, seed datasets and strict TLS were unchanged |
| Removed distribution | Demo folder and standalone build/test adapters removed; runtime JSON and compiled outputs ignored by Git |

SQL integration was not rerun for this storage split and remains opt-in against a disposable database. Earlier trusted-certificate constraints are described below; no TLS exception was introduced. The current smoke validates PDF structure/content delivery, not a new visual audit of every report. The existing Browserslist data-age notice remains. Local validation logs are under .local/dual-build-*.log and are not tracked.


## Cleanup release - 2026-11-02

Validation used Windows, Node 24.13.1 and local SQL Server Express. Cleanup removed 42 unreachable modules plus unused private declarations and server calculations; seven obsolete test files and retired assertions were removed with their implementations.

| Check | Result |
| --- | --- |
| Full development gates | npm run check passed: hygiene/reachability, documentation, lint, strict TypeScript, 556 tests passed and 11 opt-in SQL tests skipped |
| Tooling tests | Four passed, including worker/dynamic-import reachability and test-only orphan detection |
| Production build | npm run build passed; existing Browserslist data-age notice remains |
| Production startup | Temporary port 3103: root 307, login 200, unauthenticated protected API 401; test server stopped |
| Fresh database | Complete schema, migrations 001-027, current reference imports and eight demo snapshots provisioned successfully |
| SQL integration | Nine KPI/CMDB/entity-panel cases passed on the upgraded disposable copy before the strict local app connection was saved |
| Migration guards | Native SQL tests refused custom calculation/report bindings and confirmed full transaction rollback; rerun of 027 succeeded |
| KPI parity | Exact before/after results across eight snapshots: 78 bulk scopes and five individual calls each (624 bulk scopes, 40 calls), including all networks/systems, duplicate IDs, empty/unknown IDs, global scope and high-priority findings |
| Data preservation | Exact SHA-256 content hashes for all 64 retained tables outside the deliberate configuration changes; network apm_number and rowversion excluded from comparison |
| Approved database copy | TSAAT_UI3 restored from a fresh verified COPY_ONLY/CHECKSUM backup of TSAAT, migration 027 applied, DBCC CHECKDB and constraint checks passed; release parity also matched |
| Original installation | Original repository and TSAAT database retained; its 10 calculation records remain, versus two in TSAAT_UI3 |
| Saved connection | Git-ignored CurrentUser-encrypted DB_config targets TSAAT_UI3 with Windows authentication and strict TLS; certificate validation remains enabled |
| Test cleanup | The three databases created exclusively for validation were dropped after checks; recovery backups retained |

The SQL Server certificate is not trusted by Windows. The user chose to configure a trusted server certificate. Until then the new strict application connection cannot complete the TLS handshake; further SQL integration through that app connection and authenticated end-to-end checks remain dependent on the certificate. No exception was saved. The last attempt to rerun the app-adapter SQL guard suite after saving strict settings failed at TLS, not at migration execution; those guard cases were separately verified with native SQL on the disposable copy.

This cleanup changes unused code and SQL configuration rather than current UI layout. It does not claim a new visual review of every page/PDF. Current UI/report unit and route contracts passed. Local logs, comparison captures and exact recovery backup location are in .local/cleanup-audit (excluded from Git); deployment.json identifies the source backup and applied migration.

## Imported baseline - 2026-11-02

This evidence applies to the imported TSAAT UI 3 baseline, using Windows and Node 24.13.1. Future changes need fresh validation.

| Check | Result |
| --- | --- |
| Independent locked installation | npm ci succeeded; no sibling repository dependency |
| Application fidelity | 271 files identical at import; final trailing-blank-line normalization in eight text files only |
| Strict TypeScript | Passed after correcting inherited fixture types and the seed generator IP-node guard |
| Default regression suite | 599 passed, 0 failed, 7 opt-in SQL checks skipped; 119 test files |
| Documentation tooling | 3 tests passed: SQL extraction, mapped documentation impact, fingerprints and link checks |
| Production compilation | Next.js 14.2.35 build completed successfully |
| Production startup | Root redirects to login (307); login renders (200); protected API rejects unauthenticated access (401) |
| Database changes | None applied; original database and local credentials were not copied or modified |

The default suite exercises authentication helpers in isolated temporary directories, domain calculations, route contracts and exports. SQL integration was deliberately not enabled against the existing database. Run those checks against an explicitly provisioned disposable target before a database-affecting release.

The copied app includes the previously browser-verified compliance popup redesign. New-repository verification additionally covers production startup and unauthenticated login/API boundaries; it does not claim a new authenticated end-to-end review of every screen or production deployment approval.

The build reports an existing stale Browserslist dataset notice. Dependencies were kept at the source lockfile versions; a dependency refresh is separate reviewed work. Local build/test logs remain ignored under .local/validation and are not release artifacts.
