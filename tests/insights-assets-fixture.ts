import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";

/** Test-only injected HTTP asset responses. Production rendering has no filesystem dependency. */
export function useBundledInsightsAssets() {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input), "https://tsaat.test");
      if (!/^\/(?:tsaat-logo\.png|insights-report-art\/(?:cyber-terrain|software-terrain|discovery-terrain|endpoint-evidence|vulnerability-evidence)\.png)$/.test(url.pathname)) {
        throw new Error("Unexpected external asset request in PDF test: " + url.href);
      }
      return new Response(Uint8Array.from(readFileSync(path.join(process.cwd(), "public", url.pathname.slice(1)))).buffer, {
        headers: { "Content-Type": "image/png" }
      });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());
}

export const insightsRenderContext = { assetBaseUrl: "https://tsaat.test", onProgress: () => {} };
