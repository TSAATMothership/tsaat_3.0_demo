import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  defaultMeasuresSettings,
  normalizeMeasuresSettings,
  priorityMatrixKey,
  selectablePriorityDefinitions,
  selectableSeverityDefinitions,
  severityMatrixKey
} from "@/lib/measures-settings";
import { testPriorityDefinitions, testSeverityDefinitions, testSpiDefinitions } from "./spi-definition-fixtures";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("measures settings normalization", () => {
  it("includes default SPI priority mappings for P1 through P7", () => {
    const settings = defaultMeasuresSettings(testSpiDefinitions, testSeverityDefinitions, testPriorityDefinitions);

    for (const spiId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
      expect(settings.priorityMatrix[priorityMatrixKey(spiId)]).toBeGreaterThanOrEqual(1);
      expect(settings.priorityMatrix[priorityMatrixKey(spiId)]).toBeLessThanOrEqual(7);
    }
    expect(selectablePriorityDefinitions(testPriorityDefinitions).map((definition) => definition.priorityRank)).toEqual([
      1, 2, 3, 4, 5, 6, 7
    ]);
  });

  it("remaps Data Gap matrix entries to Moderate", () => {
    const settings = normalizeMeasuresSettings({
      updatedAt: "2026-04-20T00:00:00.000Z",
      severityMatrix: {
        [severityMatrixKey(4, "server")]: "Data Gap"
      }
    }, testSpiDefinitions, testSeverityDefinitions, testPriorityDefinitions);

    expect(settings.severityMatrix[severityMatrixKey(4, "server")]).toBe("Moderate");
  });

  it("keeps valid priority mappings and falls invalid entries back to defaults", () => {
    const defaults = defaultMeasuresSettings(testSpiDefinitions, testSeverityDefinitions, testPriorityDefinitions);
    const settings = normalizeMeasuresSettings({
      updatedAt: "2026-04-20T00:00:00.000Z",
      priorityMatrix: {
        "1": 7,
        "2": "5",
        "3": 9,
        "not-spi": 1
      }
    }, testSpiDefinitions, testSeverityDefinitions, testPriorityDefinitions);

    expect(settings.priorityMatrix[priorityMatrixKey(1)]).toBe(7);
    expect(settings.priorityMatrix[priorityMatrixKey(2)]).toBe(5);
    expect(settings.priorityMatrix[priorityMatrixKey(3)]).toBe(defaults.priorityMatrix[priorityMatrixKey(3)]);
    expect(settings.priorityMatrix["not-spi"]).toBeUndefined();
  });

  it("excludes Data Gap from selectable SPI settings options", () => {
    const selectable = selectableSeverityDefinitions(testSeverityDefinitions).map((definition) => definition.severityKey);
    expect(selectable).not.toContain("Data Gap");
    expect(selectable).toEqual(
      expect.arrayContaining(["Critical Exposure", "High Risk", "Major", "Moderate"])
    );
  });

  it("loads and normalizes the measures priority matrix from demo runtime JSON", () => {
    const loader = readRepoFile("lib/data-loader.ts");
    const runtimeConfig = JSON.parse(readRepoFile("data/runtime-config.json")) as {
      measuresSettings: unknown;
      priorityDefinitions: unknown[];
      severityDefinitions: unknown[];
    };
    const settings = normalizeMeasuresSettings(
      runtimeConfig.measuresSettings,
      testSpiDefinitions,
      testSeverityDefinitions,
      testPriorityDefinitions
    );

    expect(loader).toContain("const source = measuresSettingsOverride ?? config.measuresSettings");
    expect(loader).toContain("normalizeMeasuresSettings(source, spiDefinitions, severityDefinitions, priorityDefinitions)");
    expect(loader).not.toMatch(/from ["']@\/lib\/sql-server["']/);
    expect(runtimeConfig.priorityDefinitions).toHaveLength(8);
    expect(runtimeConfig.severityDefinitions).toHaveLength(5);
    expect(Object.keys(settings.priorityMatrix)).toHaveLength(testSpiDefinitions.length);
    expect(Object.keys(settings.severityMatrix)).toHaveLength(testSpiDefinitions.length * 6);
  });

  it("renders nested SPI severity and priority settings tabs and preserves both matrices on save", () => {
    const source = readRepoFile("components/measures-settings-matrix.tsx");

    expect(source).toContain("SPI Severity Matrix Settings");
    expect(source).toContain("SPI Priority Matrix Settings");
    expect(source).toContain("selectablePriorityDefinitions(priorityDefinitions)");
    expect(source).toContain("option.label");
    expect(source).toContain("severityMatrix: draftMatrix");
    expect(source).toContain("priorityMatrix: draftPriorityMatrix");
    expect(source).toContain("Unknown/Data Gap findings remain P90");
  });
});
