# Settings retirement

The header Menu and Settings feature are removed. This includes the Personas configuration viewer, Discovery Tools Settings viewer, Settings tabs, modal and exclusive styles. Neither compilation offers a Settings entry point.

Existing /settings bookmarks, including old settingsTab values, show the shared retired-feature page. Its End Point Explorer return link preserves network/system scope, security domains and snapshot date. It completes route-loading readiness and never opens a Settings modal. GET and PUT /api/discovery-tools/settings return uncached HTTP 410 without loading or saving rules. Earlier database/password/matrix compatibility APIs stay retired.

The existing persona selector moves into the header. All sections, stored labels/order, browser-local selection, reload persistence, empty permissions and retry recovery remain available. GET /api/settings/personas remains a navigation dependency; its public PUT still returns HTTP 405 with Allow: GET. Selecting a persona does not modify shared definitions, navigate, or change scope/date.

No SQL or JSON data is exclusive to these viewers: persona revisions still drive navigation and popup preferences; discovery applicability rules still drive retained coverage calculations. Their provider readers/writers, source bundle, schemas, history and maintenance safeguards are unchanged. No migration, JSON upgrade or reset is required. SQL connection setup remains a separate maintenance command with encrypted configuration and the selected transport policy.

See [Personas](../docs/personas.md), [ADR 0033](../docs/adr/0033-remove-menu-and-settings.md) and [validation](../docs/validation.md).
