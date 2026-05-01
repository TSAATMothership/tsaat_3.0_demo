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

describe("network DIIS and ATO persistence", () => {
  it("adds managed_network.diis_id to schema, migration, loader SQL, and schema validation", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/009_add_network_diis_id_and_ato_backfill.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");
    const databaseSettings = readRepoFile("lib/database-settings.ts");

    expect(schema).toMatch(/CREATE TABLE \[tsaat\]\.\[managed_network\] \([\s\S]*\[diis_id\] NVARCHAR\(100\) NULL/);
    expect(migration).toContain("COL_LENGTH(N'tsaat.managed_network', N'diis_id')");
    expect(migration).toContain("DIIS-NET-000");
    expect(migration).toContain("ATO-NET-000");
    expect(migration).toContain("CONCAT(N'DIIS-NET-', RIGHT(CONCAT(N'000'");
    expect(migration).toContain("CONCAT(N'ATO-NET-', RIGHT(CONCAT(N'000'");
    expect(loader).toContain("[diis_id] NVARCHAR(100) '$.diisId'");
    expect(loader).toContain("N'DIIS-NET-000'");
    expect(loader).toContain("N'ATO-NET-000'");
    expect(databaseSettings).toContain('{ tableName: "managed_network", columnName: "diis_id" }');
  });

  it("keeps generated network DIIS IDs and ATO numbers explicit", () => {
    const dataset = JSON.parse(readRepoFile("data/current.json")) as Dataset;

    expect(dataset.managedNetworks.length).toBeGreaterThan(0);
    for (const [index, network] of dataset.managedNetworks.entries()) {
      const reference = expectedReference(index);
      expect(network.diisId).toBe(`DIIS-NET-${reference}`);
      expect(network.atoNumber).toBe(`ATO-NET-${reference}`);
    }
  });
});
