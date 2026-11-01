import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "components", "network-compliance-overview.tsx"), "utf8");

describe("Compliance overview details panel layout", () => {
  it("keeps the details table status column limited to workflow pills", () => {
    expect(source).toContain('{entry.asOfStatus === "open" ? "Open" : "Closed"}');
    expect(source).not.toContain("Finding {entry.finding.complianceStatus}");
    expect(source).not.toContain("Eval {entry.finding.evaluationStatus}");
  });

  it("uses the explorer table with readable timestamps and workflow styling", () => {
    expect(source).toContain('<FindingsDataTable title="Findings and evidence"');
    expect(source).toContain('label: "Severity"');
    expect(source).toContain('label: "Timestamp"');
    expect(source).toContain('className="whitespace-nowrap px-3 py-2 text-slate-200"');
    expect(source).toContain("findingSeverityBadgeClass(");
    expect(source).toContain("entry.finding.severity");
    expect(source).not.toContain('<th className="px-3 py-2">Scope</th>');
    expect(source).not.toContain("{entry.finding.scopeLabel}</td>");
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
    expect(source).toContain("const rows = matchingRows.map((entry) => [");
    expect(source).toContain("disabled={!matching.length}");
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
  });
});
