# ADR 0034: Focused reads and toolchain version floors

Date: 2026-11-13

Status: Accepted

## Context

The management design review found that software report labels, CMDB details and Topology triggered full or summary inventory reads and unrelated discovery evaluation. Host tooling checks also restricted installation to Node 24 even when a newer stable runtime could satisfy the dependencies.

## Decision

Add explicit metadata, CMDB and scoped Topology operations to the shared provider facade. Keep complete-dataset operations intact for their existing consumers. Detail projections retain the model relationships required by the existing projectors, scope/date resolution and ARP-owner context, but do not evaluate discovery coverage or read unused CI communication rows. JSON still parses its snapshot file on a cold read; it shares a bounded raw-snapshot cache and evaluates discovery only for consumers that request it.

Bound each server memory cache by entry count and estimated serialized payload bytes (32 MiB by default). Oversized results are returned without caching; a pending read cannot repopulate an invalidated prefix. These are payload budgets, not an exact JavaScript heap limit or a global process budget.

Retain the existing SQL transport while adding a per-process limit of four active requests, 64 queued requests, a 15-second queue/login limit, a 60-second query limit and a 65-second child-process deadline. Internal callers can cancel a SQL text/JSON request with an AbortSignal. Existing authentication, DPAPI and TLS policy selection are unchanged; no new failure-driven downgrade is introduced. Timing and payload/row diagnostics are opt-in through TSAAT_PERF_DEBUG; cache diagnostics use TSAAT_CACHE_DEBUG.

Accept stable Node 24.13.1 or newer and npm 11.8.0 or newer instead of an exact Node major. The reviewed portable runtime is still integrity-pinned and used by the offline package. Newer installed tooling can be used directly; a source checkout without the bundle can use the newer host through the launcher. Passing the version floor does not certify every future runtime. Release validation must record the runtime actually tested.

Use compatible caret ranges for direct libraries, with the exact tested graph retained in package-lock.json and vendor/npm. Installation continues to use npm ci --offline with disabled lifecycle scripts. A newer dependency requires an explicit lockfile/archive update and validation; unrestricted automatic major upgrades would contradict the disconnected and reproducible installation contract. See the npm documentation for [locked clean installation](https://docs.npmjs.com/cli/v11/commands/npm-ci/) and [dependency version ranges](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/).

## Consequences

No stored fields, schema, evidence, configurable rules or migration formats change. Existing SQL and JSON stores remain usable without an upgrade. Local parity and read-cost evidence is recorded in [scalability improvements](../scalability-improvements.md). CVE normalization, membership/service schema changes, native SQL pagination, index consolidation and a pooled driver remain separate design/measurement gates; this decision does not claim they are implemented or production-benchmarked.
