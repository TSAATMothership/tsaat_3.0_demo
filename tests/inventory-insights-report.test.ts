import { beforeEach, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { NextRequest } from "next/server";
import { createEndpointInsightsPdf, createVulnerabilityInsightsPdf } from "@/lib/inventory-insights-pdf";
import { inventoryInsightsReportHref, type InventoryInsightReport } from "@/lib/inventory-insights-report-links";
import { GET as endpointReport } from "@/app/api/governance/end-point-insights/report/route";
import { GET as vulnerabilityReport } from "@/app/api/governance/security-vulnerability-insights/report/route";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { loadEndpointExplorerData, loadSecurityVulnerabilityExplorerData } from "@/lib/data-loader";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { ENDPOINT_COLUMNS, type EndpointRecord } from "@/lib/endpoint-explorer";
import { VULNERABILITY_COLUMNS, type SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
vi.mock("@/lib/discovery-overview-data", () => ({ loadDiscoveryOverview: vi.fn() }));
vi.mock("@/lib/data-loader", () => ({ loadEndpointExplorerData: vi.fn(), loadSecurityVulnerabilityExplorerData: vi.fn() }));
const snapshotDate = "2026-10-31";
const endpoint: EndpointRecord = { assetId: "ci-1", name: "CI 1", ciType: "Server", securityDomain: "UNKNOWN", ipAddress: null,
  macAddress: null, deviceModel: null, discoveredBy: "Scanner", lastDiscoveredDate: null, managedNetwork: "North" };
const observation: SecurityVulnerabilityRecord = { assetId: "ci-1", vulnerabilityId: "v1", cve: "CVE-2026-1000", cveName: null,
  softwareName: null, softwareVersion: null, referenceUrl: null, description: "Recorded observation", detectedDate: snapshotDate,
  cveCreatedDate: null, remediationGuidance: " ", severity: "High", source: "Sample source", deviceName: "CI 1", deviceModel: null,
  osName: "Linux", osVersion: null, osPatchLevel: null };
function fixture(endpoints: EndpointRecord[] = [], vulnerabilities: SecurityVulnerabilityRecord[] = []) {
  return { model: buildDiscoveryOverview({ snapshotDate, coverage: buildScopedDiscoveryToolCoverage([], defaultDiscoveryToolsSettings()),
    endpoints, vulnerabilities, software: [], shadow: [], patches: [] }),
    scope: { system: ["sys-1"], network: [], securityDomain: "SECRET", dataDate: snapshotDate },
    scopeLabels: { systems: ["Example system (sys-1)"], networks: [], domains: ["SECRET"] } };
}
async function readPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes), texts: string[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) if (object instanceof PDFRawStream) {
    let content: Buffer; try { content = inflateSync(object.contents); } catch { continue; }
    for (const match of content.toString("latin1").matchAll(/<([0-9A-F]+)> Tj/g)) texts.push(Buffer.from(match[1], "hex").toString("latin1"));
  }
  return { doc, text: texts.join(" ").replace(/\s+/g, " ") };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(loadDiscoveryOverview).mockResolvedValue(fixture());
  vi.mocked(loadEndpointExplorerData).mockResolvedValue({ snapshotDate, rows: [] });
  vi.mocked(loadSecurityVulnerabilityExplorerData).mockResolvedValue({ snapshotDate, rows: [] });
});
it.each(["endpoints", "vulnerabilities"] as const)("pins only header scope and the resolved date in %s report links", kind => {
  const url = new URL(inventoryInsightsReportHref(kind, { network: ["net-2", "net-1"], securityDomain: "SECRET,UNKNOWN", discoveryFilters: "ignored", dataDate: "latest" }, snapshotDate), "http://localhost");
  expect(Object.fromEntries(url.searchParams)).toEqual({ network: "net-1,net-2", securityDomain: "SECRET,UNKNOWN", dataDate: snapshotDate });
  expect(url.pathname).toMatch(/^\/api\/governance\/.+-insights\/report$/);
});
it("renders all endpoint fields, chapters, snapshot/scope, age exceptions and empty denominators", async () => {
  const rows = [endpoint, { ...endpoint, assetId: "ci-2", lastDiscoveredDate: "2026-11-01" }];
  const { doc, text } = await readPdf(await createEndpointInsightsPdf({ ...fixture(rows), rows }, new Date("2026-11-08T01:00:00Z")));
  expect(doc.getTitle()).toBe("End Point Insights Report"); expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
  for (const column of ENDPOINT_COLUMNS) expect(text).toContain(column.label);
  for (const term of ["01 /", "02 /", "03 /", "04 /", "05 /", snapshotDate, "Example system", "SECRET", "2026-11-08", "N/A", "after the snapshot", "UNKNOWN", "Unidentified IP nodes"]) expect(text).toContain(term);
});
it("renders every vulnerability field and every distribution group, including collapsed and long-label evidence", async () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({ ...observation, vulnerabilityId: `v${index}`, cve: `CVE-2026-${1000 + index}`,
    softwareName: index ? `Product ${index}` : "Long " + "identifier".repeat(1000) + " LAST-LABEL", detectedDate: `2026-10-${String(index + 1).padStart(2, "0")}` }));
  const { doc, text } = await readPdf(await createVulnerabilityInsightsPdf({ ...fixture([], rows), rows }));
  expect(doc.getTitle()).toBe("Security Vulnerability Insights Report"); expect(doc.getPageCount()).toBeGreaterThan(6);
  for (const column of VULNERABILITY_COLUMNS) expect(text).toContain(column.label);
  for (const row of rows) { expect(text).toContain(row.cve); expect(text).toContain(row.detectedDate); }
  for (const term of ["LAST-LABEL", "continued", "Appendix: Affected software", "not a last-scan date", "Critical / high", "Sample source", "not distinct endpoints"]) expect(text).toContain(term);
});
it.each(["endpoints", "vulnerabilities"] as const)("exports an explicit empty %s briefing", async kind => {
  const bytes = kind === "endpoints" ? await createEndpointInsightsPdf({ ...fixture(), rows: [] }) : await createVulnerabilityInsightsPdf({ ...fixture(), rows: [] });
  const { text } = await readPdf(bytes); expect(text).toContain("in this scope"); expect(text).toContain("N/A"); expect(text).not.toMatch(/NaN|Infinity/);
});
const handlers: Array<[InventoryInsightReport, typeof endpointReport]> = [["endpoints", endpointReport], ["vulnerabilities", vulnerabilityReport]];
it.each(handlers)("validates %s report input before data access", async (_, handler) => {
  for (const query of ["", "system=sys-1&dataDate=bad", "system=sys-1&dataDate=2026-02-30", "system=sys-1&dataDate=2026-10-31&dataDate=2026-10-24", "system=sys-1&securityDomain=invalid", "network=" + "x".repeat(256)]) {
    const response = await handler(new NextRequest("http://localhost/api/report?" + query)); expect(response.status).toBe(400);
  }
  expect(loadDiscoveryOverview).not.toHaveBeenCalled();
});
it.each(handlers)("exports %s via the page's pinned projections with safe download headers", async (kind, handler) => {
  const response = await handler(new NextRequest("http://localhost/api/report?system=sys-1&securityDomain=SECRET&dataDate=2026-11-01&discoveryFilters=ignored"));
  expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(response.headers.get("Content-Disposition")).toContain(snapshotDate + ".pdf");
  expect(loadDiscoveryOverview).toHaveBeenCalledWith({ system: ["sys-1"], network: [], securityDomain: "SECRET", dataDate: "2026-11-01" });
  const loader = kind === "endpoints" ? loadEndpointExplorerData : loadSecurityVulnerabilityExplorerData;
  expect(loader).toHaveBeenCalledWith(fixture().scope); expect((await readPdf(new Uint8Array(await response.arrayBuffer()))).doc.getPageCount()).toBeGreaterThanOrEqual(6);
});
it.each(handlers)("returns a sanitized retryable error if the %s report projection fails", async (kind, handler) => {
  const loader = kind === "endpoints" ? loadEndpointExplorerData : loadSecurityVulnerabilityExplorerData;
  vi.mocked(loader).mockRejectedValueOnce(Error("Private connection details"));
  const response = await handler(new NextRequest("http://localhost/api/report?system=sys-1"));
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("Private");
});
