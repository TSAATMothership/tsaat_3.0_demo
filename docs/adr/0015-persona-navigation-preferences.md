# ADR 0015: Persona navigation preferences

The Menu-only selection location is superseded by [ADR 0033](0033-remove-menu-and-settings.md): Menu and Settings are retired, and the existing persona selection moves to the header.

The fixed catalogue and last-successful-save-wins decisions below are superseded by [ADR 0022](0022-data-driven-personas.md). The visibility-only access model and independent page/popup controls remain current.

Catalogue extension: add Business Reporting with the same all-enabled defaults. Read the original four-persona catalogues by adding only this new entry in memory; reject missing original personas. Require all five entries on writes so stale clients cannot reset the new configuration. Retain payload version 2 and migration 031 because the representation is unchanged; explicit save alone publishes the expanded catalogue. Deployment/rollback guidance is in [Personas](../personas.md#business-reporting).

Date: 2026-11-05. Status: accepted.

Follow-up decision: extend the navigation catalogue with stable page IDs and persist schema-version-2 page and popup selections. Parent sections select their child pages, and one destination resolver applies the same preferences to sidebar links and drill-throughs, including query-selected views and compatibility URLs. Popup switches are independent, as explicitly requested; shared disabled buttons plus guarded render/action paths cover detail dialogs and chart actions. Settings/filter/loading controls remain available. Version-1 settings expand their enabled sections to pages in memory with all popups enabled; only an explicit Save publishes version 2. Existing JSON revision storage needs no further table migration. Direct URL/API access and the no-login model remain unchanged. See the current [behavior and upgrade contract](../personas.md).

The requested Personas feature defines section visibility for four roles, while the app deliberately has no user identities or application login. The user confirmed self-selection of a persona to filter the sidebar.

Keep server-shared visibility configurations and a browser-local active selection. Selection and configuration live exclusively in Menu → Settings → Personas, as requested in the follow-up; the sidebar has no persona selector. Default every persona to all existing sections and retain an explicit no-persona option. Apply the section filter before the existing per-item scope filter. Keep Menu/Settings available, including with no visible sections. Changing persona does not navigate away from the current page or change its scope/date. This is a presentation preference and introduces no access restrictions, identity claims or credential storage.

Expose settings through the shared data facade and one no-cache GET/PUT API. SQL appends complete JSON revisions in an additive table introduced by migration 031. JSON uses an optional versioned settings file plus the existing atomic writer/history pattern. Both use one strict parser and last-successful-save-wins full replacements. Missing optional JSON files read defaults without mutating existing stores; invalid files fail explicitly. SQL needs the forward migration before settings can be loaded/saved. Calculations and their caches remain independent of these preferences.

This avoids coupling navigation to snapshot data or reintroducing the retired authentication system. If enforceable roles or assignments are requested later, they require a separate identity and authorization design; hiding navigation is not a security boundary. See [feature, upgrade and validation contract](../personas.md).
