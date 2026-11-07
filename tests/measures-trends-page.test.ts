import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Page from "@/app/measures/trends/page";
import { loadMeasuresTrends } from "@/lib/measures-trends-data";
import { buildMeasuresTrends } from "@/lib/measures-trends";
vi.mock("@/lib/measures-trends-data", () => ({ loadMeasuresTrends: vi.fn() }));
vi.mock("@/components/measures-trends", () => ({ MeasuresTrends: () => React.createElement("article", { "data-measure-trends": true }) }));
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("React", React); }); afterEach(() => vi.unstubAllGlobals());
it("waits for scope without reading data", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: {} }));
  expect(loadMeasuresTrends).not.toHaveBeenCalled(); expect(html).toContain("data-route-ready-key");
});
it("passes the complete selected history and signals readiness", async () => {
  vi.mocked(loadMeasuresTrends).mockResolvedValue(buildMeasuresTrends([], [], [], {}, "2026-11-07"));
  const params = { network: "net-1", securityDomain: "SECRET", dataDate: "2026-11-07", measureHistory: "12months" };
  const html = renderToStaticMarkup(await Page({ searchParams: params }));
  expect(loadMeasuresTrends).toHaveBeenCalledWith(params); expect(html).toContain("data-measure-trends"); expect(html).toContain("data-route-ready-key");
});
it("sanitizes errors and retains scope, cutoff, range and tab on retry", async () => {
  vi.mocked(loadMeasuresTrends).mockRejectedValue(new Error("secret connection string"));
  const html = renderToStaticMarkup(await Page({ searchParams: { system: ["sys-1", "sys-2"], securityDomain: "SECRET", dataDate: "2026-11-07", measureHistory: "6months", measureTrendTab: "spi" } }));
  expect(html).not.toContain("secret connection"); expect(html).toContain("temporarily unavailable");
  for (const value of ["system=sys-1%2Csys-2", "securityDomain=SECRET", "dataDate=2026-11-07", "measureHistory=6months", "measureTrendTab=spi"]) expect(html).toContain(value);
});
