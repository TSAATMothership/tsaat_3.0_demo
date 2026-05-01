import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { Dataset } from "@/lib/types";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("network modelling status persistence", () => {
  it("adds managed_network.modelling_status to schema, migration, and loader SQL", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/008_add_network_modelling_status.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");

    expect(schema).toMatch(/CREATE TABLE \[tsaat\]\.\[managed_network\] \([\s\S]*\[modelling_status\] BIT NOT NULL/);
    expect(migration).toContain("COL_LENGTH(N'tsaat.managed_network', N'modelling_status')");
    expect(migration).toContain("CONSTRAINT [DF_managed_network_modelling_status] DEFAULT (0) WITH VALUES");
    expect(migration).toContain("WHEN [discovery_status] = N'Discovery Non Enabled' THEN 0");
    expect(loader).toContain("[modelling_status] BIT '$.modellingStatus'");
    expect(loader).toContain("WHEN n.[discovery_status] = N'Discovery Non Enabled' THEN CAST(0 AS BIT)");
  });

  it("keeps generated network modelling status explicit and aligned with legacy fallback", () => {
    const dataset = JSON.parse(readRepoFile("data/current.json")) as Dataset;

    expect(dataset.managedNetworks.length).toBeGreaterThan(0);
    for (const network of dataset.managedNetworks) {
      expect(typeof network.modellingStatus).toBe("boolean");
      expect(network.modellingStatus).toBe(network.discoveryStatus !== "Discovery Non Enabled");
    }
  });
});
