# Endpoint and vulnerability Insights reports

Both Governance briefings include **Generate PDF** in the masthead, beside the snapshot. The shared Insights download control shows generating status, disables repeated activation, retains keyboard focus, downloads the file and offers a retry after failure. Export remains available for a scoped empty selection; no scope leaves the page and export absent.

| Page | API | Filename |
| --- | --- | --- |
| End Point Insights | `/api/governance/end-point-insights/report` | `end-point-insights-YYYY-MM-DD.pdf` |
| Security Vulnerability Insights | `/api/governance/security-vulnerability-insights/report` | `security-vulnerability-insights-YYYY-MM-DD.pdf` |

## Content and layout

The A4 vector reports use the existing navy/cyan report header, readable cards/bars/tables, snapshot on every page, generation time in UTC and page numbering. Each has a scope/summary page followed by the same five chapters as its briefing. Charts show up to six groups; appendices retain complete distributions where needed, including every group hidden in the page's disclosures. Long labels wrap and table rows continue across pages; the appendix also preserves labels abbreviated in charts. Every required discovery tool has a report card and a full-name detail row.

End Point Insights includes CI/network composition, all nine field checks, UNKNOWN domains, all six discovery-age buckets, source distribution, scoped CI tool coverage, unidentified IP-node context, next steps and interpretation notes. Date gaps include missing/invalid dates, with future dates separate. Field presence does not establish correctness or applicability.

Security Vulnerability Insights includes the observation/CVE/endpoint/severity headline counts, severity and CVE distributions, all 15 field checks, affected software/OS/source/detection-date distributions, required CI tool coverage, endpoint discovery context, actions and notes. Counts retain their different units and overlapping gaps are not added. Detection dates are not last-scan dates, and tool coverage is not a vulnerability-scan completion rate. Empty evidence does not imply absence of vulnerabilities.

## Scope and data

Links carry only the applied header scope/domains and resolved snapshot, not local Explorer filters. APIs validate scope identifiers, security domains and a single real calendar date, then load the same overview and cached endpoint/vulnerability projections as the pages through `lib/data-loader.ts`. The resolved date pins all reads and the filename. Responses are `application/pdf` attachments with `no-store`; invalid input returns 400 and load/render failures return a sanitized, retryable 503.

Existing endpoint/table facet helpers and overview measures provide every figure. No new SQL/JSON query, data, schema, rule, persistent setting or calculation-contract checksum is introduced. Both provider compilations share the report path. Existing application access and persona behavior remain unchanged. Reports use the installed local `pdf-lib` dependency and require no browser service, network fonts or new packages.

## Validation

Focused tests cover page actions, filter preservation, malformed dates/scopes, resolved-date loading, empty reports, complete field/group coverage, repeated observations and long-label pagination. Existing Discovery Insights PDF tests protect the reused layout helper's default behavior. Compiled browser checks exercise actual downloads, progress, duplicate prevention, retry/focus, current/historical/domain/empty selection and narrow mastheads. Render PDFs and review charts/tables, headers/footers and continuation pages before acceptance. The comprehensive No-SQL smoke includes both exports.
