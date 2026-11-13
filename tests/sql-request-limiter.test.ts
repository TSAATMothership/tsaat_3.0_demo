import { describe, expect, it, vi } from "vitest";
import { SqlRequestLimiter } from "@/lib/sql-request-limiter";

describe("SQL admission control", () => {
  it("bounds concurrent children and queue size, resumes FIFO after a failure", async () => {
    const limiter = new SqlRequestLimiter(1, 1, 1000);
    let release!: () => void;
    const first = limiter.run(() => new Promise<void>(resolve => { release = resolve; }));
    await Promise.resolve();
    const task = vi.fn(async () => "second");
    const second = limiter.run(task);
    await expect(limiter.run(async () => "overflow")).rejects.toThrow("capacity");
    expect(task).not.toHaveBeenCalled(); release(); await first;
    expect(await second).toBe("second");
    await expect(limiter.run(async () => { throw new Error("query"); })).rejects.toThrow("query");
    expect(await limiter.run(async () => "recovered")).toBe("recovered");
  });
  it("expires or cancels queued reads without starting them or losing a slot", async () => {
    const limiter = new SqlRequestLimiter(1, 2, 10);
    let release!: () => void;
    const first = limiter.run(() => new Promise<void>(resolve => { release = resolve; }));
    await Promise.resolve();
    const task = vi.fn(async () => 1), abort = new AbortController();
    const cancelled = limiter.run(task, abort.signal); abort.abort();
    await expect(cancelled).rejects.toThrow("cancelled");
    await expect(limiter.run(task)).rejects.toThrow("timed out");
    expect(task).not.toHaveBeenCalled(); release(); await first;
    expect(await limiter.run(task)).toBe(1);
  });
});
