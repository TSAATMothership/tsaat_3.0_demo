import { describe, expect, it } from "vitest";
import { buildServiceImpactModel, selectServiceImpact, serviceImpactRows } from "@/lib/service-impact";
import type { Asset, Dataset, Finding, ICTSystem, ManagedNetwork } from "@/lib/types";

const system = (id: string, networkId: string): ICTSystem => ({ id, name: id, networkId, criticality: "Critical", securityDomain: "Protected",
  adfPlatform: false, enterprisePlatform: true, modellingStatus: true, diisDefined: true, apmNumber: ` APP-${id} `,
  businessServices: [{ id: "shared", name: "Shared service", criticality: "Critical" }],
  missionCapabilities: [{ id: `mission-${id}`, name: `Mission ${id}`, criticality: "Non-Critical" }], environments: [] });
const asset = (id: string, networkId: string, systemId?: string): Asset => ({ id, name: id, hostname: id, type: "server", networkId,
  systemContext: systemId ? { systemId, environmentType: "Production" } : undefined, securityDomain: "Protected",
  ipAddress: "10.0.0.1", deviceModel: "Stored model", discoveredBy: "Stored scanner", lastDiscoveredDate: "2026-10-30",
  vulnerabilities: [], lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, operatingSystem: null, installedSoftware: [] });
const finding = (id: string, assetId: string, severity: string): Finding => ({ id, spiId: 1, priorityRank: 1, severity, status: "open",
  complianceStatus: "Non-compliant", timestamp: "2026-10-01T12:00:00Z", title: id, recommendedAction: "Fix the source issue", evidence: {},
  scope: { assetId, networkId: "net-a", systemId: "stale-system-id", environmentType: "Test" } });
export function serviceImpactFixture() {
  const first = finding("f1", "a1", "Critical Exposure");
  const findings = [first, { ...first }, finding("f2", "a1", "High Risk"), finding("f3", "a2", "Major"),
    finding("f4", "b1", "Critical Exposure"), finding("f5", "b2", "Data Gap"), finding("f6", "unassigned", "High Risk"),
    finding("orphan", "missing-ci", "Critical Exposure"), { ...finding("closed", "a2", "Critical Exposure"), status: "closed" as const }];
  const dataset: Dataset = { snapshotDate: "2026-11-01", generatedAt: "2026-11-01", spiEvaluations: [],
    ictSystems: [system("sys-a", "net-a"), system("sys-b", "net-b"), { ...system("sys-empty", "net-b"), businessServices: [], missionCapabilities: [] }],
    managedNetworks: ["net-a", "net-b"].map(id => ({ id, name: id, ictSystemIds: [], assetIds: [] })) as unknown as ManagedNetwork[],
    assets: [asset("a1", "net-a", "sys-a"), asset("a2", "net-a", "sys-a"), asset("b1", "net-b", "sys-b"), asset("b2", "net-a", "sys-b"), asset("unassigned", "net-a")] };
  return { dataset, analytics: { findings }, filters: {}, spiDefinitions: [], severityDefinitions: [] };
}

describe("Service Impact Analyser scope and counts", () => {
  it("deduplicates findings and counts shared CIs once while retaining recorded CI metadata", () => {
    const model = buildServiceImpactModel(serviceImpactFixture());
    expect(model.findings).toHaveLength(5);
    expect(model.unattributedFindings).toBe(1);
    expect(model.findings.find(row => row.id === "f1")).toMatchObject({ systemId: "sys-a", environment: "Production", duration: 31 });
    expect(model.assets[0]).toMatchObject({ ip: "10.0.0.1", model: "Stored model", discoveredBy: "Stored scanner", lastDiscovered: "2026-10-30" });
    expect(model.systems[0].appId).toBe("APP-sys-a");
    expect(serviceImpactRows(model.business, model.findings)[0]).toMatchObject({ findings: 5, critical: 2, high: 1, affectedCis: 4, systemIds: ["sys-a", "sys-b"] });
  });
  it("recalculates linked service/capability counts for selected systems rather than reusing full-scope totals", () => {
    const model = buildServiceImpactModel(serviceImpactFixture());
    const selection = selectServiceImpact(model, ["sys-a", "sys-a"]);
    expect(selection).toMatchObject({ findings: 3, critical: 1, high: 1, affectedCis: 2 });
    expect(selection.business[0]).toMatchObject({ findings: 3, affectedCis: 2, systemIds: ["sys-a"] });
    expect(selection.mission.map(row => row.id)).toEqual(["mission-sys-a"]);
    expect(selection.findingRows).toHaveLength(3);
    expect(selectServiceImpact(model, [])).toMatchObject({ findings: 0, affectedCis: 0, findingRows: [], assets: [], business: [], mission: [] });
    expect(selectServiceImpact(model, ["missing"])).toMatchObject({ findings: 0, assets: [] });
  });
  it("uses header network infrastructure scope without bringing in a system's other networks", () => {
    const model = buildServiceImpactModel({ ...serviceImpactFixture(), filters: { managedNetwork: "net-a" } });
    expect(model.systems.map(row => row.id)).toEqual(["sys-a", "sys-b"]);
    expect(model.assets.map(row => row.id).sort()).toEqual(["a1", "a2", "b2"]);
    expect(model.findings.map(row => row.id).sort()).toEqual(["f1", "f2", "f3", "f5"]);
    expect(model.unattributedFindings).toBe(1);
  });
  it("honours multi-system scope and keeps zero-finding systems available without inventing compliance", () => {
    const model = buildServiceImpactModel({ ...serviceImpactFixture(), filters: { ictSystem: "sys-a,sys-empty" } });
    expect(model.systems.map(row => row.id)).toEqual(["sys-a", "sys-empty"]);
    expect(model.findings).toHaveLength(3);
    expect(selectServiceImpact(model, ["sys-empty"])).toMatchObject({ findings: 0, affectedCis: 0, findingRows: [] });
    expect(buildServiceImpactModel({ ...serviceImpactFixture(), filters: { ictSystem: "unknown" } })).toMatchObject({ systems: [], findings: [], assets: [] });
  });
  it("preserves configured severity labels and does not drop unfamiliar severity values", () => {
    const input = serviceImpactFixture(); input.analytics.findings.push(finding("new", "a2", "Custom severity"));
    const model = buildServiceImpactModel(input);
    expect(model.severities).toContainEqual({ key: "Custom severity", label: "Custom severity" });
    expect(selectServiceImpact(model, ["sys-a"]).severities["Custom severity"]).toBe(1);
  });
});
