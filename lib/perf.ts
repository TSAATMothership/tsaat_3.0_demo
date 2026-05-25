import "server-only";

import { performance } from "node:perf_hooks";

function perfDebugEnabled(): boolean {
  return process.env.TSAAT_PERF_DEBUG === "1";
}

export async function timeAsync<T>(label: string, task: () => Promise<T>): Promise<T> {
  if (!perfDebugEnabled()) {
    return task();
  }

  const startedAt = performance.now();
  try {
    return await task();
  } finally {
    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info(`[perf] ${label}: ${elapsedMs}ms`);
  }
}

export function timeSync<T>(label: string, task: () => T): T {
  if (!perfDebugEnabled()) {
    return task();
  }

  const startedAt = performance.now();
  try {
    return task();
  } finally {
    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info(`[perf] ${label}: ${elapsedMs}ms`);
  }
}
