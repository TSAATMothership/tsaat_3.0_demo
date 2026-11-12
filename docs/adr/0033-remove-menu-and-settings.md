# ADR 0033: Remove Menu and Settings

Status: Accepted. Date: 2026-11-12.

## Decision

Remove the header Menu, Settings modal, Personas permission viewer and Discovery Tools Settings viewer, including their exclusive components, styles and browser scenarios. The old `/settings` route uses the shared retired-feature response and preserves scope/domain/date in its return link. The UI-only `/api/discovery-tools/settings` GET/PUT route returns HTTP 410 without touching storage.

Settings previously contained the only persona selector. Move that existing selection to the header so users can change saved browser preferences, recover from empty permissions and choose All sections. Preserve loading, deleted-selection, empty-catalogue, retry and keyboard behavior. The persona API remains necessary for navigation; GET and its existing 405 write rejection remain unchanged.

## Data boundary

There is no feature-exclusive SQL table or JSON collection to remove: persona revisions still drive sidebar/link/popup preferences, while discovery applicability rules still drive Explorer/Insights coverage. Keep both common provider readers/writers, source data, history, migrations and calculation contracts. No new stored structure, upgrade or database reset is needed. Configuration maintenance remains separate from the application UI.

## Consequences

Menu/Settings can no longer be opened, including from bookmarks. The current login-free access model, scope controls, snapshots, retained reports and configurable discovery calculations are preserved. Header selection supersedes the Menu-only selection location in ADR 0015, and UI removal supersedes the retained viewer decision in ADR 0028. Their storage/access decisions remain applicable.

Validate retirement responses, header selection/recovery, scope/date/loading, mobile/keyboard navigation, retained CMDB/Topology/report interactions, both guarded compilations and documentation inventories. Provider parity and migrations are unnecessary because stored data and provider behavior are unchanged.
