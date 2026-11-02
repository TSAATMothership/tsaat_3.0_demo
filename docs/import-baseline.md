# Import baseline

Created 2026-11-02 from TSAAT commit bac03981bc314699baab592e4d1e76a8b6e32e5e. The destination was empty and received a fresh main branch, without the old Git history or a remote.

## Application fidelity

All 271 files under app, components, lib, public and data matched the source byte-for-byte at import verification. Final quality cleanup normalized trailing blank lines in eight of these text files without changing code; the file list is recorded in the provenance JSON. The shared compliance dialog redesign is included. Source package requirements and dependency resolutions were preserved; only repository name, Node engine declaration and development scripts changed. No operational database or local encrypted credential file was copied or modified.

## Development corrections

Standard npm installation replaces the former vendored/offline bundle dependency. Compilation and database creation are separate. Demo bootstrap requires a new explicit database name and refuses an existing database; the lower-level schema loader remains documented as destructive.

Typed test fixtures now match current domain types; retired posture route assertions target redirects. Windows native tests use bounded concurrency and timeouts. The seed generator explicitly skips synthetic vulnerability injection for unclassified IP nodes. These changes establish a checkable baseline without changing the visible app.

## Documentation and retained material

The 13 feature specifications were aligned to current navigation and behavior. The duplicated combined specification became an index. Database schema, all numbered migrations through 026, data mapping descriptions, ERD, the CMDB contract and stakeholder design template remain. Architecture, UI, development, security, operations, ADRs and lifecycle rules were added. Generated inventories and source fingerprints support ongoing review.

Eight snapshot fixtures and current/reference JSON remain because import and regression tests use them; these are not an export of the live database. Internal compatibility source and APIs remain to avoid breaking existing contracts.

## Deliberate exclusions

Old history, duplicate demo apps, vendored packages/runtimes, credentials, logs, caches, build outputs, temporary reports and editor/agent-local state are excluded. node_modules and .next may be created locally for validation, but are ignored and are not repository content. Offline bundles can be produced separately by the delivery process.

[Machine-readable provenance](import-baseline.json) records the origin and fidelity check. [Validation evidence](validation.md) records checks for this baseline. Hosting, branch protection and production deployment remain separate configuration tasks.
