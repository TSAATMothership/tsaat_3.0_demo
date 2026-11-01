import { describe, expect, it } from "vitest";
import { buildReportCatalogue, REPORT_COLUMNS } from "@/lib/report-catalogue";
import { prepareExplorerRows, queryExplorerRows } from "@/lib/explorer-table";
import { testSpiDefinitions } from "./spi-definition-fixtures";

describe("report catalogue", () => {
  it("preserves multi-select scope, all report filters and the loaded snapshot in every PDF link", () => {
    const rows = buildReportCatalogue({ managedNetwork: "net-1,net-2", ictSystem: "sys-3", systemCriticality: "Critical",
      securityDomain: "Protected", environment: "Production", assetType: "server", severity: "High Risk",
      missionCapability: "mission & support", businessService: "service/1" }, "2026-03-23", testSpiDefinitions);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map(row => row.id)).size).toBe(6);
    for (const row of rows) {
      const url = new URL(row.href, "http://localhost");
      expect(Object.fromEntries(url.searchParams)).toMatchObject({ network: "net-1,net-2", system: "sys-3", criticality: "Critical",
        securityDomain: "Protected", environment: "Production", assetType: "server", severity: "High Risk",
        mission: "mission & support", service: "service/1", dataDate: "2026-03-23" });
      if (row.id === "posture-summary") expect(url.searchParams.get("format")).toBe("pdf");
    }
  });
  it("keeps audience search and category selection local to the catalogue", () => {
    const rows = buildReportCatalogue({ ictSystem: "sys-3" }, "2026-03-23", testSpiDefinitions);
    const result = queryExplorerRows(prepareExplorerRows(rows, REPORT_COLUMNS), REPORT_COLUMNS,
      { search: "system owners", columns: { category: ["Assurance"] } });
    expect(result.filtered.map(row => row.id)).toEqual(["systems-out-of-support-os", "systems-modelling-status"]);
    for (const row of result.filtered) {
      expect(new URL(row.href, "http://localhost").searchParams.has("category")).toBe(false);
      expect(new URL(row.href, "http://localhost").searchParams.get("system")).toBe("sys-3");
    }
  });
  it("uses configured SPI bindings in the operating system report description", () => {
    const definition = { ...testSpiDefinitions[0], spiId: 42 };
    const rows = buildReportCatalogue({}, "2026-03-23", [definition]);
    expect(rows.find(row => row.id === "systems-out-of-support-os")?.description).toContain("SPI-42");
  });
});
