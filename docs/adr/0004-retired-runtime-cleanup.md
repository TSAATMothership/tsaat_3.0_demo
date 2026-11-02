# 0004 - Remove proven unused runtime code and SQL structures

Status: Accepted, 2026-11-02.

The UI 3 import preserved older presentation modules alongside their replacements. Retired KPI calculations also continued to execute SQL SPI/discovery work even though the catalogue exposes only ATO and DIIS coverage.

Remove modules unreachable from all App Router files, middleware and maintenance scripts. Treat aliases, dynamic imports and worker URLs as dependencies; tests alone do not justify retaining an obsolete implementation. Keep compatibility routes and exports as roots. Remove compiler-confirmed unused private declarations. Add reachability and unused-declaration checks to the existing development gates.

Migration 027 removes the retired KPI parameter table, stable-hash function, eight unbound calculation definitions, three unbound report definitions and managed_network.apm_number. The two KPI procedures retain their public parameters, JSON/tabular results, deduplicated system scope, empty-scope semantics and high-priority finding counts. They no longer evaluate retired SPI/discovery-based KPI metrics. Existing KPI metadata, tasking and report bindings are preserved. Custom calculations or report bindings cause the migration to stop for review.

Keep ict_system.apm_number for APP-ID, hierarchy tables for topology, GRC/DIIS URLs for reports, target-state tables for discovery/export, snapshot history, settings/version tables, constraints and audit attributes. An empty table or a field hidden from a particular panel is not sufficient evidence for deletion.

Published migrations 001-026 remain immutable. Fresh installation applies the historical chain followed by 027; existing installations apply only missing migrations. Recovery requires a verified pre-upgrade database backup and a compatible application artifact. Older app versions that still select network apm_number cannot share the cleaned database.

Validation includes source/build gates, a fresh demo installation, integration checks on explicit disposable databases, before/after KPI result comparison across snapshots and scopes, and retained-table content hashes. The inventory is conservative: externally consumed routes and SQL configuration are retained when usage cannot be disproved.

See [cleanup audit](../cleanup-audit.md), [database lifecycle](../database.md) and [development](../development.md).
