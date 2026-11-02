# Standalone browser demo contract

## Architecture and scope

[Demo/index.html](../Demo/index.html) is the portable browser distribution. It mounts the existing React page compositions and reuses shared tables, charts, risk models, report builders and API handlers. [ADR 0005](adr/0005-standalone-browser-demo.md) records the decision. The SQL application remains unchanged and retains authentication and strict TLS.

Demo/src supplies only the browser boundary: hash navigation, a shell identifying sample data, local settings, JSON-backed loaders, WHATWG request/response routing and small workbook platform adapters. API-style calls run as local function calls; they never contact a server. Authentication, password management and database connection settings are intentionally absent from the demo. No operational credentials or DB_config are packaged.

The build bundles the analyser worker into a Blob URL and all images, CSS and workbook template into the HTML. Compressed JSON snapshots are decompressed on demand. There are no CDN dependencies, runtime module imports or file-to-file fetches. The demo can run under file:// or static hosting.

## JSON and calculation ownership

The maintained seed snapshots in data/snapshots and reference JSON in Database Schema/data are shared inputs. Demo/data/profile.json records their purpose. Demo/src/sample-data.ts enriches synthetic records with discovery metadata, contacts, IP Scan/ARP observations and explicit missing ATO/DIIS examples. It does not query SQL. Per-type CMDB mappings live in Demo/data/cmdb-attributes.json; each currently exposes the approved common attributes.

Demo/src/evaluations.ts implements the ten approved SPI calculation rules and configured discovery detection conditions. It honors reference parameters and outcome templates and rejects unknown rules. KPI-1 checks a non-blank ATO number; KPI-2 uses DIIS Defined. The shared KPI scope resolver derives systems through selected network infrastructure and deduplicates them. Persisted sample findings retain their observed/closed dates; effective severity and priority use the same shared settings functions as the app.

SQL remains authoritative for the operational app. The demo does not execute or interpret arbitrary SQL. Changes to calculation SQL, rule metadata, finding policies or CMDB mappings require corresponding browser implementation and regression-test review. Demo/data/calculation-contract.json pins reviewed source contracts. Refresh its checksums only after reviewing semantics and tests; a checksum update alone is not evidence of parity. Future rules must have browser implementations before release.

The sample package contains persisted findings in every snapshot. The demo does not synthesize SQL's historical finding-generation workflow for an empty snapshot. Empty/malformed seed snapshots must fail build validation rather than show fabricated results.

## Required change workflow

1. Assess the demo for every UI, navigation, data shape, rule, report, settings, asset mapping or styling change.
2. Keep reusable behavior in app/components/lib. Add browser adapters only for actual platform differences. Extend explicit route/support coverage when adding a page.
3. Update JSON fixtures, CMDB mappings and browser evaluators when needed. Review the calculation contract.
4. Run demo:build, demo:test, docs:generate, check and build. Inspect relevant desktop/narrow layouts, dialogs, worker diagrams and report outputs.
5. Commit Demo/index.html and Demo/build-manifest.json with their source changes and human-written documentation. Never commit an HTML edited by hand.

demo:check rebuilds in memory and rejects a stale distributable or source manifest. npm run check includes that gate. CI runs the direct-file browser checks as well as production checks. This is a narrow exception to the repository's generated-build exclusion: dependencies, .next, logs, downloaded test reports and credentials stay ignored.

## Validation and limitations

tests/demo.test.ts checks all ten SPI rules, configurable boundaries, KPI scope/ATO presence, snapshot isolation, effective finding settings, discovery applicability and the reviewed SQL contract. scripts/test-demo-browser.mjs opens the actual HTML under file://, checks current workspace views, parses generated PDFs and workbooks, verifies local settings persistence and real downloads, and rejects browser errors or external requests.

Local storage is scoped by browser/file origin and can be disabled by browser policy; the demo reports when it must use memory. Settings affect the local demo only. Seed data and timings are demonstrative, not a simulation of live data ingestion, operational security or multi-user writes. The absence of a login is appropriate only for this synthetic public demo; it must never be used as an operational data deployment.


See [recorded validation](demo-validation.md) for this initial delivery.
