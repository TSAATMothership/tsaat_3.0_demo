# ADR 0032: Capture displayed topology for impact reports

Status: Accepted. Date: 2026-11-12.

## Context

Users need to review all matching CIs together and share the resulting graph with executive and cyber analyst audiences. A separate report query could produce a different selection, snapshot or topology than the one reviewed on screen.

## Decision

Trace the complete selected match set in one traversal, deduplicating shared nodes and edges. Persist all-results mode as `topologyAll=1`; selecting a single result clears it. Preserve existing graph-mode, scope/domain and snapshot semantics.

Capture a detached, versioned `pdf-topology-impact` document job from the displayed graph, filter/header context and actual layout positions. Generate locally through the existing worker and progress/cancel/retry dialog. Retry uses the same evidence and timestamp. Include the full fitted topology, a model-only context view, executive decisions, analyst observations and complete identity/relationship/software registers.

Narrative follows recorded structural paths only. Associations do not prove outage impact or exploitability. Dynamic CI communication remains outside Dependencies; existing Business Impact ARP observations remain labelled evidence and do not create service dependency narratives.

## Consequences

The report matches displayed evidence for both providers without new queries, storage or migration. Large fitted graphs can be visually dense; numbered, paginated registers preserve every displayed record. Generation retains the existing browser size limit and actionable failure path. Local branding, vector graphics and existing dependencies preserve offline compilation.

Validation covers multi-root tracing, capture immutability, narratives, long-label pagination, SQL/JSON parity, both builds, real worker downloads, nested modal focus, cancellation/retry and rendered PDF inspection. See [report contract](../topology-impact-report.md).
