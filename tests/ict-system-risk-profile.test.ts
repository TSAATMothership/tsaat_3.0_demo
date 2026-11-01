import { describe, expect, it } from "vitest";
import { buildIctSystemRiskProfile, ictSystemRiskHref } from "@/lib/ict-system-risk-profile";
import { isDataDateScopedPath } from "@/lib/data-date";
import { WORKSPACE_GROUPS } from "@/lib/workspace-navigation";
import type { AnalyticsResult, Asset, AssetSpiEvaluation, ComplianceStatus, Dataset, Finding, ICTSystem, ManagedNetwork } from "@/lib/types";
import { testSeverityDefinitions, testSpiDefinitions, testMeasuresSettings } from "./spi-definition-fixtures";

const system = (id: string, overrides: Partial<ICTSystem> = {}): ICTSystem => ({ id, name: id, networkId: "net-b",
  criticality: "Critical", securityDomain: "Protected", adfPlatform: false, enterprisePlatform: false,
  modellingStatus: false, diisDefined: false, missionCapabilities: [], businessServices: [], environments: [], ...overrides });
const network = (id: string): ManagedNetwork => ({ id, name: id, criticality: "Critical", adfPlatform: false,
  enterprisePlatform: false, modellingStatus: true, discoveryStatus: "Discovery Enabled", assetIds: [], ictSystemIds: [] });
const asset = (id: string, networkId: string, systemId?: string): Asset => ({ id, name: id, hostname: id, type: "server",
  networkId, securityDomain: "Protected", operatingSystem: null, installedSoftware: [], vulnerabilities: [],
  lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" },
  ...(systemId ? { systemContext: { systemId, environmentType: "Production" as const } } : {}) });
const evaluation = (ci: Asset, statuses: ComplianceStatus[], covered = true): AssetSpiEvaluation => ({ assetId: ci.id,
  assetType: ci.type, networkId: ci.networkId, systemId: ci.systemContext?.systemId ?? null, environmentType: "Production",
  securityDomain: "Protected", systemCriticality: "Critical", discoveryCoverageCompliant: covered,
  evaluations: statuses.map((status, index) => ({ spiId: index + 1, status, reasons: [], evidence: {} })) });
const finding = (ci: Asset, overrides: Partial<Finding> = {}): Finding => ({ id: ci.id, spiId: 1, priorityRank: 1,
  severity: "Critical Exposure", complianceStatus: "Non-compliant", status: "open", timestamp: "2026-07-01",
  scope: { assetId: ci.id, networkId: ci.networkId, systemId: ci.systemContext?.systemId ?? null, environmentType: "Production" },
  title: "Missing coverage", recommendedAction: "Review coverage", evidence: {}, ...overrides });
function fixture() {
  const assets = [asset("a1", "net-a", "sys-a"), asset("a2", "net-b", "sys-a"), asset("b", "net-unassigned", "sys-b"),
    asset("unassigned-system", "net-a"), asset("unknown-system", "net-a", "missing")];
  const dataset: Dataset = { snapshotDate: "2026-11-01", generatedAt: "2026-11-01", assets, spiEvaluations: [],
    managedNetworks: [network("net-a"), network("net-b"), network("net-unassigned")],
    ictSystems: [system("sys-a", { modellingStatus: true, atoNumber: " ATO-1 ", diisId: " DIIS-1 " }),
      system("sys-b", { atoNumber: "   ", diisId: "DIIS-2" }), system("sys-empty", { diisDefined: true })] };
  const analytics: AnalyticsResult = {
    evaluations: [evaluation(assets[0], ["Compliant", "Non-compliant"]), evaluation(assets[1], ["Unknown"], false),
      evaluation(assets[2], ["Compliant"]), evaluation(assets[3], ["Non-compliant"]), evaluation(assets[4], ["Non-compliant"])],
    findings: [finding(assets[0]), finding(assets[1], { severity: "High Risk", timestamp: "2026-10-15" }),
      finding(assets[2], { severity: "Data Gap", timestamp: "invalid", priorityRank: 4 }),
      finding(assets[0], { id: "closed", status: "closed", closedTimestamp: "2026-10-30" }),
      finding(assets[3]), finding(assets[4]), finding(asset("orphan", "net-a", "sys-a"))],
    networkRollups: [], systemRollups: [], environmentRollups: [], overallCompliancePercent: 0,
    statusTotals: { compliant: 0, nonCompliant: 0, unknown: 0, impactedAssets: 0 }, productionCriticalExposureAssetIds: [] };
  return { dataset, analytics, filters: {}, severityDefinitions: testSeverityDefinitions, spiDefinitions: testSpiDefinitions, measuresSettings: testMeasuresSettings };
}

describe("ICT system risk profile", () => {
  it("builds the details panel from stored metadata, related networks and the explorer's scoped asset footprint", () => {
    const input = fixture();
    Object.assign(input.dataset.ictSystems[0], { description: " Service description ", owner: " Service operations ",
      supportEmail: " service@example.test ", serviceCatalogueUrl: "https://example.test/service",
      grcUrl: "https://example.test/grc", diisUrl: "https://example.test/diis", apmNumber: " APM-SYS-001 " });
    input.dataset.managedNetworks.push({ ...network("net-c"), ictSystemIds: ["sys-a", "sys-a"] }, network("net-d"));
    input.dataset.assets.push(asset("environment-ci", "net-d"));
    input.dataset.ictSystems[0].environments = [{ id: "prod", name: "Production", type: "Production", assetIds: ["environment-ci", "environment-ci", "missing-ci"] }];
    const model = buildIctSystemRiskProfile(input);
    const row = model.rows.find(row => row.id === "sys-a")!;
    expect(row.systemDetails).toMatchObject({ description: "Service description", owner: "Service operations", supportEmail: "service@example.test",
      atoNumber: "ATO-1", diisId: "DIIS-1", apmNumber: "APM-SYS-001", grcUrl: "https://example.test/grc", diisUrl: "https://example.test/diis", assetCount: row.ciCount });
    expect(row.systemDetails.linkedNetworks.map(network => network.id)).toEqual(["net-a", "net-b", "net-c", "net-d"]);
    expect(row.systemDetails.assetCount).toBe(2);
    expect(row.systemDetails.assetFootprint).toHaveLength(7);
    expect(row.systemDetails.assetFootprint.reduce((sum, item) => sum + item.count, 0)).toBe(row.ciCount);
    expect(row.systemDetails.assetFootprint.find(item => item.type === "server")?.count).toBe(2);
    expect(model.rows.find(row => row.id === "sys-empty")!.systemDetails).toMatchObject({ description: "", owner: "", atoNumber: "", diisId: "", apmNumber: "", assetCount: 0 });
    expect(model.rows.find(row => row.id === "sys-b")!.systemDetails.linkedNetworks.map(network => network.id)).toEqual(["net-b"]);
    const scoped = buildIctSystemRiskProfile({ ...input, filters: { managedNetwork: "net-a" } }).rows.find(row => row.id === "sys-a")!;
    expect(scoped.systemDetails.linkedNetworks.map(network => network.id)).toEqual(["net-a"]);
    expect(scoped.systemDetails.assetCount).toBe(1);
  });
  it("counts systems and their actual CIs, including infrastructure hosted outside the owning network", () => {
    const model = buildIctSystemRiskProfile(fixture());
    expect(model).toMatchObject({ kind: "system", entityCount: 3, systemCount: 3, ciCount: 3, networkCount: 2,
      openFindings: 3, severeFindings: 2, overdueFindings: 1, p1p2: 2, modelled: 1, atoProvided: 1, diisProvided: 2, compliantCount: 1 });
    expect(model.rows.map(row => row.id)).toEqual(["sys-a", "sys-b", "sys-empty"]);
    expect(model.rows[0]).toMatchObject({ ciCount: 2, networkCount: 2, context: "net-a, net-b", critical: 1, high: 1, oldestDays: 123, atoNumber: "ATO-1", diisId: "DIIS-1" });
    // A CI with a valid ICT system remains included even if its managed network is unassigned.
    expect(model.rows[1]).toMatchObject({ ciCount: 1, networkCount: 0, atoNumber: "" });
    expect(model.rows[2]).toMatchObject({ ciCount: 0, status: "No assessments", diisId: "", spi: { percent: null } });
  });
  it("uses all recorded assessments including unknowns and reconciles finding charts with the rows", () => {
    const model = buildIctSystemRiskProfile(fixture());
    expect(model.spi).toEqual({ compliant: 2, nonCompliant: 1, unknown: 1, total: 4, percent: 50 });
    expect(model.discovery).toEqual({ compliant: 2, nonCompliant: 1, unknown: 0, total: 3, percent: 66.7 });
    expect(model.rows.reduce((sum, row) => sum + row.openFindings, 0)).toBe(model.openFindings);
    expect(model.severities.reduce((sum, item) => sum + item.count, 0)).toBe(model.openFindings);
    expect(model.findingsByDuration.reduce((sum, item) => sum + item.total, 0)).toBe(model.openFindings);
    expect(model.findingsByDuration.at(-1)).toMatchObject({ unknownDate: true, total: 1 });
    expect(model.trend.points.at(-1)).toEqual({ date: "2026-11-01", critical: 1, high: 1 });
  });
  it("applies single and multiple ICT system selections without leaking orphan or unrelated findings", () => {
    const input = fixture();
    const one = buildIctSystemRiskProfile({ ...input, filters: { ictSystem: "sys-a" } });
    expect(one.heatmap.devices.map(device => device.id).sort()).toEqual(["a1", "a2"]);
    expect(one).toMatchObject({ systemCount: 1, ciCount: 2, networkCount: 2, openFindings: 2, atoProvided: 1 });
    const many = buildIctSystemRiskProfile({ ...input, filters: { ictSystem: "sys-a,sys-b" } });
    expect(many.rows.map(row => row.id)).toEqual(["sys-a", "sys-b"]);
    expect(many.ciCount).toBe(3);
    expect(buildIctSystemRiskProfile({ ...input, filters: { ictSystem: "missing" } })).toMatchObject({ systemCount: 0, ciCount: 0, openFindings: 0 });
  });
  it("intersects network and system scope using CI infrastructure", () => {
    const model = buildIctSystemRiskProfile({ ...fixture(), filters: { managedNetwork: "net-a", ictSystem: "sys-a,sys-b" } });
    expect(model.rows.map(row => row.id)).toEqual(["sys-a"]);
    expect(model).toMatchObject({ ciCount: 1, networkCount: 1, openFindings: 1 });
    expect(model.rows[0].context).toBe("net-a");
  });
  it("does not call a partly assessed system fully compliant or substitute ATO and DIIS defaults", () => {
    const input = fixture();
    input.dataset.assets.push(asset("b-missing", "net-b", "sys-b"));
    const model = buildIctSystemRiskProfile(input);
    expect(model.rows.find(row => row.id === "sys-b")).toMatchObject({ status: "Unknown", unassessedCis: 1,
      spi: { percent: 100 }, discovery: { unknown: 1, percent: 50 }, atoNumber: "" });
    expect(model.compliantCount).toBe(0);
    expect(model.atoProvided).toBe(1);
    expect(model.diisProvided).toBe(2); // diisDefined alone is not a stored DIIS number.
  });
  it("preserves system selections and actual snapshot dates in reports and row drill-throughs", () => {
    const filters = { ictSystem: "sys-a,sys-b" };
    const report = new URL(ictSystemRiskHref("/api/systems/remediation-report", filters, "2026-10-30"), "http://localhost");
    expect(Object.fromEntries(report.searchParams)).toEqual({ dataDate: "2026-10-30", system: "sys-a,sys-b" });
    const findings = new URL(ictSystemRiskHref("/findings", filters, "2026-10-30", "sys-b", { severity: "High Risk", durationMin: "91" }), "http://localhost");
    expect(Object.fromEntries(findings.searchParams)).toEqual({ dataDate: "2026-10-30", system: "sys-b", severity: "High Risk", durationMin: "91" });
    expect(findings.searchParams.has("network")).toBe(false);
  });
  it("appears directly after Network Risk Profile and supports the header date", () => {
    const items = WORKSPACE_GROUPS.find(group => group.label === "Cyber Security")!.items;
    const index = items.findIndex(item => item.href === "/network-risk-profile");
    expect(items[index + 1]).toEqual({ label: "ICT System Risk Profile", href: "/ict-system-risk-profile", scope: "system" });
    expect(isDataDateScopedPath("/ict-system-risk-profile")).toBe(true);
  });
});
