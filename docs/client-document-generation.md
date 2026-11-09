# Browser document generation

## Audit and migration plan

The 2026-11-09 audit found 18 server PDF routes, eight server Excel/template routes and three existing browser Excel implementations (including one legacy risk-detail control disabled at its current call site). This change moves document construction to browser workers. The server retains validated, scoped data preparation through the SQL/JSON facades. No renderer is reachable from an application server route. [ADR 0024](adr/0024-browser-document-generation.md) records the accepted boundary.

| Family | Audited locations | Migration |
| --- | --- | --- |
| Governance Insights | Cyber Terrain, Installed Software, Discovery, End Point and Security Vulnerability Insights; five report APIs | JSON report models, bundled artwork and existing PDF layouts in the worker |
| Catalogue / risk profiles | Cyber Posture Summary, network/system remediation, out-of-support OS, modelling status, discovery remediation | Extract embedded rendering; preserve data preparation and scope |
| Observed measures | KPI/SPI current, non-compliance, trend and All-SPI reports through tasking-report | Prepared current/history models; browser PDF rendering |
| Compatibility PDFs | Individual network/system remediation, system coverage gaps, network/system performance and network discovery | Keep route URLs; browser navigation opens a client generation page |
| Discovery Excel | End Point, Installed Software, Security Vulnerability, Patch Management, Shadow IT and Discovery Compliance Explorers | Complete filtered rows, existing columns/types and workbook styles |
| Findings Excel | Findings Register and reused findings tables | Canonical requested IDs/order, scope, snapshot, stale-selection checks and affected-CI sheet |
| Template Excel | Network target-state template compatibility API (no current visible button) | Scoped network data and bundled three-sheet workbook template |
| Existing browser Excel | ICT System Dependencies; active risk-detail "Export findings + CIs"; retained legacy NetworkDetailRiskCharts implementation whose current call site disables drill-through | Keep Excel XML semantics; migrate all implementations to the same generation/progress pipeline without enabling the inactive control |

CSV-only exports are separate formats and remain unchanged. CMDB and topology panels have no additional PDF/Excel generator beyond the audited reusable controls. Compatibility-only routes remain in the migration inventory even when no live button currently calls them.

Implementation sequence:

1. Establish a versioned document envelope and audit every renderer dependency.
2. Add a shared browser worker, local asset loader, download lifecycle and accessible Generating Document dialog with actual stage/detail progress, cancel and retry.
3. Migrate Insights, workbook and legacy PDF families, retaining existing calculations and report content.
4. Replace all page/panel callers, including existing browser Excel actions and old direct report links.
5. Prove that server routes return data/redirects rather than document bytes; validate all families through real browser downloads and inspect their output.

## Implemented route and renderer inventory

| Read/selection endpoint | Browser renderer |
| --- | --- |
| `/api/governance/insights/report`, `/api/discovery/installed-software-insights/report`, `/api/discovery-coverage/overview-report`, `/api/governance/end-point-insights/report`, `/api/governance/security-vulnerability-insights/report` | `lib/documents/insights.ts`, five `insights-*` kinds and the existing themed PDF helpers |
| `/api/report/summary?format=pdf` | `legacy-pdf.ts` / `posture-summary-pdf.ts` |
| `/api/networks/remediation-report`, `/api/systems/remediation-report`, `/api/systems/out-of-support-os-report`, `/api/systems/modelling-status-report`, `/api/discovery-coverage/remediation-report` | `legacy-pdf.ts` / `legacy-narrative-pdf.ts` |
| `/api/networks/[networkId]/remediation-report`, `/api/systems/[systemId]/remediation-report`, `/api/systems/[systemId]/coverage-gaps-report` | Same narrative renderer, preserving the entity's filter contract |
| `/api/networks/performance-report`, `/api/systems/performance-report`, `/api/discovery-coverage/network-report` | `legacy-pdf.ts` / performance and network-discovery renderers |
| `/api/tasking-report` | `tasking-pdf.ts`; SPI single/all/trend and KPI current/trend/compatibility kinds, retaining non-compliance variants |
| POST `/api/discovery-coverage/{endpoints,installed-software,security-vulnerabilities,patch-management,shadow-it,compliance}/export` | `workbooks.ts`; six `xlsx-*` row projections |
| POST `/api/findings/export`; GET `/api/discovery-coverage/target-state-template` | `workbooks.ts`; findings/affected-CI sheets and the bundled template |
| Existing client evidence for dependencies/risk detail | `local-workbooks.ts`; `xls-dependencies` and `xls-risk-findings` |

`components/document-download-button.tsx` handles GET actions. POST export callers use the same controller with their existing requested IDs/filters. `components/document-generation-dialog.tsx` is mounted once in the application layout. `lib/documents/document.worker.ts` dispatches all remote and local jobs; renderers return byte arrays rather than HTTP responses. Generated route inventories remain the source for the full API/method list.

## Scope and validation assessment

This is a broad UI/runtime, API/export and browser-bundle change. It affects document transport, construction and deterministic selection of capped report evidence, not evidence definitions, query semantics, stored calculations, schemas, snapshots, source data or persistence. Validation exposed provider-dependent input ordering in capped summary/remediation reports: their PDF projections now sort by displayed priority and finding identifier before applying the existing limits. Existing scope/domain/date validation and shared provider facades stay authoritative. No SQL migration, JSON upgrade, evidence regeneration or calculation-contract checksum update is needed.

Selected checks: lint/types, focused renderer/workbook/API/scope tests, all-source regression checks where shared contracts change, client/server dependency audit, both guarded builds, offline archive verification and empty-cache installation proof, compiled No-SQL smoke, scoped SQL/JSON export parity using an explicitly disposable SQL database and isolated JSON store, real browser worker/download/cancellation/retry/keyboard/narrow-layout tests, PDF visual review and workbook-content checks. Documentation and generated route inventories are reviewed and checked. The exact checks and any infrastructure limitations must be reported from actual results; successful JSON runs alone do not establish SQL parity.

## Runtime contract

Data endpoints return version 1 envelopes containing a document kind, resolved filename, title, generation timestamp and report-specific data. They never return PDF/XLSX/XLS bytes. Existing GET report URLs opened as web pages redirect to the browser generation page; JSON clients request the envelope. The summary endpoint's existing non-PDF JSON response and Findings CSV/JSON GET behavior remain compatible.

The controller explicitly sends `Accept: application/json`. Report responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, with no attachment disposition. Direct HTML navigation receives a 303 redirect to `/documents/generate?source=...`; the landing page accepts only the audited same-origin read-only document paths. Existing external automation expecting binary responses must adopt this model/renderer contract. It is not silently supplied a server-generated fallback.

The compatibility redirect also copies network/system/domain/date selections into the workspace header. If the user subsequently changes that header, Generate document is disabled and a warning offers **Restore report selection**. Comparison uses the shared workspace-scope semantics plus the selected date, so equivalent selections remain usable while a changed visible scope cannot silently export the saved report's older scope. Restoring follows the saved source URL with its complete report-specific query intact.

The browser captures one immutable job, loads only local report assets, constructs the document in a worker and downloads its bytes. Cancelling aborts data loading and terminates generation; partial output is never downloaded. Progress reflects completed stages or actual renderer messages, with indeterminate animation where a precise total is unavailable. Errors retain a retry action and focus returns to the triggering control. No timed progress value claims work has completed.

One job can run at a time. `MAX_DOCUMENT_INPUT_BYTES` is 64 MiB for streamed JSON and existing client-model inputs; oversized input is rejected with a smaller-scope instruction rather than truncation. This is an input ceiling, not a guarantee that every device can render a job of that size. The job's validated filename and generation time are reused across rendering, while recorded snapshot timestamps retain their separate meaning. Blob URLs are released after download and workers terminate on success, failure or cancellation.

Download filenames replace unsafe path/control characters and shorten long configurable names to 220 UTF-16 code units without splitting a surrogate pair. The `.pdf`, `.xlsx` or `.xls` suffix is preserved, keeping the intended file type and download MIME type even for long names.

All required code, illustrations and template assets are repository-local. Runtime generation needs no server filesystem, external image/font request, installed Excel, browser service or new registry dependency. Data remains supplied by the current SQL/JSON services; this migration does not make storage browser-only or implement the proposed Tableau integration.

## Migration validation

The source suite passed 1,077 tests, alongside lint/types, client/server transitive dependency checks, storage/evidence checks and eleven tooling tests. A later 23-test focused boundary run passed sixteen newly added edge cases and seven repeated tests; the new cases are additional to the earlier full-suite count. Fresh empty-cache offline installation installed 571 packages from the 618 verified local archives, and both guarded provider builds passed after the capped-order correction. The shared eight-snapshot evidence bundle matched across SQL and JSON with zero differences in the explicitly disposable `TSAAT_EvidenceParity_ClientDocuments_20261109` validation database and isolated JSON store. The normal suite's skipped opt-in SQL cases are not treated as live parity evidence.

Before the intentional capped-report ordering correction, ten legacy and eleven tasking original/browser comparisons retained identical drawing/content streams and page dimensions. All 54 Insights pages plus fourteen representative legacy/tasking pages were visually inspected, including seven full-size pages; no visual defects were observed. An initial 31-document, 499-page text scan found no out-of-page characters. The final rebuilt JSON output passed a fresh 31-document / 502-page bound scan, and eighteen representative pages from the affected reports (including historical summary) were rerendered and visually reviewed without defects.

Compiled SQL and JSON browser audits each passed 31 PDF cases and ten Excel actions, including cancellation/failure/retry during data loading and worker execution, focus, narrow layouts and reduced motion. All 31 paired PDFs retained matching page counts and semantically identical evidence: 26 models matched exactly after generation-time normalization; five matched after documented collection-order/equivalent UTC formatting normalization, without dropping evidence or normalizing counters, nulls or ranked top-risk selections. Both guarded builds and all 31 PDF bookmark/header/download checks passed again for each provider after copying saved scope into the landing-page header.

The continuous No-SQL production smoke passed: 25 views, sixteen drill-through tabs, 47 PDF models, eight workbook models, actual browser downloads and settings/persona restart persistence, including all Insights link checks. After the final filename-suffix and changed-header protections, both guarded release builds and the SQL/JSON interaction phases passed again. Browser checks verified readable PDF output with a 220-character filename and correct extension/MIME, disabled generation after header changes, and keyboard restoration of the exact saved SPI and dynamic-system report selection, alongside cancellation/retry/focus/narrow/reduced-motion behavior. See [the dated validation record](validation.md#browser-pdf-and-excel-generation---2026-11-09) for the completed evidence and its scope.

## Repeat the browser audit

Build the selected provider first and use an installed Chrome/Edge browser (`TSAAT_TEST_BROWSER` can select its executable). The JSON run creates and removes its own temporary store. For SQL, first prepare an explicitly disposable `TSAAT_EvidenceParity_*` database containing the matching evidence; the runner uses that selected database with the existing connection settings and Windows authentication, never provisions or resets it. Do not select an operational database.

```powershell
node --import tsx scripts/test-client-documents.mjs json
$env:TSAAT_EVIDENCE_PARITY_DATABASE = 'TSAAT_EvidenceParity_YourRun'
node --import tsx scripts/test-client-documents.mjs sql
```

Replace `TSAAT_EvidenceParity_YourRun` with the prepared disposable target. Append `pdf`, `workbooks` or `interaction` to either command for a focused rerun; omitting the phase runs all three. Set `TSAAT_TEST_ARTIFACT_DIR` to choose an ignored evidence directory, otherwise results go under `.local/client-document-artifacts/<provider>`. Phase-specific validation JSON and downloaded files retain the selected scope/snapshot for comparison. Run `npm run test:nosql` separately for the full application smoke and settings/restart coverage.
