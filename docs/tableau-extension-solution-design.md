# TSAAT Dashboard Extension

2026-11-11 update: [inventory storage v2 and the approved retirement](feature-retirement.md) supersede references below to retired analytics, Findings, Briefs & Reports and SPI settings. Current navigation has Governance and Discovery only; Settings has read-only Personas and Discovery Tools. The old feature descriptions are historical context, not active capabilities.

## Solution design and transformation plan

Version 0.2 | 9 November 2026 | Target: on-premises Tableau Server

**Status: agreed architectural direction; implementation and deployment validation pending.** This replaces the 8 November v0.1 proposal for a server-hosted third evidence provider. The revised target is a browser application delivered as a Tableau Dashboard Extension, with VizQL Data Service (VDS) reads, client-generated documents and externally maintained configuration.

### Feasibility assessment

The current TSAAT interface, typed models, pure projections and many PDF renderers can be reused. Its server-only loaders, Next.js server routes, SQL evaluators and filesystem-dependent workbook generation cannot run unchanged in an extension. This is a new deployment target built from shared code, not a repackaging of the current Node application.

**One deployment condition remains:** a normal Dashboard Extension does not automatically acquire authenticated VDS access from its parent dashboard. For on-premises Server, plan a small enterprise authentication/query gateway unless a supported viewer-context transport is demonstrated on the installed version. This gateway is server-side infrastructure, even though it owns no TSAAT business database, document generation or configuration writes. A strict browser-plus-Tableau-only VDS deployment is not yet proven. [S1, S2]

### Decisions established by the user

| Area | Target decision |
| --- | --- |
| Application | Tableau Dashboard Extension on the organisation's Tableau Server |
| Evidence and configuration reads | VizQL Data Service, using the individual viewer's identity |
| Data authorisation | Tableau permissions and centrally enforced row-level policies |
| Feature selection | Browser joins published persona, group and current-user membership records |
| Configuration maintenance | Separate managed process; no persona or group write-back from the extension |
| Documents | PDF and Excel generated and downloaded in the browser |
| Existing deployments | Preserve SQL and JSON-backed NoSQL while adding the extension target |

### Outcome and boundaries

Users keep the TSAAT workspace and receive data permitted by Tableau. Their mapped persona controls the available pages and popups. Data engineering retains the history, identities and rules needed to support those pages. Client feature selection is a presentation control, not a security boundary around data already delivered to the browser.

This document defines the target, conversion work, responsibilities and acceptance gates. It does not claim a tested Tableau connection, a production-ready extension, or completed feature parity. No application code, database or operational configuration is changed by this design update.

<!-- PAGE -->

## 01. Architecture and ownership

### Target request and publication paths

```text
Operational evidence + AD directory + managed configuration
                    |
        External preparation and publication process
                    |
   Tableau published sources + data policies + snapshot manifest
                    ^
          VizQL Data Service, authenticated as viewer
                    ^
   Enterprise SSO / query gateway (deployment condition)
                    ^
   TSAAT Dashboard Extension in the user's browser
        |                               |
   Persona and page models       PDF / XLSX workers
                                        |
                                  Local download
```

The Tableau dashboard contains the extension; the extension's HTML, scripts, fonts and templates are served from an approved internal HTTPS static host. Tableau Server does not become a general host for the existing Next.js application. The Tableau Cloud Data Apps beta is excluded from this on-premises baseline. [S3, S4]

| Component / owner | Responsibility |
| --- | --- |
| Data engineering | Reconcile source identities; publish detailed evidence, history, relationships, reference definitions and complete snapshot manifests. |
| Identity/configuration operations | Maintain AD memberships, group-to-persona mappings, persona capabilities, effective dates and publication versions. |
| Tableau administration | Configure SSO, extension approval, source permissions, row-level policies, VDS availability and refresh operations. |
| Platform operations | Host static assets and, where required, the authenticated gateway; own certificates, secret rotation and request monitoring. |
| TSAAT application team | Maintain shared types, validated read adapters, scope semantics, UI models, feature selection and browser report generation. |

### Infrastructure boundary

The gateway has no direct SQL/JSON evidence access and no shared-settings persistence. It authenticates the user, establishes the corresponding Tableau API identity and forwards permitted read requests to VDS. It does not run a shared privileged account to fetch every user's evidence. The separate external maintenance process remains responsible for all writes and publication.

<!-- PAGE -->

## 02. Authentication and VDS feasibility gate

### Proposed baseline for Tableau Server

Use published data sources as the initial VDS target. Do not depend on obtaining the parent dashboard's internal session identifiers. Tableau's documented embedded-viz session example concerns an application embedding a viz; it is not proof that an extension inside a viz can reuse the same APIs. [S1]

1. The user opens Tableau through organisational SSO and loads the dashboard.
2. The extension initialises the Extensions API and establishes a session with an enterprise gateway protected by the same organisation's SSO. Silent reuse depends on the actual SSO and browser configuration; a redirect or popup may be necessary.
3. The gateway obtains a verified organisational subject and maps it to the corresponding Tableau account and site. It never trusts a username supplied by the browser as proof of identity.
4. Where supported and approved, the gateway creates a short-lived Connected App JWT for that Tableau user, exchanges it through REST sign-in, and uses the resulting credential for VDS reads. The VDS scope is `tableau:viz_data_service:read`. Secrets and reusable Tableau credentials stay on the gateway. [S2, S5]
5. Tableau applies source permissions and data policies to that viewer. The gateway forwards the complete response and errors without widening its contents.
6. Expiry, logout or identity mismatch cancels requests and clears browser evidence/persona caches before another account can use them.

### Required proof before feature migration

Record the installed Server version, enabled APIs, licence capacity, site/source identifiers, connection credentials model and SSO configuration. VDS first shipped publicly in 2025.1; later behaviours vary by version. Do not assume current Cloud or 2026.x documentation applies to an older Server. [S6]

Test two accounts with different permitted records. Query evidence and membership sources through the actual iframe deployment. Verify expiry, reauthentication, logout, direct request tampering and absence of shared-account leakage. If Tableau and gateway accounts differ, block startup and resolve the mismatch.

### Decision if no gateway is allowed

Implementation pauses at this gate until a supported per-viewer browser-to-VDS mechanism is demonstrated. Do not put PATs, Connected App secrets, passwords or administrator credentials into JavaScript. Falling back to worksheet reads would change the selected VDS architecture and requires a documented design decision. Cloud-only APIs are not a fallback for this Server deployment.

<!-- PAGE -->

## 03. Transforming the current TSAAT code

The current application is Next.js 14 with React and TypeScript. Both SQL and NoSQL builds use the same Node application server. The shared data facade is marked `server-only`, imports server providers and exposes read and save operations together. [R1, R2]

| Current boundary | Conversion work |
| --- | --- |
| `app/` server pages and API handlers | Extract page model composition into portable services; build a client-routed extension shell. Preserve navigation IDs, query-state semantics and compatibility mappings. |
| `lib/data-loader.ts` | Extract provider-neutral read interfaces from SQL-specific type ownership. Retain this facade for existing builds; introduce a browser-safe implementation of the same read contract. |
| `lib/cmdb-attribute-loader.ts` | Separate portable definition/value contracts from provider imports. Supply Tableau-published CMDB mappings without importing SQL into the browser. |
| Shared React components | Reuse FindingsDataTable, WorkspaceTabs, modal conventions, charts, topology and styles. Remove server-fetch assumptions at their composition boundaries. |
| SQL/JSON calculations | Identify every SQL-only evaluation. Reuse tested portable evaluators or publish equivalent versioned outcomes upstream. VDS does not execute TSAAT stored procedures. |
| Report builders | Separate model preparation from rendering; remove filesystem, Node buffers and server responses from the client dependency tree. |
| Shared save operations | Advertise explicit read/write capabilities. Tableau mode is read-only; SQL/JSON retain their existing save semantics. |

### Proposed code organisation

Keep shared domain contracts, calculations and report models in runtime-neutral modules. Add a Tableau adapter for metadata validation, VDS query planning, response mapping and request cancellation. Inject that adapter into browser page services; feature components must not issue their own VDS calls.

The extension shell initialises Tableau, loads an immutable deployment manifest, resolves the viewer's feature profile and then loads the selected workspace. A static React entrypoint may be simpler than exporting server-heavy Next.js routes. Choose the build implementation after an import/dependency audit; do not clone the application into a separate independently maintained product.

Proposed commands such as `build:tableau-extension` and `test:tableau-extension` are future deliverables. They do not exist in the current repository. Offline package installation and compilation remain required for all supported builds.

<!-- PAGE -->

## 04. Published evidence contract

Publish TSAAT-compatible logical datasets, not a single many-to-many flat table. The detailed mapping inventory must identify each application's field, Tableau source/field identifier, type, null policy, record grain and owning process. The current SQL schema and JSON contracts are the semantic baseline. [R2, R3]

| Logical dataset | Required grain and content |
| --- | --- |
| Snapshot manifest | One completed evidence revision: snapshot ID/date, generation time, batch, contract/reference versions and required dataset partitions. |
| Configuration items | One typed CI per snapshot: stable ID, name, addresses, OS, ownership, lifecycle, discovery evidence and independent security domain. |
| Business context | Networks, ICT systems, Business Services and Mission Services as typed CIs; explicit memberships and hierarchy edges. |
| Software installations | Individual installation observation with CI/snapshot key, product/version, path, source and observed dates. Preserve legitimate repetition. |
| Vulnerability evidence | Individual CVE observation and affected CI/software associations, severity, detection dates, source and remediation metadata. |
| Patch evidence | Installation, restart and verification observations with maintenance context; absence of evidence is not success. |
| Communication edges | Directed source/target CI IDs, relationship type, protocol/ports, observation method and time. Keep observed communication distinct from declared relationships. |
| Findings and evaluations | Stable finding/measure identities, raw classification, evidence, status history, denominators and versioned evaluation outcomes where materialised. |
| References and rules | Measure definitions, applicability, severity/priority rules, discovery requirements, lifecycle references and CMDB attribute definitions. |

### Contract invariants

Use typed identity such as CI type plus source ID; retain stable IDs across snapshots. Separate evidence observation time, snapshot date, publication time and document generation time. Preserve null, unknown, invalid and inapplicable states. Required fields missing from metadata are contract errors, not defaults to zero.

Each source belongs to a named contract version. Publishing a field rename, relationship change or new calculation must include adapter mapping, regression evidence and compatibility instructions. Metadata validation runs before the first evidence query and whenever the publication version changes.

The external process can change its operational inputs while continuing to supply this contract. Authoring ETL or editing SQL mappings from inside TSAAT is outside the extension's scope.

<!-- PAGE -->

## 05. Reads, snapshots and calculation parity

### Coherent read lifecycle

1. Read the permitted snapshot catalogue and resolve the selected date using the existing application's rules.
2. Pin snapshot ID, evidence batch, reference version and calculation version for the workspace request.
3. Query only the required fields and datasets for the current page. Request detail at its declared grain; preserve stable observation keys and verify counts.
4. Validate types, duplicate keys, references, batch identity and completion before exposing a model to the UI.
5. Reuse shared projections for discovery, measures, CMDB, findings and topology. Cancel obsolete reads when scope or snapshot changes.
6. Supply reports from the same validated model/revision and the report's existing filter contract.

VDS supports detail queries and version-dependent streaming/options. A row limit is not a pagination guarantee. Design deterministic snapshot/scope/key partitions using supported filters, reconcile expected authorised counts and detect truncation. A successful HTTP status alone is insufficient when a streamed response contains a later error. [S7]

### Publication consistency

The external publisher writes immutable versioned batches and marks a manifest complete only after every required partition passes validation. A current pointer advances last. The app must never assemble evidence from two batches or silently substitute the latest snapshot for a failed historical query. A source without a usable completion contract is not ready for production.

Manifest counts exposed to a viewer must be scoped to that viewer's authorised records; do not compare a restricted user's query against whole-estate counts. Global reconciliation can run in the controlled upstream validation process.

### Measures, discovery and history

Create a calculation inventory: portable TypeScript, SQL-dependent and upstream-produced. Translate or materialise SQL-only logic and verify its results against SQL and JSON fixtures. Publish the definition/evaluation version together. Do not replace TSAAT's unknown/failed/inapplicable outcomes with loosely equivalent Tableau charts.

Retain at least four complete weeks of evidence; use the current eight-week fixture for migration tests. Three-, six- and twelve-month views require corresponding upstream history. Show the actual available period and gaps; never fabricate older observations or interpret an empty denominator as compliant. Read-only configuration includes measure/discovery definitions, not just personas.

<!-- PAGE -->

## 06. Persona and AD group data model

The extension reads these logical tables through VDS. Another managed process owns their creation, validation, membership expansion and publication. These are proposed logical contracts, not migrations applied to the existing database.

| Table | Minimum fields and meaning |
| --- | --- |
| Persona | `personaId`, label, display order, enabled flag, configuration version. Preserve current stable persona IDs and labels. |
| PersonaCapability | Persona ID, capability kind (`section`, `page`, `popup`), capability ID, allowed flag and version. Equivalent to the current version-3 arrays. |
| ADGroup | Stable directory group key (object GUID or SID), domain, readable name, enabled flag and version. Names are labels, not join keys. |
| GroupPersona | Group key, persona ID, enabled flag, default priority, effective-from/to timestamps and version. |
| UserGroupMembership | Canonical Tableau username/site, group key, membership revision, validity and synchronisation time. Rows must be restricted to the querying viewer. |
| ConfigurationManifest | Contract/version, publication time, membership freshness policy, completion status and expected related versions. |

### Identity agreement

The external process explicitly maps organisational identities to Tableau usernames. Document domain/UPN handling, aliases and renames; do not assume that lowercasing or stripping a domain produces a unique identity. Tableau group LUIDs, AD GUIDs/SIDs and extension user identifiers are different namespaces.

A persona/group catalogue without user membership records is insufficient: it cannot determine which groups apply to the viewer. Nested AD membership must be expanded upstream according to an agreed policy; the browser does not query AD or discover nested groups.

### What reaches the client

Tableau enforces a viewer-specific membership source, for example through a secured data policy using the authenticated Tableau username. The browser loads that viewer's memberships plus the permitted group-to-persona catalogue and joins them locally. A browser-provided username filter is not the security mechanism. Tableau supports centrally enforced policies and user-based filtering, but deployment permissions must prevent bypass. [S8]

The process publishing configuration must preserve referential integrity and publish one coherent revision. Membership changes and disabled groups become effective according to a documented refresh/session policy. Membership revocation latency is an operational requirement to agree before release.

<!-- PAGE -->

## 07. Feature selection and settings behaviour

### Deterministic client mapping

1. Validate the configuration manifest and current-user membership freshness before enabling feature navigation.
2. Join enabled, effective memberships to enabled groups and GroupPersona rows, then to enabled personas.
3. Deduplicate eligible persona IDs. Select the lowest numeric default priority, then display order and stable ID as deterministic tie-breakers.
4. Restore a locally remembered persona only if it remains eligible in the current site/account/configuration context. Otherwise select the default.
5. Allow switching only between eligible personas. Apply one persona at a time; do not union their capabilities implicitly.
6. Use the existing section-plus-page requirement and independent popup controls. Unknown capability IDs are rejected during publication/validation.
7. Missing, expired, inconsistent or unmatched configuration produces a controlled no-assignment screen with Retry and support information. Do not use the current all-sections fallback in the Tableau target.

### Settings changes for this deployment

| Setting / action | Extension behaviour |
| --- | --- |
| Persona selection | Choose from assigned personas; retain only a local preference. |
| Persona definitions and AD mappings | Read-only display of effective profile, configuration version and freshness; no Add, Rename, Remove or Save. |
| Measures, discovery tools and shared references | Read-only in this no-write deployment. External publication owns updates. |
| Database connection and SQL setup | Not part of the extension interface. Connection/source identifiers are managed deployment configuration. |
| Display and temporary filters | Browser/session preferences where appropriate; not published as shared settings. |
| PDF/Excel export | Retain current report availability unless an explicit export capability is added in a future version. |

### Security meaning

These checks guide the interface and normal navigation. A user can alter client code; therefore they cannot protect a privileged operation or hide data that Tableau has already authorised and returned. All source access remains controlled by Tableau. The header Security Domain filter narrows the viewer's permitted data and does not grant access to another classification.

The current SQL/NoSQL deployments retain their login-free model, persona editor and save behaviour. Shared parsers and renderers can be reused, but deployment capabilities must prevent read-only restrictions from accidentally changing those existing builds. [R4]

<!-- PAGE -->

## 08. Workspace and feature migration

The extension should occupy the main dashboard workspace and retain the current TSAAT visual language. Keep loading, error and empty states explicit. Browser routing must retain selected scope/date and CI drill-through context while avoiding dependency on Next.js server routes.

| Feature | Migration requirement / acceptance focus |
| --- | --- |
| Header and navigation | Preserve pending versus applied scope, network/system selection, dates and permitted domains. Gate page navigation after persona resolution. |
| Explorers | Retain facets, search, sorting, column semantics and exports; retrieve full authorised detail when paging/search requires it. |
| Governance Insights | Reuse the existing narrative models, completeness rules and chart components; preserve links to filtered Explorer evidence. |
| Measures Summary and Trends | Match KPI/SPI results and denominators across supported date windows, including explicit missing history. |
| Business Impact topology | Preserve model upstream/downstream paths, typed CIs, node details and CMDB drill-through. |
| Dependencies topology | Preserve recorded network/system/service/capability relationships and member CIs within selected scope/date/domains, including environment evidence; exclude CI-to-CI communication and ARP observations. See [ADR 0031](adr/0031-topology-model-dependencies.md). |
| CMDB slide-out panels | Load typed attribute mappings and values for endpoints, networks, ICT systems, Business Services and Mission Services. |
| Findings and reports | Preserve raw versus effective classification, scope-relative history, evidence links and report filtering semantics. |

### Browser adaptation

Use existing modal and keyboard patterns with focus return inside the extension. Test popup placement, wheel zoom, scroll containers, viewport resize and narrow layouts in the real Tableau iframe. Full-screen actions must use supported browser/host capabilities and retain an in-frame expanded fallback when permissions prevent full screen.

Load report and heavy graph modules on demand. Use workers for suitable pure calculations and file generation; cancellation and request generation IDs prevent old results overwriting a new scope. Avoid a full-estate download at startup.

A shared compatibility map should translate old TSAAT destinations into extension route/state. Existing standalone URLs remain supported by their SQL/JSON deployments. Do not promise that a standalone server URL automatically opens the same state inside Tableau; define and test the Tableau entry-link contract.

<!-- PAGE -->

## 09. Browser PDF and Excel generation

### Common export pipeline

Capture the applied workspace/report selection, fetch and validate all authorised report partitions, build a portable report model, render in a browser worker where feasible, then expose a local download. Include snapshot/batch and generation timestamps. A progress indicator must distinguish data loading from file generation and permit cancellation.

| Format | Reuse and adaptation |
| --- | --- |
| PDF | Existing Insights generators use `pdf-lib` and vector drawing. Isolate pure rendering from loaders, retain layouts/pagination and bundle fonts/images. `pdf-lib` supports browser execution. [S9] |
| Standard XLSX | Existing workbook builders create XML/ZIP data with Node buffers. Port to browser typed arrays and a reviewed ZIP implementation, or adopt a pinned browser-capable workbook library after parity review. |
| Template XLSX | Replace filesystem template reads and `zlib` dependencies. Fetch the versioned template from bundled static assets and preserve its worksheets, styles, formulas and relationships. |
| HTML-rendered legacy reports | Audit any headless-browser/server dependency separately. Reimplement unsupported rendering with the portable report model; do not assume every PDF generator is already browser-safe. |

### Fidelity and completeness

Generate report pages from the report model rather than capturing only the visible viewport. Retain complete appendices, long-label wrapping, headers/footers and empty-evidence explanations. Maintain each report's current scope contract: for example, Insights reports use applied header scope and snapshot, while Explorer workbooks may include local table filters. [R5]

Validate spreadsheet cell types, dates, leading zeros, IP addresses and versions. Treat untrusted source text as text rather than executable formulas. Compare workbook content, formula preservation and styling against current outputs; do not compare ZIP bytes or generated timestamps as semantic equality.

### Browser constraints

Use bounded record/byte limits, reusable buffers and cancellation. Set supported maximum export sizes through measurement, not the theoretical Tableau response ceiling. Exhausted memory or incomplete data must produce an error, never a file labelled complete. Revoke temporary download URLs and clear report buffers after use.

Tableau native PDF export does not render the custom extension zone, so the TSAAT download button must invoke the client renderer. Validate iframe download policy on the deployed browser. Scheduled unattended generation while no browser is open is outside this client-only design. [S10]

Agree the export policy explicitly: Tableau's native download controls are not an enforcement boundary for files generated from data already delivered to custom client code. The source must only deliver records the viewer is permitted to possess.

<!-- PAGE -->

## 10. Security, performance and operations

### Authentication and cache boundaries

No SQL credentials, AD secrets, PATs or signing keys belong in extension assets or local storage. Source policies apply to every evidence and membership query, including requests with browser filters removed. Restrict gateway routes, source identifiers and query size; use verified identity for Tableau sign-in. Gateway access must not become an arbitrary privileged proxy.

Cache operational evidence only in memory by default. Key entries by verified site/user context, contract, evidence/reference revision, scope and date. Revalidate after identity or entitlement changes; clear caches on logout and reauthentication. Do not reuse another viewer's data, even on a shared workstation. Persistent offline evidence caching is excluded from the initial design.

### Failure behaviour

| Condition | Required response |
| --- | --- |
| Expired session / different account | Cancel work, discard sensitive state and re-establish identity. |
| Missing or stale persona publication | Show no-assignment/configuration-unavailable state; no all-features fallback. |
| Permission denied | Explain access failure; never retry under a broader service account. |
| Missing fields / partial snapshot | Reject the affected model; retain no misleading healthy totals. |
| Timeout / rate limit / streamed error | Bounded retry where safe, cancellation and explicit incomplete status. |
| Report capacity exceeded | Offer narrower scope/date selection; do not silently truncate. |

### Capacity and publication freshness

Coalesce concurrent requests, cache metadata by version, debounce interactive filters and precompute expensive reusable aggregates upstream. Measure queries per page/session/export as well as latency and memory. Current VDS documentation describes a site query allowance linked to assigned Creator licences; confirm the actual entitlement and throttling on the target Server. Do not assume an unlimited API budget. [S11]

Record request correlation, duration, result completeness, batch/version and failure class without logging sensitive rows or secrets. Log authoritative query/authentication events on managed infrastructure; client telemetry alone is not a reliable audit of all activity. Report publication freshness independently from browser render time.

Use approved internal HTTPS origins, extension safelisting, bundled assets and reviewed content-security rules. Validate security policies with adversarial direct queries, not only through the happy-path UI.

<!-- PAGE -->

## 11. Delivery plan and exit gates

Deliver incrementally while retaining working SQL and JSON builds. Each phase has demonstrable outputs; estimates follow the data-volume and dependency audit.

| Phase | Work and exit evidence |
| --- | --- |
| 0 - Platform proof | Confirm Server/version and SSO; demonstrate actual extension-to-VDS reads as two distinct users; approve gateway or prove a supported alternative. Stop if the no-gateway constraint cannot be met. |
| 1 - Contract and fixtures | Inventory every read, rule and report; publish known SQL fixture evidence plus persona/group/membership tables to an isolated Tableau project; establish counts, keys and coherent revisions. |
| 2 - Portable application core | Extract neutral contracts and pure page/report models. Keep SQL/JSON facades and saves working. Create static extension shell, manifest and build isolation. |
| 3 - Vertical slice | Implement persona resolution, End Point Explorer, CMDB, both topology modes, one Insights PDF and one XLSX. Prove context retention, permissions and report fidelity end to end. |
| 4 - Complete migration | Add remaining pages, history, measures, findings, reports and read-only settings. Replace SQL-only evaluation dependencies with verified portable/upstream equivalents. |
| 5 - Release and operate | Complete parity, performance, security, accessibility and offline-build gates. Publish static assets/manifest, rollback package and upstream configuration runbooks. |

### Initial proof scenarios

Use a small fixture containing an endpoint with multiple installations and CVEs, model CI ancestors, a cross-network communication peer and at least four weekly snapshots. Include two users with different Tableau data access, one user with two eligible personas, one unmatched user and a revoked membership.

Acceptance requires the users to see different authorised data even when using the same persona. Users with the same data permission but different personas should receive the corresponding interface without widening evidence access. Direct VDS/gateway tests must agree with those results.

The initial slice is a delivery milestone, not permission to drop other features. Full production acceptance requires the documented feature and report catalogue or explicitly agreed exceptions.

<!-- PAGE -->

## 12. Verification and coordinated evolution

### Implementation acceptance matrix

| Area | Required evidence |
| --- | --- |
| SQL / JSON / Tableau parity | Same fixture, snapshot dates and scopes; reconcile CI/observation IDs, counts, null states, findings, KPI/SPI outcomes, relationships and report totals. SQL target must be explicitly disposable. |
| Identity and policies | Two-account tests, tampered filters, denied source access, stale/disabled memberships, nested groups, logout, refresh and account mismatch. No cross-user cache reuse. |
| Configuration | Complete/incomplete revisions, duplicate mappings, invalid capabilities, renamed groups, removed personas, multiple matches and deterministic default selection. |
| Workspace | All routes, facets, keyboard navigation, narrow layouts, CMDB drill-through, topology peers, scope/date retention and compatibility mappings. |
| PDF / XLSX | Every report family; long/empty/missing-data cases; complete exported records; PDF visual review; workbook sheet/style/formula/cell-type checks; cancellation and browser limits. |
| Resilience and capacity | Concurrent users, rate limits, cancelled reads, partial streams, metadata drift, failed publication, source outages and peak export volumes. |
| Release | Fresh empty-cache offline installation, all guarded builds, compiled SQL/JSON/extension smoke and evidence tied to the exact release. |

### Extend the existing SDLC during implementation

Any change to data fields, schemas, mappings, identity, snapshots, imports, calculations or exports must review SQL, JSON and Tableau in the same change. Add Tableau fixtures and contract checks to the existing provider gates; do not replace their evidence with a successful extension build.

Continue reviewing `NoSQL/calculation-contract.json` before checksum updates. Provide forward SQL migrations, JSON upgrades and Tableau publication/mapping upgrades where representations change. Preserve installed stores, user settings and historical data; seed changes are not upgrades. Refresh generated inventories only when their inputs change. [R6]

### Validation scope of this design revision

This revision changes documentation and a generated PDF only. Selected checks are repository documentation/link validation, source-to-PDF content checks, and rendered-page inspection. Application tests, provider parity, SQL operations, dependency installation and builds are not applicable to this document-only change. All implementation tests above are future acceptance requirements, not results claimed by this document.

<!-- PAGE -->

## 13. Deployment, unresolved decisions and rollback

### Deployment package

Produce versioned static HTML/JavaScript/CSS, workers, local fonts/images/templates, a Dashboard Extension manifest and a non-secret deployment manifest. The latter identifies the site, gateway origin, source/field contract mappings, supported schema versions and asset version. No operational evidence or individual membership export is bundled with the app.

Use approved local dependency archives for reproducible offline installation and compilation. A build must not connect to Tableau, AD, a package registry or a remote font/CDN. Runtime still requires the organisation's network and Tableau; an offline build does not imply an offline data service. Any new build tooling or browser library requires the repository's dependency/provenance gate. [R7]

### Outstanding decisions

| Decision | Owner / required by |
| --- | --- |
| Installed Server version and compatible VDS features | Tableau administration / phase 0 |
| Gateway ownership and SSO-to-Tableau identity mapping | Platform and identity teams / phase 0 |
| Published data sources and row-level policy placement | Data engineering and Tableau administration / phase 1 |
| AD nesting, disabled-account rules and revocation freshness | Identity operations / phase 1 |
| Evidence retention and reference/evaluation versioning | Data owner / phase 1 |
| Estate size, query allowance, latency and export limits | Service owner / before full migration |
| External maintenance of measures/discovery references | Configuration owner / before read-only settings release |

The first two are prerequisites to claiming feasibility for the installed platform. The remaining items determine completeness and operational acceptance. No Cloud-only functionality is assumed.

### Rollout and recovery

Publish to a restricted pilot project first. Release the extension assets, workbook/manifest and data-contract version as a compatible set. Keep the prior static asset version and compatible source publication available for rollback. Switch the entry manifest back without deleting evidence or changing live SQL/JSON stores.

Stop or disable the extension on an incompatible source/identity release; do not fall back to unrestricted data. Upstream publication rollback must restore coherent configuration and evidence versions. Retain SQL/NoSQL deployments as separate supported targets, not as an automatic bypass when Tableau denies access.

<!-- PAGE -->

## 14. Source basis and references

Reviewed on 9 November 2026. Vendor capabilities remain dependent on the installed Tableau Server version and configuration. The design recommendations and acceptance gates are TSAAT-specific proposals.

### Current repository basis

- **R1:** [Architecture](architecture.md) and [README](../README.md): Next.js runtime, page/API composition and current deployments.
- **R2:** [Data providers](data-providers.md), [data facade](../lib/data-loader.ts) and [CMDB facade](../lib/cmdb-attribute-loader.ts): shared boundaries and server-only dependencies.
- **R3:** [Calculation contract](../NoSQL/calculation-contract.json) and [sample evidence](sample-evidence.md): rule parity and shared snapshot fixtures.
- **R4:** [Personas](personas.md): version-3 definitions, current save behaviour and presentation-only permissions.
- **R5:** [Inventory Insights reports](inventory-insights-reports.md), PDF renderer (retired; historical design), [workbook builder](../lib/inventory-explorer-workbook.ts) and template workbook (retired; historical design).
- **R6:** [SDLC](sdlc.md): impact-based checks and coordinated provider evolution.
- **R7:** [Offline builds](offline-builds.md): installation, dependency provenance and guarded compilation.

### Primary technical references

- **S1:** [VDS with an embedded Tableau viz](https://help.tableau.com/current/api/vizql-data-service/en-us/docs/vds_embedded_viz.html). Cookie scope, proxy/server-side integration; not an extension-specific session guarantee.
- **S2:** [VDS configuration](https://help.tableau.com/current/api/vizql-data-service/en-us/docs/vds_configuration.html). Authentication, API Access and per-user query identity.
- **S3:** [Extension security and deployment](https://help.tableau.com/current/server/en-us/security_extensions.htm). Hosting, approval and data-access boundaries.
- **S4:** [Tableau Data Apps](https://tableau.github.io/extensions-api/docs/dataapps/trex_dataapp_overview/). Cloud-only beta; excluded from the selected Server baseline.
- **S5:** [Connected Apps with direct trust](https://help.tableau.com/current/server/en-us/connected_apps_direct.htm). Trust configuration and secret-backed JWTs.
- **S6:** [VDS release history](https://help.tableau.com/current/api/vizql-data-service/en-us/docs/vds_whats_new.html). Version-dependent capabilities.
- **S7:** [Query a data source](https://help.tableau.com/current/api/vizql-data-service/en-us/docs/vds_create_queries.html). Detail, filters, limits and streamed error handling.
- **S8:** [Tableau row-level security options](https://help.tableau.com/current/server/en-us/rls_options_overview.htm). User-based access and centrally enforced policies.
- **S9:** [PDF-LIB](https://pdf-lib.js.org/). Browser PDF generation.
- **S10:** [Tableau download/export behaviour](https://help.tableau.com/current/pro/desktop/en-us/export.htm). Extension limitations in native PDF export.
- **S11:** [VDS limitations](https://help.tableau.com/current/api/vizql-data-service/en-us/docs/vds_limitations.html). Capacity and unsupported/version-dependent features.

No live Tableau environment was accessed for this revision. The current application remains unchanged; implementation requires the phase-0 platform proof and the subsequent acceptance gates.
