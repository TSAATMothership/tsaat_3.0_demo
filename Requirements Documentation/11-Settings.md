# Settings

Menu → Settings contains two keyboard-accessible tabs: Personas and Discovery Tools Settings. Both display the stored configuration read-only. The active persona can still be selected locally; persona definitions and tool applicability cannot be edited in the application. Loading, retry, empty-catalogue, focus-return and narrow-screen states remain supported.

Database Settings and its APIs remain retired. SPI Risk Matrix and SPI Priority Matrix are now retired with Observed Measures. Old settingsTab values select Personas. Measures settings APIs return HTTP 410. The retained Personas and Discovery Tools PUT endpoints return HTTP 405 with Allow: GET before reading or writing storage.

Saved persona IDs, names, ordering and revision times remain unchanged by retirement. Only permissions for retired sections, pages and popups are removed. No retained page is automatically granted as a replacement. CMDB Details is the remaining popup permission.

See [Personas](../docs/personas.md) and [paired upgrades](../docs/feature-retirement.md). SQL connection setup remains a separate maintenance command with the existing encrypted configuration and transport policy.
