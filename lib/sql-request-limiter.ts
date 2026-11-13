import "server-only";

/** Per-process FIFO admission control. A slow database cannot spawn unbounded sqlcmd children. */
export class SqlRequestLimiter {
  private active = 0;
  private readonly waiting: Array<{ grant: () => void; reject: (error: Error) => void }> = [];
  constructor(private readonly limit = 4, private readonly maxWaiting = 64, private readonly waitMs = 15_000) {}

  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      if (this.active < this.limit) { this.active++; resolve(); return; }
      if (this.waiting.length >= this.maxWaiting) { reject(new Error("SQL request capacity exceeded. Please retry.")); return; }
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
      const remove = (error: Error) => {
        const index = this.waiting.indexOf(entry);
        if (index >= 0) this.waiting.splice(index, 1);
        cleanup(); reject(error);
      };
      const abort = () => remove(new Error("SQL request cancelled."));
      const entry = { grant: () => { cleanup(); resolve(); }, reject: remove };
      const timer = setTimeout(() => remove(new Error("SQL request queue timed out. Please retry.")), this.waitMs);
      this.waiting.push(entry);
      signal?.addEventListener("abort", abort, { once: true });
    });
    try { signal?.throwIfAborted(); return await task(); }
    finally {
      const next = this.waiting.shift();
      if (next) next.grant(); else this.active--;
    }
  }
}
