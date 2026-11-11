# 0018: Replace an existing database during explicit setup

Status: Accepted, 2026-11-06. Supersedes ADR 0017's existing-database validation-only behavior at the user's explicit request.

The marker-only login reuse restriction is superseded by [ADR 0030](0030-reuse-login-for-database-replacement.md). Exact-target acknowledgement, identity checks and login/password preservation remain required.

## Decision

`npm run setup:database` rebuilds the selected application database if it already exists. Interactive setup targets TSAATDB and displays the server, database, permanent data/settings loss, active-session disconnection and lack of automatic backup. The user types the exact database name to continue. Unattended replacement requires `TSAAT_DB_REPLACE_EXISTING` equal to the target name in addition to the existing unattended configuration; assume-yes alone is insufficient. System databases are refused.

Setup checks prerequisites, administrator access and application-login ownership/password before deletion. It records the database ID/creation timestamp and rechecks that identity before issuing DROP from master. SINGLE_USER WITH ROLLBACK IMMEDIATE disconnects active sessions; a drop failure attempts to restore MULTI_USER on that same identity. The lower-level bootstrap retains its missing-database guard, so a concurrently created database is not seeded or overwritten.

A setup-managed server login is preserved. Its verified SID is carried only through the current setup run and checked again before attaching it to the replacement database. No server login is dropped, password reset or conflicting database user remapped. The normal schema/migrations/reference/eight-snapshot bootstrap and app-login validation run before DB_config publication. Existing config remains unchanged if setup fails.

## Consequences and recovery

Replacement permanently discards the target's current data and saved settings. DROP plus bootstrap is not atomic; a failed build cannot restore removed data. Users needing recovery must make their own backup before confirming and restore it explicitly. A failed replacement can leave a partial database and an unmapped preserved login; choose a new app username or have the administrator resolve that retained login before retrying.

Only explicit setup gains this reset behavior. Application builds, the settings UI, lower-level bootstrap and JSON initialization retain their prior boundaries. No schema definitions, published migrations, bundled data, provider queries, calculations or JSON formats change. No SQL migration, JSON upgrade or checksum refresh is needed.

Validation covers interactive/unattended cancellation and acknowledgement, deletion/build failure ordering, retained config, login reattachment, system/identity guards, and live create/replace on a disposable database with a sentinel table and active connection. Storage checks, both guarded builds and compiled No-SQL smoke verify compatibility. No dependency or compiler changes require a fresh installation. See [database lifecycle](../database.md) and [validation](../validation.md).
