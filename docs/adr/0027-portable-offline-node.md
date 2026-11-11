# ADR 0027: Portable Node in offline distributions

Status: Accepted. Date: 2026-11-11. Supersedes the separately provisioned Node/npm requirement in ADRs 0007 and 0025 for generated Windows x64 distributions; their repository exclusions and npm protections remain.

## Context and decision

npm cannot bootstrap itself without Node, and older host Node versions fail the project's Node 24 requirement. Provide install-offline.cmd and tsaat-npm.cmd, backed by Windows PowerShell, to verify and unpack the original Node 24.13.1/npm 11.8.0 ZIP under .local/runtime. Pin upstream archive and executable SHA-256 values, preserve notices, reject linked extraction paths, publish only complete runtimes and serialize extraction. Select bundled Node for child npm scripts through process-local PATH. Fail on corrupt bundles; never fetch, replace system Node or change persistent PATH.

Generate a delivery ZIP from reviewed Git source and local archives using offline-package.ps1. Include the runtime ZIP only in ignored runtime/ and generated output/, never Git. Include source provenance and a package checksum. Require opt-in for dirty development packages; refuse existing output. The destination needs Windows x64 and PowerShell, not Git or preinstalled Node/npm. Source checkouts without the bundle retain host Node 24/npm support.

Retain npm ci, lifecycle suppression, archive verification, server preflight, build network guards and both providers. compileApp.cmd uses the portable launcher; its Git-only source audit runs in checkouts, while extracted distributions retain docs/storage checks and build-enforced archive/lint/type checks. Full release checks happen before packaging.

## Impact and selected validation

The existing npm installation entry point also hands off to the PowerShell launcher when started under an incompatible host Node. It validates arguments before handoff, takes no parent install lock, preserves the requested cache and propagates the child exit code. Regression coverage and a real Node 22 invocation verify this compatibility path. The installation/build validation selection below also applies to this correction; data/UI contracts are unchanged.

- Installation, runtime selection, build entry points and packaging are affected: select archive/provenance checks, bootstrap/packaging tests (missing host tools, arguments, corruption, partial extraction, locks, links, exclusions and exit codes), fresh empty-cache guarded npm ci, full source checks, both guarded builds and compiled No-SQL smoke.
- Documentation is affected: update installation/deployment guidance and run docs:check. Generated inventories are unchanged because routes, navigation, APIs, dependencies and schemas are unchanged; no docs:generate is selected.
- UI, scope/authentication, SQL/JSON structures, calculations, persistence and evidence are unchanged. No migrations, live SQL parity or separate report/keyboard acceptance is selected. Existing provider checks within the broader gates still run.
- Node retains the existing documented version. Application package versions, lockfile and vendor archives are unchanged. Runtime acquisition is explicit maintenance, separate from disconnected installation.

Validation discovered four files absent from the supplied checkout: app/layout.tsx, app/globals.css, app/api/assets/cmdb-details/route.ts and .github/workflows/ci.yml. With the user's identified TSAAT_UI_3 source, all four were restored after their normalized SHA-256 values matched docs/source-baseline.json exactly. This restores the documented layout, existing provider facade route and CI contract without changing their behavior. The full source/build/smoke gates cover the recovered files; no data contract or generated inventory change is introduced.

Actual results and limitations must accompany the change; archive creation alone is not release acceptance. See [packaging and recovery](../offline-builds.md) and [SDLC](../sdlc.md).
