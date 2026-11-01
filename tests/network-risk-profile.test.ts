import { describe, expect, it } from "vitest";
import { buildNetworkRiskProfile, buildNetworkRiskTrend, networkRiskHref } from "@/lib/network-risk-profile";
import { isDataDateScopedPath } from "@/lib/data-date";
import { WORKSPACE_GROUPS } from "@/lib/workspace-navigation";
import type { AnalyticsResult, Asset, AssetSpiEvaluation, ComplianceStatus, Dataset, Finding, ManagedNetwork } from "@/lib/types";
import { testSeverityDefinitions, testSpiDefinitions, testMeasuresSettings } from "./spi-definition-fixtures";

const network = (id: string, overrides: Partial<ManagedNetwork> = {}): ManagedNetwork => ({ id, name: id,
  criticality: "Critical", adfPlatform: false, enterprisePlatform: false, modellingStatus: false,
  discoveryStatus: "Discovery Enabled", assetIds: [], ictSystemIds: [], ...overrides });
const asset = (id: string, networkId: string, systemId?: string): Asset => ({ id, name: id, hostname: id,
  networkId, type: "server", securityDomain: "Protected", operatingSystem: null, installedSoftware: [], vulnerabilities: [],
  lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" },
  ...(systemId ? { systemContext: { systemId, environmentType: "Production" as const } } : {}) });
const evaluation = (ci: Asset, statuses: ComplianceStatus[], covered = true): AssetSpiEvaluation => ({
  assetId: ci.id, assetType: ci.type, networkId: ci.networkId, systemId: ci.systemContext?.systemId ?? null,
  environmentType: "Production", securityDomain: "Protected", systemCriticality: "Critical", discoveryCoverageCompliant: covered,
  evaluations: statuses.map((status, index) => ({ spiId: index + 1, status, evidence: {}, reasons: [] })) });
const finding = (ci: Asset, overrides: Partial<Finding> = {}): Finding => ({ id: ci.id, spiId: 1, priorityRank: 1,
  severity: "High Risk", complianceStatus: "Non-compliant", status: "open", timestamp: "2026-07-01T12:00:00Z",
  scope: { assetId: ci.id, networkId: ci.networkId, systemId: ci.systemContext?.systemId ?? null, environmentType: "Production" },
  title: "Missing coverage", evidence: {}, recommendedAction: "Review coverage", ...overrides });
function fixture() {
  const assets = [asset("a", "net-a", "sys-shared"), asset("b", "net-b"), asset("c", "net-c"), asset("u", "net-unassigned")];
  const dataset: Dataset = { snapshotDate: "2026-11-01", generatedAt: "2026-11-01", assets, spiEvaluations: [],
    managedNetworks: [network("net-a"), network("net-b", { modellingStatus: true, discoveryStatus: "Discovery Non Enabled" }), network("net-c"), network("net-empty"), network("net-unassigned")],
    ictSystems: [{ id: "sys-shared", name: "Shared service", networkId: "net-b", criticality: "Critical", securityDomain: "Protected",
      adfPlatform: false, enterprisePlatform: false, modellingStatus: true, diisDefined: false, missionCapabilities: [], businessServices: [], environments: [] },
      { id: "sys-other", name: "Shared infrastructure consumer", networkId: "net-b", criticality: "Critical", securityDomain: "Protected",
        adfPlatform: false, enterprisePlatform: false, modellingStatus: false, diisDefined: false, missionCapabilities: [], businessServices: [],
        environments: [{ id: "prod", name: "Production", type: "Production", assetIds: ["a"] }] }] };
  const analytics: AnalyticsResult = { evaluations: [evaluation(assets[0], ["Compliant", "Non-compliant", "Unknown"]), evaluation(assets[1], ["Compliant"], false), evaluation(assets[3], ["Compliant"])],
    findings: [finding(assets[0], { severity: "Critical Exposure" }), finding(assets[1]), finding(assets[1], { id: "closed", status: "closed", closedTimestamp: "2026-10-31" }),
      finding(assets[3]), finding(asset("orphan", "net-a")), finding(assets[0], { id: "undated", timestamp: "invalid", severity: "Data Gap", priorityRank: 4 })],
    networkRollups: [], systemRollups: [], environmentRollups: [], overallCompliancePercent: 0,
    statusTotals: { compliant: 0, nonCompliant: 0, unknown: 0, impactedAssets: 0 }, productionCriticalExposureAssetIds: [] };
  return { dataset, analytics, filters: {}, severityDefinitions: testSeverityDefinitions, spiDefinitions: testSpiDefinitions, measuresSettings: testMeasuresSettings };
}

describe("network risk profile", () => {
  it("builds network panel details from stored metadata and all real system relationships, without duplicates", () => {
    const input = fixture();
    Object.assign(input.dataset.managedNetworks[0], { description: " Network description ", owner: " Network operations ",
      supportEmail: " ops@example.test ", serviceCatalogueUrl: "https://example.test/services", atoNumber: " ATO-1 ",
      grcUrl: "https://example.test/grc/1", diisId: " DIIS-1 ", diisUrl: "https://example.test/diis/1",
      ictSystemIds: ["sys-shared", "sys-shared", "missing"] });
    const model = buildNetworkRiskProfile(input);
    const details = model.rows.find(row => row.id === "net-a")!.networkDetails;
    expect(details).toMatchObject({ description: "Network description", owner: "Network operations", supportEmail: "ops@example.test",
      atoNumber: "ATO-1", diisId: "DIIS-1", assetCount: 1 });
    expect(details.linkedSystems.map(system => system.id).sort()).toEqual(["sys-other", "sys-shared"]);
    expect(model.rows.find(row => row.id === "net-b")!.networkDetails.linkedSystems).toHaveLength(2);
    expect(details.assetFootprint).toHaveLength(7);
    expect(details.assetFootprint.reduce((sum, item) => sum + item.count, 0)).toBe(1);
    expect(details.assetFootprint.find(item => item.type === "server")?.count).toBe(1);
    expect(details.assetFootprint.find(item => item.type === "ip-node")?.count).toBe(0);
    expect(model.rows.find(row => row.id === "net-empty")!.networkDetails).toMatchObject({ owner: "", atoNumber: "", diisId: "", linkedSystems: [], assetCount: 0 });
    const scoped = buildNetworkRiskProfile({ ...input, filters: { ictSystem: "sys-shared" } });
    expect(scoped.rows.find(row => row.id === "net-a")!.networkDetails.linkedSystems.map(system => system.id)).toEqual(["sys-shared"]);
    expect(scoped.rows.find(row => row.id === "net-b")!.networkDetails.assetCount).toBe(0);
  });
  it("reconciles scoped networks, assessed checks, discovery gaps and open findings", () => {
    const model = buildNetworkRiskProfile(fixture());
    expect(model).toMatchObject({ networkCount: 4, ciCount: 3, systemCount: 2, openFindings: 3, severeFindings: 2, overdueFindings: 2,
      p1p2: 2, modelled: 1, discoveryEnabled: 3, unassessedCis: 1, compliantNetworks: 1 });
    expect(model.spi).toEqual({ compliant: 2, nonCompliant: 1, unknown: 1, total: 4, percent: 50 });
    // Lifecycle unknown does not erase a successful discovery assessment.
    expect(model.discovery).toEqual({ compliant: 1, nonCompliant: 1, unknown: 1, total: 3, percent: 33.3 });
    expect(model.rows.map(row => row.id)).toEqual(["net-a", "net-b", "net-c", "net-empty"]);
    expect(model.rows[0]).toMatchObject({ status: "Non-compliant", systemCount: 2, openFindings: 2, critical: 1, oldestDays: 123 });
    expect(model.severities.reduce((sum, severity) => sum + severity.count, 0)).toBe(model.openFindings);
    expect(model.findingsByDuration.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(model.openFindings);
    expect(model.findingsByDuration.at(-1)).toMatchObject({ unknownDate: true, total: 1 });
  });
  it("uses selected network unions, excluding other networks, placeholders and orphan findings", () => {
    const input = fixture();
    const model = buildNetworkRiskProfile({ ...input, filters: { managedNetwork: "net-a,net-c" } });
    expect(model.rows.map(row => row.id)).toEqual(["net-a", "net-c"]);
    expect(model.heatmap.devices.map(device => device.id).sort()).toEqual(["a", "c"]);
    expect(model.heatmap.devices.find(device => device.id === "c")?.status).toBe(2);
    expect(model).toMatchObject({ ciCount: 2, openFindings: 2, modelled: 0, discoveryEnabled: 2 });
    expect(buildNetworkRiskProfile({ ...input, filters: { managedNetwork: "missing" } })).toMatchObject({ networkCount: 0, ciCount: 0, openFindings: 0 });
  });
  it("finds infrastructure networks for system scope even when the system is owned elsewhere", () => {
    const model = buildNetworkRiskProfile({ ...fixture(), filters: { ictSystem: "sys-shared" } });
    expect(model.rows.map(row => row.id)).toEqual(["net-a", "net-b"]);
    expect(model).toMatchObject({ ciCount: 1, systemCount: 1, openFindings: 2 });
    expect(model.rows.find(row => row.id === "net-b")?.ciCount).toBe(0);
    expect(buildNetworkRiskProfile({ ...fixture(), filters: { managedNetwork: "net-b", ictSystem: "sys-shared" } }).openFindings).toBe(0);
  });
  it("distinguishes absent assessments from zero compliance and does not claim partial coverage is fully compliant", () => {
    const input = fixture();
    input.dataset.assets.push(asset("missing-spi", "net-b"));
    const model = buildNetworkRiskProfile(input);
    expect(model.rows.find(row => row.id === "net-b")).toMatchObject({ status: "Unknown", unassessedCis: 1, spi: { percent: 100, total: 1 } });
    expect(model.rows.find(row => row.id === "net-c")).toMatchObject({ status: "No assessments", spi: { percent: null }, discovery: { unknown: 1, percent: 0 } });
    expect(model.rows.find(row => row.id === "net-empty")).toMatchObject({ status: "No assessments", spi: { percent: null }, discovery: { percent: null } });
    expect(model.compliantNetworks).toBe(0);
  });
  it("orders equal-severity networks by ageing then open finding counts", () => {
    const input = fixture();
    input.analytics.findings = [finding(input.dataset.assets[0], { severity: "Major", timestamp: "2026-10-31" }),
      finding(input.dataset.assets[1], { severity: "Major" })];
    expect(buildNetworkRiskProfile(input).rows.slice(0, 2).map(row => row.id)).toEqual(["net-b", "net-a"]);
  });
  it("preserves the snapshot and workspace scope in reports and row drill-throughs", () => {
    const filters = { managedNetwork: "net-a,net-b", ictSystem: "sys-shared" };
    const report = new URL(networkRiskHref("/api/networks/remediation-report", filters, "2026-10-30"), "http://localhost");
    expect(Object.fromEntries(report.searchParams)).toEqual({ network: "net-a,net-b", system: "sys-shared", dataDate: "2026-10-30" });
    const findings = new URL(networkRiskHref("/findings", filters, "2026-10-30", "net-b", { severity: "High Risk", durationMin: "91" }), "http://localhost");
    expect(Object.fromEntries(findings.searchParams)).toMatchObject({ network: "net-b", system: "sys-shared", dataDate: "2026-10-30", severity: "High Risk", durationMin: "91" });
  });
  it("keeps the risk profiles together without the retired posture pages and supports snapshot selection", () => {
    const items = WORKSPACE_GROUPS.find(group => group.label === "Cyber Security")!.items;
    const position = items.findIndex(item => item.label === "Network Risk Profile");
    expect(items[position]).toMatchObject({ href: "/network-risk-profile", scope: "network" });
    expect(items[position + 1]).toMatchObject({ label: "ICT System Risk Profile", href: "/ict-system-risk-profile", scope: "system" });
    expect(items.some(item => item.href === "/networks" || item.href === "/systems")).toBe(false);
    expect(isDataDateScopedPath("/network-risk-profile")).toBe(true);
  });
});

describe("network risk trend", () => {
  it("reconstructs UTC opening and closure days, including carry-in, and excludes unreliable records", () => {
    const ci = asset("a", "net-a");
    const trend = buildNetworkRiskTrend([
      finding(ci, { timestamp: "2024-01-01", severity: "Critical Exposure" }),
      finding(ci, { timestamp: "2026-10-30T23:30:00-05:00", status: "closed", closedTimestamp: "2026-11-01" }),
      finding(ci, { timestamp: "2026-11-01", closedTimestamp: "2026-11-01" }), // Still open: ignore stale closure.
      finding(ci, { timestamp: "2026-11-02" }),
      finding(ci, { timestamp: "2024-01-01", status: "closed", closedTimestamp: "2024-02-01" }),
      finding(ci, { timestamp: "invalid" }),
      finding(ci, { status: "closed", closedTimestamp: null }),
      finding(ci, { timestamp: "2026-10-30", status: "closed", closedTimestamp: "2026-10-29" })
    ], "2026-11-01");
    expect(trend.points).toHaveLength(365);
    expect(trend.undated).toBe(3);
    expect(trend.points[0]).toMatchObject({ critical: 1, high: 0 });
    expect(trend.points.at(-3)).toEqual({ date: "2026-10-30", critical: 1, high: 0 });
    expect(trend.points.at(-2)).toEqual({ date: "2026-10-31", critical: 1, high: 1 });
    expect(trend.points.at(-1)).toEqual({ date: "2026-11-01", critical: 1, high: 1 });
    expect(trend.points.every(point => point.critical >= 0 && point.high >= 0)).toBe(true);
  });
});
