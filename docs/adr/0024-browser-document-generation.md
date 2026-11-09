# ADR 0024: Browser-only PDF and Excel generation

- Date: 2026-11-09
- Status: Accepted

## Context

TSAAT has PDF and Excel exports across Governance briefings, catalogue reports, measures, inventory Explorers, reusable findings tables and risk/dependency panels. The audit identified 18 server PDF routes, eight server Excel/template routes and three existing browser Excel actions. The user requires every document to be constructed in the frontend with visible generation progress. SQL and JSON deployments must keep the same evidence, scope, snapshot and configuration semantics.

## Decision

Keep validated report-model preparation on the existing data server and move every PDF/XLSX/XLS renderer into the browser document worker. A version-1 envelope carries the kind, filename, title, generatedAt and report-specific data. Endpoints return no-store JSON; HTML navigation to supported GET report URLs redirects to a generation page with the original query intact. The existing summary JSON and CSV contracts remain available.

Use one client controller and native Generating Document dialog for remote-model and existing local-model exports. Announce real stages/details, allow cancellation and retry, prevent concurrent duplicate work and restore focus. Cancel aborts data reads and terminates the worker. No partial document is downloaded. Bounded input and same-origin document/asset access preserve a predictable browser resource boundary.

Reuse the existing report layouts, pdf-lib, workbook formats and offline assets. Renderer code must not import providers, Node filesystem/SQL modules or server-only loaders; application server routes must not import runtime renderers. Enforce these boundaries with regression tests. Keep all existing APIs, scopes, dates, configurable definitions, canonical export fields and stale-selection validation.

## Alternatives

- Keeping backend generation or a headless rendering service conflicts with the requested frontend-only engine.
- Rendering on the browser main thread blocks the progress and cancel interface for large reports.
- Sending full datasets to a generic client report builder broadens exposure and duplicates canonical scoping/calculation logic.
- Building a Tableau provider in this change would mix a separate authentication/data-platform transformation into the document migration. ADR 0023 remains a proposed deployment direction.

## Consequences

The server still supplies SQL/JSON data and settings; this is not a serverless application or a new authentication model. Programmatic clients of former binary PDF/XLSX APIs must consume the new JSON models and use a renderer, while interactive compatibility links remain usable. Browser resources bound export size; oversized jobs fail explicitly with a smaller-scope instruction. CSV-only behavior is unchanged.

No SQL migration, JSON upgrade, source evidence change, calculation-contract refresh or new registry dependency is required. Validation covers scoped report/model regressions, workbook contracts, renderer dependency boundaries, browser downloads/progress/error/cancel/focus, PDF layout, offline installation and both guarded builds. SQL/JSON parity uses the same selected snapshots/scopes in explicitly isolated stores; missing SQL evidence is not a pass.

See [the audit and runtime contract](../client-document-generation.md), [architecture](../architecture.md), [UI design](../ui-design.md), [data providers](../data-providers.md) and [offline builds](../offline-builds.md).
