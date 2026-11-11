# Personas

Personas are shared, data-driven navigation preferences. Menu → Settings → Personas reads the active SQL or No-SQL source and lets users add, rename, remove and configure personas. The selector and read-only header use stored names and order. The browser remembers a stable selected ID; it does not own the shared configuration.

These preferences preserve the login-free application model. They control sidebar visibility, internal links and popup actions, not authorization to directly entered URLs, APIs or reports. Scope, security domains, snapshot dates and configurable measures remain independent.

## Manage the catalogue

Select a persona to edit its name, sections, pages and popups. Add persona creates a draft with a unique stable ID and no enabled permissions. Names must be unique ignoring case, nonblank and at most 80 characters. Up to 50 personas are supported. Renaming retains the ID, permissions and browser selection. Remove persona changes the draft; Discard changes reverses it until saved. The catalogue may be empty; All sections (no persona) remains available and enables all pages and popups.

Save personas publishes all pending additions, removals, names and permissions to the active provider. Drafts survive persona, permission-group and Settings-tab switches; closing Settings discards them. Failed saves retain drafts for retry. A stale revision returns a conflict without writing; Reload saved personas discards the draft and loads the current source. Save remains disabled until that conflict is resolved. When the active persona has been removed, the browser resets to All sections, announces the change and clears its stored ID.

Selection lives exclusively in Settings; the header shows the saved active name immediately before Security Domain. Selecting an existing persona changes browser selection immediately; a new draft becomes active after successful save. Sessions refresh saved settings on page load/window focus, except while a modal is open. Load failures retain the last known configuration, or explicitly use all-enabled behavior when none has loaded. Saves are disabled while the source is unavailable. Browser-storage failure leaves selection working for the current visit.

The compact editor uses WorkspaceTabs and a permission grid. Narrow/short screens use a native group selector and three-item Previous/Next pages. Every permission and Save/Discard stays reachable at normal desktop, laptop and phone sizes; exceptionally short windows, enlarged text and long errors retain natural overflow. Native keyboard controls, Escape and modal focus return remain.

## Sections, pages and popup controls

The app defines valid capabilities; the source defines personas and selections. A section checkbox selects/clears every child page, including other permission pages, and shows a mixed state for partial selection. Both section and page must permit a destination. Clearing the last page hides its section. Show all/Hide all affects the selected persona's pages and popups. Saved empty lists stay empty; future pages are not silently added to explicit version-2/3 lists.

Internal links share the sidebar destination mapping, including scope/filter URLs, compatibility aliases and new-tab links. Disabled destinations are labelled and have no href/action. Entity-detail destinations also require their popup switch. Scope/date parameters do not alter page identity. Menu and Settings always remain available for recovery.

Popup switches are independent of sidebar pages. They cover CMDB, network/ICT-system details, KPI/SPI scope details, expanded risk trends, Service Impact Topology, impact findings/CIs, finding drill-through lists, affected CIs, high-risk CVEs, asset compliance and discovery tool asset details. Native disabled actions and render guards also cover nested dialogs. Settings, filters, loading dialogs, inline expanders and report downloads are unrestricted.

## Stored contract and defaults

`GET/PUT /api/settings/personas` uses `lib/data-loader.ts`. Payload schema version 3 contains `updatedAt` and an ordered `personas` array. Every entry has `id`, `label`, `sections`, `pages` and `popups`. IDs match `^[a-z][a-z0-9-]{0,63}$` and are unique. Labels are trimmed and unique ignoring case. Permission arrays contain unique supported IDs. Unicode and literal punctuation round-trip through both providers.

The shared [bootstrap configuration](../Database%20Schema/data/personas.json) contains Analyst, Life Cycle Management, Configuration Management, DSOC Analyst and Business Reporting with explicit enabled permissions. Fresh SQL loading and JSON initialization seed this same file. Existing stores are never replaced by initialization/builds. A legacy store without a persona file, or an SQL table with no revision, uses these defaults in memory until an explicit save. An intentionally empty version-3 catalogue never restores defaults.

SQL appends complete JSON revisions to `tsaat.persona_settings_version` and reads the latest revision ID. Migration 031 already provides this storage; version 3 needs no new DDL. Saves compare `updatedAt` within a transaction using update/range locks, then append a monotonically newer UTC timestamp. JSON store schema stays at version 1: `settings/personas.json` holds the same payload, with comparison under the existing writer lock before history/atomic publication. Conflicts write neither a revision nor a history file. Invalid updates return 400, stale updates 409, unavailable/corrupt storage a sanitized 500. Responses are not cached.

For changes outside Settings, preserve stable IDs, validate the full schema and publish a new UTC `updatedAt`; array order controls selector order. Prefer the API read/edit/save flow. SQL maintenance should append a new complete revision; JSON maintenance must stop writers and follow [backup/recovery](data-providers.md). Editing bootstrap data does not update an installed catalogue.

The SQL adapter uses UTF-8 input/output files in its temporary query directory and disables sqlcmd variable substitution. Names such as `Reviewer's café $(literal)` remain data. Query files/results are removed after execution; output limits, credentials, certificate policy and retry behavior are preserved.

## Persistence and upgrades

Back up the selected SQL database or complete JSON store before deployment. Update all app instances and refresh browser tabs. Version-1/2 configurations load as version 3 in memory, preserving timestamps and existing selections and adding original labels. Reads, builds and initialization never rewrite existing settings. The next explicit Save personas appends a version-3 SQL revision or atomically publishes JSON/history. Old clients attempting version-1/2 writes receive 400 and must reload.

SQL requires [migration 031](../Database%20Schema/migrations/031_persona_navigation_settings.sql). If absent, apply only that missing forward migration after its approved prerequisites to the explicitly chosen backed-up database, retaining its certificate policy. Never apply base schema/seed loaders to operational data. Missing storage produces a load/save error with Retry. No new SQL migration or bulk JSON upgrade is needed for this change.

For rollback, restore a compatible pre-upgrade configuration or backup with its matching application. Older apps cannot read custom version-3 IDs/names or removals. For JSON recovery, stop writers and restore a validated compatible history revision or full backup. Preserve SQL history; restore through current Settings/API where possible. Browser selection is separate from server backups and can be reset using All sections.

### Version 2 upgrade

Version 1 contained only section gates: the in-memory upgrade enables current pages of enabled sections and all popups, retaining its former behavior. Version 2 already has explicit pages/popups and retains those selections, including empty lists. Missing fields, duplicate and unknown IDs remain errors. Legacy conversion now returns version 3 with names; no write occurs on read.

### Business Reporting

Valid version-1/2 configurations with exactly the original four personas receive all-enabled Business Reporting in memory. Existing Business Reporting selections are never refilled. Missing original legacy personas remain invalid. Version 3 requires none of the original IDs: users may rename/remove any bootstrap entry without it reappearing.

### Retired Governance Overview

The parser accepts and discards only the retired `governance-overview` page ID. Other selections stay unchanged; an Overview-only selection becomes empty and never grants Trends. Duplicate retired IDs and other unknown IDs fail. Its compatibility URL maps to the Trends permission.

Discovery Insights retains `discovery-overview` under Governance; both the page and section must be enabled. Installed Software Dashboard retains `discovery-software-insights` for bookmarked-route compatibility, with no sidebar entry. The Governance briefing uses `governance-software-insights`. End Point Insights, Security Vulnerability Insights, Topology Explorer and Measures Trends retain their existing IDs. Defaults never silently grant these pages to already saved explicit lists.

## Validation

See [current validation](validation.md#data-driven-persona-catalogue---2026-11-08) and [ADR 0022](adr/0022-data-driven-personas.md). Checks cover dynamic IDs/names/order, empty catalogues, parser/API failures, legacy preservation, concurrent writes, both real providers, UTF-8 transport, keyboard/mobile/error/reload behavior and restart persistence. Both builds, storage/evidence and the compiled No-SQL smoke are required for this persistence change.

Live SQL parity uses a freshly provisioned disposable `TSAAT_PersonaParity_*` database. Set `TSAAT_PERSONA_PARITY_SERVER` and `TSAAT_PERSONA_PARITY_DATABASE`, then run `npm test -- tests/personas-sql-parity.test.ts`. It replaces persona revisions in that disposable target, compares isolated JSON behavior and restores bootstrap personas afterwards. Strict TLS is the default; `TSAAT_PERSONA_PARITY_TRUST_CERTIFICATE=true` is an explicit local test exception. A skipped test is not parity evidence.

Inventory data, snapshots, rules, CMDB mappings and calculation-contract checksums are unchanged. No dependency refresh or fresh installation is required; both builds retain offline guards.
