# Life Cycle Management

Discovery → Life Cycle Management (`/discovery-coverage?discoveryView=life-cycle-management`) prioritises hardware renewal, unsupported software and OS refresh work in the applied header scope and snapshot. It follows Patch Management Explorer and has its own persona page switch, `discovery-life-cycle`. Saved version-2 persona page lists are retained; enable the new page explicitly where required. Default/no-persona navigation includes it. CMDB buttons use the independent popup permission.

## Evidence and scope

The page uses `loadDatasetForDate` through `lib/data-loader.ts` with the **full** profile: SQL summary payloads omit installed software. Both builds use one pure projection after resolving the snapshot. Only applied network/system/security-domain filters are used; unrelated explorer filters cannot narrow the page silently. Real-network filtering follows Discovery; unidentified IP nodes are excluded. System scope follows endpoint system association and network scope follows endpoint infrastructure, including CIs hosted outside a system's owning network.

- Hardware warranties cover identified servers, workstations, network devices, storage devices and printers. Only recorded `OutOfWarranty` is confirmed; unknown status stays unknown. The inventory has no physical/virtual marker or warranty expiry date. Do not guess chassis type from model/hostname or invent dates. Other/unidentified categories are excluded from hardware totals.
- Software support shows one row per recorded server/workstation installation. `OutOfSupport` is confirmed; unknown support stays an evidence gap. Multiple installations are not collapsed into one product. An empty software inventory is a gap, not proof that no unsupported applications exist.
- OS evidence includes server/workstation OS and network OS. **N-2 or older means recorded `nMinus >= 2`, inclusive of 2**. Require a finite nonnegative integer; null/invalid values remain unknown. Never subtract release-year labels or substitute today's date. Unsupported OS is also an OS issue, even when version distance is missing or below two.

## Server attention

Rank by the number of affected areas: hardware warranty, installed software and OS (zero to three). Old and unsupported OS count together as one area. Ties use critical ICT system, Production environment, descending OS distance, descending unsupported installation count, then name/ID. Among servers with no confirmed issue, missing-evidence rows precede clear records. Missing data never becomes a confirmed issue. This is not an SPI severity, priority rank, compliance score or failure forecast.

Highlight the top three affected servers with reasons and next steps; the queue retains all servers. No remediation is executed or saved.

## Interaction and states

Four summary buttons open matching evidence: affected servers, expired warranties, unsupported installations and exactly N-2-or-older OS records. Counts and highlighted servers refer to the header scope; table filters narrow the register below. Software totals distinguish installations and distinct endpoints.

WorkspaceTabs provides server, hardware, software and OS views with arrow/Home/End support. FindingsDataTable provides search, column facets, applicable numeric ranges/sorting, pagination and local horizontal scrolling. Show selects confirmed issues, all records or missing data; the OS summary also selects N-2 or older. Switching view/Show resets table filters. Matching CSV exports escape spreadsheet formulas and include the resolved snapshot in their filename. Software names expand inline; no new popup or report API is introduced.

Empty/missing scopes show zero counts and explicit empty states. Provider failure shows sanitized retry text preserving scope/date. Existing route loading, Settings, login-free access and compatibility routes remain available. Cards/tabs wrap on narrow screens; tables scroll within their own panel.

## Compatibility and impact assessment

No SQL query, schema, JSON storage format, reference rule, configurable measure, CMDB mapping, dependency or build configuration changes. Existing full loaders expose every required field. No SQL migration, JSON upgrade/population or calculation-contract checksum refresh is needed; existing stores are never rewritten. Existing persona lists do not acquire new pages silently.

Affected: UI/navigation, snapshot-scoped projection/ranking, documentation/navigation inventory. Selected checks: lint/types; focused model, full-profile loader, page/error/scope and persona regressions; existing SQL dataset/cache and JSON-provider tests; `storage:check`; both guarded builds; compiled No-SQL smoke; browser keyboard, narrow layout, empty/historical scope, count reconciliation, CMDB and CSV checks; documentation generation/check. No new SQL migration/query/mapping needs disposable SQL parity; source-field availability is reviewed in both providers. Dependencies/offline assets, installation, authentication, persisted calculations and release deployment are unaffected, so no empty-cache install or full release gate is selected.

Sources: `lib/life-cycle-management.ts`, `lib/life-cycle-management-data.ts`, `components/life-cycle-management.tsx`, Discovery page/navigation and `scripts/life-cycle-management-smoke.mjs`.

Validation on 2026-11-05: 86 focused tests passed across lifecycle model/page, persona/scope, SQL dataset/cache and JSON-provider coverage. Lint, type checking, storage-contract, documentation and repository checks passed. Both offline-guarded builds passed. The focused compiled browser check covered ranking/count reconciliation, tabs/keyboard, CSV, CMDB, historical/empty scopes and 390px layout. The full compiled No-SQL smoke passed across 22 views, 16 explorer drill-through tabs, heatmaps/analysers, Settings/CMDB, 44 PDFs, seven workbooks and restart persistence. Desktop and narrow captures were inspected.
