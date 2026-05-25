import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { normalizeKpiDefinitions } from "@/lib/kpi-definitions";
import rawKpiDefinitions from "../Database Schema/data/kpi-definitions.json";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("KPI definitions", () => {
  it("normalizes database-backed KPI definitions in display order", () => {
    const definitions = normalizeKpiDefinitions(rawKpiDefinitions);

    expect(definitions).toHaveLength(10);
    expect(definitions.map((definition) => definition.id)).toEqual([
      "KPI-1",
      "KPI-2",
      "KPI-3",
      "KPI-4",
      "KPI-5",
      "KPI-6",
      "KPI-7",
      "KPI-8",
      "KPI-9",
      "KPI-10"
    ]);
    expect(definitions.filter((definition) => definition.reportAvailable).map((definition) => definition.id)).toEqual([
      "KPI-5",
      "KPI-6",
      "KPI-7",
      "KPI-8",
      "KPI-9",
      "KPI-10"
    ]);
  });

  it("drops unsupported or duplicate rows during normalization", () => {
    const definitions = normalizeKpiDefinitions({
      kpis: [
        {
          id: "kpi-custom",
          displayOrder: 2,
          name: "Custom",
          description: "Custom description",
          successMeasure: "Custom success measure",
          calculationKey: "discovery-coverage-compliance",
          reportAvailable: 1
        },
        {
          id: "KPI-DUPLICATE-ORDER",
          displayOrder: 2,
          name: "Duplicate",
          description: "Duplicate description",
          successMeasure: "Duplicate success measure",
          calculationKey: "overall-spi-compliance",
          reportAvailable: true
        },
        {
          id: "KPI-UNKNOWN",
          displayOrder: 3,
          name: "Unsupported",
          description: "Unsupported description",
          successMeasure: "Unsupported success measure",
          calculationKey: "unsupported-calculation",
          reportAvailable: true
        }
      ]
    });

    expect(definitions).toEqual([
      {
        id: "KPI-CUSTOM",
        displayOrder: 2,
        name: "Custom",
        description: "Custom description",
        successMeasure: "Custom success measure",
        calculationKey: "discovery-coverage-compliance",
        reportAvailable: true
      }
    ]);
  });

  it("persists KPI definitions in schema, migration, loader, validation, manifest, and docs", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/012_add_kpi_definition.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");
    const validator = readRepoFile("Database Schema/loaders/validate-database.sql");
    const manifest = readRepoFile("Database Schema/data/database-build-manifest.json");
    const mapping = readRepoFile("Database Schema/data-mapping-description.txt");
    const schemaDescription = readRepoFile("Database Schema/database-schema-description.txt");
    const databaseSettings = readRepoFile("lib/database-settings.ts");

    expect(schema).toContain("CREATE TABLE [tsaat].[kpi_definition]");
    expect(schema).toContain("[calculation_key] NVARCHAR(100) NOT NULL");
    expect(migration).toContain("OBJECT_ID(N'tsaat.kpi_definition', N'U')");
    expect(migration).toContain("network-discovery-enablement");
    expect(loader).toContain("kpi-definitions.json");
    expect(loader).toContain("MERGE [tsaat].[kpi_definition]");
    expect(validator).toContain("kpi_definition table is empty");
    expect(manifest).toContain('"kpiDefinitions": "data/kpi-definitions.json"');
    expect(mapping).toContain("Database Schema/data/kpi-definitions.json.kpis[] -> tsaat.kpi_definition");
    expect(schemaDescription).toContain("`kpi_definition`");
    expect(databaseSettings).toContain('"kpi_definition"');
  });
});
