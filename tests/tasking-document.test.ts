import { beforeEach, describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tasking-report/route";
import { renderTaskingPdfDocument, type TaskingPdfDocumentJob } from "@/lib/documents/tasking-pdf";
import * as loader from "@/lib/data-loader";
import { buildAnalytics } from "@/lib/analytics";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { normalizeKpiDefinitions } from "@/lib/kpi-definitions";
import type { AnalyticsResult, Asset, Dataset, ICTSystem, ManagedNetwork } from "@/lib/types";
import { testMeasuresSettings, testSeverityDefinitions, testSpiDefinitions } from "./spi-definition-fixtures";
import rawKpiDefinitions from "../Database Schema/data/kpi-definitions.json";

vi.mock("@/lib/data-loader", () => ({
  loadDatasetForDate: vi.fn(), loadDiscoveryToolsSettings: vi.fn(), loadKpiDefinitions: vi.fn(), loadMeasuresSettings: vi.fn(),
  loadSnapshotKpiEvaluationsForAnalyticsScope: vi.fn(), loadSeverityDefinitions: vi.fn(), loadSpiDefinitions: vi.fn(),
  loadSnapshotsForDateWindow: vi.fn()
}));
vi.mock("@/lib/analytics", () => ({ buildAnalytics: vi.fn() }));

const snapshotDate = "2026-04-30";
const dates = ["2026-04-09", "2026-04-16", "2026-04-23", snapshotDate];
const definitions = [
  ...normalizeKpiDefinitions(rawKpiDefinitions),
  ...normalizeKpiDefinitions(["critical-system-threshold", "critical-exposure-assets", "unmodelled-diis-systems"].map((handlerKey, index) => ({
    id: `KPI-${index + 3}`, displayOrder: index + 3, name: `Configured legacy ${index + 3}`, description: "Configured description",
    successMeasure: "Configured target", calculationKey: `legacy-${index + 3}`, reportAvailable: true,
    reportDetailDefinition: { reportDetailKey: handlerKey, handlerKey, displayOrder: index + 3, name: handlerKey, description: "Legacy details", enabled: true },
    taskingTeams: [{ displayOrder: 1, team: "Configured Operations", supportQueue: "OPS-Q", contactEmail: "ops@example.test" }],
    taskingActions: [{ displayOrder: 1, conditionKey: "always", actionText: "Configured remediation action" }],
    taskingConditions: [{ conditionKey: "non_compliant", templateText: "Configured observed condition" }]
  })))
];

function fixture(date = snapshotDate): Dataset {
  const assets: Asset[] = ["compliant", "noncompliant", "unknown", "outside"].map((id, index) => ({
    id, name: id === "outside" ? "OUTSIDE-SCOPE-SENTINEL" : `Endpoint ${id}`, hostname: id, type: "server",
    networkId: index === 3 ? "net-2" : "net-1", securityDomain: "PROTECTED", ipAddress: `192.0.2.${index + 1}`,
    deviceModel: "Scoped device model", discoveredBy: "Configured discovery", lastDiscoveredDate: `${date}T12:00:00Z`,
    vulnerabilities: [], lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, operatingSystem: null, installedSoftware: [],
    systemContext: { systemId: index === 3 ? "sys-2" : "sys-1", environmentType: "Production" }
  }));
  const systems: ICTSystem[] = [1, 2].map(index => ({ id: `sys-${index}`, name: `System ${index}`, networkId: `net-${index}`,
    adfPlatform: false, enterprisePlatform: false, modellingStatus: false, diisDefined: true, criticality: "Critical",
    securityDomain: "PROTECTED", missionCapabilities: [], businessServices: [],
    environments: [{ id: `env-${index}`, name: "Production", type: "Production", assetIds: assets.filter(a => a.networkId === `net-${index}`).map(a => a.id) }]
  }));
  const networks: ManagedNetwork[] = [1, 2].map(index => ({ id: `net-${index}`, name: `Network ${index}`, securityDomain: "PROTECTED",
    adfPlatform: false, enterprisePlatform: false, modellingStatus: true, criticality: "Critical", discoveryStatus: "Discovery Enabled",
    assetIds: assets.filter(a => a.networkId === `net-${index}`).map(a => a.id), ictSystemIds: [`sys-${index}`] }));
  return { generatedAt: `${date}T12:00:00Z`, snapshotDate: date, assets, ictSystems: systems, managedNetworks: networks, spiEvaluations: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loader.loadDatasetForDate).mockResolvedValue(fixture());
  vi.mocked(loader.loadDiscoveryToolsSettings).mockResolvedValue(defaultDiscoveryToolsSettings());
  vi.mocked(loader.loadKpiDefinitions).mockResolvedValue(definitions);
  vi.mocked(loader.loadSpiDefinitions).mockResolvedValue(testSpiDefinitions);
  vi.mocked(loader.loadSeverityDefinitions).mockResolvedValue(testSeverityDefinitions);
  vi.mocked(loader.loadMeasuresSettings).mockResolvedValue(testMeasuresSettings);
  vi.mocked(loader.loadSnapshotsForDateWindow).mockResolvedValue(dates.map(date => fixture(date)));
  vi.mocked(loader.loadSnapshotKpiEvaluationsForAnalyticsScope).mockImplementation(async ({ kpiDefinitions = definitions }) => kpiDefinitions.map(definition => ({
    kpiId: definition.id, displayOrder: definition.displayOrder, calculationKey: definition.calculationKey,
    score: "33.3%", scorePercent: 33.3, compliantCount: 1, applicableCount: 3, nonCompliantCount: 1, unknownCount: 1, highPriorityCount: 0
  })));
  vi.mocked(buildAnalytics).mockImplementation((dataset, _systems, filters) => {
    const assets = dataset.assets.filter(a => !filters.managedNetwork || a.networkId === filters.managedNetwork);
    const analytics: AnalyticsResult = { evaluations: assets.map(asset => ({
      assetId: asset.id, assetType: asset.type, networkId: asset.networkId, systemId: asset.systemContext?.systemId ?? null,
      environmentType: "Production", securityDomain: asset.securityDomain, systemCriticality: "Critical", discoveryCoverageCompliant: true,
      evaluations: [{ spiId: 10, status: asset.id === "compliant" ? "Compliant" : asset.id === "unknown" ? "Unknown" : "Non-compliant",
        evidence: {}, reasons: [`Evidence for ${asset.id}`] }]
    })), findings: assets.filter(a => a.id === "noncompliant").map(asset => ({
      id: "finding-1", spiId: 10, priorityRank: 1, severity: "Critical Exposure", status: "open", complianceStatus: "Non-compliant",
      timestamp: dataset.generatedAt, scope: { networkId: asset.networkId, systemId: "sys-1", environmentType: "Production", assetId: asset.id },
      title: "Exposure", evidence: {}, recommendedAction: "Resolve exposure"
    })), networkRollups: [], systemRollups: [], environmentRollups: [], overallCompliancePercent: 33.3,
      statusTotals: { compliant: 1, nonCompliant: 1, unknown: 1, impactedAssets: 3 }, productionCriticalExposureAssetIds: ["noncompliant"] };
    return analytics;
  });
});

const source = (kind: string, id: string, extra = "") => `http://localhost/api/tasking-report?kind=${kind}&id=${id}&network=net-1&securityDomain=PROTECTED&dataDate=${snapshotDate}${extra}`;
async function jobFor(kind: string, id: string, extra = ""): Promise<TaskingPdfDocumentJob> {
  const create = vi.spyOn(PDFDocument, "create");
  const response = await GET(new NextRequest(source(kind, id, extra)));
  expect(create).not.toHaveBeenCalled(); create.mockRestore();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-disposition")).toBeNull();
  const job: TaskingPdfDocumentJob = await response.json();
  expect(job).toMatchObject({ version: 1, data: { snapshotDate } });
  expect(job.filename).toMatch(/\.pdf$/);
  expect(job.data.filterText).toContain("Network=net-1");
  expect(job.data.filterText).toContain("Security Domain=PROTECTED");
  expect(JSON.stringify(job)).not.toContain("OUTSIDE-SCOPE-SENTINEL");
  expect(job.data).not.toHaveProperty("dataset");
  expect(job.data).not.toHaveProperty("analytics");
  return job;
}
async function rendered(job: TaskingPdfDocumentJob) {
  const onProgress = vi.fn();
  const bytes = await renderTaskingPdfDocument(job, { assetBaseUrl: "https://tsaat.test/", onProgress });
  expect(onProgress).toHaveBeenLastCalledWith("Tasking report ready", 3, 3);
  const pdf = await PDFDocument.load(bytes), text: string[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    for (const stream of streams) if (stream instanceof PDFRawStream) {
      for (const match of inflateSync(stream.contents).toString("latin1").matchAll(/<([0-9A-F]+)> Tj/g)) text.push(Buffer.from(match[1], "hex").toString("latin1"));
    }
  }
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  const result = text.join("\n");
  expect(result).toContain(snapshotDate);
  return result;
}

describe("tasking document API and browser rendering", () => {
  it.each([
    ["spi", "10", "pdf-tasking-spi", "Supporting Findings Annex B"],
    ["spi-all", "all", "pdf-tasking-spi-all", "Overview"],
    ["spi-trend", "10", "pdf-tasking-spi-trend", "12 months Trend Chart"],
    ["kpi-trend", "KPI-1", "pdf-tasking-kpi-trend", "12 months Trend Chart"],
    ["kpi", "KPI-1", "pdf-tasking-kpi", "ATO findings summary"],
    ["kpi", "KPI-2", "pdf-tasking-kpi", "DIIS registration findings summary"],
    ["kpi", "KPI-3", "pdf-tasking-kpi-legacy", "Critical ICT Systems at or below 95% compliance"],
    ["kpi", "KPI-4", "pdf-tasking-kpi-legacy", "Assets with ICT Critical Exposure findings"],
    ["kpi", "KPI-5", "pdf-tasking-kpi-legacy", "ICT Systems not modelled"]
  ])("preserves %s %s report content in %s", async (kind, id, documentKind, section) => {
    const job = await jobFor(kind, id);
    expect(job.kind).toBe(documentKind);
    const text = await rendered(job);
    expect(text).toContain(section);
    expect(text).toContain("Network=net-1");
    if (job.kind === "pdf-tasking-kpi-legacy") {
      for (const configured of ["Configured Operations", "Configured remediation action", "Configured observed condition"]) expect(text).toContain(configured);
    }
    if (job.kind === "pdf-tasking-kpi") expect(job.data.kpiDefinitions.map(definition => definition.id)).toEqual([id]);
  });
  it.each([["spi", "10"], ["kpi", "KPI-1"], ["kpi", "KPI-2"]])("preserves non-compliance-only totals and annexes for %s %s", async (kind, id) => {
    const job = await jobFor(kind, id, "&results=non-compliant");
    if (job.kind !== "pdf-tasking-spi" && job.kind !== "pdf-tasking-kpi") throw new Error("Unexpected kind");
    expect(job.data.model).toMatchObject({ nonCompliantOnly: true, total: 1, compliant: 0, unknown: 0, nonCompliant: 1 });
    expect(job.filename).toContain("Non-Compliance Only");
    const text = await rendered(job);
    expect(text).toContain("Non-Compliance Only");
    if (job.kind === "pdf-tasking-spi") {
      expect(job.data.model.annexA.map(row => row.assetId)).toEqual(["noncompliant"]);
      expect(job.data.model.annexB).toEqual([]);
      expect(text).not.toContain("Supporting Findings Annex B");
    }
  });
  it.each([["spi-trend", "10"], ["kpi-trend", "KPI-1"]])("pins the selected historical cutoff and scope for %s", async (kind, id) => {
    const job = await jobFor(kind, id);
    expect(loader.loadDatasetForDate).toHaveBeenCalledWith(snapshotDate);
    expect(loader.loadSnapshotsForDateWindow).toHaveBeenCalledWith(snapshotDate, 12);
    if (job.kind !== "pdf-tasking-spi-trend" && job.kind !== "pdf-tasking-kpi-trend") throw new Error("Unexpected kind");
    expect(job.data.model.trendPoints.map(point => point.snapshotDate)).toEqual(dates);
    for (const call of vi.mocked(buildAnalytics).mock.calls) expect(call[2]).toMatchObject({ managedNetwork: "net-1", securityDomain: "PROTECTED" });
    for (const [call] of vi.mocked(loader.loadSnapshotKpiEvaluationsForAnalyticsScope).mock.calls) {
      expect(call.systems.map(system => system.id)).toEqual(["sys-1"]);
      expect(call.networks.map(network => network.id)).toEqual(["net-1"]);
    }
  });
  it("sends only displayed legacy evidence fields and preserves device details", async () => {
    const job = await jobFor("kpi", "KPI-4");
    if (job.kind !== "pdf-tasking-kpi-legacy") throw new Error("Unexpected kind");
    expect(job.data.exposureRows).toEqual([{ assetId: "noncompliant", systemId: "sys-1", systemName: "System 1", findingsCount: 1,
      device: { deviceName: "Endpoint noncompliant", deviceIp: "192.0.2.2", deviceModel: "Scoped device model", lastDiscoveredDate: "30-04-2026", discoveredBy: "Configured discovery" } }]);
    expect(job.data.exposureTotal).toBe(1);
    expect(job.data.criticalSystems).toEqual([]);
    expect(job.data.unmodelledRows).toEqual([]);
    for (const value of ["192.0.2.2", "Scoped device model", "Configured discovery"]) expect(await rendered(job)).toContain(value);
  });
  it.each(["", "?kind=bad&id=10", "?kind=spi&id=10&results=invalid", "?kind=spi-trend&id=10&results=non-compliant"])("retains request validation for %s", async query => {
    expect((await GET(new NextRequest(`http://localhost/api/tasking-report${query}`))).status).toBe(400);
    expect(loader.loadDatasetForDate).not.toHaveBeenCalled();
  });
  it.each([["spi", "999"], ["spi-trend", "999"], ["kpi", "KPI-999"], ["kpi-trend", "KPI-999"]])("keeps missing indicator responses for %s %s", async (kind, id) => {
    expect((await GET(new NextRequest(source(kind, id)))).status).toBe(404);
  });
  it("retains the bookmarked report path by opening browser generation", async () => {
    const response = await GET(new NextRequest(source("spi", "10"), { headers: { Accept: "text/html" } }));
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/documents/generate");
    expect(location.searchParams.get("source")).toBe(new URL(source("spi", "10")).pathname + new URL(source("spi", "10")).search);
  });
});
