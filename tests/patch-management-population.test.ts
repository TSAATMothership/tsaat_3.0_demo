import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { enrichPatchManagement } from "../scripts/enrich-patch-management.mjs";
import { populatePatchManagement } from "../scripts/populate-patch-management.mjs";
import { buildPatchManagementRows } from "@/lib/patch-management-explorer";
import type { Dataset } from "@/lib/types";
const original: Dataset = JSON.parse(await fs.readFile("data/current.json", "utf8"));
for (const asset of original.assets) if (asset.type === 'server') delete asset.patchManagement;
describe("sample server patch population", () => {
  it("adds only server observations, preserves existing evidence and produces all workflow states", () => {
    const input = structuredClone(original);
    const first = input.assets.find(asset => asset.type === "server")!;
    if (first.type !== "server") throw Error("Expected server fixture");
    first.patchManagement = { source: "Existing scanner", lastRestartedDate: "2026-01-01" };
    const result = enrichPatchManagement(input);
    expect(result.assets.find(asset => asset.id === first.id)).toEqual(first);
    const stripped = structuredClone(result);
    for (let index = 0; index < input.assets.length; index++) {
      const before = input.assets[index], after = stripped.assets[index];
      if (after.type === "server" && (before.type !== "server" || !before.patchManagement)) delete after.patchManagement;
    }
    expect(stripped).toEqual(input);
    expect(enrichPatchManagement(result)).toEqual(result);
    const rows = buildPatchManagementRows(result, { network: result.managedNetworks.map(network => network.id) });
    expect(new Set(rows.map(row => row.status))).toEqual(new Set(["Patched", "Not patched", "Restart required", "Failed", "In progress", "Unknown"]));
    expect(rows.filter(row => row.source?.startsWith("Sample")).every(row => !row.lastPatchedDate || row.lastPatchedDate.slice(0, 10) <= result.snapshotDate)).toBe(true);
  });
  it("requires explicit sample application and keeps a recoverable original store and settings", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-patch-test-"));
    try {
      const target = path.join(root, "store");
      await fs.mkdir(path.join(target, "snapshots"), { recursive: true }); await fs.mkdir(path.join(target, "settings"));
      const manifest = { format: "tsaat-json-store", schemaVersion: 1, snapshots: [{ id: 8, date: original.snapshotDate, file: "snapshots/original.json" }] };
      await fs.writeFile(path.join(target, "store.json"), JSON.stringify(manifest)); await fs.writeFile(path.join(target, "snapshots/original.json"), JSON.stringify(original));
      await fs.writeFile(path.join(target, "settings/keep.json"), '{"keep":true}');
      expect((await populatePatchManagement({ target })).changedSnapshots).toBe(1);
      await expect(populatePatchManagement({ target, apply: true })).rejects.toThrow("--apply --demo");
      const report = await populatePatchManagement({ target, apply: true, demo: true, backupDirectory: path.join(root, "backup") });
      expect(report.applied).toBe(true);
      expect(JSON.parse(await fs.readFile(path.join(report.backupDirectory!, "store.json"), "utf8"))).toEqual(manifest);
      expect(JSON.parse(await fs.readFile(path.join(target, "snapshots/original.json"), "utf8"))).toEqual(original);
      expect(await fs.readFile(path.join(target, "settings/keep.json"), "utf8")).toBe('{"keep":true}');
      expect((await populatePatchManagement({ target })).changedSnapshots).toBe(0);
    } finally {
      if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("tsaat-patch-test-")) throw Error("Unsafe test cleanup");
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
