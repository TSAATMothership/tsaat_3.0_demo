# ADR 0002 — Source-only development repository

Status: accepted, 2026-11-02.

Context: the prior workspace mixed source with bundled runtimes/dependencies, output, duplicate app copies and local credentials.

Decision: use a fresh Git history, locked npm installation, quality gates and source-linked documentation. Keep upgrade SQL and required test/demo snapshots. Exclude machine state, credentials, vendored binaries/packages and duplicate app copies. Offline delivery bundles belong in an approved artifact store.

Consequences: clean checkouts need installed/pre-staged Node/npm, sqlcmd and packages from a trusted registry/cache. Standard wrappers replace bundle-dependent setup. Hosting and deployment controls must be configured separately.

Alternative: copying the entire old workspace would retain irrelevant and machine-specific state. See [baseline provenance](../import-baseline.md).
