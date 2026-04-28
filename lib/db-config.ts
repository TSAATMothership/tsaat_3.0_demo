import "server-only";

import { execFile } from "child_process";
import { existsSync, promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type DatabaseAuthMode = "trusted" | "sql";
export type DatabaseSslType = "strict" | "trust-server-certificate";
export type DbConfigKeyProvider = "dpapi-current-user" | "dpapi-local-machine";

export interface EditableDatabaseConnectionInput {
  server: string;
  database: string;
  authMode: DatabaseAuthMode;
  userId: string;
  password: string;
  sslEnabled: boolean;
  sslType: DatabaseSslType;
}

export interface ParsedDatabaseConnectionSettings {
  server: string;
  database: string;
  authMode: DatabaseAuthMode;
  userId: string;
  password: string;
  trustedConnection: boolean;
  sslEnabled: boolean;
  sslType: DatabaseSslType;
  encrypt: boolean;
  trustServerCertificate: boolean;
  keyProvider: DbConfigKeyProvider;
}

interface DbConfigEncryptedEnvelope {
  format: string;
  version: number;
  keyProvider: DbConfigKeyProvider;
  algorithm: "dpapi";
  ciphertextBase64: string;
  updatedAtUtc: string;
}

interface PersistedDbConfigPayload {
  server: string;
  database: string;
  authMode: DatabaseAuthMode;
  userId: string;
  password: string;
  sslEnabled: boolean;
  sslType: DatabaseSslType;
}

const DB_CONFIG_FILENAME = "DB_config";
const DB_CONFIG_LEGACY_BACKUP_FILENAME = "DB_config.legacy.backup";
const DB_CONFIG_ENVELOPE_FORMAT = "tsaat-db-config";
const DB_CONFIG_ENVELOPE_VERSION = 1;
const DB_CONFIG_ENVELOPE_ALGORITHM = "dpapi";
const DB_CONFIG_DPAPI_ENTROPY = "TSAAT_DB_CONFIG_V1";
const DB_CONFIG_DPAPI_SCOPE_ENV_KEY = "TSAAT_DB_CONFIG_DPAPI_SCOPE";
const DB_CONFIG_ALLOW_LEGACY_PLAINTEXT_ENV_KEY = "TSAAT_DB_CONFIG_ALLOW_LEGACY_PLAINTEXT";
const DPAPI_HELPER_SCRIPT_RELATIVE_PATH = path.join("scripts", "invoke-dpapi.ps1");

type DpapiScope = "CurrentUser" | "LocalMachine";

export function resolveDbConfigFilePath(): string {
  return path.join(process.cwd(), DB_CONFIG_FILENAME);
}

function resolveLegacyBackupFilePath(): string {
  return path.join(process.cwd(), DB_CONFIG_LEGACY_BACKUP_FILENAME);
}

function resolveDpapiHelperScriptPath(): string {
  return path.join(process.cwd(), DPAPI_HELPER_SCRIPT_RELATIVE_PATH);
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

function normalizeLegacySupportFlag(value: string | undefined): boolean {
  return parseBoolean(value) === true;
}

function resolvePreferredKeyProvider(): DbConfigKeyProvider {
  const raw = (process.env[DB_CONFIG_DPAPI_SCOPE_ENV_KEY] ?? "").trim().toLowerCase();
  if (raw === "local-machine" || raw === "localmachine") {
    return "dpapi-local-machine";
  }

  return "dpapi-current-user";
}

function scopeFromKeyProvider(provider: DbConfigKeyProvider): DpapiScope {
  return provider === "dpapi-local-machine" ? "LocalMachine" : "CurrentUser";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDbConfigEnvelope(value: unknown): value is DbConfigEncryptedEnvelope {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.format === DB_CONFIG_ENVELOPE_FORMAT &&
    value.version === DB_CONFIG_ENVELOPE_VERSION &&
    (value.keyProvider === "dpapi-current-user" || value.keyProvider === "dpapi-local-machine") &&
    value.algorithm === DB_CONFIG_ENVELOPE_ALGORITHM &&
    typeof value.ciphertextBase64 === "string" &&
    value.ciphertextBase64.trim().length > 0 &&
    typeof value.updatedAtUtc === "string" &&
    value.updatedAtUtc.trim().length > 0
  );
}

function sanitizeDpapiFailure(error: unknown, action: "encrypt" | "decrypt"): Error {
  const message = error instanceof Error ? error.message : "Unknown DPAPI error.";
  const prefix = action === "encrypt" ? "Failed to encrypt database config" : "Failed to decrypt database config";
  return new Error(`${prefix}. ${message}`);
}

async function runDpapiOperation(
  action: "protect" | "unprotect",
  provider: DbConfigKeyProvider,
  inputBytes: Buffer
): Promise<Buffer> {
  const helperPath = resolveDpapiHelperScriptPath();
  if (!existsSync(helperPath)) {
    throw new Error(`Missing DPAPI helper script at ${helperPath}.`);
  }

  const inputBase64 = inputBytes.toString("base64");

  try {
    const { stdout, stderr } = await execFileAsync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        helperPath,
        "-Mode",
        action,
        "-Scope",
        scopeFromKeyProvider(provider),
        "-InputBase64",
        inputBase64,
        "-EntropyText",
        DB_CONFIG_DPAPI_ENTROPY
      ],
      {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024
      }
    );

    const stderrText = stderr.trim();
    if (stderrText) {
      throw new Error(stderrText);
    }

    const output = stdout.trim();
    if (!output) {
      throw new Error("DPAPI helper returned no output.");
    }

    try {
      return Buffer.from(output, "base64");
    } catch {
      throw new Error("DPAPI helper returned invalid ciphertext output.");
    }
  } catch (error) {
    throw sanitizeDpapiFailure(error, action === "protect" ? "encrypt" : "decrypt");
  }
}

async function encryptPayloadWithDpapi(payload: PersistedDbConfigPayload, keyProvider: DbConfigKeyProvider): Promise<string> {
  const json = JSON.stringify(payload);
  const plainBytes = Buffer.from(json, "utf-8");
  const cipherBytes = await runDpapiOperation("protect", keyProvider, plainBytes);
  return cipherBytes.toString("base64");
}

async function decryptPayloadWithDpapi(
  envelope: DbConfigEncryptedEnvelope
): Promise<PersistedDbConfigPayload> {
  let encryptedBytes: Buffer;
  try {
    encryptedBytes = Buffer.from(envelope.ciphertextBase64, "base64");
  } catch {
    throw new Error("Encrypted DB_config payload is not valid base64.");
  }

  const decryptedBytes = await runDpapiOperation("unprotect", envelope.keyProvider, encryptedBytes);
  const rawPayload = decryptedBytes.toString("utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error("Encrypted DB_config payload is not valid JSON.");
  }

  return normalizePersistedPayload(parsed);
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

function parseOptionalBooleanInput(name: string, value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseBoolean(value);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  throw new Error(`${name} must be a boolean.`);
}

function parseSslType(input: Record<string, unknown>): DatabaseSslType | undefined {
  if (input.sslType === undefined || input.sslType === null || input.sslType === "") {
    return undefined;
  }

  if (typeof input.sslType !== "string") {
    throw new Error("SSL type must be a string.");
  }

  const normalized = input.sslType.trim().toLowerCase();
  if (normalized === "strict") {
    return "strict";
  }
  if (normalized === "trust-server-certificate") {
    return "trust-server-certificate";
  }

  throw new Error("SSL type must be either 'strict' or 'trust-server-certificate'.");
}

export function normalizeEditableDatabaseConnectionInput(input: unknown): EditableDatabaseConnectionInput {
  if (!input || typeof input !== "object") {
    throw new Error("Database settings payload is invalid.");
  }

  const candidate = input as Record<string, unknown>;
  const authMode = parseAuthMode(candidate);
  const userId = sanitizeOptionalField("User Id", candidate.userId);
  const password = sanitizeOptionalField("Password", candidate.password);
  const sslTypeInput = parseSslType(candidate);
  const sslEnabledInput = parseOptionalBooleanInput("SSL enabled", candidate.sslEnabled);
  const encryptInput = parseOptionalBooleanInput("Encrypt", candidate.encrypt);
  const trustServerCertificateInput = parseOptionalBooleanInput(
    "Trust Server Certificate",
    candidate.trustServerCertificate
  );

  let sslEnabled = sslEnabledInput ?? encryptInput ?? false;
  let sslType: DatabaseSslType = sslTypeInput ?? (trustServerCertificateInput === true ? "trust-server-certificate" : "strict");

  if (sslType === "trust-server-certificate" || trustServerCertificateInput === true) {
    sslEnabled = true;
    sslType = "trust-server-certificate";
  }

  if (!sslEnabled) {
    sslType = "strict";
  }

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
    password,
    sslEnabled,
    sslType
  };
}

export function formatDatabaseConnectionString(input: EditableDatabaseConnectionInput): string {
  const trustedConnection = input.authMode === "trusted" ? "True" : "False";
  const sslEnabled = input.sslEnabled === true;
  const trustServerCertificate = sslEnabled && input.sslType === "trust-server-certificate";
  const encrypt = sslEnabled ? "True" : "False";
  const trustServerCertificateString = trustServerCertificate ? "True" : "False";
  const segments = [`Server=${input.server}`, `Database=${input.database}`, `Trusted_Connection=${trustedConnection}`];

  if (input.userId) {
    segments.push(`User Id=${input.userId}`);
  }
  if (input.password) {
    segments.push(`Password=${input.password}`);
  }
  segments.push(`Encrypt=${encrypt}`);
  segments.push(`TrustServerCertificate=${trustServerCertificateString}`);

  return `${segments.join(";")};`;
}

export function parseConnectionString(connectionString: string): {
  server?: string;
  database?: string;
  userId?: string;
  password?: string;
  trustedConnection?: boolean;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
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
  const encrypt = parseBoolean(values.get("encrypt"));
  const trustServerCertificate = parseBoolean(values.get("trustservercertificate"));

  return {
    server,
    database,
    userId,
    password,
    trustedConnection,
    encrypt,
    trustServerCertificate
  };
}

function normalizePersistedPayload(input: unknown): PersistedDbConfigPayload {
  if (!isRecord(input)) {
    throw new Error("Encrypted DB_config payload is invalid.");
  }

  return normalizeEditableDatabaseConnectionInput(input);
}

function toParsedSettings(
  normalized: PersistedDbConfigPayload,
  keyProvider: DbConfigKeyProvider
): ParsedDatabaseConnectionSettings {
  const trustedConnection = normalized.authMode === "trusted";
  const sslEnabled = normalized.sslEnabled === true;
  const trustServerCertificate = sslEnabled && normalized.sslType === "trust-server-certificate";
  const encrypt = sslEnabled;

  return {
    server: normalized.server,
    database: normalized.database,
    authMode: normalized.authMode,
    userId: normalized.userId,
    password: normalized.password,
    trustedConnection,
    sslEnabled,
    sslType: normalized.sslType,
    encrypt,
    trustServerCertificate,
    keyProvider
  };
}

async function readDbConfigRawFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function resolveFirstNonCommentLine(raw: string): string | null {
  const line = raw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry && !entry.startsWith("#"));

  return line ?? null;
}

function parseEnvelopeFromRawContent(raw: string): DbConfigEncryptedEnvelope | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isDbConfigEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeFileAtomically(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, content, "utf-8");

  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "EEXIST" || err.code === "EPERM") {
      await fs.rm(filePath, { force: true });
      await fs.rename(tempPath, filePath);
    } else {
      await fs.rm(tempPath, { force: true });
      throw error;
    }
  }
}

async function tryHardenDbConfigAcl(filePath: string): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  const escapedPath = filePath.replace(/'/g, "''");
  const aclScript =
    "$ErrorActionPreference='Stop';" +
    `$target='${escapedPath}';` +
    "$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name;" +
    "icacls $target /inheritance:r /grant:r \"$identity:(R,W)\" \"SYSTEM:(R,W)\" \"Administrators:(R,W)\" | Out-Null;";

  try {
    await execFileAsync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", aclScript],
      {
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024
      }
    );
  } catch {
    // Best effort only. ACL hardening failures should not break settings persistence.
  }
}

async function writeEncryptedEnvelopeToFile(
  normalized: PersistedDbConfigPayload,
  keyProvider: DbConfigKeyProvider,
  filePath: string
): Promise<void> {
  const ciphertextBase64 = await encryptPayloadWithDpapi(normalized, keyProvider);
  const envelope: DbConfigEncryptedEnvelope = {
    format: DB_CONFIG_ENVELOPE_FORMAT,
    version: DB_CONFIG_ENVELOPE_VERSION,
    keyProvider,
    algorithm: DB_CONFIG_ENVELOPE_ALGORITHM,
    ciphertextBase64,
    updatedAtUtc: new Date().toISOString()
  };

  await writeFileAtomically(filePath, `${JSON.stringify(envelope, null, 2)}\n`);
  await tryHardenDbConfigAcl(filePath);
}

function normalizeLegacyPlaintextSettings(rawLine: string): PersistedDbConfigPayload {
  const parsed = parseConnectionString(rawLine);
  const hasAnySqlCredential = Boolean(parsed.userId || parsed.password);
  const trustedConnection = parsed.trustedConnection ?? !hasAnySqlCredential;
  const authMode: DatabaseAuthMode = trustedConnection ? "trusted" : "sql";
  const trustServerCertificate = parsed.trustServerCertificate === true;
  const encrypt = trustServerCertificate ? true : parsed.encrypt === true;
  const sslEnabled = encrypt;
  const sslType: DatabaseSslType = trustServerCertificate ? "trust-server-certificate" : "strict";

  return normalizeEditableDatabaseConnectionInput({
    server: parsed.server ?? "",
    database: parsed.database ?? "",
    authMode,
    userId: parsed.userId ?? "",
    password: parsed.password ?? "",
    sslEnabled,
    sslType
  });
}

async function migrateLegacyPlaintextConfig(rawLine: string, filePath: string): Promise<ParsedDatabaseConnectionSettings> {
  const normalized = normalizeLegacyPlaintextSettings(rawLine);
  const backupPath = resolveLegacyBackupFilePath();

  const originalRaw = await fs.readFile(filePath, "utf-8");
  await writeFileAtomically(backupPath, originalRaw);

  const keyProvider = resolvePreferredKeyProvider();
  await writeEncryptedEnvelopeToFile(normalized, keyProvider, filePath);

  return toParsedSettings(normalized, keyProvider);
}

export async function loadDatabaseConnectionSettingsFromFile(): Promise<ParsedDatabaseConnectionSettings | null> {
  const filePath = resolveDbConfigFilePath();
  const raw = await readDbConfigRawFile(filePath);
  if (!raw || !raw.trim()) {
    return null;
  }

  const envelope = parseEnvelopeFromRawContent(raw);
  if (envelope) {
    const decrypted = await decryptPayloadWithDpapi(envelope);
    return toParsedSettings(decrypted, envelope.keyProvider);
  }

  const legacyLine = resolveFirstNonCommentLine(raw);
  if (!legacyLine) {
    return null;
  }

  if (normalizeLegacySupportFlag(process.env[DB_CONFIG_ALLOW_LEGACY_PLAINTEXT_ENV_KEY])) {
    const normalized = normalizeLegacyPlaintextSettings(legacyLine);
    return toParsedSettings(normalized, resolvePreferredKeyProvider());
  }

  return migrateLegacyPlaintextConfig(legacyLine, filePath);
}

export async function saveDatabaseConnectionSettingsToFile(input: EditableDatabaseConnectionInput): Promise<void> {
  const normalized = normalizeEditableDatabaseConnectionInput(input);
  const filePath = resolveDbConfigFilePath();
  const keyProvider = resolvePreferredKeyProvider();

  await writeEncryptedEnvelopeToFile(normalized, keyProvider, filePath);
}
