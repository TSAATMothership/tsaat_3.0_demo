# 0017: Dedicated SQL login and setup without SSL

Status: Accepted, 2026-11-06. Supersedes ADR 0016's setup authentication/TLS defaults at the user's explicit request. Advanced configuration and encrypted connection support remain available.

Existing-database validation-only behavior is superseded by [ADR 0018](0018-replace-database-during-setup.md), which adds explicitly acknowledged database replacement.

Presentation update, 2026-11-07: Database Settings removes TLS controls and its separate SSL test button. Saved policies remain intact and required encryption checks run within Test Connection; configuration-only tools and compatibility APIs retain TLS support.

## Decision

`npm run setup:database` collects an endpoint, application username/password and a separate administrator connection. Interactive setup targets TSAATDB. It uses SQL authentication with SSL disabled for the saved application connection; password input is hidden and confirmed. The administrator defaults to the current Windows identity, with SQL administrator credentials as an alternative. Both administrator and application connections disable SSL; setup does not change server-enforced encryption, authentication mode or services. SQL Server mixed mode and a sysadmin setup connection are prerequisites.

The administrator creates only a missing database through the existing guarded bootstrap. Schema/data validation precedes application-principal changes. Login/user creation and database-scoped grants share a transaction and a per-login application lock. The user gets reader/writer roles, execute access to the tsaat schema and database metadata visibility. It gets no server roles or database ownership. Password policy remains enabled; expiration is disabled for the application account.

An extended property on the database user identifies a setup-managed login, with the login SID checked on rerun. Existing unrelated logins are rejected; passwords are never reset and users are never remapped. Reruns authenticate the supplied app password before changing access. Login/user failures roll back together; incomplete databases and successfully provisioned logins remain available for explicit recovery. Existing schema/data is not rebuilt or reseeded. Only successful application-credential validation allows publication of encrypted DB_config. Administrator credentials never enter that file.

Runtime sqlcmd receives passwords in its child environment rather than process arguments. Automatic Windows fallback is opt-in, preventing a failed app login from silently executing as the host account. Unattended setup reuses existing SQL/no-SSL configuration but refuses implicit conversion of older Windows/SSL configurations. Direct configuration tools and the settings UI retain explicit TLS choices.

## Consequences and compatibility

The one-command setup now creates the requested login instead of requiring a pre-created SQL account. Transport encryption is disabled as requested; DPAPI still protects the stored configuration. An existing database needs no schema migration for the new login/user grants and marker. JSON stores and calculation contracts are unchanged; builds never provision SQL resources. Published migration files and bundled data remain unchanged.

The transaction relies on SQL Server's transactional [CREATE LOGIN behavior](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-login-transact-sql?view=sql-server-ver16). The managed marker uses a user-level [extended property](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-addextendedproperty-transact-sql?view=sql-server-ver16).

Validation includes prompt/orchestration/credential regressions, real disposable SQL provisioning and reruns, collision/password/rollback checks, application provider reads/writes as the new login, storage checks, both guarded builds and compiled No-SQL smoke. No dependencies or compiler configuration change, so fresh installation is not required for this change. See [database lifecycle](../database.md) and [validation records](../validation.md).
