import "server-only";
import { fileVersion,jsonStoreDirectory,readJson } from "./files";
const cache = new Map<string, { version: string; value: unknown }>();
export async function reference<T = unknown>(name: string): Promise<T> {
  const file = "references/" + name + ".json", version = await fileVersion(file);
  const cacheKey = jsonStoreDirectory() + ":" + file;
  const cached = cache.get(cacheKey);
  if (cached?.version === version) return cached.value as T;
  const value = await readJson<T>(file); cache.set(cacheKey, { version, value }); return value;
}
export function clearReferenceCaches() { cache.clear(); }
