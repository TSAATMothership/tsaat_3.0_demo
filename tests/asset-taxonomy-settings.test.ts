import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { defaultMeasuresSettings } from "@/lib/measures-settings";
import { SPI_APPLICABLE_ASSET_TYPES } from "@/lib/spi-metadata";

describe("asset taxonomy settings integration", () => {
  it("includes all asset types in discovery tool scope defaults", () => {
    const settings = defaultDiscoveryToolsSettings();
    for (const tool of settings.tools) {
      for (const assetType of ASSET_TYPES) {
        expect(tool.assetTypeScope[assetType]).toBe("required");
      }
    }
  });

  it("includes all asset types in the measures severity matrix defaults", () => {
    const settings = defaultMeasuresSettings();
    for (const spiId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
      for (const assetType of ASSET_TYPES) {
        expect(settings.severityMatrix[`${spiId}:${assetType}`]).toBeTruthy();
      }
      expect(settings.priorityMatrix[String(spiId)]).toBeTruthy();
    }
  });

  it("keeps new asset types applicable to SPI 10 only", () => {
    expect(SPI_APPLICABLE_ASSET_TYPES[10]).toEqual(
      expect.arrayContaining(["storage-device", "printer-device", "other"])
    );
    expect(SPI_APPLICABLE_ASSET_TYPES[1]).not.toEqual(
      expect.arrayContaining(["storage-device", "printer-device", "other"])
    );
  });
});
