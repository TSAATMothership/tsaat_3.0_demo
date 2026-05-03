import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("network and ICT system action performance dashboard", () => {
  it("links action-tab report buttons to performance reports", () => {
    const networkPage = readRepoFile("app/networks/page.tsx");
    const systemPage = readRepoFile("app/systems/page.tsx");

    expect(networkPage).toContain("/api/networks/performance-report");
    expect(systemPage).toContain("/api/systems/performance-report");
    expect(networkPage).toContain("Performance Report");
    expect(systemPage).toContain("Performance Report");
    expect(networkPage).not.toContain("Generate Remediation Report");
    expect(systemPage).not.toContain("Generate Remediation Report");
  });

  it("uses the shared performance model and dashboard in both action panels", () => {
    const networkPanels = readRepoFile("components/networks-cop-panels.tsx");
    const systemPanels = readRepoFile("components/systems-cop-panels.tsx");
    const dashboard = readRepoFile("components/performance-action-dashboard.tsx");

    for (const source of [networkPanels, systemPanels]) {
      expect(source).toContain("PerformanceActionDashboard");
      expect(source).toContain("model: PerformanceReportModel");
      expect(source).not.toContain("Action Plan Summary");
    }

    expect(dashboard).toContain("Coverage & Modelling");
    expect(dashboard).toContain("Remediation Throughput (Weekly)");
    expect(dashboard).toContain("Performance Drill-Through");
    expect(dashboard).toContain('role="dialog"');
    expect(dashboard).toContain('aria-label="Performance action dashboard tabs"');
    expect(dashboard).toContain("grid-rows-[auto_minmax(0,1fr)] gap-1.5");
    expect(dashboard).not.toContain("Performance Dashboard");
    expect(dashboard).not.toContain("cyber-cop-pulse-border");
    expect(dashboard).not.toContain("xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.7fr)]");
    expect(dashboard).not.toContain("grid-rows-[auto_auto_minmax(0,1fr)]");
    expect(dashboard).not.toContain("rounded-lg border border-sky-300/20 bg-slate-950/55 p-2.5 text-slate-100");
    expect(dashboard).not.toContain('label="Throughput"');
    expect(dashboard).not.toContain("opened / closed in reporting window");
    expect(dashboard).not.toContain("function ProgressMix");
    expect(dashboard).not.toContain('text-right">Checks</th>');
    expect(dashboard).toContain("overflow-y-auto overflow-x-hidden");
    expect(dashboard).toContain("lg:grid-cols-[minmax(4.75rem,0.6fr)_minmax(9rem,1.65fr)_repeat(10,minmax(0,0.3fr))]");
    expect(dashboard).not.toContain("min-w-[74rem]");
  });

  it("adds dynamic performance PDF routes with the requested filenames", () => {
    const networkRoute = readRepoFile("app/api/networks/performance-report/route.ts");
    const systemRoute = readRepoFile("app/api/systems/performance-report/route.ts");

    expect(networkRoute).toContain('export const dynamic = "force-dynamic"');
    expect(systemRoute).toContain('export const dynamic = "force-dynamic"');
    expect(networkRoute).toContain("tsaat-network-performance-report-");
    expect(systemRoute).toContain("tsaat-ict-systems-performance-report-");
    expect(networkRoute).toContain("buildNetworkPerformanceReportModel");
    expect(systemRoute).toContain("buildSystemPerformanceReportModel");
  });
});
