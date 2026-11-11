# 0030: Reuse a verified SQL login during database replacement

Status: Accepted, 2026-11-12, following the request to replace an existing database when its selected application login already exists. Supersedes the marker-only reuse restriction in ADRs 0017 and 0018 for replacement preflight.

## Decision

When the selected database exists, `setup:database` may reuse the supplied existing SQL login even if the database user or `TSAAT_SETUP_LOGIN` marker is absent. This covers older installations and a failed replacement that imported data but stopped before reattaching the login. The administrator must still be a sysadmin, the login must use SQL authentication without server-role membership, and its supplied password must authenticate before any deletion.

The read-only preflight captures the login SID and verifies it against the authenticated connection. The existing exact database-name acknowledgement and database identity check still precede deletion. Reattachment accepts only that verified SID and rejects a deleted or replaced server principal, including when a setup marker is present. The new database user receives the existing reader/writer, schema EXECUTE and database VIEW DEFINITION grants and the setup marker. Conflicting users are not remapped.

The server login is reused, not recreated: its SID, password, server permissions and other database mappings are preserved. No password reset, server-role grant, login deletion or transport-policy change is introduced. A missing database does not enable unmarked-login reuse; existing managed-login and new-login paths retain their guards. The preflight exception cannot be used directly for user creation.

## Validation and recovery

Use disposable SQL targets to test unmarked/unmapped login reuse, credential failure before deletion, role rejection, missing-target refusal, authenticated SID preservation, conflicting-user rollback, other-database preservation and removed/replaced-login refusal. Run the full acknowledged replacement flow and application-login validation with an isolated DB_config. Unit orchestration checks retain cancellation and exact acknowledgement coverage.

Application data, snapshots, SQL/JSON schema and provider queries are unchanged. No SQL migration, JSON upgrade, checksum refresh or dependency change is needed. A failed bootstrap can still leave a partial database; retry replacement with the same valid login/password and exact target acknowledgement. Restoring lost data still requires the operator's backup. See [database lifecycle](../database.md) and [validation evidence](../validation.md).
