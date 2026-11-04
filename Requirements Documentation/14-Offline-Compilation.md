# Offline compilation

## Mandatory behavior

Both SQL and JSON-backed No-SQL artifacts must remain installable and compilable on the supported Windows host without network access. Prove this for dependency/build changes and every release candidate; unrelated routine edits use the [SDLC impact assessment](../docs/sdlc.md) without mandatory fresh installation or both builds. A complete checkout includes all application/development/compiler dependency archives, source and assets. No prewarmed npm cache, existing installation, sibling folder or external dependency store may be required. Host Node/npm and Windows/PowerShell are provisioned beforehand.

## Release and dependency/build acceptance

1. npm ci --offline succeeds with an empty cache and no prior node_modules, installing the committed locked archives with lifecycle scripts disabled.
2. Missing, altered or remotely resolved archives fail verification with an actionable error. Both lockfile package representations agree with the provenance manifest.
3. npm run check and both production builds pass with Node outbound access denied. A caught build-time network request still fails the build. Remote fonts, code generation, CDN imports and compiler downloads may not be introduced.
4. The compiled No-SQL smoke passes with no SQL configuration/service. Existing JSON settings survive builds and restarts. SQL runtime retains its provider, direct access, TLS, scope/date and calculation behavior.
5. Dependency updates include reviewed archives, integrity/provenance, meaningful tests and affected documentation in the same change; CI and PR review require fresh offline evidence.
6. When the Next.js CLI is missing from an absent or partial installation, dev/start/build commands for either provider fail before JSON initialization or build setup and show `npm ci --offline` with the command to retry. They do not install packages automatically or change existing data.

No UI, API, schema, calculation, CMDB mapping or JSON format changes are introduced. See [implementation and maintenance](../docs/offline-builds.md), [ADR 0007](../docs/adr/0007-offline-compilation.md) and [data contracts](../docs/data-providers.md).
