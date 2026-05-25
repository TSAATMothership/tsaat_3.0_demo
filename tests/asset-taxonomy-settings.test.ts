import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { defaultMeasuresSettings } from "@/lib/measures-settings";
import { testSeverityDefinitions, testSpiDefinitions } from "./spi-definition-fixtures";

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
    const settings = defaultMeasuresSettings(testSpiDefinitions, testSeverityDefinitions);
    for (const { spiId } of testSpiDefinitions) {
      for (const assetType of ASSET_TYPES) {
        expect(settings.severityMatrix[`${spiId}:${assetType}`]).toBeTruthy();
      }
      expect(settings.priorityMatrix[String(spiId)]).toBeTruthy();
    }
  });

  it("keeps new asset types applicable to SPI 10 only", () => {
    const applicableTypesBySpi = new Map(testSpiDefinitions.map((definition) => [definition.spiId, definition.applicableAssetTypes]));
    expect(applicableTypesBySpi.get(10)).toEqual(
      expect.arrayContaining(["storage-device", "printer-device", "other"])
    );
    expect(applicableTypesBySpi.get(1)).not.toEqual(
      expect.arrayContaining(["storage-device", "printer-device", "other"])
    );
  });
});
