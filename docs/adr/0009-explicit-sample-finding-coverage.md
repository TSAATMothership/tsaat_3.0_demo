# ADR 0009: Explicit sample finding coverage

Status: Accepted, 2026-11-02.

## Context

The imported sample database retained simulated closed finding history even where the selected snapshot still had failed or unknown SPI results. The user requested findings for every known endpoint that is not fully compliant, while explicitly retaining unidentified Shadow IT nodes. Reopening or rewriting imported findings would lose source evidence.

## Decision

Add an explicit maintenance command that evaluates every known endpoint against its existing configured applicable SPI definitions and appends only missing effective open observations. Use the same pure evaluator as the JSON runtime and SQL-compatible classification and settings precedence. Unknown evidence requires a finding; a missing applicability definition fails. All-compliant endpoints receive no new observation. Keep every original record unchanged, label added sample evidence, and timestamp it at the selected snapshot date rather than inventing earlier event history.

Reuse the writer lock, full backup, staged immutable snapshots and atomic manifest publication from ADR 0008. Read settings within that lock. Deterministic IDs and effective-open checks make repeated runs idempotent. Preserve MAC/model values on known endpoints, populate only missing sample details, and retain unidentified IP nodes and their configured applicability. The build and page request paths do not run this repair.

## Consequences

This extends ADR 0008's explicit sample-maintenance boundary: SQL import itself still preserves source history, while the separately requested coverage operation may append labelled sample observations. It requires no schema, rule or applicability change, no SQL migration and no calculation-checksum refresh. Existing JSON stores need the explicit apply command; restore the complete backup to roll back. Regression tests cover unknown results, full compliance, historical dates, settings precedence, source preservation and repeatability. The production smoke verifies the enriched data through the ordinary pages and exports.

See [data providers](../data-providers.md) for commands, scope and recovery.
