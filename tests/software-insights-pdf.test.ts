import { beforeEach, describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFPage, PDFRawStream } from "pdf-lib";
import { NextRequest } from "next/server";
import { buildInstalledSoftwareInsights } from "@/lib/installed-software-insights";
import { createSoftwareInsightsPdf } from "@/lib/software-insights-pdf";
import { loadSoftwareInsightsReport, type SoftwareInsightsReportData } from "@/lib/software-insights-report-data";
import type { InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import { GET } from "@/app/api/discovery/installed-software-insights/report/route";

const readers = vi.hoisted(() => ({ loadDatasetForDate: vi.fn(), loadInstalledSoftwareExplorerData: vi.fn() }));
vi.mock("@/lib/data-loader", () => readers);
const date = "2026-10-31", generated = new Date("2026-11-07T10:11:12.000Z"), captured = "2026-10-31T09:10:11.000Z";
const row = (patch: Partial<InstalledSoftwareRecord> = {}): InstalledSoftwareRecord => ({ assetId: "a1", softwareOrdinal: 1,
  softwareName: "Alpha", softwareVersion: "1", filePath: null, lastDiscoveredDate: date, discoveredBy: "Agent",
  deviceName: "Endpoint", deviceModel: null, osName: "Windows", osVersion: null, osPatchLevel: null, ...patch });
const rows = [row(), row({ softwareOrdinal: 2, softwareVersion: "2", lastDiscoveredDate: "2026-09-01" }),
  row({ assetId: "a2", softwareName: "Beta", softwareVersion: null, discoveredBy: null, lastDiscoveredDate: "bad" }),
  row({ assetId: "a3", softwareName: undefined, lastDiscoveredDate: "2026-11-01" })];
function fixture(): SoftwareInsightsReportData {
  return { model: buildInstalledSoftwareInsights(rows, date), snapshotGeneratedAt: captured,
    scopeLabels: { networks: ["Example Network (net-1)"], systems: [], domains: ["SECRET"] } };
}
async function readPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes), texts: string[] = [];
  for (const [, item] of doc.context.enumerateIndirectObjects()) if (item instanceof PDFRawStream) {
    let stream: Buffer; try { stream = inflateSync(item.contents); } catch { continue; }
    for (const match of stream.toString("latin1").matchAll(/<([0-9A-F]+)> Tj/g)) texts.push(Buffer.from(match[1], "hex").toString("latin1"));
  }
  return { doc, text: texts.join("\n") };
}
beforeEach(() => {
  vi.clearAllMocks();
  readers.loadInstalledSoftwareExplorerData.mockResolvedValue({ snapshotDate: date, rows });
  readers.loadDatasetForDate.mockResolvedValue({ snapshotDate: date, generatedAt: captured,
    managedNetworks: [{ id: "net-1", name: "Example Network" }], ictSystems: [{ id: "sys-1", name: "Example System" }] });
});

describe("Software Insights PDF", () => {
  it("renders the briefing's counts, four chapters, scope and distinct timestamps on A4", async () => {
    const data = fixture(), original = structuredClone(data);
    const { doc, text } = await readPdf(await createSoftwareInsightsPdf(data, generated));
    expect(doc.getTitle()).toBe("Software Insights"); expect(doc.getCreationDate()).toEqual(generated);
    expect(doc.getPageCount()).toBe(3);
    for (const label of ["01 / Understand the footprint", "02 / See where installations concentrate", "03 / Make version variation visible", "04 / Strengthen the evidence before acting",
      "Identify the version", "Refresh older observations", "Restore discovery dates", "Check future-dated evidence", "Record the source", "Locate the installation",
      "4", "75%", "2 versions / 2 installations / 1 endpoints", "1 installations have no product name", "Example Network (net-1)", "Security domains: SECRET",
      "Snapshot timestamp: 2026-10-31 09:10:11.000 UTC", "PDF generated: 2026-11-07 10:11:12.000 UTC", "Evidence priorities overlap"])
      expect(text).toContain(label);
    expect(text.match(/Snapshot timestamp:/g)?.length).toBe(doc.getPageCount() + 1);
    for (const page of doc.getPages()) expect(page.getSize()).toEqual({ width: 595.28, height: 841.89 });
    expect(data).toEqual(original);
  });
  it("retains empty denominators and does not invent capture time", async () => {
    const data = fixture(); data.model = buildInstalledSoftwareInsights([], date); data.snapshotGeneratedAt = date; data.scopeLabels.domains = [];
    const { text } = await readPdf(await createSoftwareInsightsPdf(data, generated));
    for (const label of ["No software evidence", "N/A", "No named products with multiple", "Snapshot timestamp: Not recorded", "Security domains: None selected"])
      expect(text).toContain(label);
    expect(text).not.toContain("100%");
  });
  it("paginates long scope and product labels without truncation or text outside margins", async () => {
    const data = fixture(); data.scopeLabels.networks = ["long scope ".repeat(300) + "scope-end"];
    data.model.products[0].value = "Long product ".repeat(350) + "product-end";
    data.model.versionSpread[0].value = "X".repeat(1500) + " variant-end";
    const spy = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const { doc, text } = await readPdf(await createSoftwareInsightsPdf(data, generated));
      expect(doc.getPageCount()).toBeGreaterThan(3);
      for (const label of ["scope-end", "product-end", "variant-end", "continued"]) expect(text).toContain(label);
      for (const [label, options] of spy.mock.calls) {
        expect(options?.y, label).toBeGreaterThanOrEqual(20); expect(options?.y, label).toBeLessThanOrEqual(818);
        expect(options?.x, label).toBeGreaterThanOrEqual(35);
        expect((options?.x ?? 0) + (options?.font?.widthOfTextAtSize(label, options.size ?? 10) ?? 0), label).toBeLessThanOrEqual(560);
      }
    } finally { spy.mockRestore(); }
  });
  it("rejects an invalid export timestamp", async () => {
    await expect(createSoftwareInsightsPdf(fixture(), new Date("invalid"))).rejects.toThrow("generation timestamp");
  });
});

describe("Software Insights report data and endpoint", () => {
  it("uses only shared scope and pins metadata to the software projection's resolved date", async () => {
    const result = await loadSoftwareInsightsReport({ network: "net-1", system: "sys-1", securityDomain: "SECRET", dataDate: "2026-11-01", environment: "Production" });
    expect(readers.loadInstalledSoftwareExplorerData).toHaveBeenCalledExactlyOnceWith({ network: ["net-1"], system: ["sys-1"], securityDomain: "SECRET", dataDate: "2026-11-01" });
    expect(readers.loadDatasetForDate).toHaveBeenCalledExactlyOnceWith(date, { profile: "summary" });
    expect(result.model).toEqual(buildInstalledSoftwareInsights(rows, date));
    expect(result.scopeLabels).toEqual({ networks: ["Example Network (net-1)"], systems: ["Example System (sys-1)"], domains: ["SECRET"] });
  });
  it("rejects mismatched metadata rather than mixing snapshots", async () => {
    readers.loadDatasetForDate.mockResolvedValueOnce({ snapshotDate: "2026-11-07" });
    await expect(loadSoftwareInsightsReport({ network: "net-1" })).rejects.toThrow("snapshot mismatch");
  });
  it.each(["", "network=net-1&dataDate=bad", "network=net-1&dataDate=2026-02-30", "network=net-1&dataDate=2026-10-31&dataDate=2026-11-07", "system=sys-1&securityDomain=INVALID", "network=" + "x".repeat(256)])("rejects invalid scope/date: %s", async query => {
    expect((await GET(new NextRequest("http://localhost/api/discovery/installed-software-insights/report?" + query))).status).toBe(400);
    expect(readers.loadInstalledSoftwareExplorerData).not.toHaveBeenCalled();
  });
  it("returns a non-cached PDF for resolved scope/date, dropping table filters", async () => {
    const response = await GET(new NextRequest("http://localhost/api/discovery/installed-software-insights/report?system=sys-1&securityDomain=NONE&dataDate=2026-11-01&environment=Production&softwareFilters=local"));
    expect(readers.loadInstalledSoftwareExplorerData).toHaveBeenCalledExactlyOnceWith({ network: [], system: ["sys-1"], securityDomain: "NONE", dataDate: "2026-11-01" });
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(`software-insights-${date}.pdf`);
    expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await readPdf(new Uint8Array(await response.arrayBuffer()))).text).toContain("Security domains: None selected");
  });
  it("reports provider failure without private details or a misleading empty report", async () => {
    readers.loadInstalledSoftwareExplorerData.mockRejectedValueOnce(new Error("Private SQL credential details"));
    const response = await GET(new NextRequest("http://localhost/api/discovery/installed-software-insights/report?network=net-1"));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("Private");
  });
});
