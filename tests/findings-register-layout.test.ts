import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "app", "findings", "page.tsx"), "utf8");
const statusTabsSource = readFileSync(path.join(process.cwd(), "components", "findings-status-tabs.tsx"), "utf8");
const viewTabsSource = readFileSync(path.join(process.cwd(), "components", "findings-view-tabs.tsx"), "utf8");
const timelineSource = readFileSync(path.join(process.cwd(), "components", "findings-timeline-filter.tsx"), "utf8");
const filterBarSource = readFileSync(path.join(process.cwd(), "components", "filter-bar.tsx"), "utf8");
const historyChartSource = readFileSync(path.join(process.cwd(), "components", "findings-history-line-chart.tsx"), "utf8");
const historyDrillthroughSource = readFileSync(
  path.join(process.cwd(), "components", "findings-history-drillthrough.tsx"),
  "utf8"
);

describe("Findings register layout", () => {
  it("embeds the findings timeline in the Open and Closed Findings control container", () => {
    expect(pageSource).toContain('<FindingsStatusTabs activeTab={selectedStatus}>');
    expect(pageSource).toContain('variant="embedded"');
    expect(pageSource).toContain('grid-rows-[auto_auto_minmax(0,1fr)]');
    expect(statusTabsSource).toContain("children?: ReactNode");
    expect(statusTabsSource).toContain("lg:flex-row lg:items-center lg:justify-between");
    expect(statusTabsSource).toContain("lg:max-w-[54rem] lg:flex-1");
    expect(timelineSource).toContain('variant?: "panel" | "embedded"');
    expect(timelineSource).toContain('variant === "embedded" ? timelineControl');
    expect(timelineSource).toContain('className="flex min-h-[1.875rem] items-center gap-2"');
    expect(timelineSource).toContain("disabled={!hasPendingChanges || isLoading}");
    expect(timelineSource).toContain("pointer-events-none border-slate-600/25 bg-slate-900/20 text-slate-500 opacity-0");
  });

  it("keeps the findings overview dashboard compact and scroll-contained", () => {
    expect(pageSource).toContain("xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]");
    expect(pageSource).toContain("grid-rows-[minmax(0,0.82fr)_minmax(0,1.18fr)]");
    expect(pageSource).toContain('className="panel no-print flex max-h-[8.5rem] flex-wrap gap-2 overflow-y-auto p-3"');
    expect(pageSource).toContain('variant="compact"');
    expect(pageSource).toContain("sticky top-0 z-10 bg-slate-900");
    expect(pageSource).toContain("Critical Risk");
    expect(pageSource).toContain("High Risk");
    expect(pageSource).toContain("Medium Risk and Lower");
    expect(pageSource).toContain("const mediumAndLowerRiskFindings = Math.max(totalFindings - criticalExposure - highRisk, 0)");
    expect(pageSource).toContain('label: "Medium and Lower Risk"');
    expect(pageSource).toContain("otherRisk: Math.max(typeFindings.length - criticalExposureCount - highRiskCount, 0)");
    expect(pageSource).toContain('<th className="px-2 py-1.5 text-right">Other</th>');
    expect(pageSource).toContain("{summary.otherRisk}");
    expect(filterBarSource).toContain('className = "panel no-print mt-4 flex flex-wrap gap-3 p-4"');
    expect(filterBarSource).toContain("interface DropdownPosition");
    expect(filterBarSource).toContain('className="fixed z-[10000]');
    expect(filterBarSource).toContain("createPortal(");
    expect(filterBarSource).toContain("window.addEventListener(\"scroll\", updateDropdownPosition, true)");
    expect(historyChartSource).toContain('variant?: "default" | "compact"');
    expect(historyChartSource).toContain('isCompact ? "mt-2 min-h-[12rem] flex-1"');
    expect(historyDrillthroughSource).toContain('variant?: "default" | "compact"');
  });

  it("defaults the overview Security Posture Indicators selector to all when opening Overview", () => {
    expect(pageSource).toContain('label: "Security Posture Indicators"');
    expect(pageSource).toContain("value: selectedSpi ? String(selectedSpi) : undefined");
    expect(viewTabsSource).toContain('if (tab === "overview")');
    expect(viewTabsSource).toContain('params.delete("spi")');
  });
});
