# ADR 0023: Proposed Tableau Dashboard Extension deployment

- Date: 2026-11-09
- Status: Proposed implementation; user-selected architectural direction

## Context

The user selected an on-premises Tableau Dashboard Extension, VizQL data reads, client PDF/XLSX generation, Tableau-managed evidence access and client feature mapping from externally maintained persona/AD tables. This supersedes the initial PDF's proposal for a third server-hosted evidence provider with local writable settings.

## Decision

Develop a third deployment target from shared TSAAT domain contracts, models and UI. Preserve current SQL/JSON deployments and their access/save behaviour. In the Tableau target, all shared configuration is read-only and externally published. Tableau enforces data authorisation; persona mapping controls presentation only.

Use individual viewer identity for VDS. A normal extension's parent session is not assumed to be a reusable VDS credential. The baseline includes a proposed platform SSO/query gateway, with no TSAAT evidence store, configuration writes or report generation. A strict zero-gateway deployment remains unproven and is a phase-0 feasibility gate. Cloud-only Data Apps capabilities are excluded.

Move report rendering to browser-safe code, retaining full report models and output contracts. Version persona definitions, group mappings and current-user memberships coherently. Fail closed for missing assignments in the extension; do not alter the existing SQL/JSON no-persona fallback.

## Consequences

This requires refactoring server-only loaders, server page/API composition, SQL-dependent calculations and Node-dependent XLSX code. It is not an implemented build flag or a static export of the existing application. Extend provider parity and offline release gates to Tableau during implementation. No schema, production access policy or runtime code changes are made by this ADR.

See the [solution design and transformation plan](../tableau-extension-solution-design.md) for contracts, migration phases, authentication conditions and acceptance evidence.
