# ADR 0028: Read-only application settings

- Status: Accepted
- Date: 2026-11-11
- Supersedes the browser editing portions of ADR 0015/0022 and Database Settings presentation in ADR 0017. Stored persona and CLI setup contracts remain.

## Context

The user requested removal of Database Settings and read-only Personas, Discovery Tools Settings, SPI Risk Matrix and SPI Priority Matrix.

## Decision

Expose the same four read-only tabs in both builds. Remove the database/JSON storage tab and its UI helpers. Keep persona selection as a browser-local view preference. Display saved permissions and mappings without edit/save/reset controls; retain search, scrolling, keyboard navigation and retry states.

Reject public settings PUT requests with 405 and Allow: GET, before parsing or calling storage. Retain retired database route shapes as 410 responses without credentials or SQL operations. Old database-tab links fall back to Personas. Keep CLI setup and provider maintenance functions intact.

Merely disabling inputs would leave public writes available. Deleting compatibility routes would lose explicit retirement responses. Freezing persona selection would prevent users choosing an existing saved view. These alternatives were rejected.

## Consequences and impact assessment

UI and API capabilities change in shared components. Scope/domain/date selection, direct-route access and reports remain unchanged. SQL/JSON reads continue through the facade. No schema, SQL query, provider write semantics, stored mapping, calculations, seed/evidence or migration changes are needed. Existing saved values and deliberate empty/unknown states remain authoritative.

Selected validation: focused read-only API/component tests; full source gate for shared persona/API retirement and deletion reachability; both guarded builds; compiled No-SQL smoke with rejected writes and unchanged settings after restart; SQL compiled UI with GET fixtures and real rejection endpoints; desktop/narrow/keyboard/error/empty checks. Live SQL parity is not selected because no provider semantics or data change; fixture-based UI validation is not parity. Report exports are unchanged but remain in the existing broad smoke. Dependencies/install/build tooling are unchanged, so fresh empty-cache installation and archive refresh are not selected. Routes and HTTP method inventory remain unchanged, so docs:check is selected without regeneration.

## Documentation

See [Settings](../../Requirements%20Documentation/11-Settings.md), [Personas](../personas.md), [architecture](../architecture.md), [UI design](../ui-design.md), [data providers](../data-providers.md), [database](../database.md) and [validation](../validation.md).

