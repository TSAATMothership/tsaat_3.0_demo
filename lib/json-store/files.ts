import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface StoreManifest {
  format: "tsaat-json-store"; schemaVersion: 1;
  snapshots: Array<{ id: number; date: string; file: string }>;
}
export function jsonStoreDirectory() { return path.resolve(process.env.TSAAT_JSON_DATA_DIR || path.join(process.cwd(), "NoSQL", "data")); }
export function storePath(relative: string) {
  const root = jsonStoreDirectory(), target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error("JSON store paths must stay inside the configured data directory.");
  return target;
}
export async function readJson<T>(relative: string): Promise<T> {
  try { return JSON.parse((await fs.readFile(storePath(relative), "utf8")).replace(/^\uFEFF/, "")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("JSON data file is missing: " + relative + ". Run npm run setup:nosql.");
    throw new Error("Cannot read JSON data file " + relative + ": " + (error instanceof Error ? error.message : String(error)));
  }
}
export async function fileVersion(relative: string) {
  const stat = await fs.stat(storePath(relative), { bigint: true });
  return stat.mtimeNs.toString() + ":" + stat.size.toString();
}
export async function loadStoreManifest(): Promise<StoreManifest> {
  const manifest = await readJson<StoreManifest>("store.json");
  if (manifest.format !== "tsaat-json-store" || manifest.schemaVersion !== 1 || !manifest.snapshots?.length) throw new Error("Unsupported or empty JSON store manifest.");
  const ids = new Set<number>(), dates = new Set<string>();
  for (const item of manifest.snapshots) {
    if (!Number.isInteger(item.id) || item.id <= 0 || ids.has(item.id) || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || dates.has(item.date)) throw new Error("Invalid JSON snapshot catalogue.");
    storePath(item.file); ids.add(item.id); dates.add(item.date);
  }
  return { ...manifest, snapshots: [...manifest.snapshots].sort((a,b) => a.date.localeCompare(b.date)) };
}
/** Same-directory rename commits a complete file; failed writes preserve the previous version. */
export async function atomicWriteJson(relative: string, value: unknown) {
  const target = storePath(relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = target + "." + randomUUID() + ".tmp";
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(value, null, 2) + "\n"); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
}
/** Serializes writers across app workers. A crashed writer leaves an explicit recovery lock. */
export async function withStoreWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const lock = storePath(".write-lock");
  const deadline = Date.now() + 10000;
  let handle;
  while (!handle) {
    try { handle = await fs.open(lock, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new Error("JSON data store is busy. If the app stopped during a write, follow the JSON store recovery instructions.");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await task(); }
  finally { await handle.close(); await fs.rm(lock, { force: true }); }
}
