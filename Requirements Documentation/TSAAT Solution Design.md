# TSAAT solution design

Use the [maintained solution design index](TSAAT-Solution-Design-Index.md) for the current product contract. The 2026-11-11 inventory-only scope supersedes the previous consolidated analytics design; see [the retirement decision](../docs/adr/0029-retire-analytics-features.md).

Retain three Governance Insights, five Discovery Explorers, the Installed Software Dashboard compatibility view, scoped CMDB and browser PDF/Excel exports. Menu and Settings viewers are retired; existing persona selection is in the header. Shared persona definitions and discovery applicability rules remain runtime dependencies. Both SQL and JSON providers use the same eight weekly snapshots and header scope/date contract.
