# ADR 0003 — Typed CMDB values with configurable display

Status: accepted baseline, 2026-11-02.

Context: asset types need different visible attributes while their values already have typed, snapshot-aware storage.

Decision: retain canonical asset/posture tables. Configure approved labels, inclusion, order and enabled state through cmdb_attribute_definition and cmdb_asset_type_attribute. Read mappings per request; deliberately empty mappings stay empty.

Consequences: new values need a typed resolver and appropriate schema/source mapping. Display-only changes do not rewrite asset history. All seven types initially share 18 attributes.

Alternative: a generic entity-attribute-value store would weaken current types and historical joins. See [CMDB attribute contract](../cmdb-asset-type-attributes.md).
