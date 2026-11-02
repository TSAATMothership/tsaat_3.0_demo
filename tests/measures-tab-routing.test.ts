import { describe, expect, it } from "vitest";
import { MEASURES_TABS, measuresTabLoadingLabel, resolveMeasuresTab } from "@/lib/measures-tab-routing";

describe("Measures tab routing", () => {
  it("does not expose KPI settings and falls old KPI settings URLs back to Summary", () => {
    expect(MEASURES_TABS.map((tab) => tab.id)).toEqual([
      "summary",
      "measures-kpi",
      "measures-spi"
    ]);
    expect(MEASURES_TABS.map((tab) => tab.label)).not.toContain("Networks - SPI Heatmap");
    expect(MEASURES_TABS.map((tab) => tab.label)).not.toContain("ICT Systems - SPI Heatmap");
    expect(MEASURES_TABS.find((tab) => tab.id === "measures-kpi")?.label).toBe("Key Performance Indicators (KPIs)");
    expect(MEASURES_TABS.find((tab) => tab.id === "measures-spi")?.label).toBe("Security Posture Indicators (SPIs)");
    expect(MEASURES_TABS.some((tab) => tab.id === "spi-settings")).toBe(false);
    expect(measuresTabLoadingLabel("measures-kpi")).toBe("Key Performance Indicators (KPIs)");
    expect(measuresTabLoadingLabel("measures-spi")).toBe("Security Posture Indicators (SPIs)");
    expect(measuresTabLoadingLabel("spi-settings")).toBe("SPI Risk Matrix");
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
