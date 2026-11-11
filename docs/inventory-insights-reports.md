# Endpoint and vulnerability Insights reports

Current scope: the shared inventory context supplies discovery coverage and snapshot-pinned inventory. Discovery Insights itself is retired; links into retired compliance/tool views are removed. See [retirement scope and upgrades](feature-retirement.md).

Both Governance briefings include **Generate PDF** in the masthead, beside the snapshot. The shared browser document control shows a **Generating Document** progress animation, disables repeated activation, supports cancellation, restores keyboard focus, downloads the file and offers a retry after failure. Export remains available for a scoped empty selection; no scope leaves the page and export absent.

| Page | API | Filename |
| --- | --- | --- |
| End Point Insights | `/api/governance/end-point-insights/report` | `end-point-insights-YYYY-MM-DD.pdf` |
| Security Vulnerability Insights | `/api/governance/security-vulnerability-insights/report` | `security-vulnerability-insights-YYYY-MM-DD.pdf` |

## Content and layout

The A4 reports follow their respective Insights pages: the actual TSAAT logo, endpoint or vulnerability hero illustration, matching vector icons, navy/mint masthead, teal charts, amber/rose review accents and light evidence cards. The opening page divides its body equally between an executive summary and recommendations, using the selected evidence and explicit empty-state wording. The full scope follows on the next page, then the same five chapters as the briefing. Every chapter, chart group and table section includes narrative paragraphs explaining the evidence, interpretation and appropriate follow-up.

Charts remain vector graphics and include the required-tool coverage ring. Charts show up to six groups; appendices retain complete distributions where needed, including every group hidden in the page's disclosures. Long labels wrap and table rows continue across pages; the appendix also preserves labels abbreviated in charts. Every required discovery tool has a report card and a full-name detail row. The snapshot appears on every page, with generation time in UTC and page numbering retained.

End Point Insights includes CI/network composition, all nine field checks, UNKNOWN domains, all six discovery-age buckets, source distribution, scoped CI tool coverage, unidentified IP-node context, next steps and interpretation notes. Date gaps include missing/invalid dates, with future dates separate. Field presence does not establish correctness or applicability.

Security Vulnerability Insights includes the observation/CVE/endpoint/severity headline counts, severity and CVE distributions, all 15 field checks, affected software/OS/source/detection-date distributions, required CI tool coverage, endpoint discovery context, actions and notes. Counts retain their different units and overlapping gaps are not added. Detection dates are not last-scan dates, and tool coverage is not a vulnerability-scan completion rate. Empty evidence does not imply absence of vulnerabilities.

## Scope and data

Links carry only the applied header scope/domains and resolved snapshot, not local Explorer filters. APIs validate scope identifiers, security domains and a single real calendar date, then load the same overview and cached endpoint/vulnerability projections as the pages through `lib/data-loader.ts`. The resolved date pins all reads and the filename. Responses are versioned JSON document jobs with `no-store`, including the full scoped rows needed for all facets and appendices. Invalid input returns 400 and load failures return a sanitized, retryable 503. Existing HTML report bookmarks redirect to browser generation. Only the browser worker produces the PDF bytes and local download; data or rendering failure cannot deliver a file labelled complete.

Existing endpoint/table facet helpers and overview measures provide every figure. No new SQL/JSON query, data, schema, rule, persistent setting or calculation-contract checksum is introduced. Both provider compilations supply the same report-data contract to the shared browser renderer. Existing application access and persona behavior remain unchanged. Reports use the installed local `pdf-lib` dependency and require no headless-browser service, remote fonts or new packages. Shared branding lives in `lib/insights-pdf-theme.ts`; the bundled PNG hero derivatives and source hashes are in `public/insights-report-art`. The browser reads only the logo and selected illustration from app-hosted static assets. They preserve the original page SVG artwork and are generated only during manual artwork maintenance, never during a PDF request.

## Validation

Focused tests cover page actions, filter preservation, malformed dates/scopes, resolved-date loading, empty reports, complete field/group coverage, repeated observations, first-page narratives and long-label pagination. Shared theme checks protect local artwork provenance and equal opening-panel layout. Shared inventory-report layout tests protect pagination and complete appendix behavior. Browser checks exercise actual downloads, progress, duplicate prevention, retry/focus, current/historical/domain/empty selection and narrow mastheads. Render PDFs and review charts/tables, headers/footers and continuation pages before acceptance. The comprehensive No-SQL smoke includes both exports.

For inventory retirement, provider/shared helper changes require both guarded builds, real SQL/JSON parity, storage/evidence checks and compiled browser/PDF checks. See [selected checks and evidence](feature-retirement.md). Earlier presentation-only changes did not require a schema migration.
