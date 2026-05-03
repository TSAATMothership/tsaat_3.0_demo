import "server-only";

import {
  EditableDatabaseConnectionInput,
  loadDatabaseConnectionSettingsFromFile,
  normalizeEditableDatabaseConnectionInput,
  saveDatabaseConnectionSettingsToFile
} from "@/lib/db-config";
import {
  executeSqlJsonWithConnection,
  SqlConnectionInput,
  resolveAppDatabaseName,
  resolveSqlServerName
} from "@/lib/sql-server";

interface MissingTableRow {
  tableName: string;
}

interface MissingColumnRow {
  tableName: string;
  columnName: string;
}

interface SchemaValidationPayload {
  missingTables: MissingTableRow[];
  missingColumns: MissingColumnRow[];
  hasSnapshots: boolean;
}

interface SslValidationPayload {
  encryptOption?: string;
  authScheme?: string;
  protocolType?: string;
}

export interface DatabaseValidationResult {
  success: boolean;
  summary: string;
  diagnostics: string;
}

export interface DatabaseSettingsViewModel extends EditableDatabaseConnectionInput {
  hasStoredPassword: boolean;
}

export const STORED_DB_PASSWORD_PLACEHOLDER = "__TSAAT_STORED_DB_PASSWORD__";

const REQUIRED_TABLES: string[] = [
  "dataset_snapshot",
  "managed_network",
  "managed_network_hierarchy",
  "ict_system",
  "ict_system_hierarchy",
  "network_declared_system",
  "network_declared_asset",
  "network_target_state_asset",
  "system_mission_capability",
  "system_business_service",
  "system_environment",
  "system_environment_asset",
  "asset",
  "asset_operating_system",
  "asset_network_os",
  "asset_patch_state",
  "asset_installed_software",
  "asset_vulnerability",
  "ci_dependency",
  "finding",
  "reference_version_set",
  "reference_os_current_major",
  "reference_software_supported_version",
  "spi_definition",
  "spi_applicable_asset_type",
  "discovery_tools_settings_version",
  "discovery_tool",
  "discovery_tool_asset_scope",
  "measures_settings_version",
  "measures_severity_matrix",
  "measures_priority_matrix"
];

const REQUIRED_COLUMNS: Array<{ tableName: string; columnName: string }> = [
  { tableName: "dataset_snapshot", columnName: "snapshot_date" },
  { tableName: "managed_network", columnName: "network_id" },
  { tableName: "managed_network", columnName: "adf_platform" },
  { tableName: "managed_network", columnName: "enterprise_platform" },
  { tableName: "managed_network", columnName: "modelling_status" },
  { tableName: "managed_network", columnName: "diis_id" },
  { tableName: "managed_network", columnName: "ato_number" },
  { tableName: "managed_network", columnName: "apm_number" },
  { tableName: "ict_system", columnName: "system_id" },
  { tableName: "ict_system", columnName: "adf_platform" },
  { tableName: "ict_system", columnName: "enterprise_platform" },
  { tableName: "ict_system", columnName: "diis_id" },
  { tableName: "ict_system", columnName: "ato_number" },
  { tableName: "ict_system", columnName: "apm_number" },
  { tableName: "asset", columnName: "asset_id" },
  { tableName: "asset", columnName: "asset_type" },
  { tableName: "finding", columnName: "finding_id" },
  { tableName: "finding", columnName: "spi_id" },
  { tableName: "finding", columnName: "workflow_status" },
  { tableName: "ci_dependency", columnName: "dependency_id" },
  { tableName: "discovery_tool", columnName: "tool_id" },
  { tableName: "measures_severity_matrix", columnName: "severity" },
  { tableName: "measures_priority_matrix", columnName: "priority_rank" }
];

function toSqlConnectionInput(settings: EditableDatabaseConnectionInput): SqlConnectionInput {
  if (settings.authMode === "trusted") {
    return {
      server: settings.server,
      database: settings.database,
      trustedConnection: true,
      sslEnabled: settings.sslEnabled,
      sslType: settings.sslType
    };
  }

  return {
    server: settings.server,
    database: settings.database,
    trustedConnection: false,
    userId: settings.userId,
    password: settings.password,
    sslEnabled: settings.sslEnabled,
    sslType: settings.sslType
  };
}

export async function loadDatabaseSettingsDefaults(): Promise<DatabaseSettingsViewModel> {
  let fileSettings: Awaited<ReturnType<typeof loadDatabaseConnectionSettingsFromFile>> = null;
  try {
    fileSettings = await loadDatabaseConnectionSettingsFromFile();
  } catch {
    // Fall back to environment/defaults so settings UI can recover by saving a new encrypted config.
    fileSettings = null;
  }
  let fallbackServer = "localhost\\SQLEXPRESS";
  let fallbackDatabase = "TSAAT";
  try {
    fallbackServer = await resolveSqlServerName();
  } catch {
    fallbackServer = "localhost\\SQLEXPRESS";
  }
  try {
    fallbackDatabase = await resolveAppDatabaseName();
  } catch {
    fallbackDatabase = "TSAAT";
  }
  const hasStoredPassword =
    fileSettings?.authMode === "sql" &&
    typeof fileSettings.password === "string" &&
    fileSettings.password.trim().length > 0;

  return {
    server: fileSettings?.server?.trim() || fallbackServer,
    database: fileSettings?.database?.trim() || fallbackDatabase,
    authMode: fileSettings?.authMode ?? "trusted",
    userId: fileSettings?.userId?.trim() || "",
    password: hasStoredPassword ? STORED_DB_PASSWORD_PLACEHOLDER : "",
    sslEnabled: fileSettings?.sslEnabled ?? false,
    sslType: fileSettings?.sslType ?? "strict",
    hasStoredPassword
  };
}

export function normalizeDatabaseSettingsPayload(input: unknown): EditableDatabaseConnectionInput {
  return normalizeEditableDatabaseConnectionInput(input);
}

async function resolveStoredPasswordPlaceholder(
  settings: EditableDatabaseConnectionInput
): Promise<EditableDatabaseConnectionInput> {
  if (settings.authMode !== "sql") {
    return { ...settings, password: "" };
  }

  if (settings.password !== STORED_DB_PASSWORD_PLACEHOLDER) {
    return settings;
  }

  const stored = await loadDatabaseConnectionSettingsFromFile();
  if (!stored || stored.authMode !== "sql") {
    throw new Error("Stored SQL password is unavailable. Enter the password and test again.");
  }

  const storedUserId = stored.userId.trim();
  const storedPassword = stored.password.trim();
  if (!storedUserId || !storedPassword) {
    throw new Error("Stored SQL password is unavailable. Enter the password and test again.");
  }

  if (storedUserId.toLowerCase() !== settings.userId.trim().toLowerCase()) {
    throw new Error("SQL User Id changed. Enter the password for the selected user.");
  }

  return {
    ...settings,
    password: storedPassword
  };
}

export async function normalizeDatabaseSettingsPayloadForProcessing(
  input: unknown
): Promise<EditableDatabaseConnectionInput> {
  const normalized = normalizeDatabaseSettingsPayload(input);
  return resolveStoredPasswordPlaceholder(normalized);
}

export async function testDatabaseConnection(
  settings: EditableDatabaseConnectionInput
): Promise<DatabaseValidationResult> {
  const connection = toSqlConnectionInput(settings);

  try {
    const payload = await executeSqlJsonWithConnection<{ databaseName: string }>(
      `
SELECT
  DB_NAME() AS [databaseName]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`,
      connection
    );

    return {
      success: true,
      summary: "Database connection successful.",
      diagnostics: [
        "Connection test succeeded.",
        `Server: ${settings.server}`,
        `Database: ${payload.databaseName || settings.database}`,
        `Authentication mode: ${settings.authMode}`,
        `SSL enabled: ${settings.sslEnabled ? "Yes" : "No"}`,
        `SSL type: ${settings.sslEnabled ? settings.sslType : "N/A"}`
      ].join("\n")
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error.";
    return {
      success: false,
      summary: "Database connection failed.",
      diagnostics: [
        "Connection test failed.",
        `Server: ${settings.server}`,
        `Database: ${settings.database}`,
        `Authentication mode: ${settings.authMode}`,
        `SSL enabled: ${settings.sslEnabled ? "Yes" : "No"}`,
        `SSL type: ${settings.sslEnabled ? settings.sslType : "N/A"}`,
        "",
        message
      ].join("\n")
    };
  }
}

export async function testDatabaseSsl(settings: EditableDatabaseConnectionInput): Promise<DatabaseValidationResult> {
  if (!settings.sslEnabled) {
    return {
      success: true,
      summary: "SSL test skipped (SSL disabled).",
      diagnostics: ["SSL test skipped because SSL is disabled in settings."].join("\n")
    };
  }

  const connection = toSqlConnectionInput(settings);

  try {
    const payload = await executeSqlJsonWithConnection<SslValidationPayload>(
      `
SELECT
  CAST(CONNECTIONPROPERTY('encrypt_option') AS NVARCHAR(60)) AS [encryptOption],
  CAST(CONNECTIONPROPERTY('auth_scheme') AS NVARCHAR(60)) AS [authScheme],
  CAST(CONNECTIONPROPERTY('protocol_type') AS NVARCHAR(60)) AS [protocolType]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`,
      connection
    );

    const encryptOption = (payload.encryptOption ?? "").trim();
    const encrypted = /^true$/i.test(encryptOption) || /^mandatory$/i.test(encryptOption);

    if (!encrypted) {
      return {
        success: false,
        summary: "SSL test failed.",
        diagnostics: [
          "SSL test failed.",
          "The SQL connection did not report encrypted transport.",
          `Requested SSL type: ${settings.sslType}`,
          `Connection encrypt option: ${encryptOption || "(unknown)"}`,
          `Connection auth scheme: ${(payload.authScheme ?? "(unknown)").trim()}`,
          `Connection protocol type: ${(payload.protocolType ?? "(unknown)").trim()}`
        ].join("\n")
      };
    }

    return {
      success: true,
      summary: "SSL test successful.",
      diagnostics: [
        "SSL test succeeded.",
        `Requested SSL type: ${settings.sslType}`,
        `Connection encrypt option: ${encryptOption || "(unknown)"}`,
        `Connection auth scheme: ${(payload.authScheme ?? "(unknown)").trim()}`,
        `Connection protocol type: ${(payload.protocolType ?? "(unknown)").trim()}`
      ].join("\n")
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SSL test error.";
    return {
      success: false,
      summary: "SSL test failed.",
      diagnostics: [
        "SSL test failed.",
        `Server: ${settings.server}`,
        `Database: ${settings.database}`,
        `Requested SSL type: ${settings.sslType}`,
        "",
        message
      ].join("\n")
    };
  }
}

function buildSchemaValidationSql(): string {
  const requiredTablesValues = REQUIRED_TABLES.map((tableName) => `(N'${tableName.replace(/'/g, "''")}')`).join(",\n");
  const requiredColumnsValues = REQUIRED_COLUMNS.map(
    (column) => `(N'${column.tableName.replace(/'/g, "''")}', N'${column.columnName.replace(/'/g, "''")}')`
  ).join(",\n");

  return `
DECLARE @requiredTables TABLE ([table_name] SYSNAME NOT NULL);
INSERT INTO @requiredTables ([table_name])
VALUES
${requiredTablesValues};

DECLARE @requiredColumns TABLE ([table_name] SYSNAME NOT NULL, [column_name] SYSNAME NOT NULL);
INSERT INTO @requiredColumns ([table_name], [column_name])
VALUES
${requiredColumnsValues};

SELECT
  JSON_QUERY((
    SELECT rt.[table_name] AS [tableName]
    FROM @requiredTables rt
    WHERE NOT EXISTS (
      SELECT 1
      FROM sys.tables t
      INNER JOIN sys.schemas s ON s.[schema_id] = t.[schema_id]
      WHERE s.[name] = N'tsaat'
        AND t.[name] = rt.[table_name]
    )
    ORDER BY rt.[table_name]
    FOR JSON PATH
  )) AS [missingTables],
  JSON_QUERY((
    SELECT rc.[table_name] AS [tableName],
           rc.[column_name] AS [columnName]
    FROM @requiredColumns rc
    WHERE NOT EXISTS (
      SELECT 1
      FROM sys.columns c
      INNER JOIN sys.tables t ON t.[object_id] = c.[object_id]
      INNER JOIN sys.schemas s ON s.[schema_id] = t.[schema_id]
      WHERE s.[name] = N'tsaat'
        AND t.[name] = rc.[table_name]
        AND c.[name] = rc.[column_name]
    )
    ORDER BY rc.[table_name], rc.[column_name]
    FOR JSON PATH
  )) AS [missingColumns],
  CASE
    WHEN OBJECT_ID(N'[tsaat].[dataset_snapshot]', N'U') IS NULL THEN CAST(0 AS BIT)
    WHEN EXISTS (SELECT 1 FROM [tsaat].[dataset_snapshot]) THEN CAST(1 AS BIT)
    ELSE CAST(0 AS BIT)
  END AS [hasSnapshots]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`;
}

export async function testDatabaseSchema(settings: EditableDatabaseConnectionInput): Promise<DatabaseValidationResult> {
  const connection = toSqlConnectionInput(settings);

  try {
    const payload = await executeSqlJsonWithConnection<SchemaValidationPayload>(buildSchemaValidationSql(), connection);

    const missingTables = Array.isArray(payload.missingTables) ? payload.missingTables : [];
    const missingColumns = Array.isArray(payload.missingColumns) ? payload.missingColumns : [];
    const issues: string[] = [];

    if (missingTables.length > 0) {
      issues.push(`Missing required tables: ${missingTables.map((row) => row.tableName).join(", ")}`);
    }
    if (missingColumns.length > 0) {
      issues.push(
        `Missing required columns: ${missingColumns
          .map((row) => `${row.tableName}.${row.columnName}`)
          .join(", ")}`
      );
    }
    if (!payload.hasSnapshots) {
      issues.push("Table [tsaat].[dataset_snapshot] exists but contains no rows.");
    }

    if (issues.length > 0) {
      return {
        success: false,
        summary: "Schema validation failed.",
        diagnostics: ["Schema validation failed.", ...issues].join("\n")
      };
    }

    return {
      success: true,
      summary: "Schema validation successful.",
      diagnostics: [
        "Schema validation succeeded.",
        `Required tables checked: ${REQUIRED_TABLES.length}`,
        `Required columns checked: ${REQUIRED_COLUMNS.length}`,
        "Snapshot data check: [tsaat].[dataset_snapshot] contains rows."
      ].join("\n")
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown schema validation error.";
    return {
      success: false,
      summary: "Schema validation failed.",
      diagnostics: [
        "Schema validation failed before completing checks.",
        `Server: ${settings.server}`,
        `Database: ${settings.database}`,
        "",
        message
      ].join("\n")
    };
  }
}

export async function saveDatabaseSettings(settings: EditableDatabaseConnectionInput): Promise<void> {
  return saveDatabaseConnectionSettingsToFile(settings);
}
