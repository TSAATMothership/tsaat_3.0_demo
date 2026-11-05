import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildGovernanceTrends, trendMovement, trendHistory, trendStartDate } from "@/lib/governance-trends";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { buildLifeCycleManagement } from "@/lib/life-cycle-management";
import type { Asset, Dataset, ServerAsset } from "@/lib/types";
import { loadGovernanceTrends } from "@/lib/governance-trends-data";
import { loadDiscoveryToolsSettings, loadSnapshotsForDateWindow } from "@/lib/data-loader";
vi.mock("@/lib/data-loader", () => ({ loadDiscoveryToolsSettings: vi.fn(), loadSnapshotsForDateWindow: vi.fn() }));
const server = (id: string, overrides: Partial<ServerAsset> = {}): ServerAsset => ({ id, name: id, hostname: id, type: "server", networkId: "net-1", securityDomain: "PROTECTED",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, vulnerabilities: [],
  operatingSystem: { family: "OS", vendor: "Example", version: "2022", majorVersion: 2022, currentSupportedMajor: 2025, supportStatus: "Supported", nMinus: 1 },
  installedSoftware: [{ name: "App", version: "2", supportStatus: "Supported" }], ...overrides });
const snapshot = (date: string, assets: Asset[] = [server("a")]): Dataset => ({ snapshotDate: date, generatedAt: date, assets, managedNetworks: [], ictSystems: [], spiEvaluations: [] });
const settings = defaultDiscoveryToolsSettings();
const project = (datasets: Dataset[], params = {}) => buildGovernanceTrends(datasets, settings, params, "2026-02-01");

describe("executive trend evidence", () => {
  it("orders observations, keeps the latest snapshot per day and excludes future snapshots", () => {
    const first = snapshot("2026-01-01"), duplicate = { ...first, snapshotId: 2, assets: [server("new")] };
    const model = project([snapshot("2027-01-01"), snapshot("2026-02-01"), duplicate, { ...first, snapshotId: 1 }]);
    expect(model.points.map(row => row.date)).toEqual(["2026-01-01", "2026-02-01"]);
    expect(model.population).toEqual({ entered: 1, left: 1 });
    expect(project([snapshot("2027-01-01")]).points).toEqual([]);
  });
  it("defaults to a calendar month and retains every daily observation without a snapshot-count cap", () => {
    expect(trendHistory("week")).toBe("week"); expect(trendHistory(["week", "month"])).toBe("week");
    for (const input of [undefined, "month", "abc", "6", "24", "-1"]) expect(trendHistory(input)).toBe("month");
    const rows = Array.from({ length: 40 }, (_, index) => snapshot(new Date(Date.UTC(2025, 11, 25 + index)).toISOString().slice(0, 10), []));
    const model = project(rows, { trendSnapshots: "6" }); // Old count links use the new default.
    expect(model).toMatchObject({ history: "month", from: "2026-01-01", cutoff: "2026-02-01" });
    expect(model.points).toHaveLength(32); expect(model.points[0].date).toBe("2026-01-01");
    expect(model.points.at(-1)?.date).toBe("2026-02-01");
    expect(model.points[0]).toMatchObject({ compliance: null, lifecycle: null, discovery: null });
    expect(trendMovement(0, null, false).label).toBe("No comparison");
  });
  it("uses a seven-day interval including both boundary observations and never backfills stale history", () => {
    const rows = ["2026-01-24", "2026-01-25", "2026-01-31", "2026-02-01", "2026-02-02"].map(day => snapshot(day));
    const model = project(rows, { trendHistory: "week" });
    expect(model.from).toBe("2026-01-25");
    expect(model.points.map(point => point.date)).toEqual(["2026-01-25", "2026-01-31", "2026-02-01"]);
    expect(project([snapshot("2026-01-24")], { trendHistory: "week" }).points).toEqual([]);
    expect(project([snapshot("2026-02-02")], { trendHistory: "week" }).points).toEqual([]);
  });
  it("handles calendar month ends, leap years, year rollover and UTC week arithmetic", () => {
    expect(trendStartDate("month", "2026-03-31")).toBe("2026-02-28");
    expect(trendStartDate("month", "2024-03-31")).toBe("2024-02-29");
    expect(trendStartDate("month", "2026-01-31")).toBe("2025-12-31");
    expect(trendStartDate("week", "2026-01-03")).toBe("2025-12-27");
    expect(trendStartDate("week", "2026-10-06")).toBe("2026-09-29");
  });
  it("recomputes comparisons from the first observation inside the selected period", () => {
    const rows = ["2026-01-01", "2026-01-25", "2026-02-01"].map((day, index) => ({ ...snapshot(day),
      spiEvaluations: [0, 1].map(spiId => ({ assetId: "a", spiId, status: index === 1 && spiId === 1 ? "Non-compliant" as const : "Compliant" as const, evidence: {}, reasons: [] })) }));
    const month = project(rows), week = project(rows, { trendHistory: "week" });
    expect(month.points.map(point => point.compliance)).toEqual([100, 50, 100]);
    expect(week.points.map(point => point.compliance)).toEqual([50, 100]);
    expect(trendMovement(month.points.at(-1)!.compliance, month.points[0].compliance, true).delta).toBe(0);
    expect(trendMovement(week.points.at(-1)!.compliance, week.points[0].compliance, true).delta).toBe(50);
  });
  it("includes Unknown in the compliance denominator and does not invent checks", () => {
    const data = snapshot("2026-01-01", [server("a"), server("b")]);
    data.spiEvaluations = ["Compliant", "Non-compliant", "Unknown"].map((status, index) => ({ assetId: "a", spiId: index + 1, status: status as "Compliant" | "Non-compliant" | "Unknown", evidence: {}, reasons: [] }));
    const point = project([data]).points[0];
    expect(point).toMatchObject({ compliant: 1, nonCompliant: 1, unknown: 1, checks: 3, compliance: 33.3, uncheckedAssets: 1 });
  });
  it("uses the existing lifecycle rules, counts installation multiplicity, and separates evidence gaps", () => {
    const bad = server("bad", { lifecycle: { eolStatus: "EOL", warrantyStatus: "OutOfWarranty" }, installedSoftware: [1, 2].map(() => ({ name: "Legacy", version: "1", supportStatus: "OutOfSupport" })) });
    bad.operatingSystem = { ...bad.operatingSystem!, nMinus: 2 };
    const data = snapshot("2026-01-01", [bad, server("unknown", { operatingSystem: null, installedSoftware: [] })]);
    const model = project([data]);
    expect(model.points[0]).toMatchObject({ ...buildLifeCycleManagement(data, {}).totals, lifecycle: 50, warrantyExpired: 1, unsupportedInstallations: 2, oldOperatingSystems: 1, serversAtRisk: 1, compoundedServers: 1, serversWithGaps: 1 });
    expect(model.priorities.map(row => row.id)).toEqual(["bad", "unknown"]);
  });
  it("uses configured required discovery checks and reports unconfigured inventory separately", () => {
    const data = snapshot("2026-01-01");
    const tools = { ...settings, tools: settings.tools.slice(0, 2).map(tool => ({ ...tool, assetTypeScope: { ...tool.assetTypeScope, server: "required" as const } })) };
    data.discoveryCoverageEvaluations = [{ assetId: "a", toolValues: { [tools.tools[0].id]: 1, [tools.tools[1].id]: 0 }, missingToolIds: [], missingToolNames: [], coverageCompliance: false }];
    const model = buildGovernanceTrends([data], tools, {}, "2026-02-01");
    expect(model.points[0]).toMatchObject({ discovery: 50, covered: 1, required: 2, discoveryGaps: 1, unmapped: 0 });
    expect(model.tools.map(tool => tool.missing)).toEqual([1, 0]);
    expect(buildScopedDiscoveryToolCoverage(data.assets, tools, data.discoveryCoverageEvaluations).toolCards.reduce((sum, tool) => sum + tool.covered, 0)).toBe(model.points[0].covered);
    expect(buildGovernanceTrends([data], { ...tools, tools: [] }, {}, "2026-02-01").points[0]).toMatchObject({ discovery: null, required: 0, discoveryGaps: 0, unmapped: 1 });
  });
  it("applies header domain and system scope at each snapshot and ignores local explorer filters", () => {
    const a = server("a", { systemContext: { systemId: "sys-1", environmentType: "Production" } });
    const b = server("b", { securityDomain: "SECRET", systemContext: { systemId: "sys-1", environmentType: "Production" } });
    const c = server("c", { networkId: "net-2" });
    const rows = [snapshot("2026-01-01", [a, b, c]), snapshot("2026-02-01", [{ ...a, systemContext: undefined }, b, c])];
    expect(project(rows, { system: "sys-1", securityDomain: "PROTECTED", assetType: "storage-device", severity: "fake" }).points.map(row => row.scopedAssets)).toEqual([1, 0]);
    expect(project(rows, { network: "net-2" }).points.map(row => row.scopedAssets)).toEqual([1, 1]);
    expect(project(rows, { securityDomain: "NONE" }).points.every(row => row.scopedAssets === 0)).toBe(true);
  });
  it("tracks membership churn even when the population size is unchanged", () => {
    expect(project([snapshot("2026-01-01", [server("old")]), snapshot("2026-02-01", [server("new")])]).population).toEqual({ entered: 1, left: 1 });
  });
  it("uses percentage points and reverses the preferred direction for lifecycle issues", () => {
    expect(trendMovement(80, 75.5, true)).toEqual({ delta: 4.5, tone: "good", label: "Improving" });
    expect(trendMovement(80, 75.5, false).tone).toBe("attention");
    expect(trendMovement(10, 30, false).tone).toBe("good");
    expect(trendMovement(0, 0, false).label).toBe("Unchanged");
    expect(trendMovement(null, 100, true).delta).toBeNull();
  });
});

beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadDiscoveryToolsSettings).mockResolvedValue(settings); vi.mocked(loadSnapshotsForDateWindow).mockResolvedValue([snapshot("2026-01-01")]); });
it("loads a bounded full-profile history through the shared facade, with the first repeated date", async () => {
  vi.mocked(loadSnapshotsForDateWindow).mockResolvedValue([snapshot("2026-09-10"), snapshot("2026-09-24"), snapshot("2026-09-30"), snapshot("2026-10-02")]);
  const model = await loadGovernanceTrends({ dataDate: ["2026-10-01", "2027-01-01"], trendHistory: "week", network: "net-1" });
  expect(loadSnapshotsForDateWindow).toHaveBeenCalledWith("2026-10-01", 1, { profile: "full" });
  expect(model.cutoff).toBe("2026-10-01"); expect(model.scope.dataDate).toBe("2026-09-30");
  expect(model.points.map(point => point.date)).toEqual(["2026-09-24", "2026-09-30"]);
});
it("bounds invalid ranges and dates without reading an unbounded history", async () => {
  const model = await loadGovernanceTrends({ dataDate: "2026-02-30", trendHistory: "99999" });
  expect(loadSnapshotsForDateWindow).toHaveBeenCalledWith(new Date().toISOString().slice(0, 10), 1, { profile: "full" });
  expect(model.history).toBe("month");
});
it("does not move the requested period to the provider's older resolved snapshot", async () => {
  vi.mocked(loadSnapshotsForDateWindow).mockResolvedValue([snapshot("2026-08-01"), snapshot("2026-08-15")]);
  const model = await loadGovernanceTrends({ dataDate: "2026-10-01", trendHistory: "month" });
  expect(model).toMatchObject({ from: "2026-09-01", cutoff: "2026-10-01", points: [] });
});
