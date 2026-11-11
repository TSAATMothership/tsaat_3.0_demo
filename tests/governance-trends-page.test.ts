import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TrendsPage from "@/app/governance/trends/page";
import { loadGovernanceTrends } from "@/lib/governance-trends-data";
import { buildGovernanceTrends } from "@/lib/governance-trends";
vi.mock("@/lib/governance-trends-data", () => ({ loadGovernanceTrends: vi.fn() }));
vi.mock("@/components/governance-trends", () => ({ GovernanceTrends: () => React.createElement("article", { "data-trend-briefing": true }) }));
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("React", React); });
afterEach(() => vi.unstubAllGlobals());
it("does not read business data without header scope", async () => {
  const html = renderToStaticMarkup(await TrendsPage({ searchParams: {} }));
  expect(loadGovernanceTrends).not.toHaveBeenCalled(); expect(html).toContain("data-route-ready-key"); expect(html).not.toContain("data-trend-briefing");
});
it("passes selected scope and date to the loader and marks successful navigation ready", async () => {
  vi.mocked(loadGovernanceTrends).mockResolvedValue(buildGovernanceTrends([], { updatedAt: "", tools: [] }, {}, "2026-11-05"));
  const params = { network: "net-1", securityDomain: "SECRET", dataDate: "2026-10-01", trendHistory: "week" };
  const html = renderToStaticMarkup(await TrendsPage({ searchParams: params }));
  expect(loadGovernanceTrends).toHaveBeenCalledWith(params); expect(html).toContain("data-trend-briefing"); expect(html).toContain("data-route-ready-key");
});
it("sanitizes provider failures and keeps scope, history and date on retry", async () => {
  vi.mocked(loadGovernanceTrends).mockRejectedValue(new Error("secret database credentials"));
  const html = renderToStaticMarkup(await TrendsPage({ searchParams: { system: ["sys-1", "sys-2"], securityDomain: "SECRET", dataDate: "2026-10-01", trendHistory: "week" } }));
  expect(html).toContain("temporarily unavailable"); expect(html).not.toContain("credentials");
  for (const text of ["system=sys-1%2Csys-2", "securityDomain=SECRET", "dataDate=2026-10-01", "trendHistory=week", "data-route-ready-key"]) expect(html).toContain(text);
});
