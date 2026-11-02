import { describe, expect, it } from "vitest";
import { resolveKpiScope } from "@/lib/kpi-scope";
import type { Asset, Dataset, ICTSystem, ManagedNetwork } from "@/lib/types";

const system = (id: string, networkId: string, assetIds: string[] = []): ICTSystem => ({
  id, name: id, networkId, adfPlatform: false, enterprisePlatform: false, modellingStatus: true,
  diisDefined: true, criticality: "Critical", securityDomain: "Protected", missionCapabilities: [], businessServices: [],
  environments: [{ id: `${id}-prod`, name: "Production", type: "Production", assetIds }]
});
const network = (id: string): ManagedNetwork => ({
  id, name: id, adfPlatform: false, enterprisePlatform: false, modellingStatus: true,
  criticality: "Critical", discoveryStatus: "Discovery Enabled", assetIds: [], ictSystemIds: []
});
const asset = (id: string, networkId: string, systemId?: string): Asset => ({
  id, name: id, hostname: id, type: "server", networkId, securityDomain: "Protected", vulnerabilities: [],
  lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, operatingSystem: null, installedSoftware: [],
  ...(systemId ? { systemContext: { systemId, environmentType: "Production" } } : {})
});
const dataset: Dataset = {
  generatedAt: "2026-11-01", snapshotDate: "2026-11-01", spiEvaluations: [],
  managedNetworks: [network("net-a"), network("net-b"), network("net-empty"), network("net-unassigned")],
  ictSystems: [system("sys-a", "net-a", ["shared", "a"]), system("sys-b", "net-a", ["shared"]), system("sys-no-assets", "net-b")],
  assets: [asset("shared", "net-b", "sys-a"), asset("a", "net-a", "sys-a"), asset("b", "net-b", "sys-b"), asset("unassigned", "net-unassigned", "sys-a")]
};

describe("system KPI scope", () => {
  it("keeps selected systems even without infrastructure or SPI assessments", () => {
    const scope = resolveKpiScope(dataset, { ictSystem: "sys-no-assets,sys-a,sys-a", assetType: "network-device" });
    expect(scope.systems.map(({ id }) => id)).toEqual(["sys-a", "sys-no-assets"]);
    expect(scope.networks.map(({ id }) => id)).toEqual(["net-a", "net-b"]);
  });
  it("finds systems through infrastructure in selected networks, regardless of the system's nominal network", () => {
    const scope = resolveKpiScope(dataset, { managedNetwork: "net-b" });
    expect(scope.systems.map(({ id }) => id)).toEqual(["sys-a", "sys-b"]);
    expect(scope.networks.map(({ id }) => id)).toEqual(["net-b"]);
  });
  it("includes users of shared environment infrastructure even without a direct asset assignment", () => {
    const sharedOnly = { ...dataset, assets: [asset("shared", "net-b")] };
    expect(resolveKpiScope(sharedOnly, { managedNetwork: "net-b" }).systems.map(({ id }) => id)).toEqual(["sys-a", "sys-b"]);
  });
  it("deduplicates systems spanning multiple selected networks", () => {
    expect(resolveKpiScope(dataset, { managedNetwork: "net-a,net-b,net-a" }).systems.map(({ id }) => id)).toEqual(["sys-a", "sys-b"]);
  });
  it("returns no systems for a network without associated infrastructure", () => {
    const scope = resolveKpiScope(dataset, { managedNetwork: "net-empty" });
    expect(scope.systems).toEqual([]);
    expect(scope.networks.map(({ id }) => id)).toEqual(["net-empty"]);
  });
  it("intersects explicit system and network selections in saved URLs", () => {
    expect(resolveKpiScope(dataset, { ictSystem: "sys-b", managedNetwork: "net-b" }).systems.map(({ id }) => id)).toEqual(["sys-b"]);
    expect(resolveKpiScope(dataset, { ictSystem: "sys-b", managedNetwork: "net-a" }).systems).toEqual([]);
  });
  it("never falls back to all systems for unknown selections", () => {
    expect(resolveKpiScope(dataset, { ictSystem: "missing" }).systems).toEqual([]);
    expect(resolveKpiScope(dataset, { managedNetwork: "missing" }).systems).toEqual([]);
  });
});
