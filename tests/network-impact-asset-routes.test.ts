import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getDiagram } from "@/app/api/cyber-cop/impact-analyser-2/route";
import { GET as getFindings } from "@/app/api/cyber-cop/impact-analyser-2/findings/route";
import { getCoreAppData } from "@/lib/app-data";
import { filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import type { Asset, Dataset, Finding, ICTSystem, ManagedNetwork } from "@/lib/types";

vi.mock("@/lib/app-data", () => ({ getCoreAppData: vi.fn(async (query: Record<string, string>) => {
  const filters = parseFilters(query);
  return { dataset, filters, systems: filterSystems(dataset.ictSystems, filters),
    networks: filterNetworks(dataset.managedNetworks, filters, dataset.ictSystems), analytics: { findings, evaluations: [] } };
}) }));

const assets: Asset[] = ["ci-1", "ci-10", "ci-2", "no-findings"].map(id => ({
  id, name: "Identical display name", hostname: id, type: "printer-device", networkId: id === "ci-2" ? "net-2" : "net-1",
  securityDomain: "PROTECTED", lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, vulnerabilities: [],
  systemContext: { systemId: id === "ci-2" ? "sys-2" : "sys-1", environmentType: "Production" }
}));
const systems: ICTSystem[] = [1, 2].map(index => ({
  id: `sys-${index}`, name: `System ${index}`, networkId: `net-${index}`, adfPlatform: false, enterprisePlatform: true,
  modellingStatus: true, diisDefined: true, criticality: "Critical", securityDomain: "PROTECTED",
  missionCapabilities: [], businessServices: [], environments: [{ id: `env-${index}`, name: "Production", type: "Production",
    assetIds: assets.filter(asset => asset.networkId === `net-${index}`).map(asset => asset.id) }]
}));
const networks: ManagedNetwork[] = [1, 2].map(index => ({ securityDomain: "UNKNOWN",
  id: `net-${index}`, name: `Network ${index}`, criticality: "Critical", adfPlatform: false, enterprisePlatform: true,
  modellingStatus: true, discoveryStatus: "Discovery Enabled", ictSystemIds: [`sys-${index}`],
  assetIds: assets.filter(asset => asset.networkId === `net-${index}`).map(asset => asset.id)
}));
const dataset: Dataset = { generatedAt: "2026-10-30T00:00:00Z", snapshotDate: "2026-10-30",
  assets, ictSystems: systems, managedNetworks: networks, spiEvaluations: [] };
const findings = assets.filter(asset => asset.id !== "no-findings").map<Finding>(asset => ({
  id: `finding-${asset.id}`, spiId: 3, priorityRank: 2, severity: "High Risk", status: "open", complianceStatus: "Non-compliant",
  timestamp: "2026-10-29T00:00:00Z", scope: { networkId: asset.networkId, systemId: asset.systemContext?.systemId ?? null,
    environmentType: asset.systemContext?.environmentType ?? null, assetId: asset.id },
  title: "Review asset", evidence: {}, recommendedAction: "Review"
}));
const request = (query: string) => new NextRequest(`http://localhost/api/cyber-cop/impact-analyser-2?dataDate=2026-10-30&diagramNetworkIds=net-1,net-2&${query}`);

describe("asset-filtered network impact APIs", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["network=net-1", "system=sys-1", "network=net-1,net-2", "system=sys-1,sys-2"])("uses exact IDs for diagram and finding counts within %s", async scope => {
    const query = request(`${scope}&impactAssetId=ci-1&spiId=3`);
    const diagram = await (await getDiagram(query)).json();
    expect(diagram.snapshotDate).toBe("2026-10-30");
    expect(diagram.rows).toHaveLength(2);
    expect(diagram.rows.every((row: { assetId: string }) => row.assetId === "ci-1")).toBe(true);
    const response = await (await getFindings(query)).json();
    expect(response.totalCount).toBe(1);
    expect(response.findings.map((row: { assetId: string }) => row.assetId)).toEqual(["ci-1"]);
    expect(response.allFindings.map((row: { assetId: string }) => row.assetId)).toEqual(["ci-1"]);
    expect(getCoreAppData).toHaveBeenCalledWith(expect.objectContaining({ dataDate: "2026-10-30" }));
  });
  it.each(["ci-2", "unknown", "", "ci-1&impactAssetId=ci-10"])("returns empty results for an unavailable or malformed selection: %s", async assetId => {
    const query = request(`network=net-1&impactAssetId=${assetId}&spiId=3`);
    expect((await (await getDiagram(query)).json()).rows).toEqual([]);
    expect(await (await getFindings(query)).json()).toMatchObject({ findings: [], allFindings: [], totalCount: 0, assetHighRiskCvesByAssetId: {} });
  });
  it("retains inventory-only assets without inventing findings and leaves ordinary network runs unchanged", async () => {
    const query = request("network=net-1&impactAssetId=no-findings&spiId=3");
    expect((await (await getDiagram(query)).json()).rows).toMatchObject([{ assetId: "no-findings", findingId: null }]);
    expect(await (await getFindings(query)).json()).toMatchObject({ totalCount: 0, allFindings: [] });
    const unfiltered = await (await getDiagram(request("network=net-1"))).json();
    expect(new Set(unfiltered.rows.map((row: { assetId: string }) => row.assetId))).toEqual(new Set(["ci-1", "ci-10", "no-findings"]));
  });
});
