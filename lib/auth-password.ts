import "server-only";

import { pbkdf2Sync, randomBytes } from "crypto";

export const PASSWORD_HASH_ALGORITHM = "PBKDF2-HMAC-SHA256";
export const PASSWORD_HASH_DIGEST = "sha256";
export const PASSWORD_HASH_BYTES = 32;
export const PASSWORD_SALT_BYTES = 16;
export const DEFAULT_PASSWORD_ITERATIONS = 210000;
export const MIN_PASSWORD_LENGTH = 8;

function resolveIterationCount(): number {
  const raw = process.env.TSAAT_AUTH_PASSWORD_ITERATIONS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isInteger(parsed) && parsed >= 100000) {
    return parsed;
  }

  return DEFAULT_PASSWORD_ITERATIONS;
}

export interface PasswordHashRecord {
  hash: Buffer;
  salt: Buffer;
  iterationCount: number;
  algorithm: typeof PASSWORD_HASH_ALGORITHM;
}

export async function hashPassword(password: string): Promise<PasswordHashRecord> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const iterationCount = resolveIterationCount();
  const hash = pbkdf2Sync(
    password,
    salt.toString("base64"),
    iterationCount,
    PASSWORD_HASH_BYTES,
    PASSWORD_HASH_DIGEST
  );

  return {
    hash,
    salt,
    iterationCount,
    algorithm: PASSWORD_HASH_ALGORITHM
  };
}

export async function verifyPassword(
  password: string,
  expectedHash: Buffer,
  salt: Buffer,
  iterationCount: number
): Promise<boolean> {
  if (!password || !expectedHash.length || !salt.length || !Number.isInteger(iterationCount) || iterationCount < 1) {
    return false;
  }

  const calculatedHash = pbkdf2Sync(
    password,
    salt.toString("base64"),
    iterationCount,
    expectedHash.length,
    PASSWORD_HASH_DIGEST
  );

  if (calculatedHash.length !== expectedHash.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < calculatedHash.length; index += 1) {
    mismatch |= calculatedHash[index] ^ expectedHash[index];
  }

  return mismatch === 0;
}

export function validateNewPassword(value: string): string {
  const normalized = value.trim();
  if (normalized.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (normalized.length > 256) {
    throw new Error("New password is too long.");
  }

  return normalized;
}
