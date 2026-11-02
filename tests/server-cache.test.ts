import { describe, expect, it } from "vitest";
import { ServerMemoryCache, stableCacheKey } from "@/lib/server-cache";

describe("ServerMemoryCache", () => {
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
