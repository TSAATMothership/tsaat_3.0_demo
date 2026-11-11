import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "components", "network-detail-risk-charts.tsx"), "utf8");

describe("Network detail risk chart layout", () => {
  it("keeps Risk Trend aligned with Risk Profile without creating a vertical scrollbar", () => {
    expect(source).toContain('layout === "stacked"');
    expect(source).toContain(' ? "grid h-full min-h-0 gap-2.5 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"');
    expect(source).toContain(': "grid h-full min-h-[285px] gap-3 lg:grid-cols-2"');
    expect(source).toContain('const riskPanelClass =');
    expect(source).toContain(': "panel-alt flex min-h-[285px] flex-col overflow-hidden p-2.5"');
    expect(source).toContain('const chartBodyClass = layout === "stacked" ? "mt-1.5 min-h-0 flex-1" : "mt-1.5 min-h-[170px] flex-1";');
    expect(source).toContain("const chartMinHeight = layout === \"stacked\" ? 1 : 170;");
    expect(source).toContain('className="h-full min-h-0 overflow-hidden"');
    expect(source).not.toContain("overflow-y-auto overflow-x-hidden pr-1");
    expect(source).not.toContain("min-h-[156px]");
    expect(source).not.toContain("minHeight={108}");
  });
});
