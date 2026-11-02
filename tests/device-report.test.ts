import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage, StandardFonts } from "pdf-lib";
import { deviceReportDetails, deviceFindingRows, deviceCoverageRows, DEVICE_REPORT_COLUMNS } from "@/lib/device-report";
import { drawDeviceReportTable } from "@/lib/device-report-pdf";
import type { Asset, Dataset, Finding } from "@/lib/types";

const asset: Asset = { id: "ci-1", name: "Server 1", hostname: "server-1", ipAddress: "192.0.2.1", deviceModel: "Example Model",
  lastDiscoveredDate: "2026-10-31T23:30:00Z", discoveredBy: "Discovery Tool", networkId: "net-1", type: "server", securityDomain: "Protected",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, vulnerabilities: [], operatingSystem: null, installedSoftware: [],
  systemContext: { systemId: "sys-1", environmentType: "Production" } };
const dataset: Dataset = { snapshotDate: "2026-11-01", generatedAt: "2026-11-01", assets: [asset], spiEvaluations: [],
  managedNetworks: [], ictSystems: [] };

afterEach(() => vi.restoreAllMocks());

describe("device details in PDF reports", () => {
  it("uses recorded device inventory and preserves the recorded discovery date", () => {
    expect(deviceReportDetails(asset, asset.id)).toEqual({ deviceName: "Server 1", deviceIp: "192.0.2.1", deviceModel: "Example Model",
      lastDiscoveredDate: "31-10-2026", discoveredBy: "Discovery Tool" });
  });
  it("shows missing values explicitly and falls back to hostname or the CI identifier", () => {
    expect(deviceReportDetails(undefined, "ci-missing")).toEqual({ deviceName: "ci-missing", deviceIp: "Not recorded", deviceModel: "Not recorded",
      lastDiscoveredDate: "Not recorded", discoveredBy: "Not recorded" });
    expect(deviceReportDetails({ ...asset, name: " ", deviceModel: " ", ipAddress: null }, asset.id))
      .toMatchObject({ deviceName: "server-1", deviceModel: "Not recorded", deviceIp: "Not recorded" });
  });
  it("retains finding context and remediation instructions beside the inventory fields", () => {
    const finding: Finding = { id: "finding-1", spiId: 1, status: "open", complianceStatus: "Non-compliant", severity: "High Risk", priorityRank: 1,
      timestamp: "2026-11-01", scope: { assetId: asset.id, networkId: "net-1", systemId: "sys-1", environmentType: "Production" },
      title: "Upgrade required", recommendedAction: "Upgrade the OS", evidence: {} };
    const [row] = deviceFindingRows([finding], dataset);
    expect(row.device).toEqual(deviceReportDetails(asset, asset.id));
    expect(row.details[0]).toContain("finding-1");
    for (const value of ["server-1", "net-1", "sys-1", "Production", "Upgrade required", "Upgrade the OS"]) expect(row.details[1]).toContain(value);
    const [gap] = deviceCoverageRows([{ assetId: asset.id, missingTools: ["Missing Tool"] }], dataset);
    expect(gap.device).toEqual(row.device);
    expect(gap.details[1]).toBe("Missing Tool");
  });
  it("repeats all device headers on landscape pages and keeps long text inside the page", async () => {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const device = deviceReportDetails({ ...asset, name: "device-name-".repeat(25), ipAddress: "2001:db8:1234:5678:abcd:ef01:2345:6789" }, asset.id);
    drawDeviceReportTable({ pdfDoc, fontRegular, fontBold, pageTitle: "Device list test", snapshotDate: dataset.snapshotDate,
      sectionTitle: "Endpoints", rows: Array.from({ length: 30 }, (_, index) => ({ device, details: [`Evidence ${index}: ${"unbroken".repeat(80)}`] })),
      columns: [{ label: "Evidence", weight: 2 }] });
    expect(pdfDoc.getPageCount()).toBeGreaterThan(1);
    for (const page of pdfDoc.getPages()) {
      expect(page.getWidth()).toBeGreaterThan(page.getHeight());
      const calls = draw.mock.calls.filter((_, index) => draw.mock.instances[index] === page);
      const text = calls.map(([value]) => value).join(" ");
      for (const { label } of DEVICE_REPORT_COLUMNS) expect(text).toContain(label);
      for (const [value, options] of calls) {
        expect((options?.x ?? 0) + (options?.font ?? fontRegular).widthOfTextAtSize(value, options?.size ?? 8)).toBeLessThanOrEqual(page.getWidth() - 30);
        expect(options?.y).toBeGreaterThanOrEqual(18);
      }
    }
    expect(await pdfDoc.save()).toBeTruthy();
  });
});
