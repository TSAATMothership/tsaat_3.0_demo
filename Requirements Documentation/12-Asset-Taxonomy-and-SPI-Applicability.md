# Shared Asset Taxonomy and SPI Applicability

**Scope:** Cross-cutting requirements contract used by runtime logic, settings models, schema constraints, and UI filtering.

## 1. Overview
- **Specification name:** Shared Asset Taxonomy and SPI Applicability
- **Purpose:** define the canonical asset types, how SPI applicability is enforced per type, and where those rules are persisted and consumed.
- **Outcome:** all application layers use the same six asset-type IDs and the same applicability behavior.

## 2. Summary
This specification captures shared behavior used by discovery settings, measures settings, SPI evaluation, filters, topology summaries, and SQL schema constraints.

Primary implementation anchors:

- `lib/asset-taxonomy.ts`
- `lib/types.ts`
- `lib/spi-rules.ts`
- `lib/spi-definitions.ts`
- `lib/discovery-tools-settings.ts`
- `lib/measures-settings.ts`
- `components/filter-bar.tsx`
- `Database Schema/database-schema.sql`
- `Database Schema/migrations/004_expand_asset_type_taxonomy.sql`

Key cross-cutting rules:

- canonical asset types are exactly:
  - `server`
  - `workstation`
  - `network-device`
  - `storage-device`
  - `printer-device`
  - `other`
- `storage-device`, `printer-device`, and `other` evaluate SPI 10 only in the current database seed.
- discovery tool scope includes all six asset types for every tool and defaults to `required`.
- measures severity matrix includes all active database SPI IDs x all six asset types.

## 3. Contract Breakdown
### Feature: Canonical Asset Type Contract
- **What it does:** defines shared IDs, labels, and ordering for all asset-type-aware views and APIs.
- **System behaviour:** all filter options and type labels are rendered from `lib/asset-taxonomy.ts` rather than hard-coded 3-type lists.
- **Outcome:** one source of truth for taxonomy across backend and UI.

### Feature: SPI Applicability by Asset Type
- **What it does:** routes each asset type to applicable SPI evaluations.
- **System behaviour:** SPI evaluation flow reads active database SPI definitions, checks database-backed applicability, resolves the DB-backed rule catalogue row, and dispatches by supported handler key. The current seed enforces:
  - `server`: SPI 1, 2, 3, 4, 5, 10
  - `workstation`: SPI 1, 2, 6, 10
  - `network-device`: SPI 7, 8, 9, 10
  - `storage-device`, `printer-device`, `other`: SPI 10 only
- **Outcome:** new asset types participate in lifecycle controls without introducing unintended SPI checks.

### Feature: Discovery Tool Scope Contract
- **What it does:** stores per-tool applicability for every canonical asset type.
- **System behaviour:** each tool row carries all six asset-type scope keys with values `required` or `na`; normalization fills missing keys as `required`.
- **Outcome:** discovery compliance can be evaluated consistently for all asset types.

### Feature: Measures Severity Matrix Contract
- **What it does:** maps severity by SPI and asset type.
- **System behaviour:** matrix keys are `spiId:assetType` for all active database SPI IDs and all six asset types.
- **Outcome:** severity remap remains deterministic even when a type is not applicable for a given SPI.

### Feature: SQL Schema and Migration Contract
- **What it does:** ensures database constraints accept all canonical asset types.
- **System behaviour:** CHECK constraints and related lookup/scope tables include the six-type domain, with migration support for upgraded databases.
- **Outcome:** fresh builds and upgraded environments share the same `asset_type` domain.

## 4. Feature Detail Table
| Area | Feature | Description | Inputs | Outputs | Business Rules | Dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| Shared taxonomy | Canonical IDs and labels | Defines six canonical asset types and display labels | `lib/asset-taxonomy.ts` | Filter options, labels, ordering | IDs are lowercase hyphenated and fixed | `lib/types.ts`, UI filter/summaries |
| SPI runtime | Applicability routing | Chooses SPI set by asset type | active SPI definitions + rule catalogue + asset type + asset evidence | Per-asset SPI evaluations with DB-backed outcome text | current seed keeps `storage-device`, `printer-device`, `other` on SPI 10 only | `lib/spi-definitions.ts`, `lib/spi-rules.ts` |
| Discovery settings | Asset-type scope | Stores tool scope per asset type | discovery tools settings payload | normalized scope record per tool | default scope is `required` for all six keys | `lib/discovery-tools-settings.ts` |
| Measures settings | Severity matrix keys | Stores severity by SPI and asset type | active SPI definitions + severity definitions + measures settings payload | normalized matrix | matrix includes all six asset types for each active SPI | `lib/measures-settings.ts` |
| SQL schema | `asset_type` domain | Expands allowed asset types in constraints and related tables | schema SQL + migration SQL | validated inserts/updates | fresh schema and upgraded schema must match | `database-schema.sql`, migration `004_...sql` |
| UI analytics | Dynamic rendering by type | Uses canonical list for filters and summaries | runtime data + taxonomy | six-type filters/charts/tables | no hard-coded 3-column assumptions | filter, findings, discovery, topology components |

## 5. Data Mapping
Primary persistence surfaces for this contract:

- `tsaat.asset.asset_type`
- `tsaat.spi_definition`
- `tsaat.spi_rule_definition`
- `tsaat.spi_rule_parameter_definition`
- `tsaat.spi_rule_outcome_template`
- `tsaat.spi_report_detail_definition`
- `tsaat.spi_finding_classification_rule`
- `tsaat.spi_applicable_asset_type.asset_type`
- `tsaat.spi_rule_parameter`
- `tsaat.discovery_tool_asset_scope.asset_type`
- `tsaat.finding_severity_definition`
- `tsaat.measures_severity_matrix.asset_type`
- settings JSON payload keys:
  - discovery `assetTypeScope`
  - measures `severityMatrix`

## 6. Mapping Table
| Contract Element | Store | Keys / Columns | Rule |
| --- | --- | --- | --- |
| Asset identity type | `tsaat.asset` | `asset_type` | must be one of six canonical IDs |
| SPI applicability metadata | `tsaat.spi_definition`, `tsaat.spi_rule_definition`, `tsaat.spi_applicable_asset_type` | `spi_id`, `enabled`, `rule_key`, `handler_key`, `asset_type` | active rows drive runtime routing; current seed lists new types for SPI 10 only |
| SPI rule catalogues | `tsaat.spi_rule_definition`, `tsaat.spi_rule_parameter_definition`, `tsaat.spi_rule_outcome_template`, `tsaat.spi_report_detail_definition`, `tsaat.spi_finding_classification_rule` | handler keys, parameter defaults, outcome templates, report detail handlers, classification condition keys | database controls supported metadata and templates; app code executes only known handler/condition keys |
| Discovery tool scope | `tsaat.discovery_tool_asset_scope` | `tool_id`, `asset_type`, `scope_setting` | each tool has all six asset-type keys |
| Measures severity mapping | `tsaat.finding_severity_definition`, `tsaat.measures_severity_matrix` | `severity_key`, `selectable_in_settings`, `spi_id`, `asset_type`, `severity` | matrix persists six asset types for each active SPI |
| Runtime typing | TypeScript domain | `AssetType` union | shared across analytics, filters, and API normalization |

## 7. Derived Logic
| Calculation / Logic | Formula / Behavior | Layer |
| --- | --- | --- |
| Type label rendering | canonical ID -> display label (`assetTypeLabel`) | runtime UI |
| SPI evaluation routing | iterate active DB SPI definitions, check applicability by `asset.type`, resolve rule catalogue metadata, then dispatch by supported handler key | runtime backend |
| Measures key normalization | `severityMatrixKey(spiId, assetType)` for active SPI IDs and all six types | runtime backend + settings API |
| Discovery scope normalization | missing `assetTypeScope` keys backfilled as `required` | runtime backend + settings API |
| Dynamic type summaries | iterate canonical list instead of fixed 3-type arrays | runtime UI |

## 8. Non-Database Logic
- Synthetic/demo data generation includes all six asset types.
- New asset types are currently unmodelled in seeded/demo snapshots.
- Topology and findings summaries render using canonical type ordering rather than fixed columns.

## 9. Rules and Constraints
- Canonical IDs are lowercase hyphenated values and are treated as the stable contract.
- SPI applicability for `storage-device`, `printer-device`, and `other` is currently limited to SPI 10 by the seeded database metadata.
- Discovery defaults remain `required` for every tool and asset type unless explicitly changed to `na`.
- Measures severity matrix stores all combinations for active SPI rows even when some SPI/type pairs are non-applicable.

## 10. Open Questions
- **Open question:** when business rules for new asset types are defined, should SPI applicability expand beyond SPI 10 or remain lifecycle-only?
- **Open question:** should seeded/demo distributions for the three new types become configurable by environment profile?
- **Open question:** should UI labels explicitly identify SPI-non-applicable type combinations inside measures settings?
