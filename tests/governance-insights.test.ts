import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildGovernanceInsights, insightsHref } from "@/lib/governance-insights";
import { loadGovernanceInsights } from "@/lib/governance-insights-data";
import type { ServiceImpactModel, ServiceImpactFinding } from "@/lib/service-impact";
import type { DiscoveryOverviewData } from "@/lib/discovery-overview-data";
import InsightsPage from "@/app/governance/insights/page";

const { readCore, readOverview } = vi.hoisted(() => ({ readCore: vi.fn(), readOverview: vi.fn() }));
vi.mock("@/lib/app-data", () => ({ getCoreAppData: readCore }));
vi.mock("@/lib/discovery-overview-data", () => ({ loadDiscoveryOverview: readOverview }));
const date = "2026-03-05";
const discovery = () => buildDiscoveryOverview({ snapshotDate: date, coverage: buildScopedDiscoveryToolCoverage([], defaultDiscoveryToolsSettings()),
  endpoints: [], software: [], shadow: [], vulnerabilities: [], patches: [] });
const overview = (): DiscoveryOverviewData => ({ model: discovery(), scope: { network: ["net-1"], system: [], securityDomain: "SECRET", dataDate: date },
  scopeLabels: { networks: ["Example network (net-1)"], systems: [], domains: ["SECRET"] } });
const impact = (): ServiceImpactModel => ({ snapshotDate: date, systems: [], business: [], mission: [], assets: [], findings: [], unattributedFindings: 0, severities: [] });
const finding = (id: string, severity: string): ServiceImpactFinding => ({ id, assetId: "asset-1", systemId: "sys-1", severity,
  spiId: 1, spiName: "Configured measure", title: id, priority: 1, environment: "Production", timestamp: date, duration: 4, recommendedAction: "Review" });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  readOverview.mockResolvedValue(overview());
  readCore.mockResolvedValue({ dataset: { snapshotDate: date, generatedAt: "2026-03-05T08:00:00Z", assets: [], ictSystems: [], managedNetworks: [] }, analytics: { findings: [] }, filters: {}, spiDefinitions: [], severityDefinitions: [] });
});
afterEach(() => vi.unstubAllGlobals());

describe("Executive insight interpretation", () => {
  it("deduplicates findings and treats shared-service rows as non-additive", () => {
    const model = impact(), critical = finding("critical", "Critical Exposure");
    model.findings = [critical, critical, finding("high", "High Risk"), finding("custom", "Custom severity")];
    model.systems = [{ id: "sys-1", name: "System", criticality: "Critical", appId: "APP-1" }];
    model.business = ["Service A", "Service B"].map(name => ({ id: name, name, criticality: "Critical", systemIds: ["sys-1"] }));
    model.severities = [{ key: "Custom severity", label: "Configured label" }];
    model.unattributedFindings = 9;
    const result = buildGovernanceInsights(discovery(), model);
    expect(result.counts).toMatchObject({ findings: 3, critical: 1, high: 1, affectedCis: 1 });
    expect(result).toMatchObject({ priority: 2, priorityCis: 1, prioritySystems: 1, exposedServices: 2, hasEvidence: true });
    expect(result.services.map(row => row.findings)).toEqual([3, 3]);
    expect(result.severities).toContainEqual({ key: "Custom severity", label: "Configured label", count: 1 });
    expect(result.actions[0].count).toBe(2);
  });
  it("keeps CVE observations distinct from findings and patch status", () => {
    const model = discovery(); model.vulnerabilities.criticalHigh = 7; model.vulnerabilities.total = 9;
    const result = buildGovernanceInsights(model, impact());
    expect(result.priority).toBe(0); expect(model.patches.patched).toBe(0);
    expect(result.actions).toEqual([expect.objectContaining({ key: "cve", count: 7 })]);
    expect(result.headline).toContain("vulnerability exposure");
  });
  it("uses actual nonzero triggers and stable leadership priority order", () => {
    const model = discovery(); model.patches.overdue = 2; model.coverage.gaps = 3; model.vulnerabilities.criticalHigh = 4; model.shadow.total = 5;
    const original = structuredClone(model), result = buildGovernanceInsights(model, impact());
    expect(result.actions.map(row => row.key)).toEqual(["patch", "coverage", "cve"]);
    expect(model).toEqual(original);
  });
  it("keeps absent denominators and empty scopes explicit without declaring compliance", () => {
    const model = discovery(), result = buildGovernanceInsights(model, impact());
    expect(model.coverage.percent).toBeNull(); expect(model.patches.verifiedPercent).toBeNull();
    expect(result.hasEvidence).toBe(false); expect(result.actions).toEqual([]);
  });
  it("pins scope, security domains and snapshot in evidence links without local filters", () => {
    const href = insightsHref({ network: ["net-b", "net-a"], securityDomain: ["SECRET", "UNKNOWN"], dataDate: date, severity: "Major", discoveryFilters: "stale" }, "/cyber-cop", { key: "copView", value: "impact" });
    expect(Object.fromEntries(new URL(href, "http://localhost").searchParams)).toEqual({ network: "net-a,net-b", securityDomain: "SECRET,UNKNOWN", dataDate: date, copView: "impact" });
    expect(insightsHref({ system: "sys-1", securityDomain: "NONE", dataDate: date }, "/findings")).toContain("securityDomain=NONE");
  });
});

describe("Insights scope and route contract", () => {
  it("pins both source models to one resolved snapshot and strips page-local filters", async () => {
    const scope = { network: ["net-a", "net-b"], system: undefined, securityDomain: "SECRET", dataDate: "2026-03-06" };
    const result = await loadGovernanceInsights({ ...scope, severity: "Major", environment: "Test", discoveryFilters: "local" });
    expect(readOverview).toHaveBeenCalledExactlyOnceWith(scope);
    expect(readCore).toHaveBeenCalledExactlyOnceWith({ ...scope, dataDate: date }, { profile: "full" });
    expect(result.model.snapshotDate).toBe(result.impact.snapshotDate);
    expect(result.snapshotGeneratedAt).toBe("2026-03-05T08:00:00Z");
  });
  it("refuses to combine mismatched snapshots", async () => {
    readCore.mockResolvedValue({ dataset: { snapshotDate: "2026-03-04" } });
    await expect(loadGovernanceInsights({ system: "sys-1" })).rejects.toThrow("snapshot mismatch");
  });
  it("does not read business data before a header scope is selected", async () => {
    const html = renderToStaticMarkup(await InsightsPage({ searchParams: {} }));
    expect(readOverview).not.toHaveBeenCalled(); expect(readCore).not.toHaveBeenCalled();
    expect(html).toContain("data-route-ready-key"); expect(html).not.toContain("<h1");
  });
  it("renders all five chapters with an explicit empty state, N/A and scoped evidence links", async () => {
    const html = renderToStaticMarkup(await InsightsPage({ searchParams: { network: "net-1", securityDomain: "SECRET", dataDate: date } }));
    for (const id of ["terrain", "exposure", "mission", "resilience", "decisions"]) expect(html).toContain(`id="insights-${id}"`);
    expect(html).toContain("No records in this scope and snapshot"); expect(html).toContain("N/A");
    expect(html).toContain("securityDomain=SECRET"); expect(html).toContain(`data-insights-snapshot="${date}"`);
    expect(html).toContain("/cyber-terrain.svg"); expect(html).toContain("About this briefing");
  });
  it("returns a ready error state with a scoped retry instead of zero metrics on failure", async () => {
    readOverview.mockRejectedValue(new Error("Provider unavailable"));
    const html = renderToStaticMarkup(await InsightsPage({ searchParams: { system: "sys-1", dataDate: date } }));
    expect(html).toContain("Insights are temporarily unavailable"); expect(html).toContain("system=sys-1");
    expect(html).toContain("data-route-ready-key"); expect(html).not.toContain("insight-headline-metrics");
  });
});
