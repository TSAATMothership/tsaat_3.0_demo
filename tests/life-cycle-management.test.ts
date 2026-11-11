import { describe, expect, it, vi } from "vitest";
import { buildLifeCycleManagement, lifecycleLag, lifecycleLagLabel } from "@/lib/life-cycle-management";
import type { Asset, Dataset, ICTSystem, ServerAsset } from "@/lib/types";
import { defaultPersonaSettings, personaAllowsHref } from "@/lib/personas";
import { activeWorkspaceItem, WORKSPACE_GROUPS } from "@/lib/workspace-navigation";

const server = (id: string, overrides: Partial<ServerAsset> = {}): ServerAsset => ({ id, name: id, hostname: id, type: "server", networkId: "net-1", securityDomain: "PROTECTED",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, vulnerabilities: [],
  operatingSystem: { family: "Example OS", vendor: "Example", version: "2022", majorVersion: 2022, currentSupportedMajor: 2025, supportStatus: "Supported", nMinus: 1 },
  installedSoftware: [{ name: "Supported app", version: "2", supportStatus: "Supported" }], ...overrides });
const system = (id: string, criticality: ICTSystem["criticality"]): ICTSystem => ({ id, name: id, criticality, securityDomain: "PROTECTED", networkId: "net-2", adfPlatform: false,
  enterprisePlatform: false, modellingStatus: true, diisDefined: false, environments: [], missionCapabilities: [], businessServices: [] });
const dataset = (assets: Asset[]): Dataset => ({ snapshotDate: "2026-03-05", generatedAt: "2026-03-05T00:00:00Z", assets, managedNetworks: [],
  ictSystems: [system("critical", "Critical"), system("ordinary", "Non-Critical")], spiEvaluations: [] });
const allDomains = { securityDomain: "PROTECTED,SECRET,UNKNOWN" };

describe("Life Cycle Management evidence and ranking", () => {
  it("uses recorded N-minus, includes exactly N-2 and older, and does not subtract release years", () => {
    const assets = [0, 1, 2, 3, null, -1, 1.5].map((nMinus, index) => {
      const row = server(String(index)); return { ...row, operatingSystem: { ...row.operatingSystem!, nMinus } };
    });
    const model = buildLifeCycleManagement(dataset(assets), allDomains);
    expect(model.totals.oldOperatingSystems).toBe(2);
    expect(model.totals.unknownOsLag).toBe(3);
    expect(model.servers.find(row => row.id === "1")?.issueCount).toBe(0); // 2025 - 2022 must not override N-1.
    expect(model.servers.find(row => row.id === "2")?.issues).toContain("OS N-2");
    expect(lifecycleLag(NaN)).toBeNull(); expect(lifecycleLag(Infinity)).toBeNull(); expect(lifecycleLagLabel(null)).toBe("Unknown");
  });
  it("counts three areas without double-counting unsupported and old OS, and preserves installation multiplicity", () => {
    const row = server("overlap", { lifecycle: { eolStatus: "EOL", warrantyStatus: "OutOfWarranty" },
      installedSoftware: [{ name: "Legacy", version: "1", supportStatus: "OutOfSupport" }, { name: "Legacy", version: "1", supportStatus: "OutOfSupport" }] });
    row.operatingSystem = { ...row.operatingSystem!, nMinus: 2, supportStatus: "OutOfSupport" };
    const model = buildLifeCycleManagement(dataset([row]), allDomains);
    expect(model.servers[0].issueCount).toBe(3);
    expect(model.servers[0].issues).toHaveLength(4);
    expect(model.totals).toMatchObject({ serversAtRisk: 1, compoundedServers: 1, unsupportedInstallations: 2, unsupportedDevices: 1, warrantyExpired: 1 });
    expect(new Set(model.software.map(item => item.id)).size).toBe(2);
  });
  it("keeps missing evidence separate from confirmed failures and does not call an empty software inventory supported", () => {
    const row = server("unknown", { lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, operatingSystem: null, installedSoftware: [] });
    const model = buildLifeCycleManagement(dataset([row]), allDomains);
    expect(model.servers[0].issueCount).toBe(0); expect(model.servers[0].gaps).toEqual(["Warranty status", "Operating system inventory", "Software inventory"]);
    expect(model.totals.serversAtRisk).toBe(0); expect(model.totals.serversWithGaps).toBe(1);
    const unknownApp = server("unknown-app", { installedSoftware: [{ name: "App", version: "1", supportStatus: "Unknown" }] });
    expect(buildLifeCycleManagement(dataset([unknownApp]), allDomains).servers[0]).toMatchObject({ unsupportedSoftware: 0, unknownSoftware: 1, issueCount: 0 });
  });
  it("prioritises overlap, then criticality and production; unknown-only records precede clear records", () => {
    const warranty = { eolStatus: "Supported", warrantyStatus: "OutOfWarranty" } as const;
    const overlap = server("overlap", { lifecycle: warranty, installedSoftware: [{ name: "App", version: "1", supportStatus: "OutOfSupport" }] });
    const criticalTest = server("critical-test", { lifecycle: warranty, systemContext: { systemId: "critical", environmentType: "Test" } });
    const criticalProduction = server("critical-production", { lifecycle: warranty, systemContext: { systemId: "critical", environmentType: "Production" } });
    const ordinary = server("ordinary-production", { lifecycle: warranty, systemContext: { systemId: "ordinary", environmentType: "Production" } });
    const unknown = server("unknown", { operatingSystem: null });
    const model = buildLifeCycleManagement(dataset([server("clear"), ordinary, unknown, criticalTest, criticalProduction, overlap]), allDomains);
    expect(model.servers.map(row => row.id)).toEqual(["overlap", "critical-production", "critical-test", "ordinary-production", "unknown", "clear"]);
  });
  it("uses endpoint domain and infrastructure network, preserves multiple scopes, and ignores unrelated page filters", () => {
    const modelData = dataset([server("a", { systemContext: { systemId: "critical", environmentType: "Test" } }), server("b", { networkId: "net-2", securityDomain: "SECRET" }),
      server("unassigned", { networkId: "net-unassigned" }), server("outside", { networkId: "net-3" })]);
    expect(buildLifeCycleManagement(modelData, { network: "net-1", system: "critical", assetType: "workstation", environment: "Production" }).servers.map(row => row.id)).toEqual(["a"]);
    expect(buildLifeCycleManagement(modelData, { network: ["net-1", "net-2"], securityDomain: "SECRET" }).servers.map(row => row.id)).toEqual(["b"]);
    expect(buildLifeCycleManagement(modelData, { securityDomain: "NONE" }).servers).toEqual([]);
  });
  it("includes device hardware and network OS, excludes unidentified nodes, and does not invent software for hardware-only types", () => {
    const base = server("base");
    const hardware: Asset = { ...base, type: "storage-device", id: "storage" };
    const network: Asset = { ...base, type: "network-device", id: "network", networkOs: { ...base.operatingSystem!, nMinus: 4 }, patchState: null };
    // Explicit objects avoid leaving server-only properties on other canonical types.
    const strip = ({ id, name, hostname, networkId, securityDomain, lifecycle, vulnerabilities }: ServerAsset) => ({ id, name, hostname, networkId, securityDomain, lifecycle, vulnerabilities });
    const model = buildLifeCycleManagement(dataset([{ ...strip(base), type: "storage-device", id: hardware.id },
      { ...strip(base), type: "network-device", id: network.id, networkOs: network.networkOs, patchState: null },
      { ...strip(base), id: "unknown-ip", type: "ip-node", discoveryApproach: "IP Scan", arpOwnerAssetId: null }]), allDomains);
    expect(model.hardware).toHaveLength(2); expect(model.operatingSystems).toHaveLength(1); expect(model.software).toEqual([]); expect(model.totals.oldOperatingSystems).toBe(1);
  });
  it("exposes the new Discovery page to persona configuration without granting it to saved page lists", () => {
    const item = WORKSPACE_GROUPS.find(group => group.id === "discovery")!.items.find(item => item.id === "discovery-life-cycle")!;
    const target = new URL(item.href, "http://localhost");
    expect(activeWorkspaceItem(target.pathname, target.searchParams)?.label).toBe("Life Cycle Management");
    const settings = defaultPersonaSettings(); settings.personas[1].pages = settings.personas[1].pages.filter(page => page !== item.id);
    expect(personaAllowsHref(settings, "life-cycle-management", item.href)).toBe(false);
    expect(personaAllowsHref(settings, null, item.href)).toBe(true);
  });
});

vi.mock("@/lib/data-loader", () => ({ loadDatasetForDate: vi.fn() }));
import { loadDatasetForDate } from "@/lib/data-loader";
import { loadLifeCycleManagement } from "@/lib/life-cycle-management-data";
it("loads the full provider snapshot for the requested date before projection", async () => {
  vi.mocked(loadDatasetForDate).mockResolvedValue(dataset([server("a")]));
  const model = await loadLifeCycleManagement({ network: "net-1", dataDate: ["2026-03-06"] });
  expect(loadDatasetForDate).toHaveBeenCalledWith("2026-03-06", { profile: "full" });
  expect(model.snapshotDate).toBe("2026-03-05"); expect(model.software).toHaveLength(1);
});
