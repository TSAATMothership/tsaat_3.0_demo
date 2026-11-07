import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MeasuresTrends } from "@/components/measures-trends";
import { buildMeasuresTrends } from "@/lib/measures-trends";
import { testSpiDefinitions } from "./spi-definition-fixtures";
const query = vi.hoisted(() => ({ value: "network=net-1&measureTrendTab=spi" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(query.value) }));
vi.mock("@/components/persona-link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) }));
beforeEach(() => vi.stubGlobal("React", React)); afterEach(() => vi.unstubAllGlobals());
it("renders accessible tabs, actual dated chart values and exact-value evidence", () => {
  const definition = testSpiDefinitions[0];
  const model = buildMeasuresTrends([{ snapshotDate: "2026-11-07", kpis: [], spis: [{ ...definition, scorePercent: 50, compliant: 1, nonCompliant: 0, unknown: 1, total: 2 }] }], [], [definition], { network: "net-1" }, "2026-11-07");
  const html = renderToStaticMarkup(React.createElement(MeasuresTrends, { model }));
  expect(html).toContain("<title>7 Nov 2026: 50.0% (1/2)</title>"); expect(html).not.toContain("<title></title>"); expect(html).not.toContain("NaN");
  expect(html).toContain('aria-label="Measure type"'); expect(html).toContain('aria-label="Inspect measure snapshot"');
  expect(html).toContain("Snapshot evidence"); expect(html).toContain("No comparison"); expect(html).toContain("Earlier dates in this period have no snapshots");
  expect(html).toContain("measuresTab=measures-spi"); expect(html).toContain("dataDate=2026-11-07");
});
it("shows available definitions and empty-history guidance with no fabricated percentages", () => {
  const html = renderToStaticMarkup(React.createElement(MeasuresTrends, { model: buildMeasuresTrends([], [], testSpiDefinitions, {}, "2020-01-01") }));
  expect(html).toContain("No snapshots in this period"); expect(html).toContain("N/A"); expect(html).toContain('disabled=""');
  expect(html).not.toContain('class="measure-trend-point"');
});
