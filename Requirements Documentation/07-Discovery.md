# Discovery workspace

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Current sidebar views are Overview, Discovery Tool Coverage, Discovery Compliance Explorer, End Point Explorer, Installed Software Explorer and Shadow IT Explorer. They share applied header scope and snapshot; Installed Software and Shadow IT are implemented explorers, not placeholder pages. Target State Analyser is not a navigation page; compatibility report/template APIs may remain.

Overview summarizes scoped discovery. Tool coverage combines configured tool applicability and stored detection evidence; missing, covered and unavailable values remain distinct. Tool-owned asset drill-through uses the same snapshot. Discovery Compliance Explorer exposes source values and compliance with standard searchable/faceted tables.

End Point Explorer uses canonical asset identity, IP, model, discovery timestamp/source and asset type. Installed Software Explorer groups the current software inventory and supports its scoped export. Shadow IT Explorer uses its dedicated SQL source/definitions and supports scoped export. Export handlers reapply relevant filters and return canonical data, not an independent unscoped extract.

CMDB opens from device names. Its searchable Field/Value table has plain labels rather than interactive headers. Per-type SQL mappings govern which approved attributes appear; the seven types initially share 18 fields. CI owner/change assignment/incident assignment display fields are retired; network/system operational owners remain separate.

Sources: app/discovery-coverage/page.tsx, lib/discovery-*.ts, endpoint-explorer.ts, installed-software-explorer.ts, shadow-it-explorer.ts, cmdb-attributes.ts and associated API routes. Tests cover overview, scope, coverage/tool assets, all three explorers/exports and CMDB routes/mappings. SQL source and mapping inventories are in the database documentation.
