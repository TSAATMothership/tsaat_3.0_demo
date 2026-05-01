import { describe, expect, it } from "vitest";
import { MEASURES_TABS, resolveMeasuresTab } from "@/lib/measures-tab-routing";

describe("Measures tab routing", () => {
  it("does not expose KPI settings and falls old KPI settings URLs back to Summary", () => {
    expect(MEASURES_TABS.map((tab) => tab.id)).toEqual([
      "summary",
      "measures-kpi",
      "measures-spi",
      "spi-settings"
    ]);
    expect(resolveMeasuresTab("kpi-settings")).toBe("summary");
  });

  it("keeps legacy settings URLs mapped to SPI settings", () => {
    expect(resolveMeasuresTab("settings")).toBe("spi-settings");
  });
});
