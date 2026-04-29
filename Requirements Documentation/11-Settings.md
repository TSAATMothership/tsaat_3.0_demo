# Settings

**Page Path:** `/settings`

## 1. Page Overview
- **Page name:** Settings
- **Purpose:** provide application-level configuration controls for database connectivity and file-backed authentication password lifecycle.
- **User outcome:** the user can validate and save database connectivity/SSL settings, and can change the current `logindetails` application password from the dedicated password settings tab.
- **Primary user roles:** application administrators, support teams, deployment engineers, maintainers.

## 2. Page Summary
This page provides `database-settings`, `password-settings`, and `placeholder-2` tabs.

Major dependencies:

- `loadDatabaseSettingsDefaults()`
- `DatabaseSettingsPanel`
- `SettingsTabs`
- `/api/settings/database/test-connection`
- `/api/settings/database/test-ssl`
- `/api/settings/database/test-schema`
- `/api/settings/database`
- `/api/settings/password`
- `DB_config`
- `logindetails`
- `scripts/ensure-db-config.ps1`
- `canSaveDatabaseSettings()`
- `buildSqlcmdSecurityArgs()`

Important hidden behaviour:

- database settings are persisted to encrypted local, git-ignored `DB_config` envelope file, not to the SQL Server database.
- when encrypted `DB_config` is missing, UI defaults resolve to fallback server/database values and SSL disabled.
- offline scripts run `scripts/ensure-db-config.ps1` before database build or compile: interactive runs confirm/change saved values, create missing files, or recreate files that cannot be decrypted by the current Windows identity; noninteractive runs accept a valid existing file or create/recreate one from `TSAAT_DB_CONFIG_ASSUME_YES=true` plus complete `TSAAT_SQL_*` values.
- schema validation checks for required tables, required columns, and that `tsaat.dataset_snapshot` contains at least one row.
- save remains disabled until required validation tests succeed:
  - SSL disabled: connection test + schema test
  - SSL enabled: connection test + SSL test + schema test
- any edit to server, database, auth mode, credentials, SSL toggle, or SSL type clears prior test status.
- save API re-validates connection, SSL (when enabled), and schema before writing encrypted `DB_config`.
- runtime and offline scripts decrypt/read confirmed settings from `DB_config` and apply SQL auth plus `sqlcmd` security flags (`-N`, `-C`) consistently; offline scripts stage bundled `sqlcmd` from `Dependencies/offline-artifacts/sqlcmd/sqlcmd-windows-amd64-1.10.0.zip` to `Dependencies/external/sqlcmd/win-x64/sqlcmd.exe` and normalize local named-instance server targets to `lpc:` when no protocol prefix is supplied.
- password changes are written to encrypted local `logindetails` as salted PBKDF2-HMAC-SHA256 hash material and session version is incremented.
- a successful password change clears the current session and requires sign-in again.
- `placeholder-2` remains routable but intentionally has no operational settings.

## 3. Feature Breakdown
### Feature: Settings Tab Routing
- **What it does:** switches between database settings, password settings, and one placeholder tab.
- **User perspective:** the user can navigate to both active settings surfaces and one reserved future tab.
- **System behaviour:** `settingsTab` in the query string controls which panel is rendered.
- **Outcome:** database and password settings are both active configuration surfaces.

### Feature: Database Settings Form
- **What it does:** captures server, database, authentication mode, user ID, password, SSL enabled flag, and SSL type.
- **User perspective:** the user edits the runtime connection and SSL behavior TSAAT should use.
- **System behaviour:** initial values are loaded from encrypted `DB_config` when present, otherwise fallback server/database defaults are used and SSL defaults to disabled; the same encrypted file is confirmed by offline scripts before database creation and compile validation.
- **Outcome:** the user can prepare a connection definition without saving immediately.

### Feature: Connection Test
- **What it does:** validates the supplied connection settings against SQL Server.
- **User perspective:** the user checks whether the supplied settings can connect successfully.
- **System behaviour:** the client posts the current draft settings to `/api/settings/database/test-connection` and logs diagnostics locally in the panel.
- **Outcome:** the panel records pass or fail status before schema testing.

### Feature: Schema Test
- **What it does:** validates that the target database has the required TSAAT schema.
- **User perspective:** the user confirms that the database is structurally suitable for TSAAT.
- **System behaviour:** the client posts the current draft settings to `/api/settings/database/test-schema`, which checks required tables, required columns, and snapshot data presence.
- **Outcome:** only schema-valid databases can proceed to save.

### Feature: SSL Test
- **What it does:** validates encrypted transport/handshake behavior for the selected SSL mode.
- **User perspective:** when SSL is enabled, the user confirms SSL works before saving.
- **System behaviour:** the client posts current draft settings to `/api/settings/database/test-ssl`, which first verifies connection success and then validates SQL connection encryption properties.
- **Outcome:** SSL-enabled settings cannot be saved unless SSL test succeeds.

### Feature: Save and Reset
- **What it does:** writes validated settings to encrypted `DB_config` or resets the draft to the last saved values.
- **User perspective:** the user either commits the validated settings or discards edits.
- **System behaviour:** save is enabled only when the form is not busy and all required tests have succeeded; reset restores the last saved state and clears transient statuses.
- **Outcome:** the application configuration file stays synchronized with validated input.

### Feature: Password Settings
- **What it does:** changes the current application password for the authenticated user.
- **User perspective:** the user enters current password, new password, and confirm password, then saves.
- **System behaviour:** `/api/settings/password` validates current credentials, writes a new salted hash + salt + iteration metadata into encrypted `logindetails`, increments file-backed session version, and clears the session cookie.
- **Outcome:** old credentials stop working immediately and the user must sign in with the new password.

### Feature: Diagnostics Log and Copy Action
- **What it does:** records connection, schema, and save diagnostics and lets the user copy them.
- **User perspective:** the user can review test output and share it with support teams.
- **System behaviour:** each action appends a timestamped log entry in client state; copy uses the browser clipboard.
- **Outcome:** troubleshooting output is available without leaving the page.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Settings | Tab routing | Switches among database settings, password settings, and one placeholder | Click tab | Updates `settingsTab` query parameter | `settingsTab` | Different settings panel | `database-settings` is default | unsupported values fall back to database settings | `SettingsTabs` | Bookmarkable tab state | `placeholder-2` has no operational logic |
| Settings | Database settings form | Edit connection and SSL definition | Change fields | Marks form dirty and clears prior validation results | server, database, auth mode, credentials, `sslEnabled`, `sslType` | Draft settings | save requires passing validation first | client checks auth mode completeness and valid SSL type | `DatabaseSettingsPanel`, defaults loader | Prepared connection definition | initial values can come from fallback resolution |
| Settings | Connection test | Validate connectivity | Click `Test Connection` | POSTs draft settings and stores result and diagnostics | current draft settings | connection status and diagnostics | connection test must pass before SSL test or schema test | endpoint returns success summary and diagnostics | `/api/settings/database/test-connection` | Verified connectivity | |
| Settings | SSL test | Validate SSL transport for selected SSL type | Click `Test SSL` | POSTs draft settings, checks connection precondition, validates encrypted transport | current draft settings | SSL status and diagnostics | required only when SSL is enabled | endpoint returns success summary and diagnostics | `/api/settings/database/test-ssl` | Verified SSL mode | skipped when SSL disabled |
| Settings | Schema test | Validate TSAAT schema readiness | Click `Test Schema` | POSTs draft settings and checks required tables, columns, and snapshot rows | current draft settings | schema status and diagnostics | schema test requires a successful connection test first | endpoint enforces required tables and columns | `/api/settings/database/test-schema`, schema validation helper | Verified schema readiness | |
| Settings | Save and reset | Persist or discard draft settings | Click `Save` or `Reset` | Saves to encrypted `DB_config` or restores last saved state | validated draft settings | updated file-backed settings or restored draft | SSL disabled requires connection + schema tests; SSL enabled requires connection + SSL + schema tests | save API re-validates all required checks | `/api/settings/database`, `DB_config`, `canSaveDatabaseSettings()` | Synchronized configuration | save does not write to SQL Server |
| Settings | Password settings | Change current app password | Enter current/new/confirm password then click `Save Password` | Validates current password and persists new salted hash metadata to encrypted `logindetails`; increments session version and clears session cookie | current password, new password, confirm password | password update status and re-login requirement | only authenticated session can change password; current password must match; new/confirm must match | new password length and current-password verification are enforced server-side | `/api/settings/password`, `logindetails` | Password rotation without plaintext storage | success forces sign-out |
| Settings | Diagnostics log | Review and copy technical diagnostics | Read log or click copy | Appends timestamped messages and copies log text to clipboard | test and save results | local diagnostics text | diagnostics are local to the browser session | copy fails gracefully | browser clipboard API | Support-friendly troubleshooting | not persisted |

## 5. Database Mapping
This page is file-backed for persisted settings. Database connection settings are stored in encrypted `DB_config`, while application login credentials are stored in encrypted `logindetails`. Both files are local generated artefacts and are not portable between Windows identities when encrypted with DPAPI `CurrentUser` scope; compile-time setup can recreate an undecryptable `logindetails` with new credentials.

Primary dependencies:

- local configuration file `DB_config`
- local credential file `logindetails`
- SQL Server schema `tsaat` for validation checks
- required tables and columns listed in `lib/database-settings.ts`

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Settings | File-backed connection settings | local ignored file | `DB_config` | encrypted JSON envelope (`format`, `version`, `keyProvider`, `algorithm`, `ciphertextBase64`, `updatedAtUtc`) | text/json | source of saved database + SSL settings | Read and Update | no database join; file read/write only | UI missing-file defaults SSL to disabled; offline scripts can create encrypted file from confirmed input or recreate an undecryptable local file | DPAPI decrypt/encrypt + normalization before save or script confirmation | API never returns plaintext password; SQL mode uses stored-password placeholder token; confirmation helper redacts SQL passwords |
| Settings | Password settings storage | local ignored file | `logindetails` | encrypted payload containing `username`, password hash/salt, algorithm, iteration count, timestamps, and session version | text/json | stores application login credentials and invalidation metadata | Read and Update | lookup by username from authenticated session | session version increments on each password change; compile-time setup can recreate undecryptable local files with new credentials | DPAPI decrypt/encrypt + PBKDF2-HMAC-SHA256 salted hash verification + rewrite | plaintext password is never persisted or returned |
| Settings | Schema validation - required tables | `tsaat` | multiple required tables including `dataset_snapshot`, `managed_network`, `ict_system`, `asset`, `finding`, settings tables, and reference tables | table existence only | mixed | determines whether target DB is valid for TSAAT | Read | validation checks object existence in `tsaat` schema | all required tables must exist | SQL validation query | exact list maintained in code |
| Settings | Schema validation - required columns | `tsaat` | selected required tables | `snapshot_date`, `network_id`, `adf_platform`, `enterprise_platform`, `system_id`, `asset_id`, `asset_type`, `finding_id`, `spi_id`, `workflow_status`, `dependency_id`, `tool_id`, `severity` | mixed | confirms minimum structural contract | Read | validation checks column existence by table | all required columns must exist | SQL validation query | exact list maintained in code |
| Settings | Snapshot data check | `tsaat` | `dataset_snapshot` | row existence and `snapshot_date` | date | confirms usable data is present | Read | no join required | at least one row must exist | boolean check in validation SQL | schema can exist but still fail if no snapshots exist |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Defaults resolution | prefill database settings form and offline confirmation | use decrypted file values when present, otherwise resolve fallback SQL Server name and application DB name; offline unattended creation/recreation requires `TSAAT_DB_CONFIG_ASSUME_YES=true` plus complete `TSAAT_SQL_*` values | encrypted `DB_config`, runtime resolution helpers, optional environment provisioning | Runtime | backend and scripts | password is replaced with stored placeholder token in UI; scripts redact SQL password during confirmation |
| Dirty-state detection | enable reset and clear stale validations | compare draft settings to saved settings field by field | form state | Runtime | client | resets validation state on every field change |
| Connection validation | confirm database connectivity | execute lightweight SQL returning current DB and login | supplied connection settings | Runtime | API/backend | failure returns diagnostics instead of throwing into UI |
| SSL validation | confirm encrypted SQL transport | execute SQL connection-property checks and require encrypted transport when SSL enabled | supplied connection settings plus SQL connection properties | Runtime | API/backend | skipped when SSL disabled |
| Schema validation | confirm minimum TSAAT schema | check required tables, required columns, and that `dataset_snapshot` contains rows | target SQL Server database | Runtime | API/backend | stops at validation failure and returns diagnostics |
| Save enablement | prevent invalid configuration writes | save allowed only when connection and schema tests succeed, plus SSL test when SSL enabled, and no busy state is active | client validation state | Runtime | client | save button remains disabled until required checks pass |
| SSL mode mapping | normalize UI SSL settings into encrypted payload fields | `sslEnabled=false => sslType=strict`; `sslEnabled=true, sslType=strict`; `sslEnabled=true, sslType=trust-server-certificate` | form state, encrypted `DB_config` payload | Runtime | backend | `trust-server-certificate` implicitly enables SSL |
| SQLCMD SSL argument mapping | enforce runtime/script SSL mode | SSL disabled => no SSL flags; strict => `-N`; trust server certificate => `-N -C` | decrypted `DB_config` payload (`sslEnabled`, `sslType`) | Runtime | backend and scripts | used by runtime SQL execution and offline scripts (`compileApp.cmd`, `CreateDB.cmd`, loader PowerShell); `CreateDB.cmd` and `compileApp.cmd` confirm `DB_config` first, then stage bundled `sqlcmd` and normalize local server targets to `lpc:` when needed |
| Password change | rotate app login secret | verify current password hash, persist new salted hash, increment session version, clear cookie | encrypted `logindetails` payload + authenticated session cookie | Runtime | API/backend | old sessions become invalid after update |

## 8. Non-Database Calculations
- Status badges, dirty-state detection, copy-to-clipboard status, and diagnostics aggregation are client-side only.
- Timestamped diagnostics text is session-local and not persisted.
- `placeholder-2` is a runtime route state with static placeholder content.

## 9. Rules, Assumptions, and Constraints
- Settings persist to local ignored `DB_config`, not to the database.
- `CreateDB.cmd` and `compileApp.cmd` must confirm, create, or recreate encrypted `DB_config` before using database settings.
- The page is marked `force-dynamic`, so it does not rely on static generation.
- Connection test must pass before schema test can run.
- Connection test must pass before SSL test can run.
- Save requires both connection and schema tests; SSL test is additionally required when SSL is enabled.
- `DB_config` is encrypted at rest; runtime SSL behavior is derived from decrypted payload fields:
  - `sslEnabled=false` means SSL disabled.
  - `sslEnabled=true` + `sslType=strict` means strict SSL validation.
  - `sslEnabled=true` + `sslType=trust-server-certificate` means trust-server-certificate SSL mode.
- Password updates require the current authenticated session and a valid current password.
- Password writes are one-way salted hashes in encrypted `logindetails`; plaintext is not persisted.
- Undecryptable copied `logindetails` files are not migrated; compile-time recreation creates a new credential.
- Successful password changes increment file-backed session version and force re-authentication.
- `placeholder-2` remains visible in navigation but has no settings logic.
- The settings page handles credentials, so operational documentation should avoid exposing actual values.

## 10. Open Questions / Gaps
- **Open question:** should save require a secondary confirmation because it writes runtime connection and SSL behavior used by app startup and scripts?
- **Open question:** should the schema validation contract be documented externally for deployment teams, since the required tables and columns are enforced in code?

