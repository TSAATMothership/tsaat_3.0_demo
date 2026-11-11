# Personas

Personas are shared, data-driven navigation preferences. Menu → Settings → Personas reads the active SQL or No-SQL source and displays their saved configuration read-only. The selector and read-only header use stored names and order. The browser remembers a stable selected ID; it does not own the shared configuration.

These preferences preserve the login-free application model. They control sidebar visibility, internal links and popup actions, not authorization to directly entered URLs, APIs or reports. Scope, security domains, snapshot dates and configurable measures remain independent.

## Select and view a persona

Menu → Settings → Personas displays the saved catalogue read-only. Select an existing persona to use its view and inspect its saved name, sections, pages and popups. Add, rename, remove, permission toggles, save and discard actions are removed. All sections (no persona) remains available and enables every page and popup. An intentionally empty catalogue never restores defaults.

Selection lives only in this browser; the header shows the saved active name before Security Domain. Sessions refresh settings on page load/window focus except while a modal is open. A removed active ID resets to All sections and clears browser storage. Load failure retains the last known configuration or explicitly falls back to all enabled if none loaded, with Retry. Browser-storage failure still allows selection for the current visit.

WorkspaceTabs groups disabled permission indicators. Narrow/short screens use a native group selector and three-item Previous/Next pages. Keyboard navigation, Escape/focus return, empty states and natural overflow remain. Section indicators show a mixed state for partial selections. Both section and page must permit a destination. Explicit empty permission lists remain empty; new pages are not silently granted.

Internal links share the sidebar destination mapping, including compatibility and new-tab URLs. Unavailable destinations have no href/action. Independent popup permissions still control their actions and render guards. Direct URLs, APIs and report downloads remain unrestricted by persona; Menu/Settings always remain available for recovery.

## Stored contract and defaults

`GET /api/settings/personas` uses `lib/data-loader.ts`. Payload schema version 3 contains `updatedAt` and an ordered `personas` array. Every entry has `id`, `label`, `sections`, `pages` and `popups`. IDs match `^[a-z][a-z0-9-]{0,63}$` and are unique. Labels are trimmed and unique ignoring case. Permission arrays contain unique supported IDs. Unicode and literal punctuation round-trip through both providers.

The shared [bootstrap configuration](../Database%20Schema/data/personas.json) contains Analyst, Life Cycle Management, Configuration Management, DSOC Analyst and Business Reporting with explicit enabled permissions. Fresh SQL loading and JSON initialization seed this same file. Existing stores are never replaced by initialization/builds. A legacy store without a persona file, or an SQL table with no revision, uses these defaults in memory until an explicit save. An intentionally empty version-3 catalogue never restores defaults.

SQL appends complete JSON revisions to `tsaat.persona_settings_version` and reads the latest revision ID. Migration 031 already provides this storage; version 3 needs no new DDL. Saves compare `updatedAt` within a transaction using update/range locks, then append a monotonically newer UTC timestamp. JSON store schema stays at version 1: `settings/personas.json` holds the same payload, with comparison under the existing writer lock before history/atomic publication. Conflicts write neither a revision nor a history file. These maintenance writer guarantees remain intact. The public PUT endpoint now returns 405 with Allow: GET before invoking a writer, including for malformed or old payloads. Unavailable/corrupt storage returns a sanitized GET error; responses are not cached.

For changes outside Settings, preserve stable IDs, validate the full schema and publish a new UTC `updatedAt`; array order controls selector order. Public API writes are disabled. Use controlled provider maintenance with a backup and the existing validation/revision safeguards. SQL maintenance should append a new complete revision; JSON maintenance must stop writers and follow [backup/recovery](data-providers.md). Editing bootstrap data does not update an installed catalogue.

The SQL adapter uses UTF-8 input/output files in its temporary query directory and disables sqlcmd variable substitution. Names such as `Reviewer's café $(literal)` remain data. Query files/results are removed after execution; output limits, credentials, certificate policy and retry behavior are preserved.

## Persistence and upgrades

Back up the selected SQL database or complete JSON store before deployment. Update all app instances and refresh browser tabs. Version-1/2 configurations load as version 3 in memory, preserving timestamps and existing selections and adding original labels. Reads, builds and initialization never rewrite existing settings. Read-only Settings does not publish an upgraded revision. Controlled maintenance can append a validated version-3 SQL revision or publish JSON/history using the existing writer. All public PUT requests receive 405, including older clients.

SQL requires [migration 031](../Database%20Schema/migrations/031_persona_navigation_settings.sql). If absent, apply only that missing forward migration after its approved prerequisites to the explicitly chosen backed-up database, retaining its certificate policy. Never apply base schema/seed loaders to operational data. Missing storage produces a load error with Retry. No new SQL migration or bulk JSON upgrade is needed for this change.

For rollback, restore a compatible pre-upgrade configuration or backup with its matching application. Older apps cannot read custom version-3 IDs/names or removals. For JSON recovery, stop writers and restore a validated compatible history revision or full backup. Preserve SQL history; restore through controlled provider maintenance with a validated complete revision. Browser selection is separate from server backups and can be reset using All sections.

### Version 2 upgrade

Version 1 contained only section gates: the in-memory upgrade enables current pages of enabled sections and all popups, retaining its former behavior. Version 2 already has explicit pages/popups and retains those selections, including empty lists. Missing fields, duplicate and unknown IDs remain errors. Legacy conversion now returns version 3 with names; no write occurs on read.

### Business Reporting

Valid version-1/2 configurations with exactly the original four personas receive all-enabled Business Reporting in memory. Existing Business Reporting selections are never refilled. Missing original legacy personas remain invalid. Version 3 requires none of the original IDs: maintained catalogues may rename/remove any bootstrap entry without it reappearing.

### Retired Governance Overview

The parser accepts and discards only the retired `governance-overview` page ID. Other selections stay unchanged; an Overview-only selection becomes empty and never grants Trends. Duplicate retired IDs and other unknown IDs fail. Its compatibility URL maps to the Trends permission.

Discovery Insights retains `discovery-overview` under Governance; both the page and section must be enabled. Installed Software Dashboard retains `discovery-software-insights` for bookmarked-route compatibility, with no sidebar entry. The Governance briefing uses `governance-software-insights`. End Point Insights, Security Vulnerability Insights, Topology Explorer and Measures Trends retain their existing IDs. Defaults never silently grant these pages to already saved explicit lists.

## Validation

The read-only UI/API change is recorded in [ADR 0028](adr/0028-read-only-settings.md) and the current validation record. Earlier persistence validation below remains historical evidence for the unchanged storage implementation.

See [current validation](validation.md#data-driven-persona-catalogue---2026-11-08) and [ADR 0022](adr/0022-data-driven-personas.md). Checks cover dynamic IDs/names/order, empty catalogues, parser/API failures, legacy preservation, concurrent writes, both real providers, UTF-8 transport, keyboard/mobile/error/reload behavior and restart persistence. Both builds, storage/evidence and the compiled No-SQL smoke are required for this persistence change.

Live SQL parity uses a freshly provisioned disposable `TSAAT_PersonaParity_*` database. Set `TSAAT_PERSONA_PARITY_SERVER` and `TSAAT_PERSONA_PARITY_DATABASE`, then run `npm test -- tests/personas-sql-parity.test.ts`. It replaces persona revisions in that disposable target, compares isolated JSON behavior and restores bootstrap personas afterwards. Strict TLS is the default; `TSAAT_PERSONA_PARITY_TRUST_CERTIFICATE=true` is an explicit local test exception. A skipped test is not parity evidence.

Inventory data, snapshots, rules, CMDB mappings and calculation-contract checksums are unchanged. No dependency refresh or fresh installation is required; both builds retain offline guards.
