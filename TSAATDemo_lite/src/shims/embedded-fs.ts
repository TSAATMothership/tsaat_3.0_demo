import { gunzipSync } from "fflate";
import { BrowserBuffer } from "../browser-buffer";
import { embeddedFiles, sharedSnapshotChunk, snapshotHeaders } from "virtual:embedded-data";

interface EmbeddedFile {
  gzip?: string;
  alias?: string;
  kind?: "snapshot" | "text" | "binary";
}

const files = embeddedFiles as Record<string, EmbeddedFile>;
let sharedSnapshotJson: string | null = null;

function normalizePath(value: unknown): string {
  const normalized = String(value ?? "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const marker = "/data/";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex + marker.length).replace(/^\/+/, "");
  }
  return normalized.replace(/^\/+/, "").replace(/^data\//i, "");
}

function resolveEntry(rawPath: unknown): { key: string; entry: EmbeddedFile } {
  let key = normalizePath(rawPath);
  let entry = files[key];
  const visited = new Set<string>();
  while (entry?.alias) {
    if (visited.has(key)) {
      throw new Error(`Embedded data alias cycle at '${key}'.`);
    }
    visited.add(key);
    key = entry.alias;
    entry = files[key];
  }
  if (!entry?.gzip) {
    throw new Error(`Embedded TSAAT data file '${normalizePath(rawPath)}' was not found.`);
  }
  return { key, entry };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function inflateBase64(value: string): Uint8Array {
  return gunzipSync(decodeBase64(value));
}

function decodeUtf8(value: string): string {
  return new TextDecoder().decode(inflateBase64(value));
}

function materializeSnapshot(variableGzip: string): string {
  const variableJson = decodeUtf8(variableGzip).trim();
  if (!sharedSnapshotJson) {
    sharedSnapshotJson = decodeUtf8(sharedSnapshotChunk).trim();
  }
  if (!variableJson.endsWith("}") || !sharedSnapshotJson.startsWith("{")) {
    throw new Error("Embedded TSAAT snapshot chunks are malformed.");
  }
  return `${variableJson.slice(0, -1)},${sharedSnapshotJson.slice(1)}`;
}

export function existsSync(rawPath: unknown): boolean {
  const key = normalizePath(rawPath);
  return Boolean(files[key]);
}

export async function readFile(rawPath: unknown, encoding?: string): Promise<string | BrowserBuffer> {
  const { entry } = resolveEntry(rawPath);
  const bytesOrText =
    entry.kind === "snapshot" ? materializeSnapshot(entry.gzip!) : inflateBase64(entry.gzip!);
  if (typeof bytesOrText === "string") {
    return encoding ? bytesOrText : BrowserBuffer.from(bytesOrText, "utf8");
  }
  return encoding ? new TextDecoder().decode(bytesOrText) : BrowserBuffer.from(bytesOrText);
}

export async function readdir(rawPath: unknown): Promise<string[]> {
  const prefix = `${normalizePath(rawPath).replace(/\/$/, "")}/`;
  return Array.from(
    new Set(
      Object.keys(files)
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length).split("/")[0])
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export async function open(rawPath: unknown, _flags?: string) {
  const key = normalizePath(rawPath);
  const header = (snapshotHeaders as Record<string, string>)[key];
  if (!header) {
    resolveEntry(rawPath);
  }
  const headerBytes = new TextEncoder().encode(header ?? "");
  return {
    async read(target: Uint8Array, offset = 0, length = target.byteLength, position = 0) {
      const available = headerBytes.subarray(position, position + length);
      target.set(available, offset);
      return { bytesRead: available.byteLength, buffer: target };
    },
    async close() {
      return undefined;
    }
  };
}

export const promises = { readFile, readdir, open };
export default promises;
