# Settings

Current contract: 2026-11-11. See [SDLC](../docs/sdlc.md) and [ADR 0028](../docs/adr/0028-read-only-settings.md).

Menu → Settings opens a native modal with four tabs in both SQL and No-SQL builds: Personas, Discovery Tools Settings, SPI Risk Matrix and SPI Priority Matrix. Personas is the default. Database Settings and the alternate JSON Data Files tab are removed. Old database/password tab bookmarks fall back to Personas; existing risk, priority and discovery links still select their tab. Opening, switching and closing preserves the workspace URL, header scope, security domains and selected snapshot. Escape/Close returns focus to the menu trigger; arrow keys and Home/End navigate the tabs.

## Personas

The ordered catalogue, names, sections, pages and popup permissions are read-only. Existing permissions remain visible as disabled checked/unchecked controls, including indeterminate sections. There are no add, rename, remove, enable/disable, save or discard controls.

Active persona selection remains enabled: choosing an existing persona changes this browser's view and updates the read-only header label. All sections (no persona) remains available. This is a browser-local preference and never changes saved configuration. Source-defined names/order, empty catalogues and removed-selection recovery remain supported. Menu and Settings stay accessible when all pages are hidden; direct URLs/APIs keep their existing access model.

WorkspaceTabs groups the permissions. Narrow/short screens use a native group selector and three-item Previous/Next pages. All saved permissions remain reachable; load/error/retry and no-persona explanations remain. See [Personas](../docs/personas.md) for stored contracts and maintenance.

## Discovery Tools Settings

Show saved coverage applicability for every tool and canonical asset type as Yes/No text and colour. Preserve the searchable tool-name filter, matching/empty states, saved timestamp and keyboard-accessible table scrolling. No coverage dropdowns, save or reset actions remain. Filtering is local and never changes stored mappings or calculation denominators.

## SPI matrices

Risk shows the saved severity label for every configured SPI/asset type; priority shows the saved configured priority label per SPI. Do not substitute an editable default for unknown or Data Gap values. Definitions still come from the shared data facade; unknown values remain visible and absent entries say Not configured. Tables scroll horizontally/vertically by keyboard on small screens. Both views include a read-only explanation and saved timestamp, with loading/error/retry/empty states. No selects, reset or save controls remain.

## API and storage contract

GET /api/settings/personas, /api/discovery-tools/settings and /api/measures/settings retain their shared-facade reads. PUT on all three returns 405, Allow: GET and a read-only error before parsing a body or invoking any provider writer. Rejection responses use Cache-Control: no-store. Legacy database GET/PUT and test-connection/test-schema/test-ssl POST routes return 410 without reading credentials, connecting or writing configuration. /api/settings/storage remains a read-only diagnostic endpoint.

Existing SQL revisions and JSON settings files remain authoritative. No stored schemas, defaults, timestamps, rules, mappings, snapshot history or calculation-contract checksums change. Builds never rewrite installed stores. Provider maintenance helpers remain available for controlled administration with existing backup/recovery rules; the browser cannot publish settings. Database setup remains the explicit [command-line workflow](../docs/database.md#one-command-database-setup).

## Validation

Cover all four read-only views, saved values, persona selection/reload, filters, empty/error/retry states, keyboard/focus and narrow layouts. Assert PUT rejection and retired database responses in both compiled builds; verify unchanged JSON settings after restart. SQL UI checks use GET fixtures, not a live SQL parity claim. See [validation record](../docs/validation.md).
