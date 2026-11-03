# ADR 0012: Canonical security domains across workspace and providers

Status: Accepted, 2026-11-03.

The workspace requires a shared domain filter and a domain on every endpoint, system and network. Existing endpoints/systems use title-case labels; networks use a separate classification with no explicit domain.

Use required PROTECTED, SECRET or UNKNOWN values, a header multi-select defaulting to all three, and independent entity classifications. Do not infer endpoint domains from parent models. Preserve the seed generator's Restricted-network to SECRET mapping only when filling missing network domains. UNKNOWN replaces Unclassified for this field; classification remains separate.

A shared pure module defines normalization and selection semantics for both providers, import/export and explicit JSON migration. Omitted selection means all; NONE means empty. The existing scope/date and authentication contracts remain. SQL migration 030 changes only domain storage/constraints; the calculation guard was reviewed against unchanged SPI/KPI/discovery rules and domain regression tests. JSON migration publishes new files atomically with a complete backup, preserving settings/history. Read compatibility alone never rewrites a store.

Consequences: old URL labels remain supported, existing model classifications are preserved, and clients should use canonical values. SQL must apply 030 before running this release. This is a display/report filter, not an access-control boundary. See [upgrade and verification](../security-domains.md).
