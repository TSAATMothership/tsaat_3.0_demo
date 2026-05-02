import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { Dataset } from "@/lib/types";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function expectedReference(index: number): string {
  return String(index + 1).padStart(3, "0");
}

describe("network and ICT system reference persistence", () => {
  it("adds persisted APM, DIIS, and ATO columns to schema, migrations, loader SQL, and schema validation", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/010_add_apm_numbers_and_reference_backfill.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");
    const databaseSettings = readRepoFile("lib/database-settings.ts");

    expect(schema).toMatch(/CREATE TABLE \[tsaat\]\.\[managed_network\] \([\s\S]*\[diis_id\] NVARCHAR\(100\) NULL/);
    expect(schema).toMatch(/CREATE TABLE \[tsaat\]\.\[managed_network\] \([\s\S]*\[apm_number\] NVARCHAR\(100\) NULL/);
    expect(schema).toMatch(/CREATE TABLE \[tsaat\]\.\[ict_system\] \([\s\S]*\[diis_id\] NVARCHAR\(100\) NULL/);
    expect(schema).toMatch(/CREATE TABLE \[tsaat\]\.\[ict_system\] \([\s\S]*\[apm_number\] NVARCHAR\(100\) NULL/);
    expect(migration).toContain("COL_LENGTH(N'tsaat.managed_network', N'apm_number')");
    expect(migration).toContain("COL_LENGTH(N'tsaat.ict_system', N'apm_number')");
    expect(migration).toContain("DIIS-NET-000");
    expect(migration).toContain("ATO-NET-000");
    expect(migration).toContain("APM-NET-000");
    expect(migration).toContain("DIIS-SYS-");
    expect(migration).toContain("ATO-SYS-");
    expect(migration).toContain("APM-SYS-");
    expect(migration).toContain("CONCAT(N'DIIS-NET-', RIGHT(CONCAT(N'000'");
    expect(migration).toContain("CONCAT(N'ATO-NET-', RIGHT(CONCAT(N'000'");
    expect(migration).toContain("CONCAT(N'APM-NET-', RIGHT(CONCAT(N'000'");
    expect(migration).toContain("ELSE mn.[apm_number]");
    expect(migration).toContain("ELSE s.[apm_number]");
    expect(loader).toContain("[diis_id] NVARCHAR(100) '$.diisId'");
    expect(loader).toContain("[apm_number] NVARCHAR(100) '$.apmNumber'");
    expect(loader).toContain("N'DIIS-NET-000'");
    expect(loader).toContain("N'ATO-NET-000'");
    expect(loader).toContain("N'APM-NET-000'");
    expect(loader).toContain("CONCAT(N'DIIS-SYS-', RIGHT(CONCAT(N'000'");
    expect(loader).toContain("CONCAT(N'ATO-SYS-', RIGHT(CONCAT(N'000'");
    expect(loader).toContain("CONCAT(N'APM-SYS-', RIGHT(CONCAT(N'000'");
    expect(databaseSettings).toContain('{ tableName: "managed_network", columnName: "diis_id" }');
    expect(databaseSettings).toContain('{ tableName: "managed_network", columnName: "ato_number" }');
    expect(databaseSettings).toContain('{ tableName: "managed_network", columnName: "apm_number" }');
    expect(databaseSettings).toContain('{ tableName: "ict_system", columnName: "diis_id" }');
    expect(databaseSettings).toContain('{ tableName: "ict_system", columnName: "ato_number" }');
    expect(databaseSettings).toContain('{ tableName: "ict_system", columnName: "apm_number" }');
  });

  it("keeps generated network and ICT system APM, DIIS, and ATO numbers explicit", () => {
    const dataset = JSON.parse(readRepoFile("data/current.json")) as Dataset;

    expect(dataset.managedNetworks.length).toBeGreaterThan(0);
    for (const [index, network] of dataset.managedNetworks.entries()) {
      const reference = expectedReference(index);
      expect(network.diisId).toBe(`DIIS-NET-${reference}`);
      expect(network.atoNumber).toBe(`ATO-NET-${reference}`);
      expect(network.apmNumber).toBe(`APM-NET-${reference}`);
    }

    expect(dataset.ictSystems.length).toBeGreaterThan(0);
    for (const [index, system] of dataset.ictSystems.entries()) {
      const reference = expectedReference(index);
      expect(system.diisId).toBe(`DIIS-SYS-${reference}`);
      expect(system.atoNumber).toBe(`ATO-SYS-${reference}`);
      expect(system.apmNumber).toBe(`APM-SYS-${reference}`);
    }
  });
});
