import React, { type ComponentProps, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IctSystemRiskProfilePage from "@/app/ict-system-risk-profile/page";
import { IctSystemRiskProfile } from "@/components/ict-system-risk-profile";
import { getCoreAppData } from "@/lib/app-data";

vi.mock("@/lib/app-data", () => ({ getCoreAppData: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("React", React); });
afterEach(() => vi.unstubAllGlobals());

describe("ICT system risk profile route", () => {
  it("waits for a header scope before loading data", async () => {
    await IctSystemRiskProfilePage({ searchParams: {} });
    expect(getCoreAppData).not.toHaveBeenCalled();
  });
  it("uses only header filters and the actual available snapshot", async () => {
    vi.mocked(getCoreAppData).mockResolvedValue({
      dataset: { snapshotDate: "2026-10-30", generatedAt: "2026-10-30", assets: [], managedNetworks: [], ictSystems: [{ id: "sys-a", name: "System A", environments: [] }], spiEvaluations: [] },
      analytics: { evaluations: [], findings: [] }, filters: { ictSystem: "sys-a,sys-b" }, severityDefinitions: [], spiDefinitions: [], measuresSettings: { updatedAt: "", severityMatrix: {}, priorityMatrix: {} }
    } as unknown as Awaited<ReturnType<typeof getCoreAppData>>);
    const page = await IctSystemRiskProfilePage({ searchParams: { system: ["sys-a", "sys-b"], systemDetails: ["sys-a"], dataDate: "2026-10-31", severity: "High Risk", assetType: "server" } });
    expect(getCoreAppData).toHaveBeenCalledExactlyOnceWith({ network: undefined, system: ["sys-a", "sys-b"], dataDate: "2026-10-31" }, { profile: "risk-summary" });
    const profile = (page.props.children as ReactElement[]).find(child => child.type === IctSystemRiskProfile) as ReactElement<ComponentProps<typeof IctSystemRiskProfile>>;
    expect(profile.props.model).toMatchObject({ kind: "system", snapshotDate: "2026-10-30" });
    expect(profile.props.filters).toEqual({ ictSystem: "sys-a,sys-b" });
    expect(profile.props.initialSystemId).toBe("sys-a");
    const otherPage = await IctSystemRiskProfilePage({ searchParams: { system: "sys-a", systemDetails: "sys-outside" } });
    const otherProfile = (otherPage.props.children as ReactElement[]).find(child => child.type === IctSystemRiskProfile) as ReactElement<ComponentProps<typeof IctSystemRiskProfile>>;
    expect(otherProfile.props.initialSystemId).toBeUndefined();
  });
});
