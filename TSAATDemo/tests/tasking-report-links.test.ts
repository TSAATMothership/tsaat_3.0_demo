import { describe, expect, it } from "vitest";
import { isDataDateScopedPath } from "@/lib/data-date";
import {
  TASKING_REPORT_CONTENT_TYPE,
  buildTaskingReportHref,
  taskingReportDataDateFromSearchParams,
  taskingReportFilename
} from "@/lib/tasking-report-links";

describe("tasking report links", () => {
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
    expect(taskingReportFilename("spi", "10")).toBe("tsaat-spi-report-spi-10.pdf");
    expect(taskingReportFilename("spi-trend", "10")).toBe("tsaat-spi-trend-report-spi-trend-10.pdf");
    expect(taskingReportFilename("spi-all", "all")).toBe("tsaat-spi-report-all.pdf");
    expect(taskingReportFilename("kpi-trend", "KPI-6")).toBe("tsaat-kpi-trend-report-kpi-trend-kpi-6.pdf");
    expect(TASKING_REPORT_CONTENT_TYPE).toBe("application/pdf");
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

  it("builds KPI current and trend report links for KPI-5 through KPI-10", () => {
    for (const id of ["KPI-5", "KPI-6", "KPI-7", "KPI-8", "KPI-9", "KPI-10"]) {
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
