import { describe, expect, it } from "vitest";
import { ServerMemoryCache, stableCacheKey } from "@/lib/server-cache";

describe("ServerMemoryCache", () => {
  it("bounds serialized payload bytes, bypasses oversized values and accounts for replacement/expiry", async () => {
    let now = 0;
    const cache = new ServerMemoryCache<string>({ namespace: "bytes", ttlMs: 10, maxEntries: 10, maxBytes: 10, now: () => now });
    cache.set("a", "1234"); now++;
    cache.set("b", "5678");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.getStats().bytes).toBe(6);
    expect(await cache.getOrSet("large", async () => "0123456789012345")).toBe("0123456789012345");
    expect(cache.get("large")).toBeUndefined();
    expect(cache.get("b")).toBe("5678");
    cache.set("b", "1"); expect(cache.getStats().bytes).toBe(3);
    now = 100; expect(cache.getStats().bytes).toBe(0);
    expect(cache.getStats().oversized).toBe(1);
  });

  it("does not repopulate an invalidated prefix from an in-flight read", async () => {
    const cache = new ServerMemoryCache<string>({ namespace: "pending", ttlMs: 100, maxEntries: 2 });
    let resolve!: (value: string) => void;
    const pending = cache.getOrSet("snapshot:1", () => new Promise<string>(done => { resolve = done; }));
    cache.invalidatePrefix("snapshot:");
    resolve("old"); expect(await pending).toBe("old");
    expect(cache.get("snapshot:1")).toBeUndefined();
  });

  it("expires entries after the configured TTL", () => {
    let now = 1_000;
    const cache = new ServerMemoryCache<string>({
      namespace: "test",
      ttlMs: 100,
      maxEntries: 10,
      now: () => now
    });

    cache.set("a", "alpha");
    expect(cache.get("a")).toBe("alpha");

    now = 1_101;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.getStats().expirations).toBe(1);
  });

  it("evicts the least recently used entry when full", () => {
    let now = 1_000;
    const cache = new ServerMemoryCache<string>({
      namespace: "test",
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => now
    });

    cache.set("a", "alpha");
    now += 1;
    cache.set("b", "bravo");
    now += 1;
    expect(cache.get("a")).toBe("alpha");
    now += 1;
    cache.set("c", "charlie");

    expect(cache.get("a")).toBe("alpha");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("charlie");
  });

  it("refreshes expiry on access when sliding TTL is enabled", () => {
    let now = 1_000;
    const cache = new ServerMemoryCache<string>({
      namespace: "test",
      ttlMs: 100,
      maxEntries: 10,
      sliding: true,
      now: () => now
    });

    cache.set("a", "alpha");
    now = 1_050;
    expect(cache.get("a")).toBe("alpha");
    now = 1_125;
    expect(cache.get("a")).toBe("alpha");
    now = 1_226;
    expect(cache.get("a")).toBeUndefined();
  });

  it("invalidates entries by prefix", () => {
    const cache = new ServerMemoryCache<string>({
      namespace: "test",
      ttlMs: 1_000,
      maxEntries: 10
    });

    cache.set("core:a", "alpha");
    cache.set("core:b", "bravo");
    cache.set("trend:a", "charlie");

    expect(cache.invalidatePrefix("core:")).toBe(2);
    expect(cache.get("core:a")).toBeUndefined();
    expect(cache.get("core:b")).toBeUndefined();
    expect(cache.get("trend:a")).toBe("charlie");
  });

  it("deduplicates concurrent async cache fills", async () => {
    const cache = new ServerMemoryCache<string>({
      namespace: "test",
      ttlMs: 1_000,
      maxEntries: 10
    });
    let calls = 0;

    const [first, second] = await Promise.all([
      cache.getOrSet("a", async () => {
        calls += 1;
        return "alpha";
      }),
      cache.getOrSet("a", async () => {
        calls += 1;
        return "bravo";
      })
    ]);

    expect(first).toBe("alpha");
    expect(second).toBe("alpha");
    expect(calls).toBe(1);
  });
});

describe("stableCacheKey", () => {
  it("normalizes object key order and undefined values", () => {
    expect(stableCacheKey([{ b: 2, a: undefined }])).toBe(stableCacheKey([{ a: undefined, b: 2 }]));
    expect(stableCacheKey([{ b: 2, a: undefined }])).toContain("null");
  });
});
