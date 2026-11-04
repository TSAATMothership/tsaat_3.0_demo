# Contributing

Create a short-lived branch from main. Define the problem, scope and acceptance criteria. Before selecting tests, assess UI/runtime, SQL/JSON data and structures, calculations, documentation/inventories, dependencies/builds and release risk using the [SDLC validation matrix](docs/sdlc.md).

Implement meaningful regression coverage and update only affected requirements/design/data/operations documentation. If documentation is unaffected, record why in the PR; do not force documentation edits or checks. Record user-visible changes in CHANGELOG.md and significant decisions in an ADR.

Use focused tests and relevant lint/type/browser/report checks for scoped application changes. Run docs:check when documentation/inventories are affected and docs:generate only when inventories need refreshing. Data/rule/persistence changes require both-provider review, storage checks, both builds, No-SQL smoke and applicable trusted disposable-SQL parity. A presentation-only change does not require those data gates. See [data providers](docs/data-providers.md).

node scripts/change-impact.mjs prints a conservative plan; --run executes its selected source checks. Review semantic impacts and supplement related-test discovery for dynamic imports/source-reading tests. Use --data, --docs or --full to broaden the assessment. CI uses the same planner; PR labels validation:data, validation:docs and validation:full request broader checks. Record actual results, omitted categories and limitations in the PR template.

Both providers and offline compilation remain supported product contracts. Use shared data facades and never reset existing JSON stores or operational SQL data to make validation pass. Preserve strict TLS and keep secrets, mutable data and generated outputs outside Git.

For dependency/build changes and release candidates, prove fresh empty-cache npm ci --offline, archive/provenance integrity, full checks, both guarded builds and compiled No-SQL smoke. Follow the [offline contract](docs/offline-builds.md); all packages/assets remain repository-contained, with no registry or lifecycle-download fallback. Unrelated routine edits do not need a fresh install or both builds.

Merge after the assessed checks and independent review pass. Before release, run the manual full CI workflow on the release commit and follow the [operations runbook](docs/operations.md). The repository owner must configure protected main and required CI in the hosting service.
