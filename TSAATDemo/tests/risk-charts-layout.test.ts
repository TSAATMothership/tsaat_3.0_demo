import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "components", "network-detail-risk-charts.tsx"), "utf8");
const riskTrendPageSources = [
  "app/cyber-cop/page.tsx",
  "app/networks/page.tsx",
  "app/systems/page.tsx",
  "app/networks/[networkId]/page.tsx",
  "app/systems/[systemId]/page.tsx"
].map((relativePath) => readFileSync(path.join(process.cwd(), relativePath), "utf8"));

describe("Network detail risk chart layout", () => {
  it("keeps Risk Trend aligned with Risk Profile without creating a vertical scrollbar", () => {
    expect(source).toContain('layout === "stacked"');
    expect(source).toContain(' ? "grid h-full min-h-0 gap-2.5 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"');
    expect(source).toContain(
      ': "grid h-full min-h-0 gap-3 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-1"'
    );
    expect(source).toContain('const riskPanelClass = "panel-alt flex min-h-0 flex-col overflow-hidden p-2.5";');
    expect(source).toContain('const chartBodyClass = "mt-1.5 min-h-0 flex-1";');
    expect(source).toContain('data-risk-charts="true"');
    expect(source).toContain('data-risk-trend-chart="true"');
    expect(source).toContain("initialDimension={chartInitialDimension}");
    expect(source).toContain("No High Risk or Critical Exposure trend data is available for this scope.");
    expect(source).not.toContain("overflow-y-auto overflow-x-hidden pr-1");
    expect(source).not.toContain("min-h-[285px]");
    expect(source).not.toContain("min-h-[170px]");
  });

  it("uses the shared snapshot-aware weekly trend builder on every page", () => {
    for (const pageSource of riskTrendPageSources) {
      expect(pageSource).toContain('from "@/lib/risk-trend"');
      expect(pageSource).toContain("buildWeeklyOpenRiskTrend(");
      expect(pageSource).not.toContain("function buildWeeklyRiskTrend(");
      expect(pageSource).not.toContain("function buildNetworkDetailWeeklyRiskTrend(");
      expect(pageSource).not.toContain("function buildSystemDetailWeeklyRiskTrend(");
    }
  });
});
