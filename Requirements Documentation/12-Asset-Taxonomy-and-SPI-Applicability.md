# Asset taxonomy and applicability

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

The seven canonical IDs are server, workstation, network-device, storage-device, printer-device, other and ip-node. Labels/order are defined in lib/asset-taxonomy.ts. All type-aware tables, matrix keys, filters and source mappings use that contract.

SPI applicability is provider metadata, not an assumed universal list. SQL uses spi_applicable_asset_type and evaluation procedures; No-SQL uses persisted JSON definitions and its server evaluator for the same asset types and selected snapshot. Source reference JSON defines seed defaults for both; deployed configuration may differ. Do not infer compliance from missing or inapplicable observations. Discovery tools similarly carry required/na scope per canonical type; missing source values and non-applicability are distinct.

CMDB attribute display is independently configured per type. Initially all seven types have the same 18 approved attributes; this does not imply their posture fields or SPI rules are identical. SQL stores values in typed snapshot tables and inclusion/order/labels in mapping tables. No-SQL stores snapshot values and per-type reference mappings as JSON. Both use the same approved canonical attribute keys and view builder. Adding a type requires coordinated SQL constraints, JSON format/mappings, type guards, UI, calculations and tests for both providers.

Demonstration enrichment fills applicable inventory/profile fields while preserving existing nonblank values, classification, lifecycle/support states and relationships. Sample IP Nodes retain unknown identity and lifecycle information; intentionally unmodelled ICT systems keep their unresolved memberships. New sample stores are complete at initialization; existing stores require the explicit backed-up population workflow.

Sources: lib/asset-taxonomy.ts, types.ts, spi-definitions.ts, discovery-tools-settings.ts, cmdb-attributes.ts; schema and migrations 004, 016 and 025 as applicable. Tests: asset-taxonomy-settings, spi-definitions, spi-rules, server-compliance and CMDB attribute suites. Review generated schema and current reference data instead of maintaining another static applicability matrix.
