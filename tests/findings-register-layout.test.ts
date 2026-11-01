import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "app", "findings", "page.tsx"), "utf8");
const statusTabsSource = readFileSync(path.join(process.cwd(), "components", "findings-status-tabs.tsx"), "utf8");
const registerSource = readFileSync(path.join(process.cwd(), "components", "findings-table.tsx"), "utf8");
const timelineSource = readFileSync(path.join(process.cwd(), "components", "findings-timeline-filter.tsx"), "utf8");

describe("Findings register layout", () => {
  it("embeds the findings timeline in the Open and Closed Findings control container", () => {
    expect(pageSource).toContain('<FindingsStatusTabs activeTab={selectedStatus}>');
    expect(pageSource).toContain('variant="embedded"');
    expect(pageSource).toContain('grid-rows-[auto_minmax(0,1fr)]');
    expect(statusTabsSource).toContain("children?: ReactNode");
    expect(statusTabsSource).toContain("lg:flex-row lg:items-center lg:justify-between");
    expect(statusTabsSource).toContain("lg:max-w-[54rem] lg:flex-1");
    expect(timelineSource).toContain('variant?: "panel" | "embedded"');
    expect(timelineSource).toContain('variant === "embedded" ? timelineControl');
    expect(timelineSource).toContain('className="flex min-h-[1.875rem] items-center gap-2"');
    expect(timelineSource).toContain("disabled={!hasPendingChanges}");
    expect(timelineSource).toContain("startRouteLoading({ href, message: \"Applying timeline...\" })");
    expect(timelineSource).toContain("pointer-events-none border-slate-600/25 bg-slate-900/20 text-slate-500 opacity-0");
  });

  it("dismisses register overlays before switching Open and Closed Findings tabs", () => {
    expect(statusTabsSource).toContain('window.dispatchEvent(new Event("tsaat:findings-register-dismiss-overlays"))');
    expect(registerSource).toContain('window.addEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately)');
    expect(registerSource).toContain('window.removeEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately)');
    expect(registerSource).toContain("const dismissOverlaysImmediately = useCallback(() => {");
    expect(registerSource).toContain("setIsAssetDetailsPanelVisible(false);");
  });

  it("keeps register table controls and drill-through actions without the page filter panel", () => {
    expect(pageSource).toContain("findings={findings}");
    expect(pageSource).toContain("deviceReportDetails(asset, asset.id)");
    expect(pageSource).not.toContain("FindingsViewTabs");
    expect(pageSource).not.toContain("<FilterBar");
    expect(pageSource).not.toContain("activeViewTab");
    expect(pageSource).toContain('grid-rows-[auto_minmax(0,1fr)]');
    expect(pageSource).not.toContain("paginatedFindings");
    expect(pageSource).not.toContain("openTabPageSize");
    expect(pageSource).not.toContain("selectedPage");
    expect(registerSource).toContain('<FindingsDataTable title="Findings Register"');
    expect(registerSource).toContain('label: "SPI"');
    expect(registerSource).toContain('label: "Severity"');
    expect(registerSource).toContain('label: "Timestamp"');
    expect(registerSource).toContain('{asOfStatus === "open" ? "Open" : "Closed"}');
    expect(registerSource).not.toContain("findings-register-filters");
    expect(registerSource).not.toContain("<th className=\"px-3 py-2\">Scope</th>");
    expect(registerSource).not.toContain("buildScopeLabel");
    expect(registerSource).not.toContain("Findings History (2 Years)");
    expect(registerSource).not.toContain("Findings by Severity");
    expect(registerSource).not.toContain("Page {pagination.currentPage}");
    expect(registerSource).not.toContain("fetch(`/api/findings/asset-details");
  });

  it("uses snapshot device details in the affected CI drillthrough", () => {
    expect(registerSource).toContain("Affected CIs");
    expect(registerSource).toContain("buildAssetDetailsRow(selectedFindingForAssets, assetDetailsByAssetId, findingDisplayConfiguration)");
    for (const label of ["Device Name", "Device IP", "Device Model", "Last Discovered Date", "Discovered By", "Asset Type"]) {
      expect(registerSource).toContain(`label: "${label}"`);
    }
    expect(registerSource).not.toContain("CVE Vulnerabilities");
    expect(registerSource).toContain("disabled={!matching.length}");
    expect(registerSource).not.toContain("Total Critical Exposure Findings");
    expect(registerSource).not.toContain("Total High Risk Findings");
    expect(registerSource).not.toContain("<th className=\"px-3 py-2\">Total Findings</th>");
  });
});
