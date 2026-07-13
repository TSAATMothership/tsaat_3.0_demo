import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { Dataset } from "@/lib/types";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("network modelling status persistence", () => {
  it("loads managed network modelling status from the demo JSON dataset", () => {
    const loader = readRepoFile("lib/data-loader.ts");
    const types = readRepoFile("lib/types.ts");
    const dataset = JSON.parse(readRepoFile("data/current.json")) as Dataset;

    expect(loader).toContain('const currentPath = path.join(resolveDataDirectory(), "current.json")');
    expect(loader).toContain("readJsonFile<Dataset>(filePath)");
    expect(loader).not.toMatch(/from ["']@\/lib\/sql-server["']/);
    expect(types).toMatch(/export interface ManagedNetwork \{[\s\S]*modellingStatus: boolean/);
    expect(dataset.managedNetworks.every((network) => typeof network.modellingStatus === "boolean")).toBe(
      true
    );
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
