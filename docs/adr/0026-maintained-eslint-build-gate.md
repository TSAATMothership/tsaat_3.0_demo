# ADR 0026: Maintained ESLint build gate

Status: Accepted. Date: 2026-11-10.

## Context

ESLint 8 and the Next 14 lint configuration retain deprecated inflight, humanwhocodes config/schema, rimraf 3 and glob 7/10 packages. ESLint 10 is the maintained major; the Next 14 embedded lint adapter uses removed APIs. Updating runtime Next/React is not required to replace development tooling.

## Decision

Pin ESLint 10.14.0 and eslint-config-next 16.4.6, vendor their complete locked graph and preserve original archive licenses/integrity/provenance. Use the Next configuration's plugin compatibility adapters with the existing peer-resolution policy. Adopt flat configuration and explicitly retain the two existing React Hooks rules for this React 18 application; React Compiler adoption and its additional diagnostics require a separate assessment. Preserve every previously enabled rule and TypeScript .mts/.cts declaration parsing.

Run scripts/lint.mjs for npm run lint and as a mandatory production-build preflight in scripts/run-app.mjs. Both provider builds execute lint under the same network guard before storage initialization or compilation. Missing tooling, lint failures or caught network attempts fail the build. Disable only Next's incompatible embedded lint adapter and retain compiler type checking. Direct invocation of Next bypasses repository safeguards and is not the supported build entry point.

Reject deprecation metadata during offline archive checks. Explicit connected refresh may restore an omitted legacy v2 source only from the exact current package location with matching version and SHA-512; ordinary offline verification remains strict.

## Alternatives and consequences

Suppressing npm warnings or overriding old transitive packages leaves an unsupported parent tool or risks incompatible APIs. ESLint 9 is also outside support as of this decision. Upgrading the entire application framework would expand runtime scope unnecessarily. The selected configuration uses a newer lint-only Next package while leaving runtime Next 14.2.35 and React 18.2.0 unchanged. Future upgrades must review compatibility and newly enabled rules again.

The new navigation diagnostic is resolved using native links for deliberate topology document navigation. Scope, mode, domains, dates and graph reset behavior remain intact. No SQL/JSON data, schema, calculations, access model or migration changes are introduced.

## Validation and affected documentation

Require meaningful lint-policy and preflight failure tests, topology link/keyboard regressions, fresh empty-cache guarded installation without deprecation warnings, full source checks, both guarded builds and compiled No-SQL smoke. Record actual results in [validation](../validation.md). See [development](../development.md), [offline builds](../offline-builds.md), [architecture](../architecture.md) and [offline acceptance](../../Requirements%20Documentation/14-Offline-Compilation.md).

Maintenance references: [ESLint support policy](https://eslint.org/version-support/), [ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0) and [Next lint configuration](https://nextjs.org/docs/app/api-reference/config/eslint).
