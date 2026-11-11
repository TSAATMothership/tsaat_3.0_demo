# ADR 0019: Shared weekly SQL and JSON evidence

Status: Accepted — 2026-11-07

## Context

SQL and JSON setup applied different enrichment steps to eight older seed snapshots. SQL lacked endpoint/software discovery metadata and Shadow IT nodes supplied by JSON setup. Both raw seeds omitted fields used by current pages. Provider-only tests did not expose the drift.

## Decision

Publish one reviewed `tsaat-aligned-evidence-v1` bundle in `data/snapshots`, with `data/current.json` identical to its latest snapshot. Both fresh setup paths consume it. The initial bundle has eight weekly observations, 2026-09-19 to 2026-11-07. The data gate requires at least four complete weeks (five weekly boundaries).

Explicit sample authoring completes applicable attributes and failed/unknown finding coverage before publication. IP nodes retain unknown device identity; unfinished patch workflows retain missing completion dates; unmodelled systems use an explicit unassigned network. Fictional vulnerabilities use `SAMPLE-CVE-*` identities and `.example.test` references. Reviewed public CVE facts remain unchanged. Only observation dates can be shifted; future detections are excluded from historical snapshots.

SQL setup and append share one marked snapshot insertion block. SQL persists raw finding severity/priority and applies configurable settings at read time, matching JSON. Full SQL reads retain software discovery metadata and network OS patch level; empty inventory scopes return an array.

Existing sample stores receive an explicit append-only update. SQL takes a verified native backup and imports missing dates in one transaction. JSON backs up the store and publishes a new manifest atomically. Existing dates, settings, references and credentials remain unchanged. SQL catalogues preserve matching snapshot IDs. Builds never perform these upgrades. No schema version or calculation checksum changes are needed.

## Consequences

Data, structures, relationships, null semantics, snapshots, reference data, import/export and calculation changes must evolve both paths in the same change. SDLC gates require paired upgrades where necessary, regressions, evidence audits, both builds, compiled No-SQL validation and actual disposable-SQL parity. See [sample maintenance](../sample-evidence.md), [SDLC](../sdlc.md) and [validation](../validation.md).
