## Problem and resulting behavior

Describe the trigger, previous behavior and result. Link acceptance criteria.

## Impact assessment (before selecting checks)

Mark each category Affected or Not affected and briefly explain. Reassess against the final diff.

| Category | Assessment and reason |
| --- | --- |
| UI/runtime behavior, reports and accessibility | |
| SQL/JSON data, structures, queries, rules, persistence and CMDB mappings | |
| Application access, scope/date and compatibility routes | |
| Documentation and generated inventories | |
| Dependencies, offline installation and builds | |
| Shared behavior, tooling/CI and release risk | |

## Selected validation and results

List the commands/manual checks actually run and their results. Explain omitted categories and any unavailable checks. Use the [SDLC matrix](../docs/sdlc.md); the full suite is not required for every PR.

- Focused tests, lint/types and relevant UI/keyboard/narrow-layout/PDF checks:
- Data/provider checks, both builds, No-SQL smoke and disposable-SQL parity, if affected:
- Documentation checks/regeneration, if affected:
- Offline integrity/fresh-install/full build evidence, for dependency/build changes or releases:
- CI assessment reviewed; validation:data, validation:docs or validation:full applied if broader coverage is needed:

## Documentation, data and release impact

State affected documentation, SQL migrations/JSON upgrade steps and rollout/recovery needs, or why none apply. No documentation-only edits are required for unchanged meaning. Existing JSON stores must survive builds/upgrades; seeds alone are not migrations. Do not include secrets, mutable stores or operational extracts.

Confirm shared provider compatibility, offline capability, the current application access model and scope/date contracts remain intact. Explain calculation-checksum changes if any; refresh only after equivalent behavior is verified.
