import "server-only";

import { promises as fs } from "fs";
import path from "path";

export type DatabaseAuthMode = "trusted" | "sql";

export interface EditableDatabaseConnectionInput {
  server: string;
  database: string;
  authMode: DatabaseAuthMode;
  userId: string;
  password: string;
}

export interface ParsedDatabaseConnectionSettings {
  server: string;
  database: string;
  authMode: DatabaseAuthMode;
  userId: string;
  password: string;
  trustedConnection: boolean;
  rawConnectionString: string;
}

const DB_CONFIG_FILENAME = "DB_config";
const CONNECTION_TEMPLATE_COMMENT = "# Format: Server=...;Database=...;Trusted_Connection=True|False;User Id=...;Password=...;";

export function resolveDbConfigFilePath(): string {
  return path.join(process.cwd(), DB_CONFIG_FILENAME);
}

function normalizeConnectionKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/[\s_]+/g, "");
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

export function parseConnectionString(connectionString: string): {
  server?: string;
  database?: string;
  userId?: string;
  password?: string;
  trustedConnection?: boolean;
} {
  const values = new Map<string, string>();

  for (const segment of connectionString.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = normalizeConnectionKey(trimmed.slice(0, separatorIndex));
    const value = trimmed.slice(separatorIndex + 1).trim();
    values.set(key, value);
  }

  const server = values.get("server") ?? values.get("datasource") ?? values.get("address") ?? values.get("addr");
  const database = values.get("database") ?? values.get("initialcatalog");
  const userId = values.get("userid") ?? values.get("uid") ?? values.get("user") ?? values.get("username");
  const password = values.get("password") ?? values.get("pwd");
  const trustedConnection = parseBoolean(values.get("trustedconnection") ?? values.get("integratedsecurity"));

  return {
    server,
    database,
    userId,
    password,
    trustedConnection
  };
}

async function readFirstConnectionStringLine(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const line = raw
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry && !entry.startsWith("#"));

    return line ?? null;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function loadDatabaseConnectionSettingsFromFile(): Promise<ParsedDatabaseConnectionSettings | null> {
  const filePath = resolveDbConfigFilePath();
  const line = await readFirstConnectionStringLine(filePath);
  if (!line) {
    return null;
  }

  const parsed = parseConnectionString(line);
  const hasAnySqlCredential = Boolean(parsed.userId || parsed.password);
  const trustedConnection = parsed.trustedConnection ?? !hasAnySqlCredential;
  const authMode: DatabaseAuthMode = trustedConnection ? "trusted" : "sql";

  return {
    server: parsed.server ?? "",
    database: parsed.database ?? "",
    authMode,
    userId: parsed.userId ?? "",
    password: parsed.password ?? "",
    trustedConnection,
    rawConnectionString: line
  };
}

function sanitizeField(name: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} is required.`);
  }

  if (/[\r\n]/.test(trimmed)) {
    throw new Error(`${name} cannot contain line breaks.`);
  }

  if (trimmed.includes(";")) {
    throw new Error(`${name} cannot include ';'.`);
  }

  return trimmed;
}

function sanitizeOptionalField(name: string, value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }

  const trimmed = value.trim();
  if (/[\r\n]/.test(trimmed)) {
    throw new Error(`${name} cannot contain line breaks.`);
  }
  if (trimmed.includes(";")) {
    throw new Error(`${name} cannot include ';'.`);
  }

  return trimmed;
}

function parseAuthMode(input: Record<string, unknown>): DatabaseAuthMode {
  if (typeof input.authMode === "string") {
    const normalized = input.authMode.trim().toLowerCase();
    if (normalized === "trusted") {
      return "trusted";
    }
    if (normalized === "sql") {
      return "sql";
    }
  }

  if (typeof input.trustedConnection === "boolean") {
    return input.trustedConnection ? "trusted" : "sql";
  }

  return "sql";
}

export function normalizeEditableDatabaseConnectionInput(input: unknown): EditableDatabaseConnectionInput {
  if (!input || typeof input !== "object") {
    throw new Error("Database settings payload is invalid.");
  }

  const candidate = input as Record<string, unknown>;
  const authMode = parseAuthMode(candidate);
  const userId = sanitizeOptionalField("User Id", candidate.userId);
  const password = sanitizeOptionalField("Password", candidate.password);

  if (authMode === "sql") {
    if (!userId) {
      throw new Error("User Id is required when SQL authentication is selected.");
    }
    if (!password) {
      throw new Error("Password is required when SQL authentication is selected.");
    }
  }

  return {
    server: sanitizeField("Server", candidate.server),
    database: sanitizeField("Database", candidate.database),
    authMode,
    userId,
    password
  };
}

export function formatDatabaseConnectionString(input: EditableDatabaseConnectionInput): string {
  const trustedConnection = input.authMode === "trusted" ? "True" : "False";
  const segments = [`Server=${input.server}`, `Database=${input.database}`, `Trusted_Connection=${trustedConnection}`];

  if (input.userId) {
    segments.push(`User Id=${input.userId}`);
  }
  if (input.password) {
    segments.push(`Password=${input.password}`);
  }

  return `${segments.join(";")};`;
}

export async function saveDatabaseConnectionSettingsToFile(input: EditableDatabaseConnectionInput): Promise<string> {
  const normalized = normalizeEditableDatabaseConnectionInput(input);
  const connectionString = formatDatabaseConnectionString(normalized);
  const filePath = resolveDbConfigFilePath();

  const nextFileContent = `${connectionString}\n${CONNECTION_TEMPLATE_COMMENT}\n`;
  await fs.writeFile(filePath, nextFileContent, "utf-8");

  return connectionString;
}
