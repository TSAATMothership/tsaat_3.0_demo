import "server-only";

import { ServerMemoryCache } from "@/lib/server-cache";

const APP_DATA_CACHE_TTL_MS = 5 * 60 * 1000;
const APP_DATA_CACHE_MAX_ENTRIES = 200;

const coreAppDataCache = new ServerMemoryCache<unknown>({
  namespace: "app-data:core",
  ttlMs: APP_DATA_CACHE_TTL_MS,
  maxEntries: APP_DATA_CACHE_MAX_ENTRIES
});

const trendAppDataCache = new ServerMemoryCache<unknown>({
  namespace: "app-data:trend",
  ttlMs: APP_DATA_CACHE_TTL_MS,
  maxEntries: APP_DATA_CACHE_MAX_ENTRIES
});

export async function getCachedCoreAppData<T>(key: string, factory: () => Promise<T>): Promise<T> {
  return coreAppDataCache.getOrSet(key, factory) as Promise<T>;
}

export async function getCachedTrendAppData<T>(key: string, factory: () => Promise<T>): Promise<T> {
  return trendAppDataCache.getOrSet(key, factory) as Promise<T>;
}

export function clearAppDataCaches(): void {
  coreAppDataCache.clear();
  trendAppDataCache.clear();
}

export function __resetAppDataCachesForTest(): void {
  clearAppDataCaches();
  coreAppDataCache.resetStats();
  trendAppDataCache.resetStats();
}
