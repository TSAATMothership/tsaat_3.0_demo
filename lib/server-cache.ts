import "server-only";

type CacheClock = () => number;

export interface ServerMemoryCacheOptions {
  namespace: string;
  ttlMs: number;
  maxEntries: number;
  sliding?: boolean;
  now?: CacheClock;
}

export interface ServerMemoryCacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  expirations: number;
  invalidations: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessedAt: number;
}

function shouldDebugCache(): boolean {
  return process.env.TSAAT_CACHE_DEBUG === "1";
}

function debugCache(namespace: string, event: string, key?: string): void {
  if (!shouldDebugCache()) {
    return;
  }
  const suffix = key ? ` ${key}` : "";
  console.debug(`[cache:${namespace}] ${event}${suffix}`);
}

function normalizeCacheKeyValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeCacheKeyValue(item));
  }

  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    normalized[key] = normalizeCacheKeyValue((value as Record<string, unknown>)[key]);
  }
  return normalized;
}

export function stableCacheKey(parts: unknown[]): string {
  return JSON.stringify(normalizeCacheKeyValue(parts));
}

export class ServerMemoryCache<T> {
  private readonly namespace: string;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly sliding: boolean;
  private readonly now: CacheClock;
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly pending = new Map<string, Promise<T>>();
  private revision = 0;
  private stats: ServerMemoryCacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    expirations: 0,
    invalidations: 0
  };

  constructor(options: ServerMemoryCacheOptions) {
    this.namespace = options.namespace;
    this.ttlMs = Math.max(1, options.ttlMs);
    this.maxEntries = Math.max(1, options.maxEntries);
    this.sliding = options.sliding ?? false;
    this.now = options.now ?? Date.now;
  }

  get(key: string): T | undefined {
    const now = this.now();
    const entry = this.entries.get(key);
    if (!entry) {
      this.stats.misses += 1;
      debugCache(this.namespace, "miss", key);
      return undefined;
    }

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      this.stats.expirations += 1;
      this.stats.misses += 1;
      debugCache(this.namespace, "expired", key);
      return undefined;
    }

    entry.lastAccessedAt = now;
    if (this.sliding) {
      entry.expiresAt = now + this.ttlMs;
    }

    this.stats.hits += 1;
    debugCache(this.namespace, "hit", key);
    return entry.value;
  }

  set(key: string, value: T): void {
    const now = this.now();
    this.entries.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      lastAccessedAt: now
    });
    this.stats.sets += 1;
    debugCache(this.namespace, "set", key);
    this.prune(now);
  }

  async getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.pending.get(key);
    if (pending) {
      debugCache(this.namespace, "pending", key);
      return pending;
    }

    const revision = this.revision;
    const promise = factory()
      .then((value) => {
        if (this.revision === revision) {
          this.set(key, value);
        }
        return value;
      })
      .finally(() => {
        if (this.pending.get(key) === promise) {
          this.pending.delete(key);
        }
      });

    this.pending.set(key, promise);
    return promise;
  }

  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of Array.from(this.entries.keys())) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        count += 1;
      }
    }
    for (const key of Array.from(this.pending.keys())) {
      if (key.startsWith(prefix)) {
        this.pending.delete(key);
      }
    }
    if (count > 0) {
      this.revision += 1;
      this.stats.invalidations += count;
      debugCache(this.namespace, `invalidate-prefix ${prefix}`);
    }
    return count;
  }

  clear(): void {
    const count = this.entries.size;
    this.entries.clear();
    this.pending.clear();
    this.revision += 1;
    this.stats.invalidations += count;
    debugCache(this.namespace, "clear");
  }

  size(): number {
    this.prune(this.now());
    return this.entries.size;
  }

  getStats(): ServerMemoryCacheStats {
    this.prune(this.now());
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expirations: 0,
      invalidations: 0
    };
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        this.stats.expirations += 1;
      }
    }

    if (this.entries.size <= this.maxEntries) {
      return;
    }

    const entriesByAccess = Array.from(this.entries.entries()).sort(
      (left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt
    );
    const toDelete = this.entries.size - this.maxEntries;
    for (let index = 0; index < toDelete; index += 1) {
      this.entries.delete(entriesByAccess[index][0]);
      this.stats.evictions += 1;
    }
  }
}
