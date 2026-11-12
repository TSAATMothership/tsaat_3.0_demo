# Architecture

Topology Impact Reports capture the displayed scoped graph into a detached local document job and use the shared browser worker. Multi-root selection traces all lookup matches once; no additional provider query is used for export. See [report capture and narrative boundaries](topology-impact-report.md).

The Next.js App Router serves a login-free scoped inventory workspace. Governance contains three Insights; Discovery contains five Explorers and a hidden software Dashboard compatibility view. Workspace state keeps network/system/domain/date selections independent from page-local facets. Retired routes render one shared retirement component with route-readiness and a scoped destination; retired APIs return uncached HTTP 410 before provider access.

The shared data facade delegates to SQL or JSON at compilation/runtime configuration. Both providers project the same inventory storage v2 contract. SQL evaluates discovery coverage from retained configurable rules; JSON applies the matching evaluator. Inventory-context helpers combine coverage with snapshot-pinned endpoint, vulnerability and Shadow IT rows, without former patch/risk/finding analytics.

Topology uses recorded model ancestry and descendants. Dependencies additionally expands member endpoint CIs and displays environment evidence; both modes retain header scope, domains and snapshot. CI-to-CI records remain stored but are excluded from Topology. Business Impact alone retains labelled ARP observation context. A standalone topology layout module replaces its former dependency on the retired Service Impact graph. CMDB uses the shared attribute facade and native modal/focus conventions.

PDF/Excel APIs return scoped JSON document envelopes. Browser workers render three Insights PDF kinds and four Explorer workbook kinds using local assets. No provider code enters browser renderer graphs. The compatibility document landing page accepts only retained report/export endpoints and rejects header selection mismatches. See [document contracts](client-document-generation.md).

Menu and Settings viewers are retired; existing persona selection is in the header. The active persona remains a local navigation preference, not authentication. Shared discovery rules and persona revisions remain provider-backed runtime dependencies; the removed viewers have no exclusive storage. Dedicated SQL login provisioning, saved TLS modes, offline Node/npm bootstrapping and lifecycle-disabled installation remain as documented in [database lifecycle](database.md) and [offline builds](offline-builds.md).

The [retirement decision](adr/0029-retire-analytics-features.md) records removed dependencies and the paired forward/recovery strategy. [Generated inventories](generated/application-inventory.md) list compatibility routes separately from visible navigation.
