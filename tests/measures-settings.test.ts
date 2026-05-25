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

  it("persists measures priority matrix in schema, migration, loader, and validation", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/011_add_measures_priority_matrix.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");
    const validator = readRepoFile("Database Schema/loaders/validate-database.sql");
    const databaseSettings = readRepoFile("lib/database-settings.ts");
    const seedSettings = readRepoFile("Database Schema/data/measures-settings.json");
    const sqlSeed = readRepoFile("Database Schema/data/spi-sql-calculations.json");

    expect(schema).toContain("CREATE TABLE [tsaat].[measures_priority_matrix]");
    expect(schema).toContain("CREATE TABLE [tsaat].[finding_priority_definition]");
    expect(schema).toContain("CHECK ([priority_rank] > 0)");
    expect(migration).toContain("OBJECT_ID(N'tsaat.measures_priority_matrix', N'U')");
    expect(migration).toContain("sd.[priority_order]");
    expect(loader).toContain("INSERT INTO [tsaat].[measures_priority_matrix]");
    expect(loader).toContain("$.priorityMatrix");
    expect(loader).toContain("finding_priority_definition");
    expect(validator).toContain("measures_priority_matrix table is empty");
    expect(validator).toContain("finding_priority_definition_count");
    expect(databaseSettings).toContain('"measures_priority_matrix"');
    expect(databaseSettings).toContain('"finding_priority_definition"');
    expect(databaseSettings).toContain('{ tableName: "measures_priority_matrix", columnName: "priority_rank" }');
    expect(seedSettings).toContain('"priorityMatrix"');
    expect(sqlSeed).toContain('"findingPriorities"');
    expect(schema).toContain("CREATE TABLE [tsaat].[finding_severity_definition]");
    expect(loader).toContain("severity-definitions.json");
    expect(validator).toContain("finding_severity_definition_count");
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
