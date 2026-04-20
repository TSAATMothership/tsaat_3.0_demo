import { describe, expect, it } from "vitest";
import {
  MEASURES_SELECTABLE_SEVERITY_OPTIONS,
  normalizeMeasuresSettings,
  severityMatrixKey
} from "@/lib/measures-settings";

describe("measures settings normalization", () => {
  it("remaps Data Gap matrix entries to Moderate", () => {
    const settings = normalizeMeasuresSettings({
      updatedAt: "2026-04-20T00:00:00.000Z",
      severityMatrix: {
        [severityMatrixKey(4, "server")]: "Data Gap"
      }
    });

    expect(settings.severityMatrix[severityMatrixKey(4, "server")]).toBe("Moderate");
  });

  it("excludes Data Gap from selectable SPI settings options", () => {
    expect(MEASURES_SELECTABLE_SEVERITY_OPTIONS).not.toContain("Data Gap");
    expect(MEASURES_SELECTABLE_SEVERITY_OPTIONS).toEqual(
      expect.arrayContaining(["Critical Exposure", "High Risk", "Major", "Moderate"])
    );
  });
});
