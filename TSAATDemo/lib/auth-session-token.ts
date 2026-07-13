export const AUTH_SESSION_COOKIE_NAME = "tsaat_session";
const TOKEN_VERSION = 1;

export interface AuthSessionTokenPayload {
  v: number;
  sub: string;
  sv: number;
  iat: number;
  exp: number;
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  if (remainder === 0) {
    return padded;
  }
  return `${padded}${"=".repeat(4 - remainder)}`;
}

function encodeBytes(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return toBase64Url(Buffer.from(bytes).toString("base64"));
  }

  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return toBase64Url(btoa(binary));
}

function decodeBytes(encoded: string): Uint8Array {
  const base64 = fromBase64Url(encoded);
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function subtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto subtle API is unavailable.");
  }
  return subtle;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(secret);
  return subtleCrypto().importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function isValidPayloadShape(payload: unknown): payload is AuthSessionTokenPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    candidate.v === TOKEN_VERSION &&
    typeof candidate.sub === "string" &&
    candidate.sub.trim().length > 0 &&
    Number.isInteger(candidate.sv) &&
    Number(candidate.sv) >= 1 &&
    Number.isInteger(candidate.iat) &&
    Number(candidate.iat) > 0 &&
    Number.isInteger(candidate.exp) &&
    Number(candidate.exp) > Number(candidate.iat)
  );
}

export function buildSessionPayload(input: {
  username: string;
  sessionVersion: number;
  nowEpochSeconds: number;
  lifetimeSeconds: number;
}): AuthSessionTokenPayload {
  return {
    v: TOKEN_VERSION,
    sub: input.username,
    sv: input.sessionVersion,
    iat: input.nowEpochSeconds,
    exp: input.nowEpochSeconds + input.lifetimeSeconds
  };
}

export async function createSignedSessionToken(payload: AuthSessionTokenPayload, secret: string): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await importHmacKey(secret);
  const signature = new Uint8Array(await subtleCrypto().sign("HMAC", key, toArrayBuffer(payloadBytes)));

  return `${encodeBytes(payloadBytes)}.${encodeBytes(signature)}`;
}

export async function verifySignedSessionToken(
  token: string,
  secret: string,
  nowEpochSeconds: number
): Promise<AuthSessionTokenPayload | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const payloadBytes = decodeBytes(payloadPart);
  const signatureBytes = decodeBytes(signaturePart);
  const key = await importHmacKey(secret);
  const isValidSignature = await subtleCrypto().verify(
    "HMAC",
    key,
    toArrayBuffer(signatureBytes),
    toArrayBuffer(payloadBytes)
  );
  if (!isValidSignature) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }

  if (!isValidPayloadShape(parsed)) {
    return null;
  }

  if (parsed.exp < nowEpochSeconds) {
    return null;
  }

  return parsed;
}
