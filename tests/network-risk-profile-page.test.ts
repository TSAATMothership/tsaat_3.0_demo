import React, { type ComponentProps, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NetworkRiskProfilePage from "@/app/network-risk-profile/page";
import { NetworkRiskProfile } from "@/components/network-risk-profile";
import { getCoreAppData } from "@/lib/app-data";

vi.mock("@/lib/app-data", () => ({ getCoreAppData: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("React", React); });
afterEach(() => vi.unstubAllGlobals());

describe("network risk profile route", () => {
  it("waits for a header scope before loading data", async () => {
    await NetworkRiskProfilePage({ searchParams: {} });
    expect(getCoreAppData).not.toHaveBeenCalled();
  });
  it("loads only shared header scope and uses the actual available snapshot", async () => {
    vi.mocked(getCoreAppData).mockResolvedValue({
      dataset: { snapshotDate: "2026-10-30", generatedAt: "2026-10-30", assets: [], managedNetworks: [{ id: "net-a", name: "Network A", ictSystemIds: [] }], ictSystems: [], spiEvaluations: [] },
      analytics: { evaluations: [], findings: [] }, filters: { managedNetwork: "net-a,net-b" }, severityDefinitions: [], spiDefinitions: [], measuresSettings: { updatedAt: "", severityMatrix: {}, priorityMatrix: {} }
    } as unknown as Awaited<ReturnType<typeof getCoreAppData>>);
    const page = await NetworkRiskProfilePage({ searchParams: { network: ["net-a", "net-b"], networkDetails: "net-a", dataDate: "2026-10-31", severity: "High Risk", assetType: "server", securityDomain: "Protected" } });
    expect(getCoreAppData).toHaveBeenCalledExactlyOnceWith({ network: ["net-a", "net-b"], system: undefined, dataDate: "2026-10-31" }, { profile: "risk-summary" });
    const profile = (page.props.children as ReactElement[]).find(child => child.type === NetworkRiskProfile) as ReactElement<ComponentProps<typeof NetworkRiskProfile>>;
    expect(profile.props.model.snapshotDate).toBe("2026-10-30");
    expect(profile.props.filters).toEqual({ managedNetwork: "net-a,net-b" });
    expect(profile.props.initialNetworkId).toBe("net-a");
    const otherPage = await NetworkRiskProfilePage({ searchParams: { network: "net-a", networkDetails: "net-outside" } });
    const otherProfile = (otherPage.props.children as ReactElement[]).find(child => child.type === NetworkRiskProfile) as ReactElement<ComponentProps<typeof NetworkRiskProfile>>;
    expect(otherProfile.props.initialNetworkId).toBeUndefined();
  });
});
