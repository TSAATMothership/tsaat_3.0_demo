import {
  ICT_SYSTEM_DEPENDENCIES_EXCEL_MIME_TYPE,
  ICT_SYSTEM_DEPENDENCIES_EXPORT_HEADERS,
  buildIctSystemDependenciesExportFileName,
  buildIctSystemDependenciesWorkbookXml
} from "@/lib/ict-system-dependencies-export";
import { describe, expect, it } from "vitest";

describe("ICT System Dependencies Excel export", () => {
  it("creates an Excel-readable six-column workbook in diagram order", () => {
    const workbook = buildIctSystemDependenciesWorkbookXml([
      {
        systemName: "Mission & Command <Primary>",
        environmentType: "Production",
        serverName: "srv-command-01",
        relatedAssetName: "db-command-01",
        relatedAssetEnvironmentType: "UAT",
        relatedSystemName: 'Data "Hub"'
      }
    ]);

    expect(ICT_SYSTEM_DEPENDENCIES_EXCEL_MIME_TYPE).toBe("application/vnd.ms-excel;charset=utf-8;");
    expect(ICT_SYSTEM_DEPENDENCIES_EXPORT_HEADERS).toEqual([
      "ICT System",
      "Environment",
      "Server",
      "Dependent Server",
      "Dependent Environment",
      "Dependent ICT System"
    ]);
    expect(workbook).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect(workbook).toContain('<Worksheet ss:Name="ICT System Dependencies">');
    expect(workbook).toContain('ss:ExpandedColumnCount="6"');
    expect(workbook).toContain('ss:ExpandedRowCount="2"');
    expect(workbook).toContain("Mission &amp; Command &lt;Primary&gt;");
    expect(workbook).toContain("Data &quot;Hub&quot;");

    const headerPositions = ICT_SYSTEM_DEPENDENCIES_EXPORT_HEADERS.map((header) => workbook.indexOf(`>${header}<`));
    expect(headerPositions.every((position) => position >= 0)).toBe(true);
    expect(headerPositions).toEqual([...headerPositions].sort((left, right) => left - right));
  });

  it("uses diagram fallbacks, display-name fallbacks, and removes invalid XML controls", () => {
    const workbook = buildIctSystemDependenciesWorkbookXml([
      {
        systemName: "System\u0000 Alpha",
        environmentType: " ",
        serverName: "",
        assetName: "source-server",
        relatedAssetName: "",
        relatedAssetHostname: "dependent-server",
        relatedAssetEnvironmentType: null,
        relatedSystemName: null
      }
    ]);

    expect(workbook).not.toContain("\u0000");
    expect(workbook).toContain("System Alpha");
    expect(workbook).toContain(">source-server<");
    expect(workbook).toContain(">dependent-server<");
    expect(workbook.match(/>Unassigned</g)).toHaveLength(2);
    expect(workbook).toContain(">Not Modelled<");
  });

  it("builds a sanitized snapshot-aware .xls filename", () => {
    expect(buildIctSystemDependenciesExportFileName("2026-07-17")).toBe(
      "ict-system-dependencies-2026-07-17.xls"
    );
    expect(buildIctSystemDependenciesExportFileName(" 2026/07/17 12:30 ")).toBe(
      "ict-system-dependencies-2026-07-17-12-30.xls"
    );
    expect(buildIctSystemDependenciesExportFileName(" ")).toBe("ict-system-dependencies-current.xls");
  });
});
