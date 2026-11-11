# ADR 0008: Explicit No-SQL data population

Status: Accepted, 2026-11-02.

## Context

The initial JSON sample snapshots lacked the SQL demonstration database's later endpoint/software enrichment, entity profiles and Shadow IT observations. The requested population must start from SQL records, preserve history and settings, and remain independently installable/buildable offline.

## Decision

Convert an explicitly selected read-only SQL export into the existing shared Dataset format. Preserve source entity IDs, dates, inventory details, relationships, vulnerabilities and persisted findings. Enrich only missing demonstration values when explicitly requested. Mark example contacts/URLs and retain unknown/inapplicable states and intentionally unmodelled memberships.

Fresh sample initialization applies the deterministic enrichment to repository sample data. Existing stores require the separate population command. It uses the writer lock, validates the complete input, backs up the whole store, flushes a new snapshot revision and atomically publishes a manifest referencing it. Old snapshot files remain intact. Local settings/history and reference/CMDB mappings are preserved. Record source export provenance and its SHA-256. Never fetch SQL data or overwrite existing JSON stores during builds.

## Alternatives

Copying only the old seed files would retain known data gaps. Automatically replacing stores at startup/build would lose edits. Fabricating findings from current evaluations would misrepresent historical workflow. Direct operational schema/seed changes are unnecessary and were rejected.

## Consequences

The version-1 store and both provider interfaces remain compatible; no SQL migration or calculation checksum refresh is needed. Runtime exports/backups remain ignored by Git. Existing-store upgrades need an explicit apply, backup and recovery plan. A matching SQL export is a maintenance input, never an offline build dependency. SQL-to-JSON conversion rejects unsupported typed inventory instead of silently dropping records. Reference/settings differences remain an explicit operator concern rather than being overwritten by data population.

See [data providers](../data-providers.md), [database lifecycle](../database.md), [architecture](../architecture.md) and [offline builds](../offline-builds.md).
