import React, { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CyberCopPage from "@/app/cyber-cop/page";
import { ServiceImpactAnalyser } from "@/components/service-impact-analyser";
import { getCoreAppData } from "@/lib/app-data";

vi.mock("@/lib/app-data", () => ({ getCoreAppData: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("React", React); });
afterEach(() => vi.unstubAllGlobals());
describe("Service Impact Analyser route", () => {
  it("waits for header scope", async () => {
    await CyberCopPage({ searchParams: { copView: "impact" } });
    expect(getCoreAppData).not.toHaveBeenCalled();
  });
  it("loads the new analyser with header scope and the actual snapshot without building legacy dashboard props", async () => {
    vi.mocked(getCoreAppData).mockResolvedValue({ dataset: { snapshotDate: "2026-10-30", generatedAt: "2026-10-30", assets: [], ictSystems: [], managedNetworks: [], spiEvaluations: [] },
      analytics: { findings: [] }, filters: { managedNetwork: "net-a,net-b" }, spiDefinitions: [], severityDefinitions: [] } as unknown as Awaited<ReturnType<typeof getCoreAppData>>);
    const page = await CyberCopPage({ searchParams: { copView: "impact", network: ["net-a", "net-b"], dataDate: "2026-11-01", severity: "old-local-filter", environment: "Test" } });
    expect(getCoreAppData).toHaveBeenCalledExactlyOnceWith({ network: ["net-a", "net-b"], system: undefined, dataDate: "2026-11-01" }, { profile: "full" });
    const component = (page.props.children as ReactElement[]).find(child => child.type === ServiceImpactAnalyser)!;
    expect(component.props.model.snapshotDate).toBe("2026-10-30");
    expect(component.props.filters).toEqual({ managedNetwork: "net-a,net-b" });
  });
});
