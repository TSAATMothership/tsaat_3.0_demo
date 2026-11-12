# Topology Impact Report

In Topology Explorer, **Show all results in Impact Topology** includes every current lookup match across pagination. Shared CIs and relationships appear once. Filters update the starting set while this option is active; selecting an individual result restores single-CI behavior. The `topologyAll=1` bookmark retains this behavior alongside scope, snapshot, filters and graph mode.

**Generate Impact Report** exports the complete presented graph as PDF, including evidence outside the camera viewport and first results page. The capture preserves starting/contextual CIs, directed relationships, environment labels, resolved snapshot, header selections, lookup filters, layout and actual node positions, including compact layouts and moved nodes. Inspection highlights and zoom/pan do not remove evidence. Empty graphs cannot be exported.

## Reading the report

The print theme uses TSAAT branding, navy headings, teal accents, category colors shared with the interactive graph, measured text and repeating table headers. Vector graphics, legends and CI references provide meaning beyond color. Long names and evidence lists wrap and paginate; no rows are silently truncated.

1. **Executive impact brief:** distinct totals, category composition, service context, shared ICT systems, vulnerability evidence and follow-up decisions.
2. **Scope and reading guide:** captured selection, filters, domains, snapshot, mode and interpretation limits.
3. **Displayed topology:** the captured layout fitted to the page, with starting-CI rings.
4. **Model and service context:** a second view of the same graph retaining networks, ICT systems, business services and mission services. Small graphs show model names; complete identities always remain in the CI register.
5. **Service impact narrative:** recorded system/endpoint paths for each displayed service and shared-system associations.
6. **Cyber analyst review:** recorded CVEs, unlinked CIs, missing domain/IP evidence and an investigation sequence.
7. **Complete CI register:** source ID, category, name, domain and starting-CI marker.
8. **Complete relationship register:** source/target CI references, recorded direction and applicable environment evidence.
9. **Endpoint evidence register:** hostname/IP and installed-software observations.

Dependencies includes recorded model relationships and member CIs, excluding dynamic CI communication and ARP observations. Business Impact retains its higher-level behavior and explicitly labelled ARP observations. Service narratives traverse only displayed structural links; ARP observations do not create service dependency paths. Business and mission services associate independently with ICT systems.

Counts describe recorded associations, not confirmed outages, exploitation, severity, enterprise-wide dependencies or service criticality. Business Impact does not expand model endpoint membership, so zero endpoint/CVE counts do not prove the absence of underlying endpoints or vulnerabilities. Missing links and deliberate unknown values remain explicit.

## Runtime and provider boundary

The browser captures the already scoped model loaded through `lib/data-loader.ts`; there is no new API, query or provider-specific reader. `pdf-topology-impact` uses the shared document worker and local `/tsaat-logo.png`. Progress, cancellation, retry, duplicate prevention and focus return use the existing dialog, including inside the full-screen topology modal. Retry reuses frozen evidence and the generation timestamp.

SQL and JSON storage/evidence contracts are unchanged; no migration, JSON upgrade, dependency installation or checksum refresh is needed. Both guarded builds retain the offline asset boundary. See [client document generation](client-document-generation.md), [ADR 0032](adr/0032-captured-topology-impact-reports.md) and [validation](validation.md).
