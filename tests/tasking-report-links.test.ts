import { describe, expect, it } from "vitest";
import { isDataDateScopedPath } from "@/lib/data-date";
import {
  TASKING_REPORT_CONTENT_TYPE,
  buildTaskingReportHref,
  nonCompliantTaskingReportHref,
  taskingReportDataDateFromSearchParams,
  taskingReportFilename
} from "@/lib/tasking-report-links";

describe("tasking report links", () => {
  it("adds the non-compliance option while retaining indicator, snapshot and multi-scope selections", () => {
    for (const [kind, id] of [["kpi", "KPI-1"], ["kpi", "KPI-2"], ["spi", "10"]] as const) {
      const href = buildTaskingReportHref({ kind, id, dataDate: "2026-04-23", filters: { managedNetwork: "net-1,net-2", ictSystem: "sys-1,sys-2" } });
      const url = new URL(nonCompliantTaskingReportHref(href), "http://localhost");
      expect(url.searchParams.get("results")).toBe("non-compliant");
      url.searchParams.delete("results");
      expect(url.pathname + url.search).toBe(href);
      const date = new Date("2026-10-31T15:00:00Z");
      const filename = taskingReportFilename(kind, id, date, "Example Indicator", true);
      expect(filename).toContain(" - Non-Compliance Only 01-11-2026.pdf");
      expect(filename).not.toBe(taskingReportFilename(kind, id, date, "Example Indicator"));
    }
  });

  it("preserves filters and dataDate in SPI report links", () => {
    const href = buildTaskingReportHref({
      kind: "spi",
      id: "10",
      dataDate: "2026-04-30",
      filters: {
        managedNetwork: "net-1",
        ictSystem: "sys-1",
        assetType: "server",
        severity: "High Risk"
      }
    });
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/api/tasking-report");
    expect(url.searchParams.get("kind")).toBe("spi");
    expect(url.searchParams.get("id")).toBe("10");
    expect(url.searchParams.get("dataDate")).toBe("2026-04-30");
    expect(url.searchParams.get("network")).toBe("net-1");
    expect(url.searchParams.get("system")).toBe("sys-1");
    expect(url.searchParams.get("assetType")).toBe("server");
    expect(url.searchParams.get("severity")).toBe("High Risk");
  });

  it("normalizes tasking report dataDate and report response metadata", () => {
    expect(taskingReportDataDateFromSearchParams(new URLSearchParams("dataDate=2026-04-30"))).toBe("2026-04-30");
    expect(taskingReportDataDateFromSearchParams(new URLSearchParams("dataDate=30-04-2026"))).toBeUndefined();
    const generatedAt = new Date("2026-10-31T14:30:00Z");
    expect(taskingReportFilename("spi", "10", generatedAt, "Asset Lifecycle Currency")).toBe("SPI-10 - Asset Lifecycle Currency Report 01-11-2026.pdf");
    expect(taskingReportFilename("spi-trend", "10", generatedAt, "Asset Lifecycle Currency")).toBe("SPI-10 - Asset Lifecycle Currency 01-11-2026.pdf");
    expect(taskingReportFilename("spi-all", "all", generatedAt)).toBe("All SPI Report 01-11-2026.pdf");
    expect(TASKING_REPORT_CONTENT_TYPE).toBe("application/pdf");
  });

  it("names the KPI-1 current PDF using the Sydney generation date", () => {
    expect(taskingReportFilename("kpi", "KPI-1", new Date("2026-10-31T14:30:00Z")))
      .toBe("KPI-1 ICT Systems without ATO Report 01-11-2026.pdf");
    expect(taskingReportFilename("kpi", "KPI-1", new Date("2026-11-01T13:30:00Z")))
      .toBe("KPI-1 ICT Systems without ATO Report 02-11-2026.pdf");
  });

  it("names the KPI-2 current PDF using the Sydney generation date", () => {
    expect(taskingReportFilename("kpi", "KPI-2", new Date("2026-10-31T14:30:00Z")))
      .toBe("KPI-2 ICT Systems without DIIS Registration Report 01-11-2026.pdf");
    expect(taskingReportFilename("kpi", "KPI-2", new Date("2026-11-01T13:30:00Z")))
      .toBe("KPI-2 ICT Systems without DIIS Registration Report 02-11-2026.pdf");
  });

  it.each([
    ["KPI-1", "ICT Systems have an active ATO"],
    ["KPI-2", "ICT Systems are registered within DIIS"]
  ])("names the %s trend PDF using its supplied name and Sydney generation date", (id, name) => {
    expect(taskingReportFilename("kpi-trend", id, new Date("2026-10-31T14:30:00Z"), name))
      .toBe(`${id} - ${name} 01-11-2026.pdf`);
    expect(taskingReportFilename("kpi-trend", id, new Date("2026-11-01T13:30:00Z"), name))
      .toBe(`${id} - ${name} 02-11-2026.pdf`);
  });

  it("uses a renamed KPI and removes characters that cannot appear in a download filename", () => {
    expect(taskingReportFilename("kpi-trend", "KPI-2", new Date("2026-11-01T00:00:00Z"), 'ICT Systems: DIIS / "Registration"'))
      .toBe("KPI-2 - ICT Systems DIIS Registration 01-11-2026.pdf");
  });

  it("builds SPI trend report links with the selected snapshot scope", () => {
    const href = buildTaskingReportHref({
      kind: "spi-trend",
      id: "7",
      dataDate: "2026-04-23",
      filters: {
        managedNetwork: "net-1",
        ictSystem: "sys-1"
      }
    });
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/api/tasking-report");
    expect(url.searchParams.get("kind")).toBe("spi-trend");
    expect(url.searchParams.get("id")).toBe("7");
    expect(url.searchParams.get("dataDate")).toBe("2026-04-23");
    expect(url.searchParams.get("network")).toBe("net-1");
    expect(url.searchParams.get("system")).toBe("sys-1");
  });

  it("builds all-SPI report links with the current filters and snapshot scope", () => {
    const href = buildTaskingReportHref({
      kind: "spi-all",
      id: "all",
      dataDate: "2026-04-23",
      filters: {
        managedNetwork: "net-1",
        assetType: "storage-device",
        severity: "Moderate"
      }
    });
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/api/tasking-report");
    expect(url.searchParams.get("kind")).toBe("spi-all");
    expect(url.searchParams.get("id")).toBe("all");
    expect(url.searchParams.get("dataDate")).toBe("2026-04-23");
    expect(url.searchParams.get("network")).toBe("net-1");
    expect(url.searchParams.get("assetType")).toBe("storage-device");
    expect(url.searchParams.get("severity")).toBe("Moderate");
  });

  it("builds KPI trend report links with the current filters and snapshot scope", () => {
    const href = buildTaskingReportHref({
      kind: "kpi-trend",
      id: "KPI-6",
      dataDate: "2026-04-23",
      filters: {
        managedNetwork: "net-1",
        ictSystem: "sys-1",
        severity: "High Risk"
      }
    });
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/api/tasking-report");
    expect(url.searchParams.get("kind")).toBe("kpi-trend");
    expect(url.searchParams.get("id")).toBe("KPI-6");
    expect(url.searchParams.get("dataDate")).toBe("2026-04-23");
    expect(url.searchParams.get("network")).toBe("net-1");
    expect(url.searchParams.get("system")).toBe("sys-1");
    expect(url.searchParams.get("severity")).toBe("High Risk");
  });

  it("builds KPI current and trend report links for KPI-1 and KPI-2", () => {
    for (const id of ["KPI-1", "KPI-2"]) {
      for (const kind of ["kpi", "kpi-trend"] as const) {
        const href = buildTaskingReportHref({
          kind,
          id,
          dataDate: "2026-04-23",
          filters: {
            managedNetwork: "net-1",
            ictSystem: "sys-1",
            assetType: "server"
          }
        });
        const url = new URL(href, "http://localhost");

        expect(url.searchParams.get("kind")).toBe(kind);
        expect(url.searchParams.get("id")).toBe(id);
        expect(url.searchParams.get("dataDate")).toBe("2026-04-23");
        expect(url.searchParams.get("network")).toBe("net-1");
        expect(url.searchParams.get("system")).toBe("sys-1");
        expect(url.searchParams.get("assetType")).toBe("server");
      }
    }
  });

  it("treats Measures as data-date scoped navigation", () => {
    expect(isDataDateScopedPath("/measures")).toBe(true);
  });
});
