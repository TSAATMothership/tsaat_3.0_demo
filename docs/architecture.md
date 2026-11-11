# Architecture

The Next.js App Router serves a login-free scoped inventory workspace. Governance contains three Insights; Discovery contains five Explorers and a hidden software Dashboard compatibility view. Workspace state keeps network/system/domain/date selections independent from page-local facets. Retired routes render one shared retirement component with route-readiness and a scoped destination; retired APIs return uncached HTTP 410 before provider access.

The shared data facade delegates to SQL or JSON at compilation/runtime configuration. Both providers project the same inventory storage v2 contract. SQL evaluates discovery coverage from retained configurable rules; JSON applies the matching evaluator. Inventory-context helpers combine coverage with snapshot-pinned endpoint, vulnerability and Shadow IT rows, without former patch/risk/finding analytics.

Topology retains model ancestry/descendants and observed directed communications, including domain-permitted direct external peers. A standalone topology layout module replaces its former dependency on the retired Service Impact graph. CMDB uses the shared attribute facade and native modal/focus conventions.

PDF/Excel APIs return scoped JSON document envelopes. Browser workers render three Insights PDF kinds and four Explorer workbook kinds using local assets. No provider code enters browser renderer graphs. The compatibility document landing page accepts only retained report/export endpoints and rejects header selection mismatches. See [document contracts](client-document-generation.md).

Personas and Discovery Tools Settings display saved state read-only. The active persona remains a local navigation preference, not authentication. Dedicated SQL login provisioning, saved TLS modes, offline Node/npm bootstrapping and lifecycle-disabled installation remain as documented in [database lifecycle](database.md) and [offline builds](offline-builds.md).

The [retirement decision](adr/0029-retire-analytics-features.md) records removed dependencies and the paired forward/recovery strategy. [Generated inventories](generated/application-inventory.md) list compatibility routes separately from visible navigation.
