# Client document generation

PDF and Excel generation happens in a browser worker using local bundled assets. APIs return versioned JSON envelopes with uncached scoped data; direct browser GET report links use the existing generation page. The dialog shows progress, supports cancel/retry, traps focus appropriately and returns focus to the triggering control. Headers retain scope/domain/snapshot and page-local filters select Explorer export rows.

| Endpoint | Retained renderer |
| --- | --- |
| /api/discovery/installed-software-insights/report | insights-software PDF |
| /api/governance/end-point-insights/report | insights-endpoint PDF |
| /api/governance/security-vulnerability-insights/report | insights-vulnerability PDF |
| POST /api/discovery-coverage/endpoints/export | xlsx-endpoints |
| POST /api/discovery-coverage/installed-software/export | xlsx-software |
| POST /api/discovery-coverage/security-vulnerabilities/export | xlsx-vulnerabilities |
| POST /api/discovery-coverage/shadow-it/export | xlsx-shadow-it |
| Topology Explorer / Generate Impact Report (local captured graph; no API) | pdf-topology-impact |

Briefs & Reports, findings/tasking/performance/remediation PDFs, Cyber Terrain/Discovery overview PDFs, patch/compliance/target-state workbooks and risk/dependency panel Excel actions are retired. Their APIs return HTTP 410 and are excluded from the document-source allowlist. Their renderers, artwork and workbook template have been removed.

Retained document data comes through the provider facade. Browser renderers never import SQL/JSON adapters. Runtime boundaries, source selection, document transport, PDF contents, XLSX integrity and actual compiled browser downloads are tested. See [Inventory Insights reports](inventory-insights-reports.md) and [feature retirement](feature-retirement.md).

The [Topology Impact Report](topology-impact-report.md) captures the displayed graph, complete starting set, context, filters and positions. Its local job preserves evidence on retry and works from inline/full-screen graphs. Executive and analyst sections share complete numbered registers; no new server export source is introduced.
