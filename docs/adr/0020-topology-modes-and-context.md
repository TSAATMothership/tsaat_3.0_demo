# ADR 0020: Topology modes and communication context

Status: Superseded for Dependencies and external-peer behavior by [ADR 0031](0031-topology-model-dependencies.md), 2026-11-12. The original decision follows for history.

## Context

Topology Explorer needs Business Impact and Dependencies views. The user explicitly requested direct communication peers outside the selected network or ICT system while retaining Security Domain restrictions. Existing full SQL and JSON snapshots already carry directed Flow Dependency observations, model membership and service/capability associations.

## Decision

Keep lookup and Business Impact scoped to the header. Business Impact descends from the selected model CI and adds ancestors of those descendants; it never descends from an ancestor into unrelated sibling branches. Endpoint roots show recorded model ancestry.

Dependencies uses direct incoming/outgoing Flow Dependency observations. Model roots use their header-scoped member endpoints. Build a separate context pool containing direct peers of scoped endpoints and their model ancestors, with independent domain filtering for endpoints, systems and networks. Only the selected root/member set seeds a communication trace; peers and context models never seed another communication hop.

Mark context CIs outside lookup scope. Inspection preserves the header. Explicit exploration opens the selected context CI's network or allowed associated systems, pins the resolved snapshot and retains domains/mode. CMDB receives an optional peer-network hint for that explicit navigation; all existing callers retain their original scope behavior.

Group observations by directed pair for graph readability while retaining every distinct observation in the evidence table. Separate reverse-direction curves, ports, provenance and UTC times remain visible. Do not treat logical declarations or ARP entries as observed communication. Exclude future records, dangling endpoints and self-links; retain unknown optional fields explicitly.

## Consequences

Both providers feed the same projection through the existing full-snapshot facade. No stored field, query, schema, reference rule, seed, JSON upgrade or calculation-contract checksum changes. Validate historical/domain parity using disposable SQL and isolated JSON, plus both builds, storage/evidence and compiled browser checks. No new dependency or offline asset is needed. Large graphs keep all evidence, with existing force-layout limits and paginated tables.
