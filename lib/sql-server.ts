import "server-only";

import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DEFAULT_SQL_SERVER = "localhost\\SQLEXPRESS";
const DEFAULT_APP_DATABASE = "TSAAT";
const SQLCMD_MARKER_BEGIN = "__TSAAT_JSON_BEGIN__";
const SQLCMD_MARKER_END = "__TSAAT_JSON_END__";

const SQLCMD_MAX_BUFFER = 1024 * 1024 * 1024;

let cachedManifestDatabaseName: string | null | undefined;

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
  const fromEnv =
    process.env.TSAAT_APP_DATABASE ?? process.env.APP_DATABASE_NAME ?? process.env.SQL_APP_DATABASE ?? "";
  if (fromEnv.trim()) {
    return fromEnv.trim();
  }

  const fromManifest = await readManifestDatabaseName();
  return fromManifest ?? DEFAULT_APP_DATABASE;
}

export function resolveSqlServerName(): string {
  const fromEnv = process.env.TSAAT_SQL_SERVER ?? process.env.SQL_SERVER ?? "";
  return fromEnv.trim() || DEFAULT_SQL_SERVER;
}

function resolveSqlcmdExecutable(): string {
  const fromEnv = process.env.SQLCMD_PATH ?? "";
  return fromEnv.trim() || "sqlcmd";
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

export async function executeSqlText(sqlText: string, databaseName?: string): Promise<string> {
  const server = resolveSqlServerName();
  const database = databaseName?.trim() || (await resolveAppDatabaseName());
  const sqlcmd = resolveSqlcmdExecutable();

  return withTempSqlFile(sqlText, async (sqlPath) => {
    try {
      const { stdout, stderr } = await execFileAsync(
        sqlcmd,
        [
          "-S",
          server,
          "-d",
          database,
          "-E",
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
    } catch (error) {
      const err = error as {
        code?: number;
        message?: string;
        stdout?: string;
        stderr?: string;
      };

      const details = [
        `sqlcmd failed against server '${server}' database '${database}'.`,
        err.message ? `Message: ${err.message}` : undefined,
        err.code !== undefined ? `Exit code: ${err.code}` : undefined,
        err.stderr?.trim() ? `stderr: ${err.stderr.trim()}` : undefined,
        err.stdout?.trim() ? `stdout: ${err.stdout.trim()}` : undefined
      ]
        .filter(Boolean)
        .join("\n");

      throw new Error(details);
    }
  });
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

export async function executeSqlJson<T>(innerSql: string, databaseName?: string): Promise<T> {
  const wrapped = `
SET NOCOUNT ON;
SELECT N'${SQLCMD_MARKER_BEGIN}';
${innerSql}
SELECT N'${SQLCMD_MARKER_END}';
`;

  const output = await executeSqlText(wrapped, databaseName);
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
