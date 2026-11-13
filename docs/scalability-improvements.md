# Scalability implementation and evidence

## Scope and acceptance

Implement the review's first stage: reduce unnecessary reads, bound runtime resources, measure the remaining costs, and remove unnecessary tooling version restrictions. Preserve scope, selected history, unknown/inapplicable evidence, configured discovery rules, login-free access and compatibility routes. SQL and JSON must produce the same page/report meaning.

Structural changes suggested by the review (CVE reference normalization, service identity tables, membership consolidation, index changes and replacing sqlcmd) require evidence before adoption. They are not safe automatic rewrites of historical evidence. The first stage measures existing behavior and records the decision for each candidate.

## Impact assessment and selected checks

| Area | Impact and validation |
| --- | --- |
| App/runtime | Focused metadata, CMDB and Topology reads; cache and SQL execution limits. Lint/types, focused loader/cache/transport tests and compiled browser smoke. Page layout and keyboard interaction remain unchanged; existing compiled interaction smoke covers affected consumers. |
| SQL/JSON queries | Both providers change together; review calculation contract and compare identical snapshots/scopes on an explicitly disposable SQL database. Run evidence/storage checks and both compiled providers. |
| Persistence/schema/calculations | No persisted format, field, seed, calculation or relationship meaning changes in the first stage. No migration is required; existing-store reads must remain compatible. Never reset an operational database. |
| Build/dependencies | Host version selection and package compatibility ranges change. Keep exact offline lock/archive graph; run tooling regression tests, archive verification, fresh empty-cache offline installation, full source checks and both guarded builds. |
| Documentation | Update provider/build/architecture contracts and this evidence record; run documentation inventory generation/checks where the manifest changes. |
| Release | These checks validate the working tree. Publishing, deployment and a final-commit release certification are outside this change. |

Actual results and remaining measurement gates are recorded here after validation; planned checks are not passing evidence.

## Implemented behavior

- Software PDF metadata no longer loads asset inventories or evaluates discovery rules.
- CMDB endpoint reads filter inventory and its child observations by endpoint ID. Model CI details read model associations without endpoint observations. Existing model/domain checks and endpoint access behavior are preserved.
- Topology filters endpoint evidence by network/system, including environment membership and ARP-owner context. All required model relationships remain available; discovery evaluations and unused CI communication rows are omitted. Final domain projection is unchanged.
- JSON caches raw snapshot reads separately from discovery evaluation. Header, Explorer, CMDB, Topology and software-metadata consumers avoid unnecessary rule evaluation.
- Each server cache has a 32 MiB estimated serialized-payload budget as well as its existing entry/TTL limits. Oversized results bypass storage. Pending-read prefix invalidation is fixed. This is not a global heap cap.
- SQL transport admits four requests per process, with up to 64 queued, a 15-second queue/login limit, 60-second query limit and 65-second process deadline. Optional timing, payload/row counts and cache diagnostics support later capacity measurement.
- Build tooling accepts stable Node 24.13.1+ and npm 11.8.0+. Compatible library updates are allowed by manifest ranges, with exact reviewed offline archives retained. The existing compileApp.cmd SQL/No-SQL/all dispatch was verified end to end.

## Local measurement

The explicitly new disposable database is `TSAAT_EvidenceParity_Scale_20261113`; JSON uses an isolated `.local/scalability-json-parity` store. Both contain the same eight snapshots, 2026-09-19 through 2026-11-07, with 1,240 endpoints per snapshot. No operational database was reset.

Measurements below use 2026-11-07, network net-1 for Topology and one recorded server for CMDB. Each is the median of three reads after clearing application caches. SQL/OS caches were warm. Bytes are serialized provider results, not browser transfer or heap allocation. They demonstrate this fixture's read reduction, not production throughput or a pooled-driver comparison.

| SQL read | Median time | Approximate result size |
| --- | ---: | ---: |
| Complete snapshot (previous detail path) | 3,785 ms | 11.4 MB |
| Summary snapshot (previous report metadata path) | 3,813 ms | 1.13 MB |
| Focused metadata | 223 ms | 5.6 KB |
| Selected CMDB endpoint | 318 ms | 97 KB |
| Scoped Topology | 403 ms | 774 KB |

JSON medians were 117 ms for the complete snapshot and 74–82 ms for the focused reads. A cold JSON read still parses the complete file; these improvements do not make JSON a database with indexed reads. The reproducible measurement test is `tests/scalability-measurement.test.ts`, selected only with an explicitly disposable parity database and isolated JSON store.

## Remaining recommendations and decision gates

| Candidate | Current decision and required evidence |
| --- | --- |
| Server filtering/pagination/facets | Not implemented in this stage. Explorers retain their complete scoped row collections and all-matching exports. A later change must move filtering, facet counts and paging together, with stable ordering and parity for unknown/date values; paging alone would produce incorrect counts or truncated exports. |
| Pooled SQL driver | Not replaced or benchmarked against sqlcmd. The measured first-stage reductions are already substantial. A transport comparison must include concurrency, Windows/SQL authentication, saved TLS/Strict policy, cancellation and offline dependency packaging. |
| CVE reference normalization | The fixture has 23,274 observations and 20 distinct CVE codes. This identifies a storage candidate, but CVE code alone is not a safe reference key: source text and historical revisions must remain immutable. A versioned-reference SQL migration and JSON upgrade/recovery path must be designed and tested together before adoption. |
| Service identity and membership tables | The fixture has no conflicting per-snapshot service names and no multi-system environment memberships. Preserve the broader recorded-membership projection supported by JSON/Topology; do not silently enforce a new identity or cardinality policy from sample data. |
| Index consolidation, compression, partitioning | No indexes or storage policies changed. Sample elapsed times do not establish production index redundancy or partition requirements. Use representative query plans, volumes, write costs and retention needs before changing them. |
| Insights composition | Existing shared context is retained because the briefings intentionally combine evidence types. A later split must preserve each page and PDF's context; no measures have been dropped to reduce reads. |

## Validation record

Completed: fresh empty-cache offline install from all 572 verified archives with networking and lifecycle scripts blocked; focused detail/report/cache/SQL-limit tests; real SQL/JSON parity across all eight dates and matching network/system/domain scopes; original full-snapshot equivalence for CMDB and Topology. The installer initially stopped safely on a process-identity change before removing dependencies; the retry completed after those checkout servers exited.

Final results: compileApp.cmd ALL completed its installer, full source gate and both guarded production builds with exit 0. The source gate passed 601 tests (18 optional integration/measurement tests skipped in that generic run), plus 26 tooling tests. Applicable real SQL/JSON parity and the measurement test were run separately against the named disposable database; those skips are not used as parity evidence. The ten change-impact classifier tests also passed after adding the new projection and toolchain-policy paths. Storage/evidence, documentation, repository hygiene, syntax and whitespace checks passed. All 15 files in the existing NoSQL/data store matched their pre-build SHA-256 hashes.

Compiled browser coverage exercised all eight views, current/historical/empty scopes, four Excel downloads, endpoint/vulnerability/software briefings, PDFs, Topology/CMDB, keyboard/mobile behavior, retired routes, header settings and restart persistence. Initial full browser runs exposed harness timing failures: a stale URL was captured before a domain Update committed, and broad PDF retry interception could stall worker artwork fetches. The harness now waits for the committed all-domain URL and intercepts only the report API, retaining the retry, duplicate-prevention and scope assertions. Added request diagnostics make any future unscoped-Back timeout actionable. The affected No-SQL PDF/settings and SQL settings reruns, including the common route/export/CMDB/restart checks, completed with exit 0. Other feature checks had passed in the broader runs. This records combined coverage, not a claim that the earlier full browser commands completed without interruption.

Logs are ignored under `.local/scalability-*`; key records are compile-all, parity-final, smoke-json-retry and smoke-sql-retry. The tested runtime is portable Node 24.13.1/npm 11.8.0; newer-version acceptance is regression-tested, not a claim that every newer host has been executed here. No production load-capacity certification or deployment was performed.
