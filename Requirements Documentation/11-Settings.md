# Settings

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Menu → Settings opens a native modal above the workspace. Settings sizing is shared by expanded charts and the asset compliance view. Close/Escape returns to the workspace; local tabs do not discard its applied scope/date.

SPI Risk Matrix and SPI Priority Matrix are sibling tabs. Risk mapping is by configured SPI and canonical asset type; priority mapping is by SPI and configured priority rank. Saved settings are persisted in versioned SQL settings tables and influence subsequent app evaluation through version-aware cache signatures. They are not presentation-only selections. Discovery Tool settings define source metadata, ownership and per-type applicability.

Database Settings reads/writes encrypted DB_config and supports connection/schema/TLS diagnostics. Application Password Settings is retired; old settingsTab=password-settings links fall back to the storage tab. Masked or unchanged secrets must not be accidentally overwritten with placeholders. Diagnostics must not disclose passwords. Configuration helpers support local setup under the Windows identity.

Settings does not authorize destructive schema rebuilds or demo imports. Source: components/settings-popup.tsx, settings-tabs.tsx, spi-risk-settings-popup.tsx and settings forms; lib/measures-settings.ts, discovery-tools-settings.ts, db-config.ts and related APIs. Tests cover priority/risk settings behavior, password handling, SQL TLS, DB config and retired-login compatibility. Verify save/reopen and subsequent scoped results, not just successful toast text.

Database schema diagnostics require the current 66-table contract after migration 027; they no longer require the unused KPI parameter table or network apm_number. Risk/priority settings and version tables are retained.

## SQL and No-SQL build settings

Both builds use the same Settings dialog, SPI risk/priority matrices and discovery applicability editor. SQL retains Database Settings and strict TLS. No-SQL replaces that tab with JSON Data Files, showing the configured server directory and available snapshots; SQL configuration/test APIs return 409 in that build.

No-SQL saves settings to JSON files on the server, using atomic replacement and a writer lock. Changes affect subsequent calculations, are shared by browser sessions and survive app restarts. Initialization and recompilation retain existing settings. Verify save/reopen, changed findings and restart persistence using the compiled No-SQL smoke. See [storage contracts](../docs/data-providers.md).
