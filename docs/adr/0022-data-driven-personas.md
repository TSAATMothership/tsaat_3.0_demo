# ADR 0022: Data-driven persona catalogue

Status: Accepted, 2026-11-08

## Context

Permissions already persist in SQL/JSON, but the fixed TypeScript persona list prevents managing names and entries. Settings must publish the same complete catalogue to either source, preserve legacy selections and avoid overwriting another editor.

## Decision

Use persona payload version 3 with stable IDs, labels, ordered entries and existing permission arrays. Permit zero to 50 personas. Add, rename and remove are reversible drafts until saved; new entries have no permissions. Capabilities remain app-defined and preferences remain independent of authorization.

Both fresh setups consume `Database Schema/data/personas.json`. Version-1/2 settings upgrade in memory, then publish on explicit save. SQL migration 031 and JSON store version 1 need no new structural migration; builds never reseed existing stores.

Compare `updatedAt` within SQL's locked transaction or JSON's writer lock before publishing. Stale saves return 409 and retain the draft for explicit reload. Removed active IDs reset to no persona. UTF-8 sqlcmd input/output files and disabled variable substitution preserve names as literals.

## Consequences

Selector/header names and order come from the active source. Renames preserve selection; removed defaults stay removed. External maintenance must publish a fresh timestamp. Deploy all instances together; rollback needs compatible configuration backups. No new tables, operational reseeding, scope/rule changes or dependencies are required.

This supersedes the fixed catalogue and last-successful-save-wins portions of [ADR 0015](0015-persona-navigation-preferences.md); its access and independent popup decisions remain. See [Personas](../personas.md) and [validation](../validation.md#data-driven-persona-catalogue---2026-11-08).
