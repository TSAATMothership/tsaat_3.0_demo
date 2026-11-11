# Personas

Personas are shared navigation preferences, not authentication or authorization. Menu → Settings → Personas displays the active SQL or JSON configuration read-only. All sections (no persona) enables the retained workspace; direct page/API/export access remains available. Scope, security domain and selected snapshot are independent.

The browser stores only the selected stable persona ID. Stored names and ordering drive the selector. Removal of a selected ID resets to All sections. Refresh/focus reload settings except during a modal; failed loads preserve the last configuration, expose Retry and allow recovery. Empty catalogues and explicit empty permissions stay empty.

## Storage and permissions

Payload schema version 3 contains updatedAt and ordered personas with id, label, sections, pages and popups. IDs, unique labels, supported permissions and duplicates are validated. Unicode/literal punctuation round-trip through both providers. The shared bootstrap catalogue retains five named roles, including Life Cycle Management and Business Reporting as role labels, with only retained permissions.

Governance and Discovery are the only sections. Three Insights and five Explorers remain visible. Installed Software Dashboard retains its bookmark permission without a sidebar entry. CMDB and Topology popup permissions remain. Known retired permission IDs are removed by the shared parser and both storage upgrades; unrelated unknown IDs and duplicates still fail validation. Existing explicit lists never gain replacement permissions.

SQL stores complete revisions in tsaat.persona_settings_version; JSON storage v2 uses settings/personas.json and history. Maintenance writes retain optimistic timestamps, transaction/writer-lock protection and atomic publication. Public PUT returns 405 with Allow: GET before parsing or writing. GET uses the provider facade and sanitized errors, with no caching.

## Upgrade and recovery

Follow [inventory v2 upgrade](feature-retirement.md): SQL 033 and the JSON migration prune retired IDs from every saved revision while preserving IDs, labels, order, timestamps and retained selections. The parser still supports valid legacy payload versions in memory. Reads and builds do not publish settings revisions. Controlled later changes must validate the whole payload, use backup/revision safeguards and a new UTC updatedAt; changing bootstrap JSON does not update installed settings.

Restore the matching pre-upgrade application and complete database/store backup for rollback. Browser selection is separate and can be reset to All sections. See [read-only decision](adr/0028-read-only-settings.md) and [retirement decision](adr/0029-retire-analytics-features.md).

## Validation

Parser/provider tests cover dynamic catalogues, legacy permissions, empty selections, errors, concurrency, UTF-8 and revision history. Compiled smoke checks exercise keyboard/mobile/filter/reload and read-only API behavior. Real SQL persona parity requires an explicitly disposable TSAAT_PersonaParity_* or TSAAT_EvidenceParity_* database; select TSAAT_PERSONA_PARITY_SERVER and TSAAT_PERSONA_PARITY_DATABASE before running tests/personas-sql-parity.test.ts. Strict TLS is default. Test-only trust/SSL overrides require explicit selection and never modify saved application policy. A skip is not parity evidence.
