# ADR 0031: Dependencies shows recorded model relationships

Status: Accepted, 2026-11-12. Supersedes the communication and external-peer behavior in [ADR 0020](0020-topology-modes-and-context.md).

## Context

The user wants Dependencies to connect networks, ICT systems, business services, mission services and member endpoint CIs. CI-to-CI communication belongs in a separate future feature. The stored `Logical Dependency` enum also denotes an endpoint pair, so selecting that enum would not satisfy this requirement.

## Decision

Use the existing full snapshot through `lib/data-loader.ts` and the shared topology projector. Network hosting, network/endpoint membership, system environment membership, endpoint system context, business-service/ICT-system and mission-service/ICT-system associations, and explicit model hierarchies supply the graph. Retain every recorded in-scope system membership, with deduplicated environment types in relationship evidence. Do not infer a mission-to-service association from a shared system.

For Dependencies, descend from the selected model through recorded links to its member endpoints, then add ancestors of those descendants. For an endpoint, add its recorded model ancestors only. Ancestors never seed expansion into siblings. All nodes retain header network/system scope and independent security-domain restrictions from the selected snapshot. Missing relationships remain unknown. Cycles terminate and duplicate links collapse.

Business Impact retains its higher-level model view and labelled ARP observation context. Dependencies excludes ARP links and does not read `ciDependencies`, regardless of dependency type. Remove communication rendering and external-peer expansion from this feature. Keep stored CI dependency records, schema, imports/exports and both provider readers intact for future use.

Replace communication evidence with a filterable, paginated source/relationship/target/environment table. Preserve mode bookmarks, lookup filters, full screen, keyboard controls and CMDB navigation. Environment is Not applicable on model links without environment semantics; missing system-membership environment evidence is Not recorded.

## Consequences

No SQL schema, JSON format, stored evidence, seed, calculation rule, checksum or dependency changes are required. Existing SQL and JSON stores need no migration or recovery operation for this change; deploy/revert the application code normally. Builds retain existing stores. A future direct mission-to-service relationship would need a separate paired SQL/JSON data change.

Validate tracing/scope/environment regressions, shared CMDB/navigation and both provider outputs across selected historical dates and identical scopes on disposable SQL/JSON stores. Run storage/evidence checks, both guarded builds and compiled browser checks including keyboard, full screen and narrow layouts. Installation tooling remains unchanged; its focused regression checks are sufficient for this scoped change rather than a fresh installation/release certification.
