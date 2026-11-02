import "server-only";

import { execFile } from "child_process";
import { existsSync, promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import {
  hashPassword,
  PASSWORD_HASH_ALGORITHM,
  PASSWORD_HASH_BYTES,
  PASSWORD_SALT_BYTES,
  validateNewPassword,
  verifyPassword
} from "@/lib/auth-password";

const execFileAsync = promisify(execFile);

const LOGIN_DETAILS_FILENAME = "logindetails";
const LOGIN_DETAILS_ENVELOPE_FORMAT = "tsaat-logindetails";
const LOGIN_DETAILS_ENVELOPE_VERSION = 1;
const LOGIN_DETAILS_ENVELOPE_ALGORITHM = "dpapi";
const LOGIN_DETAILS_DPAPI_ENTROPY = "TSAAT_LOGINDETAILS_V1";
const LOGIN_DETAILS_KEY_PROVIDER = "dpapi-current-user";
const MIN_PASSWORD_ITERATIONS = 100000;
const DPAPI_HELPER_SCRIPT_RELATIVE_PATH = path.join("scripts", "invoke-dpapi.ps1");

interface LoginDetailsEncryptedEnvelope {
  format: typeof LOGIN_DETAILS_ENVELOPE_FORMAT;
  version: typeof LOGIN_DETAILS_ENVELOPE_VERSION;
  keyProvider: typeof LOGIN_DETAILS_KEY_PROVIDER;
  algorithm: typeof LOGIN_DETAILS_ENVELOPE_ALGORITHM;
  ciphertextBase64: string;
  updatedAtUtc: string;
}

interface PersistedLoginDetailsPayload {
  username: string;
  passwordHashBase64: string;
  passwordSaltBase64: string;
  hashAlgorithm: typeof PASSWORD_HASH_ALGORITHM;
  iterationCount: number;
  passwordChangedAtUtc: string;
  sessionVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface LoginDetailsRecord {
  username: string;
  passwordHash: Buffer;
  passwordSalt: Buffer;
  hashAlgorithm: typeof PASSWORD_HASH_ALGORITHM;
  iterationCount: number;
  passwordChangedAtUtc: string;
  sessionVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AuthenticatedLoginDetailsUser {
  username: string;
  sessionVersion: number;
}

type DpapiScope = "CurrentUser";

export function resolveLoginDetailsFilePath(): string {
  return path.join(process.cwd(), LOGIN_DETAILS_FILENAME);
}

function resolveDpapiHelperScriptPath(): string {
  return path.join(process.cwd(), DPAPI_HELPER_SCRIPT_RELATIVE_PATH);
}

export function normalizeLoginUsername(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Username is required.");
  }

  if (normalized.length > 120) {
    throw new Error("Username is too long.");
  }

  if (/[\r\n\t]/.test(normalized)) {
    throw new Error("Username contains invalid characters.");
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoginDetailsEnvelope(value: unknown): value is LoginDetailsEncryptedEnvelope {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.format === LOGIN_DETAILS_ENVELOPE_FORMAT &&
    value.version === LOGIN_DETAILS_ENVELOPE_VERSION &&
    value.keyProvider === LOGIN_DETAILS_KEY_PROVIDER &&
    value.algorithm === LOGIN_DETAILS_ENVELOPE_ALGORITHM &&
    typeof value.ciphertextBase64 === "string" &&
    value.ciphertextBase64.trim().length > 0 &&
    typeof value.updatedAtUtc === "string" &&
    value.updatedAtUtc.trim().length > 0
  );
}

function sanitizeDpapiFailure(error: unknown, action: "encrypt" | "decrypt"): Error {
  const message = error instanceof Error ? error.message : "Unknown DPAPI error.";
  const prefix =
    action === "encrypt"
      ? "Failed to encrypt logindetails"
      : "Failed to decrypt logindetails. Re-run compileApp.cmd to recreate it for this Windows identity";
  return new Error(`${prefix}. ${message}`);
}

async function runDpapiOperation(action: "protect" | "unprotect", inputBytes: Buffer): Promise<Buffer> {
  const helperPath = resolveDpapiHelperScriptPath();
  if (!existsSync(helperPath)) {
    throw new Error(`Missing DPAPI helper script at ${helperPath}.`);
  }

  const inputBase64 = inputBytes.toString("base64");
  const dpapiScope: DpapiScope = "CurrentUser";

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
        dpapiScope,
        "-InputBase64",
        inputBase64,
        "-EntropyText",
        LOGIN_DETAILS_DPAPI_ENTROPY
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

    return Buffer.from(output, "base64");
  } catch (error) {
    throw sanitizeDpapiFailure(error, action === "protect" ? "encrypt" : "decrypt");
  }
}

async function encryptPayloadWithDpapi(payload: PersistedLoginDetailsPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const plainBytes = Buffer.from(json, "utf-8");
  const cipherBytes = await runDpapiOperation("protect", plainBytes);
  return cipherBytes.toString("base64");
}

async function decryptPayloadWithDpapi(envelope: LoginDetailsEncryptedEnvelope): Promise<PersistedLoginDetailsPayload> {
  let encryptedBytes: Buffer;
  try {
    encryptedBytes = Buffer.from(envelope.ciphertextBase64, "base64");
  } catch {
    throw new Error("Encrypted logindetails payload is not valid base64.");
  }

  const decryptedBytes = await runDpapiOperation("unprotect", encryptedBytes);
  const rawPayload = decryptedBytes.toString("utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error("Encrypted logindetails payload is not valid JSON.");
  }

  return normalizePersistedPayload(parsed);
}

function requireString(name: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}

function requireBase64Buffer(name: string, value: unknown, expectedBytes: number): Buffer {
  const raw = requireString(name, value);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0) {
    throw new Error(`${name} is not valid base64.`);
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== expectedBytes) {
    throw new Error(`${name} has unexpected length.`);
  }

  return decoded;
}

function requirePositiveInteger(name: string, value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function normalizePersistedPayload(input: unknown): PersistedLoginDetailsPayload {
  if (!isRecord(input)) {
    throw new Error("Encrypted logindetails payload is invalid.");
  }

  const username = normalizeLoginUsername(requireString("Username", input.username));
  const passwordHashBase64 = requireString("Password hash", input.passwordHashBase64);
  const passwordSaltBase64 = requireString("Password salt", input.passwordSaltBase64);
  requireBase64Buffer("Password hash", passwordHashBase64, PASSWORD_HASH_BYTES);
  requireBase64Buffer("Password salt", passwordSaltBase64, PASSWORD_SALT_BYTES);

  if (input.hashAlgorithm !== PASSWORD_HASH_ALGORITHM) {
    throw new Error("Stored password algorithm is unsupported.");
  }

  const iterationCount = requirePositiveInteger("Iteration count", input.iterationCount);
  if (iterationCount < MIN_PASSWORD_ITERATIONS) {
    throw new Error(`Iteration count must be at least ${MIN_PASSWORD_ITERATIONS}.`);
  }

  const sessionVersion = requirePositiveInteger("Session version", input.sessionVersion);

  return {
    username,
    passwordHashBase64,
    passwordSaltBase64,
    hashAlgorithm: PASSWORD_HASH_ALGORITHM,
    iterationCount,
    passwordChangedAtUtc: requireString("Password changed timestamp", input.passwordChangedAtUtc),
    sessionVersion,
    createdAtUtc: requireString("Created timestamp", input.createdAtUtc),
    updatedAtUtc: requireString("Updated timestamp", input.updatedAtUtc)
  };
}

function toRecord(payload: PersistedLoginDetailsPayload): LoginDetailsRecord {
  return {
    username: payload.username,
    passwordHash: requireBase64Buffer("Password hash", payload.passwordHashBase64, PASSWORD_HASH_BYTES),
    passwordSalt: requireBase64Buffer("Password salt", payload.passwordSaltBase64, PASSWORD_SALT_BYTES),
    hashAlgorithm: payload.hashAlgorithm,
    iterationCount: payload.iterationCount,
    passwordChangedAtUtc: payload.passwordChangedAtUtc,
    sessionVersion: payload.sessionVersion,
    createdAtUtc: payload.createdAtUtc,
    updatedAtUtc: payload.updatedAtUtc
  };
}

function toPersistedPayload(record: LoginDetailsRecord): PersistedLoginDetailsPayload {
  return {
    username: normalizeLoginUsername(record.username),
    passwordHashBase64: record.passwordHash.toString("base64"),
    passwordSaltBase64: record.passwordSalt.toString("base64"),
    hashAlgorithm: record.hashAlgorithm,
    iterationCount: record.iterationCount,
    passwordChangedAtUtc: record.passwordChangedAtUtc,
    sessionVersion: record.sessionVersion,
    createdAtUtc: record.createdAtUtc,
    updatedAtUtc: record.updatedAtUtc
  };
}

async function readLoginDetailsRawFile(filePath: string): Promise<string | null> {
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

function parseEnvelopeFromRawContent(raw: string): LoginDetailsEncryptedEnvelope {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    throw new Error("logindetails is not in encrypted envelope format.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("logindetails contains invalid JSON.");
  }

  if (!isLoginDetailsEnvelope(parsed)) {
    throw new Error("logindetails envelope metadata is invalid.");
  }

  return parsed;
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

async function tryHardenLoginDetailsAcl(filePath: string): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  const escapedPath = filePath.replace(/'/g, "''");
  const aclScript =
    "$ErrorActionPreference='Stop';" +
    `$target='${escapedPath}';` +
    "$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name;" +
    "icacls $target /inheritance:r /grant:r \"$($identity):(R,W)\" \"SYSTEM:(R,W)\" \"Administrators:(R,W)\" | Out-Null;";

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
    // Best effort only. ACL hardening failures should not block credential persistence.
  }
}

async function writeEncryptedEnvelopeToFile(record: LoginDetailsRecord, filePath: string): Promise<void> {
  const payload = toPersistedPayload(record);
  const ciphertextBase64 = await encryptPayloadWithDpapi(payload);
  const envelope: LoginDetailsEncryptedEnvelope = {
    format: LOGIN_DETAILS_ENVELOPE_FORMAT,
    version: LOGIN_DETAILS_ENVELOPE_VERSION,
    keyProvider: LOGIN_DETAILS_KEY_PROVIDER,
    algorithm: LOGIN_DETAILS_ENVELOPE_ALGORITHM,
    ciphertextBase64,
    updatedAtUtc: new Date().toISOString()
  };

  await writeFileAtomically(filePath, `${JSON.stringify(envelope, null, 2)}\n`);
  await tryHardenLoginDetailsAcl(filePath);
}

export async function loadLoginDetailsFromFile(): Promise<LoginDetailsRecord | null> {
  const filePath = resolveLoginDetailsFilePath();
  const raw = await readLoginDetailsRawFile(filePath);
  if (!raw || !raw.trim()) {
    return null;
  }

  const envelope = parseEnvelopeFromRawContent(raw);
  const payload = await decryptPayloadWithDpapi(envelope);
  return toRecord(payload);
}

export async function saveInitialLoginDetails(usernameInput: string, passwordInput: string): Promise<LoginDetailsRecord> {
  const username = normalizeLoginUsername(usernameInput);
  const password = validateNewPassword(passwordInput);
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const record: LoginDetailsRecord = {
    username,
    passwordHash: passwordHash.hash,
    passwordSalt: passwordHash.salt,
    hashAlgorithm: passwordHash.algorithm,
    iterationCount: passwordHash.iterationCount,
    passwordChangedAtUtc: now,
    sessionVersion: 1,
    createdAtUtc: now,
    updatedAtUtc: now
  };

  await writeEncryptedEnvelopeToFile(record, resolveLoginDetailsFilePath());
  return record;
}

export async function authenticateLoginDetailsUser(
  usernameInput: string,
  password: string
): Promise<AuthenticatedLoginDetailsUser | null> {
  const username = normalizeLoginUsername(usernameInput);
  const record = await loadLoginDetailsFromFile();
  if (!record || record.username !== username || record.hashAlgorithm !== PASSWORD_HASH_ALGORITHM) {
    return null;
  }

  const valid = await verifyPassword(password, record.passwordHash, record.passwordSalt, record.iterationCount);
  if (!valid) {
    return null;
  }

  return {
    username: record.username,
    sessionVersion: record.sessionVersion
  };
}

export async function loadActiveLoginDetailsSession(
  usernameInput: string
): Promise<AuthenticatedLoginDetailsUser | null> {
  const username = normalizeLoginUsername(usernameInput);
  const record = await loadLoginDetailsFromFile();
  if (!record || record.username !== username) {
    return null;
  }

  return {
    username: record.username,
    sessionVersion: record.sessionVersion
  };
}

export async function changeLoginDetailsPassword(
  usernameInput: string,
  currentPasswordInput: string,
  newPasswordInput: string
): Promise<AuthenticatedLoginDetailsUser | null> {
  const username = normalizeLoginUsername(usernameInput);
  const currentPassword = currentPasswordInput.trim();
  if (!currentPassword) {
    throw new Error("Current password is required.");
  }

  const newPassword = validateNewPassword(newPasswordInput);
  const record = await loadLoginDetailsFromFile();
  if (!record || record.username !== username) {
    return null;
  }

  if (record.hashAlgorithm !== PASSWORD_HASH_ALGORITHM) {
    throw new Error("Stored password algorithm is unsupported.");
  }

  const currentPasswordValid = await verifyPassword(
    currentPassword,
    record.passwordHash,
    record.passwordSalt,
    record.iterationCount
  );
  if (!currentPasswordValid) {
    return null;
  }

  const nextHash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  const updated: LoginDetailsRecord = {
    ...record,
    passwordHash: nextHash.hash,
    passwordSalt: nextHash.salt,
    hashAlgorithm: nextHash.algorithm,
    iterationCount: nextHash.iterationCount,
    passwordChangedAtUtc: now,
    sessionVersion: record.sessionVersion + 1,
    updatedAtUtc: now
  };

  await writeEncryptedEnvelopeToFile(updated, resolveLoginDetailsFilePath());

  return {
    username: updated.username,
    sessionVersion: updated.sessionVersion
  };
}
