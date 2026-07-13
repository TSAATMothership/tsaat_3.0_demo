import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { Dataset } from "@/lib/types";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function formatReferenceOrdinal(value: number): string {
  return String(value).padStart(3, "0");
}

function expectedNetworkReference(id: string): string {
  if (id === "net-unassigned") {
    return "000";
  }
  if (id === "net-disabled-reference") {
    return "013";
  }

  const generatedMatch = /^net-new-(\d+)$/.exec(id);
  if (generatedMatch) {
    return formatReferenceOrdinal(Number(generatedMatch[1]) + 5);
  }

  const originalMatch = /^net-(\d+)$/.exec(id);
  if (originalMatch) {
    return formatReferenceOrdinal(Number(originalMatch[1]));
  }

  throw new Error(`Unexpected managed network identifier: ${id}`);
}

function expectedSystemReference(id: string): string {
  const match = /^sys-(\d+)$/.exec(id);
  if (!match) {
    throw new Error(`Unexpected ICT system identifier: ${id}`);
  }
  return formatReferenceOrdinal(Number(match[1]));
}

describe("network and ICT system reference persistence", () => {
  it("loads persisted APM, DIIS, and ATO references from the demo JSON dataset", () => {
    const loader = readRepoFile("lib/data-loader.ts");
    const types = readRepoFile("lib/types.ts");
    const dataset = JSON.parse(readRepoFile("data/current.json")) as Dataset;

    expect(loader).toContain('const currentPath = path.join(resolveDataDirectory(), "current.json")');
    expect(loader).toContain("readJsonFile<Dataset>(filePath)");
    expect(loader).not.toMatch(/from ["']@\/lib\/sql-server["']/);
    expect(types).toContain("diisId?: string");
    expect(types).toContain("atoNumber?: string");
    expect(types).toContain("apmNumber?: string");
    expect(dataset.managedNetworks.every((network) => Boolean(network.diisId))).toBe(true);
    expect(dataset.managedNetworks.every((network) => Boolean(network.atoNumber))).toBe(true);
    expect(dataset.managedNetworks.every((network) => Boolean(network.apmNumber))).toBe(true);
    expect(dataset.ictSystems.every((system) => Boolean(system.diisId))).toBe(true);
    expect(dataset.ictSystems.every((system) => Boolean(system.atoNumber))).toBe(true);
    expect(dataset.ictSystems.every((system) => Boolean(system.apmNumber))).toBe(true);
  });

  it("keeps generated network and ICT system APM, DIIS, and ATO numbers explicit", () => {
    const dataset = JSON.parse(readRepoFile("data/current.json")) as Dataset;

    expect(dataset.managedNetworks.length).toBeGreaterThan(0);
    for (const network of dataset.managedNetworks) {
      const reference = expectedNetworkReference(network.id);
      expect(network.diisId).toBe(`DIIS-NET-${reference}`);
      expect(network.atoNumber).toBe(`ATO-NET-${reference}`);
      expect(network.apmNumber).toBe(`APM-NET-${reference}`);
    }

    expect(dataset.ictSystems.length).toBeGreaterThan(0);
    for (const system of dataset.ictSystems) {
      const reference = expectedSystemReference(system.id);
      expect(system.diisId).toBe(`DIIS-SYS-${reference}`);
      expect(system.atoNumber).toBe(`ATO-SYS-${reference}`);
      expect(system.apmNumber).toBe(`APM-SYS-${reference}`);
    }
  });
});
