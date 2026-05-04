import { describe, expect, it } from "vitest";
import { MEASURES_TABS, measuresTabLoadingLabel, resolveMeasuresTab } from "@/lib/measures-tab-routing";

describe("Measures tab routing", () => {
  it("does not expose KPI settings and falls old KPI settings URLs back to Summary", () => {
    expect(MEASURES_TABS.map((tab) => tab.id)).toEqual([
      "summary",
      "measures-kpi",
      "measures-spi",
      "networks-spi-heatmap",
      "systems-spi-heatmap",
      "spi-settings"
    ]);
    expect(MEASURES_TABS.map((tab) => tab.label)).toContain("Networks - SPI Heatmap");
    expect(MEASURES_TABS.map((tab) => tab.label)).toContain("ICT Systems - SPI Heatmap");
    expect(resolveMeasuresTab("kpi-settings")).toBe("summary");
  });

  it("keeps legacy settings URLs mapped to SPI settings", () => {
    expect(resolveMeasuresTab("settings")).toBe("spi-settings");
  });

  it("routes the Measures SPI heatmap tabs and loading labels", () => {
    expect(resolveMeasuresTab("networks-spi-heatmap")).toBe("networks-spi-heatmap");
    expect(resolveMeasuresTab("systems-spi-heatmap")).toBe("systems-spi-heatmap");
    expect(measuresTabLoadingLabel("networks-spi-heatmap")).toBe("Networks - SPI Heatmap");
    expect(measuresTabLoadingLabel("systems-spi-heatmap")).toBe("ICT Systems - SPI Heatmap");
  });
});
