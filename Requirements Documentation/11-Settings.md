# Settings

**Page Path:** `/settings`

## 1. Page Overview
- **Page name:** Settings
- **Purpose:** provide application-level configuration controls, currently focused on database connection settings.
- **User outcome:** the user can view, validate, and save the database connection used by the application, while understanding that other tabs are placeholders only.
- **Primary user roles:** application administrators, support teams, deployment engineers, maintainers.

## 2. Page Summary
This page provides `database-settings`, `placeholder-1`, and `placeholder-2` tabs.

Major dependencies:

- `loadDatabaseSettingsDefaults()`
- `DatabaseSettingsPanel`
- `SettingsTabs`
- `/api/settings/database/test-connection`
- `/api/settings/database/test-schema`
- `/api/settings/database`
- `DB_config`

Important hidden behaviour:

- database settings are persisted to the local `DB_config` file, not to the SQL Server database.
- schema validation checks for required tables, required columns, and that `tsaat.dataset_snapshot` contains at least one row.
- save remains disabled until both connection test and schema test succeed.
- placeholder tabs are routable but intentionally contain no operational settings.

## 3. Feature Breakdown
### Feature: Settings Tab Routing
- **What it does:** switches between database settings and two placeholder tabs.
- **User perspective:** the user can navigate to the implemented settings surface or view reserved future tabs.
- **System behaviour:** `settingsTab` in the query string controls which panel is rendered.
- **Outcome:** the database settings panel is the only active configuration surface today.

### Feature: Database Settings Form
- **What it does:** captures server, database, authentication mode, user ID, and password.
- **User perspective:** the user edits the connection settings that TSAAT should use.
- **System behaviour:** initial values are loaded from `DB_config` when present, otherwise the application resolves fallback server and database defaults.
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

### Feature: Save and Reset
- **What it does:** writes validated settings to `DB_config` or resets the draft to the last saved values.
- **User perspective:** the user either commits the validated settings or discards edits.
- **System behaviour:** save is enabled only when the form is not busy and both tests have succeeded; reset restores the last saved state and clears transient statuses.
- **Outcome:** the application configuration file stays synchronized with validated input.

### Feature: Diagnostics Log and Copy Action
- **What it does:** records connection, schema, and save diagnostics and lets the user copy them.
- **User perspective:** the user can review test output and share it with support teams.
- **System behaviour:** each action appends a timestamped log entry in client state; copy uses the browser clipboard.
- **Outcome:** troubleshooting output is available without leaving the page.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Settings | Tab routing | Switches among database settings and placeholders | Click tab | Updates `settingsTab` query parameter | `settingsTab` | Different settings panel | `database-settings` is default | unsupported values fall back to database settings | `SettingsTabs` | Bookmarkable tab state | placeholder tabs have no operational logic |
| Settings | Database settings form | Edit connection definition | Change fields | Marks form dirty and clears prior validation results | server, database, auth mode, credentials | Draft settings | save requires passing validation first | client checks auth mode completeness | `DatabaseSettingsPanel`, defaults loader | Prepared connection definition | initial values can come from fallback resolution |
| Settings | Connection test | Validate connectivity | Click `Test Connection` | POSTs draft settings and stores result and diagnostics | current draft settings | connection status and diagnostics | connection test must pass before schema test | endpoint returns success summary and diagnostics | `/api/settings/database/test-connection` | Verified connectivity | |
| Settings | Schema test | Validate TSAAT schema readiness | Click `Test Schema` | POSTs draft settings and checks required tables, columns, and snapshot rows | current draft settings | schema status and diagnostics | schema test requires a successful connection test first | endpoint enforces required tables and columns | `/api/settings/database/test-schema`, schema validation helper | Verified schema readiness | |
| Settings | Save and reset | Persist or discard draft settings | Click `Save` or `Reset` | Saves to `DB_config` or restores last saved state | validated draft settings | updated file-backed settings or restored draft | save requires passing connection and schema tests | save disabled unless validation succeeded | `/api/settings/database`, `DB_config` | Synchronized configuration | save does not write to SQL Server |
| Settings | Diagnostics log | Review and copy technical diagnostics | Read log or click copy | Appends timestamped messages and copies log text to clipboard | test and save results | local diagnostics text | diagnostics are local to the browser session | copy fails gracefully | browser clipboard API | Support-friendly troubleshooting | not persisted |

## 5. Database Mapping
This page is primarily file-backed rather than database-backed. It interacts with SQL Server only to validate connectivity and schema suitability.

Primary dependencies:

- local configuration file `DB_config`
- SQL Server schema `tsaat` for validation checks
- required tables and columns listed in `lib/database-settings.ts`

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Settings | File-backed connection settings | local file | `DB_config` | server, database, auth mode, user ID, password | text | source of saved database settings | Read and Update | no database join; file read/write only | fallback defaults used when file values are absent | normalization before save | do not expose credentials in documentation |
| Settings | Schema validation - required tables | `tsaat` | multiple required tables including `dataset_snapshot`, `managed_network`, `ict_system`, `asset`, `finding`, settings tables, and reference tables | table existence only | mixed | determines whether target DB is valid for TSAAT | Read | validation checks object existence in `tsaat` schema | all required tables must exist | SQL validation query | exact list maintained in code |
| Settings | Schema validation - required columns | `tsaat` | selected required tables | `snapshot_date`, `network_id`, `adf_platform`, `enterprise_platform`, `system_id`, `asset_id`, `asset_type`, `finding_id`, `spi_id`, `workflow_status`, `dependency_id`, `tool_id`, `severity` | mixed | confirms minimum structural contract | Read | validation checks column existence by table | all required columns must exist | SQL validation query | exact list maintained in code |
| Settings | Snapshot data check | `tsaat` | `dataset_snapshot` | row existence and `snapshot_date` | date | confirms usable data is present | Read | no join required | at least one row must exist | boolean check in validation SQL | schema can exist but still fail if no snapshots exist |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Defaults resolution | prefill database settings form | use file values when present, otherwise resolve fallback SQL Server name and application DB name | `DB_config` plus runtime resolution helpers | Runtime | backend | ensures panel opens with usable defaults |
| Dirty-state detection | enable reset and clear stale validations | compare draft settings to saved settings field by field | form state | Runtime | client | resets validation state on every field change |
| Connection validation | confirm database connectivity | execute lightweight SQL returning current DB and login | supplied connection settings | Runtime | API/backend | failure returns diagnostics instead of throwing into UI |
| Schema validation | confirm minimum TSAAT schema | check required tables, required columns, and that `dataset_snapshot` contains rows | target SQL Server database | Runtime | API/backend | stops at validation failure and returns diagnostics |
| Save enablement | prevent invalid configuration writes | save allowed only when connection test and schema test both succeeded and no busy state is active | client validation state | Runtime | client | save button remains disabled until both checks pass |

## 8. Non-Database Calculations
- Status badges, dirty-state detection, copy-to-clipboard status, and diagnostics aggregation are client-side only.
- Timestamped diagnostics text is session-local and not persisted.
- Placeholder tabs are runtime route states with static placeholder content.

## 9. Rules, Assumptions, and Constraints
- Settings persist to `DB_config`, not to the database.
- The page is marked `force-dynamic`, so it does not rely on static generation.
- Connection test must pass before schema test can run.
- Save requires both tests to have succeeded.
- Placeholder tabs are present in navigation but intentionally contain no settings.
- The settings page handles credentials, so operational documentation should avoid exposing actual values.

## 10. Open Questions / Gaps
- **Open question:** should the placeholder tabs remain visible before they have real functionality?
- **Open question:** should save also require a user confirmation because it writes local configuration used by the runtime?
- **Open question:** should the schema validation contract be documented externally for deployment teams, since the required tables and columns are enforced in code?
