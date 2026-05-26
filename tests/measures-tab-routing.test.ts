import { describe, expect, it } from "vitest";
import { MEASURES_TABS, measuresTabLoadingLabel, resolveMeasuresTab } from "@/lib/measures-tab-routing";

describe("Measures tab routing", () => {
  it("does not expose KPI settings and falls old KPI settings URLs back to Summary", () => {
    expect(MEASURES_TABS.map((tab) => tab.id)).toEqual([
      "summary",
      "measures-kpi",
      "measures-spi",
      "spi-settings"
    ]);
    expect(MEASURES_TABS.map((tab) => tab.label)).not.toContain("Networks - SPI Heatmap");
    expect(MEASURES_TABS.map((tab) => tab.label)).not.toContain("ICT Systems - SPI Heatmap");
    expect(MEASURES_TABS.find((tab) => tab.id === "measures-kpi")?.label).toBe("Performance Measures-KPIs");
    expect(MEASURES_TABS.find((tab) => tab.id === "measures-spi")?.label).toBe("Findings Measures-SPIs");
    expect(MEASURES_TABS.find((tab) => tab.id === "spi-settings")?.label).toBe("SPI Risk Severity Settings");
    expect(measuresTabLoadingLabel("measures-kpi")).toBe("Performance Measures-KPIs");
    expect(measuresTabLoadingLabel("measures-spi")).toBe("Findings Measures-SPIs");
    expect(measuresTabLoadingLabel("spi-settings")).toBe("SPI Risk Severity Settings");
    expect(resolveMeasuresTab("kpi-settings")).toBe("summary");
  });

  it("keeps legacy settings URLs mapped to SPI settings", () => {
    expect(resolveMeasuresTab("settings")).toBe("spi-settings");
  });

  it("falls old Measures SPI heatmap tabs back to Summary", () => {
    expect(resolveMeasuresTab("networks-spi-heatmap")).toBe("summary");
    expect(resolveMeasuresTab("systems-spi-heatmap")).toBe("summary");
  });
});
