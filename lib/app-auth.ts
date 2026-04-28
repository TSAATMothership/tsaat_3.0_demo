import "server-only";

import { hashPassword, PASSWORD_HASH_ALGORITHM, validateNewPassword, verifyPassword } from "@/lib/auth-password";
import { executeSqlJson, toSqlUnicodeLiteral } from "@/lib/sql-server";

const AUTH_SCHEMA = "tsaat";

interface AppUserRow {
  username: string;
  passwordHashHex: string;
  passwordSaltHex: string;
  hashAlgorithm: string;
  iterationCount: number;
  isActive: boolean;
  sessionVersion: number;
}

export interface AuthenticatedAppUser {
  username: string;
  sessionVersion: number;
}

function normalizeUsername(value: string): string {
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

function parseHexBytes(value: string): Buffer {
  const normalized = value.trim();
  if (!normalized || normalized.length % 2 !== 0 || /[^0-9a-f]/i.test(normalized)) {
    throw new Error("Stored password hash is malformed.");
  }

  return Buffer.from(normalized, "hex");
}

function toVarBinaryLiteral(value: Buffer): string {
  return `0x${value.toString("hex").toUpperCase()}`;
}

async function loadUserRow(username: string): Promise<AppUserRow | null> {
  const safeUsername = toSqlUnicodeLiteral(username);
  const row = await executeSqlJson<AppUserRow | null>(`
SELECT TOP (1)
  u.[username] AS [username],
  CONVERT(NVARCHAR(256), u.[password_hash], 2) AS [passwordHashHex],
  CONVERT(NVARCHAR(256), u.[password_salt], 2) AS [passwordSaltHex],
  u.[hash_algorithm] AS [hashAlgorithm],
  u.[iteration_count] AS [iterationCount],
  u.[is_active] AS [isActive],
  u.[session_version] AS [sessionVersion]
FROM [${AUTH_SCHEMA}].[app_user] u
WHERE u.[username] = ${safeUsername}
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`);

  if (!row) {
    return null;
  }

  return {
    username: String(row.username ?? "").trim(),
    passwordHashHex: String(row.passwordHashHex ?? "").trim(),
    passwordSaltHex: String(row.passwordSaltHex ?? "").trim(),
    hashAlgorithm: String(row.hashAlgorithm ?? "").trim(),
    iterationCount: Number(row.iterationCount),
    isActive: row.isActive === true || Number(row.isActive) === 1,
    sessionVersion: Number(row.sessionVersion)
  };
}

export async function authenticateAppUser(
  usernameInput: string,
  password: string
): Promise<AuthenticatedAppUser | null> {
  const username = normalizeUsername(usernameInput);
  const row = await loadUserRow(username);
  if (!row || !row.isActive) {
    return null;
  }

  if (row.hashAlgorithm !== PASSWORD_HASH_ALGORITHM) {
    return null;
  }

  const valid = await verifyPassword(
    password,
    parseHexBytes(row.passwordHashHex),
    parseHexBytes(row.passwordSaltHex),
    row.iterationCount
  );
  if (!valid) {
    return null;
  }

  return {
    username: row.username,
    sessionVersion: row.sessionVersion
  };
}

export async function loadActiveUserSession(usernameInput: string): Promise<AuthenticatedAppUser | null> {
  const username = normalizeUsername(usernameInput);
  const row = await loadUserRow(username);
  if (!row || !row.isActive) {
    return null;
  }

  return {
    username: row.username,
    sessionVersion: row.sessionVersion
  };
}

export async function changeAppUserPassword(
  usernameInput: string,
  currentPasswordInput: string,
  newPasswordInput: string
): Promise<AuthenticatedAppUser | null> {
  const username = normalizeUsername(usernameInput);
  const currentPassword = currentPasswordInput.trim();
  if (!currentPassword) {
    throw new Error("Current password is required.");
  }

  const newPassword = validateNewPassword(newPasswordInput);
  const row = await loadUserRow(username);
  if (!row || !row.isActive) {
    return null;
  }

  if (row.hashAlgorithm !== PASSWORD_HASH_ALGORITHM) {
    throw new Error("Stored password algorithm is unsupported.");
  }

  const currentPasswordValid = await verifyPassword(
    currentPassword,
    parseHexBytes(row.passwordHashHex),
    parseHexBytes(row.passwordSaltHex),
    row.iterationCount
  );
  if (!currentPasswordValid) {
    return null;
  }

  const nextHash = await hashPassword(newPassword);
  const safeUsername = toSqlUnicodeLiteral(username);
  const safeAlgorithm = toSqlUnicodeLiteral(nextHash.algorithm);

  const updated = await executeSqlJson<AuthenticatedAppUser | null>(`
UPDATE [${AUTH_SCHEMA}].[app_user]
SET
  [password_hash] = ${toVarBinaryLiteral(nextHash.hash)},
  [password_salt] = ${toVarBinaryLiteral(nextHash.salt)},
  [hash_algorithm] = ${safeAlgorithm},
  [iteration_count] = ${nextHash.iterationCount},
  [password_changed_at_utc] = SYSUTCDATETIME(),
  [session_version] = [session_version] + 1,
  [updated_at_utc] = SYSUTCDATETIME(),
  [updated_by] = SUSER_SNAME()
OUTPUT
  INSERTED.[username] AS [username],
  INSERTED.[session_version] AS [sessionVersion]
WHERE [username] = ${safeUsername}
  AND [is_active] = 1
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`);

  if (!updated) {
    return null;
  }

  return {
    username: String(updated.username ?? "").trim().toLowerCase(),
    sessionVersion: Number(updated.sessionVersion)
  };
}
