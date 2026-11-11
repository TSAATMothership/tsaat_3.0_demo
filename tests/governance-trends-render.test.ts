import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GovernanceTrends } from "@/components/governance-trends";
import { buildGovernanceTrends } from "@/lib/governance-trends";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams("network=net-1") }));
vi.mock("@/components/persona-link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) }));
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
it("renders chart point titles as server text so the browser can hydrate them", () => {
  const model = buildGovernanceTrends([{ snapshotDate: "2026-03-05", generatedAt: "2026-03-05", assets: [], managedNetworks: [], ictSystems: [], spiEvaluations: [] }], { updatedAt: "", tools: [] }, { network: "net-1" }, "2026-03-05");
  const html = renderToStaticMarkup(React.createElement(GovernanceTrends, { model }));
  expect(html).toContain("<title>5 Mar 2026: 0</title>");
  expect(html).not.toContain("<title></title>"); expect(html).not.toContain("NaN");
  expect(html).toContain("No inventory matches this scope"); expect(html).toContain("No comparison");
});
it("shows an explicit no-history state without fabricated chart values", () => {
  const model = buildGovernanceTrends([], { updatedAt: "", tools: [] }, { network: "net-1" }, "2020-01-01");
  const html = renderToStaticMarkup(React.createElement(GovernanceTrends, { model }));
  expect(html).toContain("No snapshots in this history period"); expect(html).not.toContain("executive-scorecard");
  expect(html).toContain("disabled=\"\"");
});
it("shows only week/month options and uses the full selected period on chart axes", () => {
  const model = buildGovernanceTrends([{ snapshotDate: "2026-02-01", generatedAt: "2026-02-01", assets: [], managedNetworks: [], ictSystems: [], spiEvaluations: [] }], { updatedAt: "", tools: [] }, { network: "net-1", trendHistory: "week" }, "2026-02-01");
  const html = renderToStaticMarkup(React.createElement(GovernanceTrends, { model }));
  expect(html).toContain('<option value="week" selected="">1 week</option>');
  expect(html).toContain('<option value="month">1 month</option>');
  expect(html).not.toContain("Latest 12 snapshots");
  expect(html).toContain('data-trends-from="2026-01-25"');
  expect(html).toContain('<div class="executive-chart-dates" aria-hidden="true"><span>25 Jan 2026</span><span>1 Feb 2026</span></div>');
  expect(html).toContain('cx="512"'); // A single observation at the period end is not centred on the chart.
});
