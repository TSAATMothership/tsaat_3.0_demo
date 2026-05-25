import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "app", "findings", "page.tsx"), "utf8");
const statusTabsSource = readFileSync(path.join(process.cwd(), "components", "findings-status-tabs.tsx"), "utf8");
const viewTabsSource = readFileSync(path.join(process.cwd(), "components", "findings-view-tabs.tsx"), "utf8");
const registerSource = readFileSync(path.join(process.cwd(), "components", "findings-table.tsx"), "utf8");
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

  it("dismisses register overlays before switching Open and Closed Findings tabs", () => {
    expect(statusTabsSource).toContain('window.dispatchEvent(new Event("tsaat:findings-register-dismiss-overlays"))');
    expect(registerSource).toContain('window.addEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately)');
    expect(registerSource).toContain('window.removeEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately)');
    expect(registerSource).toContain("const dismissOverlaysImmediately = useCallback(() => {");
    expect(registerSource).toContain("setIsAssetDetailsPanelVisible(false);");
    expect(registerSource).toContain("setIsCveDetailsModalVisible(false);");
  });

  it("keeps the findings overview dashboard compact and scroll-contained", () => {
    expect(pageSource).toContain("xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]");
    expect(pageSource).toContain("grid-rows-[minmax(0,0.82fr)_minmax(0,1.18fr)]");
    expect(pageSource).toContain('className="panel no-print flex max-h-[8.5rem] flex-wrap gap-2 overflow-y-auto p-3"');
    expect(pageSource).toContain('variant="compact"');
    expect(pageSource).toContain("sticky top-0 z-10 bg-slate-900");
    expect(pageSource).toContain("findingBucketsOfType(findingDisplayConfiguration, \"severity\")");
    expect(pageSource).toContain("findingMatchesBucket(finding, bucket)");
    expect(pageSource).toContain("primarySeverityBucket?.label");
    expect(pageSource).toContain("secondarySeverityBucket?.label");
    expect(pageSource).toContain("otherSeverityBucket?.label");
    expect(pageSource).toContain("otherSeverityBucket");
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

  it("removes the Criticality filter from the Findings Overview tab", () => {
    expect(pageSource).toContain("criticality: undefined");
    expect(pageSource).toContain('hiddenFields={activeViewTab === "overview" ? ["systemCriticality"] : []}');
    expect(viewTabsSource).toContain('params.delete("criticality")');
    expect(historyDrillthroughSource).toContain('hiddenFields={["systemCriticality"]}');
  });

  it("renders the register as a compliance detail-style scrollable worklist", () => {
    expect(pageSource).toContain("findings={findings}");
    expect(pageSource).toContain("buildCveVulnerabilityIndexByAssetId(dataset.assets)");
    expect(pageSource).toContain("const priorityFilterSelect = {");
    expect(pageSource).toContain(": [priorityFilterSelect]");
    expect(pageSource).not.toContain("paginatedFindings");
    expect(pageSource).not.toContain("openTabPageSize");
    expect(pageSource).not.toContain("selectedPage");
    expect(registerSource).toContain("Compliance detail-style worklist");
    expect(registerSource).toContain('<th className="w-[12rem] min-w-[12rem] px-3 py-2">Measure</th>');
    expect(registerSource).toContain('<th className="w-[11rem] min-w-[11rem] px-3 py-2">Severity</th>');
    expect(registerSource).toContain(
      '<th className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap px-3 py-2">Timestamp</th>'
    );
    expect(registerSource).toContain('{asOfStatus === "open" ? "Open" : "Closed"}');
    expect(registerSource).toContain("Findings Severity");
    expect(registerSource).not.toContain("<th className=\"px-3 py-2\">Scope</th>");
    expect(registerSource).not.toContain("buildScopeLabel");
    expect(registerSource).not.toContain("Findings History (2 Years)");
    expect(registerSource).not.toContain("Findings by Severity");
    expect(registerSource).not.toContain("Page {pagination.currentPage}");
    expect(registerSource).not.toContain("Previous");
    expect(registerSource).not.toContain("fetch(`/api/findings/asset-details");
  });

  it("uses the updated affected CIs and filtered CVE drillthrough in the register", () => {
    expect(registerSource).toContain("Affected CIs");
    expect(registerSource).toContain("buildAssetDetailsRow(selectedFindingForAssets, assetCvesByAssetId, findingDisplayConfiguration)");
    expect(registerSource).toContain("CVE Vulnerabilities");
    expect(registerSource).toContain("CVE Criticality");
    expect(registerSource).toContain("const rows = filteredAssetCves.map((entry) => [");
    expect(registerSource).toContain("disabled={!filteredAssetCves.length}");
    expect(registerSource).not.toContain("Total Critical Exposure Findings");
    expect(registerSource).not.toContain("Total High Risk Findings");
    expect(registerSource).not.toContain("<th className=\"px-3 py-2\">Total Findings</th>");
  });
});
