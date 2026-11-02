# Asset taxonomy and applicability

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

The seven canonical IDs are server, workstation, network-device, storage-device, printer-device, other and ip-node. Labels/order are defined in lib/asset-taxonomy.ts. All type-aware tables, matrix keys, filters and source mappings use that contract.

SPI applicability is SQL metadata (spi_applicable_asset_type), not an assumed universal list. SQL procedures evaluate active definitions/calculations for applicable asset types and the selected snapshot. Source reference JSON defines seed defaults; deployed configuration may differ. Do not infer compliance from missing or inapplicable observations. Discovery tools similarly carry required/na scope per canonical type; missing source values and non-applicability are distinct.

CMDB attribute display is independently configured per type. Initially all seven types have the same 18 approved attributes; this does not imply their posture fields or SPI rules are identical. Values stay in typed snapshot tables, while inclusion/order/labels come from the mapping tables. Adding a type requires coordinated SQL constraints, reference mappings, type guards, UI, calculations and tests.

Sources: lib/asset-taxonomy.ts, types.ts, spi-definitions.ts, discovery-tools-settings.ts, cmdb-attributes.ts; schema and migrations 004, 016 and 025 as applicable. Tests: asset-taxonomy-settings, spi-definitions, spi-rules, server-compliance and CMDB attribute suites. Review generated schema and current reference data instead of maintaining another static applicability matrix.
