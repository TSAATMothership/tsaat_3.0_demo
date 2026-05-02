import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "components", "network-compliance-overview.tsx"), "utf8");
const networkDetailSource = readFileSync(path.join(process.cwd(), "app", "networks", "[networkId]", "page.tsx"), "utf8");
const systemDetailSource = readFileSync(path.join(process.cwd(), "app", "systems", "[systemId]", "page.tsx"), "utf8");

describe("Compliance overview details panel layout", () => {
  it("keeps the details table status column limited to workflow pills", () => {
    expect(source).toContain('{entry.asOfStatus === "open" ? "Open" : "Closed"}');
    expect(source).not.toContain("Finding {entry.finding.complianceStatus}");
    expect(source).not.toContain("Eval {entry.finding.evaluationStatus}");
  });

  it("keeps details table timestamps on one line with a fixed readable width", () => {
    expect(source).toContain('className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap px-3 py-2"');
    expect(source).toContain('className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap px-3 py-2 text-slate-200"');
  });

  it("scopes affected CIs to the selected compliance detail row", () => {
    expect(source).toContain("const selectedFinding = selectedFindingForAssets.finding;");
    expect(source).toContain("return [selectedFinding]");
    expect(source).not.toContain("entry.finding.spiId === selectedFindingForAssets.finding.spiId");
    expect(source).not.toContain("entry.finding.title === selectedFindingForAssets.finding.title");
  });

  it("simplifies affected CIs and exposes all-CVE filtering", () => {
    expect(source).not.toContain("Total Critical Exposure Findings");
    expect(source).not.toContain("Total High Risk Findings");
    expect(source).not.toContain("Total High Risk CVE Vulnerabilities");
    expect(source).not.toContain("<th className=\"px-3 py-2\">Total Findings</th>");
    expect(source).toContain("CVE Vulnerabilities");
    expect(source).toContain("CVE Criticality");
    expect(source).toContain("CVE_CRITICALITY_FILTERS");
  });

  it("exports the filtered CVE drillthrough list", () => {
    expect(source).toContain("const rows = filteredAssetCves.map((entry) => [");
    expect(source).toContain("disabled={!filteredAssetCves.length}");
    expect(source).not.toContain("const rows = selectedAssetCves.map");
    expect(source).not.toContain("downloadHighRiskCvesCsv");
  });

  it("shows the full asset-type taxonomy in the compliance overview summary", () => {
    expect(source).toContain("storageDeviceCount: number;");
    expect(source).toContain("printerDeviceCount: number;");
    expect(source).toContain("otherCount: number;");
    expect(source).toContain('label: "Storage Devices"');
    expect(source).toContain('label: "Printer Devices"');
    expect(source).toContain('label: "Other Devices"');
    expect(source).toContain("assetTypeTiles.map");
    for (const pageSource of [networkDetailSource, systemDetailSource]) {
      expect(pageSource).toContain('storageDeviceCount: filteredAssets.filter((asset) => asset.type === "storage-device").length');
      expect(pageSource).toContain('printerDeviceCount: filteredAssets.filter((asset) => asset.type === "printer-device").length');
      expect(pageSource).toContain('otherCount: filteredAssets.filter((asset) => asset.type === "other").length');
    }
  });
});
