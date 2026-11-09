import { beforeEach, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
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
import { renderInsightsDocument, type InsightsDocumentJob } from "@/lib/documents/insights";
import { useBundledInsightsAssets, insightsRenderContext } from "./insights-assets-fixture";
useBundledInsightsAssets();
vi.mock("@/lib/discovery-overview-data", () => ({ loadDiscoveryOverview: vi.fn() }));
vi.mock("@/lib/data-loader", () => ({ loadEndpointExplorerData: vi.fn(), loadSecurityVulnerabilityExplorerData: vi.fn() }));
const snapshotDate = "2026-10-31";
const endpoint: EndpointRecord = { assetId: "ci-1", name: "CI 1", ciType: "Server", securityDomain: "UNKNOWN", ipAddress: null,
  macAddress: null, deviceModel: null, discoveredBy: "Scanner", lastDiscoveredDate: null, managedNetwork: "North" };
const observation: SecurityVulnerabilityRecord = { assetId: "ci-1", vulnerabilityId: "v1", cve: "CVE-2026-1000", cveName: null,
  softwareName: null, softwareVersion: null, referenceUrl: null, description: "Recorded observation", detectedDate: snapshotDate,
  cveCreatedDate: null, remediationGuidance: " ", severity: "High", source: "Sample source", deviceName: "CI 1", deviceModel: null,
  osName: "Linux", osVersion: null, osPatchLevel: null };
function fixture(endpoints: EndpointRecord[] = [], vulnerabilities: SecurityVulnerabilityRecord[] = []): Awaited<ReturnType<typeof loadDiscoveryOverview>> {
  return { model: buildDiscoveryOverview({ snapshotDate, coverage: buildScopedDiscoveryToolCoverage([], defaultDiscoveryToolsSettings()),
    endpoints, vulnerabilities, software: [], shadow: [], patches: [] }),
    scope: { system: ["sys-1"], network: [], securityDomain: "SECRET", dataDate: snapshotDate },
    scopeLabels: { systems: ["Example system (sys-1)"], networks: [], domains: ["SECRET"] } };
}
async function readPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes), texts: string[] = [];
  const readStream = (stream: PDFRawStream) => {
    let content: Buffer; try { content = inflateSync(stream.contents); } catch { return ""; }
    return Array.from(content.toString("latin1").matchAll(/<([0-9A-F]+)> Tj/g), match => Buffer.from(match[1], "hex").toString("latin1")).join(" ");
  };
  let imageCount = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) if (object instanceof PDFRawStream) {
    texts.push(readStream(object));
    if (object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image") imageCount++;
  }
  const contents = doc.getPage(0).node.Contents();
  const firstPageText = (contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : []).map(ref => {
    const item = doc.context.lookup(ref); return item instanceof PDFRawStream ? readStream(item) : "";
  }).join(" ").replace(/\s+/g, " ");
  return { doc, text: texts.join(" ").replace(/\s+/g, " "), firstPageText, imageCount };
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
  const { doc, text, firstPageText, imageCount } = await readPdf(await createEndpointInsightsPdf({ ...fixture(rows), rows }, new Date("2026-11-08T01:00:00Z")));
  expect(doc.getTitle()).toBe("End Point Insights Report"); expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
  expect(firstPageText).toContain("Executive summary"); expect(firstPageText).toContain("Recommendations");
  expect(firstPageText).toContain("2 endpoint records"); expect(firstPageText).toContain("1 unusable dates and 1 dates after the snapshot");
  expect(firstPageText.indexOf("Executive summary")).toBeLessThan(firstPageText.indexOf("Recommendations"));
  expect(imageCount).toBeGreaterThanOrEqual(2);
  for (const narrative of ["The composition shows which CI types", "Network groupings show where", "bars describe recorded observations", "Source labels describe the collection provenance", "Use the following actions as an investigation sequence"]) expect(text).toContain(narrative);
  for (const column of ENDPOINT_COLUMNS) expect(text).toContain(column.label);
  for (const term of ["01 /", "02 /", "03 /", "04 /", "05 /", snapshotDate, "Example system", "SECRET", "2026-11-08", "N/A", "after the snapshot", "UNKNOWN", "Unidentified IP nodes"]) expect(text).toContain(term);
});
it("renders every vulnerability field and every distribution group, including collapsed and long-label evidence", async () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({ ...observation, vulnerabilityId: `v${index}`, cve: `CVE-2026-${1000 + index}`,
    softwareName: index ? `Product ${index}` : "Long " + "identifier".repeat(1000) + " LAST-LABEL", detectedDate: `2026-10-${String(index + 1).padStart(2, "0")}` }));
  const { doc, text, firstPageText, imageCount } = await readPdf(await createVulnerabilityInsightsPdf({ ...fixture([], rows), rows }));
  expect(doc.getTitle()).toBe("Security Vulnerability Insights Report"); expect(doc.getPageCount()).toBeGreaterThan(6);
  expect(firstPageText).toContain("Executive summary"); expect(firstPageText).toContain("Recommendations");
  expect(firstPageText).toContain("9 vulnerability observations"); expect(firstPageText).toContain("9 observations lack remediation text");
  expect(firstPageText).toContain("Validate the 9 critical or high observations"); expect(imageCount).toBeGreaterThanOrEqual(2);
  for (const narrative of ["These groups show which recorded software", "Operating system labels provide endpoint context", "Source labels show the provenance", "Recorded detection dates describe when", "Prioritise source validation"]) expect(text).toContain(narrative);
  for (const column of VULNERABILITY_COLUMNS) expect(text).toContain(column.label);
  for (const row of rows) { expect(text).toContain(row.cve); expect(text).toContain(row.detectedDate); }
  for (const term of ["LAST-LABEL", "continued", "Appendix: Affected software", "not a last-scan date", "Critical / high", "Sample source", "not distinct endpoints"]) expect(text).toContain(term);
});
it.each(["endpoints", "vulnerabilities"] as const)("exports an explicit empty %s briefing", async kind => {
  const bytes = kind === "endpoints" ? await createEndpointInsightsPdf({ ...fixture(), rows: [] }) : await createVulnerabilityInsightsPdf({ ...fixture(), rows: [] });
  const { text, firstPageText } = await readPdf(bytes); expect(text).toContain("in this scope"); expect(text).toContain("N/A"); expect(text).not.toMatch(/NaN|Infinity/);
  expect(firstPageText).toContain("Recommendations"); expect(firstPageText).toContain("Confirm the selected");
  expect(firstPageText).toContain(kind === "endpoints" ? "No endpoint records are available" : "No vulnerability observations are available");
});
const handlers: Array<[InventoryInsightReport, typeof endpointReport]> = [["endpoints", endpointReport], ["vulnerabilities", vulnerabilityReport]];
it.each(handlers)("validates %s report input before data access", async (_, handler) => {
  for (const query of ["", "system=sys-1&dataDate=bad", "system=sys-1&dataDate=2026-02-30", "system=sys-1&dataDate=2026-10-31&dataDate=2026-10-24", "system=sys-1&securityDomain=invalid", "network=" + "x".repeat(256)]) {
    const response = await handler(new NextRequest("http://localhost/api/report?" + query)); expect(response.status).toBe(400);
  }
  expect(loadDiscoveryOverview).not.toHaveBeenCalled();
});
it.each(handlers)("exports %s via the page's pinned projections as a browser document job", async (kind, handler) => {
  const response = await handler(new NextRequest("http://localhost/api/report?system=sys-1&securityDomain=SECRET&dataDate=2026-11-01&discoveryFilters=ignored"));
  expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toContain("application/json");
  expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(response.headers.get("Content-Disposition")).toBeNull();
  expect(loadDiscoveryOverview).toHaveBeenCalledWith({ system: ["sys-1"], network: [], securityDomain: "SECRET", dataDate: "2026-11-01" });
  const loader = kind === "endpoints" ? loadEndpointExplorerData : loadSecurityVulnerabilityExplorerData;
  expect(loader).toHaveBeenCalledWith(fixture().scope);
  const job:InsightsDocumentJob=await response.json();
  expect(job.kind).toBe(kind === "endpoints" ? "insights-endpoint" : "insights-vulnerability");
  expect(job.filename).toContain(snapshotDate+".pdf");
  expect((await readPdf(await renderInsightsDocument(job,insightsRenderContext))).doc.getPageCount()).toBeGreaterThanOrEqual(6);
});
it.each(handlers)("returns a sanitized retryable error if the %s report projection fails", async (kind, handler) => {
  const loader = kind === "endpoints" ? loadEndpointExplorerData : loadSecurityVulnerabilityExplorerData;
  vi.mocked(loader).mockRejectedValueOnce(Error("Private connection details"));
  const response = await handler(new NextRequest("http://localhost/api/report?system=sys-1"));
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("Private");
});
