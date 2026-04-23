import "server-only";

import { execFile } from "child_process";
import { existsSync, promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import {
  type DatabaseSslType,
  loadDatabaseConnectionSettingsFromFile,
  ParsedDatabaseConnectionSettings
} from "@/lib/db-config";

const execFileAsync = promisify(execFile);

const DEFAULT_SQL_SERVER = "localhost\\SQLEXPRESS";
const DEFAULT_APP_DATABASE = "TSAAT";
const SQLCMD_MARKER_BEGIN = "__TSAAT_JSON_BEGIN__";
const SQLCMD_MARKER_END = "__TSAAT_JSON_END__";

const SQLCMD_MAX_BUFFER = 1024 * 1024 * 1024;

let cachedManifestDatabaseName: string | null | undefined;

type ResolvedSqlAuth =
  | {
      mode: "trusted";
    }
  | {
      mode: "sql";
      userId: string;
      password: string;
    };

interface ResolvedSqlConnection {
  server: string;
  database: string;
  auth: ResolvedSqlAuth;
  sslEnabled: boolean;
  sslType: DatabaseSslType;
}

interface ExecuteSqlFileOptions {
  allowTrustedFallback: boolean;
}

export interface SqlConnectionInput {
  server: string;
  database: string;
  userId?: string;
  password?: string;
  trustedConnection?: boolean;
  sslEnabled?: boolean;
  sslType?: DatabaseSslType;
}

function envValue(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "sspi"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function normalizeSslConfig(input: { sslEnabled?: boolean; sslType?: DatabaseSslType }): {
  sslEnabled: boolean;
  sslType: DatabaseSslType;
} {
  const sslType = input.sslType === "trust-server-certificate" ? "trust-server-certificate" : "strict";
  const sslEnabled = input.sslEnabled === true || sslType === "trust-server-certificate";

  if (!sslEnabled) {
    return { sslEnabled: false, sslType: "strict" };
  }

  return { sslEnabled: true, sslType };
}

function resolveAuthFromEnv(): ResolvedSqlAuth | undefined {
  const userId = envValue("TSAAT_SQL_USER", "SQL_USER", "SQLCMDUSER");
  const password = envValue("TSAAT_SQL_PASSWORD", "SQL_PASSWORD", "SQLCMDPASSWORD");

  if (userId || password) {
    if (!userId || !password) {
      throw new Error("SQL authentication environment variables must include both user and password.");
    }

    return {
      mode: "sql",
      userId,
      password
    };
  }

  const trusted = parseBoolean(process.env.TSAAT_SQL_TRUSTED_CONNECTION ?? process.env.SQL_TRUSTED_CONNECTION);
  if (trusted === true) {
    return { mode: "trusted" };
  }
  if (trusted === false) {
    throw new Error("Trusted SQL authentication was explicitly disabled without SQL user credentials.");
  }

  return undefined;
}

function resolveAuthFromDbConfig(config: ParsedDatabaseConnectionSettings | null): ResolvedSqlAuth | undefined {
  if (!config) {
    return undefined;
  }

  if (config.trustedConnection || config.authMode === "trusted") {
    return { mode: "trusted" };
  }

  const userId = config.userId.trim();
  const password = config.password.trim();
  if (userId || password) {
    if (!userId || !password) {
      throw new Error("DB_config must include both User Id and Password when SQL authentication is used.");
    }

    return {
      mode: "sql",
      userId,
      password
    };
  }

  return undefined;
}

function buildSqlcmdAuthArgs(auth: ResolvedSqlAuth): string[] {
  if (auth.mode === "sql") {
    return ["-U", auth.userId, "-P", auth.password];
  }

  return ["-E"];
}

export function buildSqlcmdSecurityArgs(input: { sslEnabled: boolean; sslType: DatabaseSslType }): string[] {
  if (!input.sslEnabled) {
    return [];
  }

  if (input.sslType === "trust-server-certificate") {
    return ["-N", "-C"];
  }

  return ["-N"];
}

function allowTrustedRuntimeFallback(): boolean {
  const explicit = parseBoolean(process.env.TSAAT_SQL_TRUSTED_FALLBACK ?? process.env.SQL_TRUSTED_FALLBACK);
  return explicit !== false;
}

function isSqlLoginFailure(error: { message?: string; stderr?: string }): boolean {
  const text = `${error.message ?? ""}\n${error.stderr ?? ""}`.toLowerCase();
  return text.includes("login failed for user");
}

async function readManifestDatabaseName(): Promise<string | undefined> {
  if (cachedManifestDatabaseName !== undefined) {
    return cachedManifestDatabaseName ?? undefined;
  }

  try {
    const manifestPath = path.join(process.cwd(), "Database Schema", "data", "database-build-manifest.json");
    const raw = await fs.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(raw) as { applicationDatabaseName?: unknown };
    if (typeof parsed.applicationDatabaseName === "string" && parsed.applicationDatabaseName.trim()) {
      cachedManifestDatabaseName = parsed.applicationDatabaseName.trim();
      return cachedManifestDatabaseName;
    }
  } catch {
    // Ignore manifest read issues and fall back to defaults.
  }

  cachedManifestDatabaseName = null;
  return undefined;
}

export async function resolveAppDatabaseName(): Promise<string> {
  const fromEnv = envValue("TSAAT_APP_DATABASE", "APP_DATABASE_NAME", "SQL_APP_DATABASE");
  if (fromEnv) {
    return fromEnv;
  }

  const fromConfig = await loadDatabaseConnectionSettingsFromFile();
  if (fromConfig?.database.trim()) {
    return fromConfig.database.trim();
  }

  const fromManifest = await readManifestDatabaseName();
  return fromManifest ?? DEFAULT_APP_DATABASE;
}

export async function resolveSqlServerName(): Promise<string> {
  const fromEnv = envValue("TSAAT_SQL_SERVER", "SQL_SERVER");
  if (fromEnv) {
    return fromEnv;
  }

  const fromConfig = await loadDatabaseConnectionSettingsFromFile();
  if (fromConfig?.server.trim()) {
    return fromConfig.server.trim();
  }

  return DEFAULT_SQL_SERVER;
}

function resolveSqlcmdExecutable(): string {
  const fromEnv = process.env.SQLCMD_PATH ?? "";
  if (fromEnv.trim()) {
    return fromEnv.trim();
  }

  const bundledCandidates = [
    path.join(process.cwd(), "Dependencies", "external", "sqlcmd", "win-x64", "sqlcmd.exe"),
    path.join(process.cwd(), "Dependencies", "runtime", "sqlcmd", "win-x64", "sqlcmd.exe")
  ];
  for (const candidate of bundledCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "sqlcmd";
}

function resolveSqlcmdServerTarget(server: string): string {
  const normalized = server.trim();
  if (/^(tcp|np|lpc):/i.test(normalized)) {
    return normalized;
  }

  const isLocalTarget =
    normalized === "localhost" ||
    normalized === "." ||
    normalized === "(local)" ||
    /^localhost\\/i.test(normalized) ||
    /^\.\\/i.test(normalized) ||
    /^\(local\)\\/i.test(normalized);

  if (isLocalTarget) {
    return `lpc:${normalized}`;
  }

  return normalized;
}

async function resolveEffectiveConnection(databaseName?: string): Promise<ResolvedSqlConnection> {
  const dbConfig = await loadDatabaseConnectionSettingsFromFile();
  const server = (await resolveSqlServerName()).trim();
  const database = (databaseName?.trim() || (await resolveAppDatabaseName())).trim();

  if (!server) {
    throw new Error("Unable to resolve SQL Server name.");
  }
  if (!database) {
    throw new Error("Unable to resolve SQL database name.");
  }

  const auth = resolveAuthFromEnv() ?? resolveAuthFromDbConfig(dbConfig) ?? { mode: "trusted" };
  const ssl = normalizeSslConfig({
    sslEnabled: dbConfig?.sslEnabled,
    sslType: dbConfig?.sslType
  });
  return { server, database, auth, ...ssl };
}

function normalizeExplicitConnection(input: SqlConnectionInput): ResolvedSqlConnection {
  const server = input.server?.trim();
  const database = input.database?.trim();

  if (!server) {
    throw new Error("SQL connection server is required.");
  }
  if (!database) {
    throw new Error("SQL connection database is required.");
  }

  const userId = input.userId?.trim() ?? "";
  const password = input.password?.trim() ?? "";
  const trustedConnection = input.trustedConnection === true;
  const ssl = normalizeSslConfig({
    sslEnabled: input.sslEnabled,
    sslType: input.sslType
  });

  if (userId || password) {
    if (!userId || !password) {
      throw new Error("Both SQL user and password are required for SQL authentication.");
    }

    return {
      server,
      database,
      ...ssl,
      auth: {
        mode: "sql",
        userId,
        password
      }
    };
  }

  if (!trustedConnection) {
    throw new Error("SQL connection credentials are missing.");
  }

  return {
    server,
    database,
    ...ssl,
    auth: { mode: "trusted" }
  };
}

async function withTempSqlFile<T>(sqlText: string, callback: (sqlPath: string) => Promise<T>): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-sqlcmd-"));
  const sqlPath = path.join(tempDir, "query.sql");

  try {
    await fs.writeFile(sqlPath, sqlText, "utf-8");
    return await callback(sqlPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function executeSqlFileAgainstConnection(
  sqlPath: string,
  connection: ResolvedSqlConnection,
  options: ExecuteSqlFileOptions
): Promise<string> {
  const sqlcmd = resolveSqlcmdExecutable();

  const runSqlcmd = async (targetConnection: ResolvedSqlConnection): Promise<string> => {
    const targetServer = resolveSqlcmdServerTarget(targetConnection.server);
    const { stdout, stderr } = await execFileAsync(
      sqlcmd,
      [
        "-S",
        targetServer,
        "-d",
        targetConnection.database,
        ...buildSqlcmdAuthArgs(targetConnection.auth),
        ...buildSqlcmdSecurityArgs(targetConnection),
        "-b",
        "-w",
        "65535",
        "-y",
        "0",
        "-Y",
        "0",
        "-i",
        sqlPath
      ],
      {
        maxBuffer: SQLCMD_MAX_BUFFER,
        windowsHide: true
      }
    );

    if (stderr && stderr.trim()) {
      const normalized = stderr.trim();
      if (!/^Warning!/im.test(normalized)) {
        throw new Error(normalized);
      }
    }

    return stdout;
  };

  const formatSqlcmdFailure = (
    targetConnection: ResolvedSqlConnection,
    error: { code?: number; message?: string; stdout?: string; stderr?: string }
  ): string =>
    [
      `sqlcmd failed against server '${targetConnection.server}' (target '${resolveSqlcmdServerTarget(targetConnection.server)}') database '${targetConnection.database}' using ${targetConnection.auth.mode} authentication (SSL ${targetConnection.sslEnabled ? targetConnection.sslType : "disabled"}).`,
      error.message ? `Message: ${error.message}` : undefined,
      error.code !== undefined ? `Exit code: ${error.code}` : undefined,
      error.stderr?.trim() ? `stderr: ${error.stderr.trim()}` : undefined,
      error.stdout?.trim() ? `stdout: ${error.stdout.trim()}` : undefined
    ]
      .filter(Boolean)
      .join("\n");

  try {
    return await runSqlcmd(connection);
  } catch (error) {
    const err = error as {
      code?: number;
      message?: string;
      stdout?: string;
      stderr?: string;
    };
    const primaryErrorDetails = formatSqlcmdFailure(connection, err);

    if (
      options.allowTrustedFallback &&
      connection.auth.mode === "sql" &&
      allowTrustedRuntimeFallback() &&
      isSqlLoginFailure(err)
    ) {
      const trustedConnection: ResolvedSqlConnection = {
        ...connection,
        auth: { mode: "trusted" }
      };

      try {
        return await runSqlcmd(trustedConnection);
      } catch (fallbackError) {
        const fallbackErr = fallbackError as {
          code?: number;
          message?: string;
          stdout?: string;
          stderr?: string;
        };
        const fallbackErrorDetails = formatSqlcmdFailure(trustedConnection, fallbackErr);
        throw new Error(`${primaryErrorDetails}\nTrusted fallback failed.\n${fallbackErrorDetails}`);
      }
    }

    throw new Error(primaryErrorDetails);
  }
}

export async function executeSqlText(sqlText: string, databaseName?: string): Promise<string> {
  const connection = await resolveEffectiveConnection(databaseName);

  return withTempSqlFile(sqlText, async (sqlPath) =>
    executeSqlFileAgainstConnection(sqlPath, connection, { allowTrustedFallback: true })
  );
}

export async function executeSqlTextWithConnection(sqlText: string, connection: SqlConnectionInput): Promise<string> {
  const resolved = normalizeExplicitConnection(connection);
  return withTempSqlFile(sqlText, async (sqlPath) =>
    executeSqlFileAgainstConnection(sqlPath, resolved, { allowTrustedFallback: false })
  );
}

function extractMarkedJsonPayload(output: string): string {
  const begin = output.indexOf(SQLCMD_MARKER_BEGIN);
  const end = output.indexOf(SQLCMD_MARKER_END);

  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error(`Unable to locate JSON payload markers in sqlcmd output.`);
  }

  const payload = output
    .slice(begin + SQLCMD_MARKER_BEGIN.length, end)
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .trim();
  if (!payload) {
    throw new Error("SQL query returned an empty JSON payload.");
  }

  return payload;
}

function wrapJsonSql(innerSql: string): string {
  return `
SET NOCOUNT ON;
SELECT N'${SQLCMD_MARKER_BEGIN}';
${innerSql}
SELECT N'${SQLCMD_MARKER_END}';
`;
}

export async function executeSqlJson<T>(innerSql: string, databaseName?: string): Promise<T> {
  const wrapped = wrapJsonSql(innerSql);
  const output = await executeSqlText(wrapped, databaseName);
  const jsonPayload = extractMarkedJsonPayload(output);

  try {
    return JSON.parse(jsonPayload) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(`Failed to parse SQL JSON payload: ${message}`);
  }
}

export async function executeSqlJsonWithConnection<T>(
  innerSql: string,
  connection: SqlConnectionInput
): Promise<T> {
  const wrapped = wrapJsonSql(innerSql);
  const output = await executeSqlTextWithConnection(wrapped, connection);
  const jsonPayload = extractMarkedJsonPayload(output);

  try {
    return JSON.parse(jsonPayload) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(`Failed to parse SQL JSON payload: ${message}`);
  }
}

export function toSqlUnicodeLiteral(value: string): string {
  return `N'${value.replace(/'/g, "''")}'`;
}
