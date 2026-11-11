# ADR 0029: Retire analytics features with inventory storage v2

Status: Accepted, 2026-11-11. Supersedes the retired-feature portions of ADRs 0004, 0009, 0011 and 0024; extends ADR 0028 by retiring both SPI matrix tabs.

## Decision

Retire the explicitly approved Governance/Cyber Security/Discovery/Observed Measures/Findings features, ICT System Impact Analyser, Briefs & Reports and SPI settings. Keep the three inventory Insights, five Explorers, software Dashboard compatibility, CMDB and their PDF/Excel exports. Full scope is in [the retirement plan](../feature-retirement.md).

Extract inventory context, PDF layout and topology layout from retired analytics. Keep discovery coverage rules and inventory lifecycle/OS patch/network patch-state evidence because retained views consume them. Remove 41 historical feature-specific tables, 17 routines, three OS calculation columns per OS table and snapshot reference-version linkage. Remove paired JSON references/payloads and unused dependencies/assets/commands.

## Upgrade and recovery

Fresh SQL uses a reduced schema and only manifest-listed fresh additions 025/031/032; it never replays retired historical migrations. Published migrations remain unchanged. Migration 033 requires target-specific session acknowledgement, refuses unexpected dependent routines/foreign keys, and commits all drops/persona updates transactionally. JSON uses schema version 2 and an explicit preview/apply migration with a complete external backup, writer lock, staged validation, atomic directory publication and rollback. Builds cannot overwrite existing stores.

Only known retired persona permissions are removed; source IDs, names, ordering, selected scopes, timestamps and retained permissions remain. Compatibility pages/APIs remain explicit retirement responses.

## Consequences

No operational store is changed during implementation. Deployment requires stopping writers and applying the paired explicit upgrade to the selected store. Rollback restores the complete pre-upgrade backup and matching application. Validation must include real fresh and upgraded SQL/JSON parity plus compiled retained-feature/browser/report checks, not only mocks or skipped tests.
