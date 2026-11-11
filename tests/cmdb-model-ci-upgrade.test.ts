import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import { migrateModelCiCmdb } from "../scripts/migrate-model-ci-cmdb.mjs";
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture(mappings: unknown = { server: [], printer: [{ key: "custom" }] }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "tsaat-model-ci-upgrade-")); roots.push(root);
  const target = path.join(root, "store"), file = path.join(target, "references/cmdb-attributes.json");
  await mkdir(path.dirname(file), { recursive: true });
  const manifest = JSON.stringify({ format: "tsaat-json-store", schemaVersion: 1, snapshots: [{ id: 1, date: "2026-10-31", file: "snapshots/old.json" }] });
  await writeFile(path.join(target, "store.json"), manifest); await writeFile(file, JSON.stringify(mappings));
  return { root, target, file, manifest, backupDirectory: path.join(root, "backup") };
}
it("previews, backs up, atomically adds both types and preserves endpoint/custom/empty mappings on repeat", async () => {
  const fixtureData = await fixture(), { target, file, manifest, backupDirectory } = fixtureData;
  const original = await readFile(file, "utf8");
  expect((await migrateModelCiCmdb(fixtureData)).addedTypes).toEqual(["business-service", "mission-capability"]);
  expect(await readFile(file, "utf8")).toBe(original);
  const applied = await migrateModelCiCmdb({ target, backupDirectory, apply: true });
  expect(applied.applied).toBe(true); expect(await readFile(applied.backupFile!, "utf8")).toBe(original);
  const mappings = JSON.parse(await readFile(file, "utf8"));
  expect(mappings.server).toEqual([]); expect(mappings.printer).toEqual([{ key: "custom" }]);
  expect(mappings["mission-capability"]).toHaveLength(7);
  mappings["business-service"] = []; mappings["mission-capability"][0].label = "Custom ID";
  await writeFile(file, JSON.stringify(mappings));
  expect((await migrateModelCiCmdb({ target, backupDirectory, apply: true })).addedTypes).toEqual([]);
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual(mappings);
  expect(await readFile(path.join(target, "store.json"), "utf8")).toBe(manifest);
});
it("refuses another writer, invalid existing model mappings and backups inside the store without replacing data", async () => {
  const { target, file, backupDirectory } = await fixture({ "business-service": "invalid" });
  const original = await readFile(file, "utf8"), lock = path.join(target, ".write-lock");
  await expect(migrateModelCiCmdb({ target, backupDirectory, apply: true })).rejects.toThrow("Invalid existing mapping");
  expect(await readFile(file, "utf8")).toBe(original);
  await writeFile(file, "{}");
  await expect(migrateModelCiCmdb({ target, backupDirectory: target, apply: true })).rejects.toThrow("Backup must be outside");
  await writeFile(lock, "other writer");
  await expect(migrateModelCiCmdb({ target, backupDirectory, apply: true })).rejects.toThrow();
  expect(await readFile(lock, "utf8")).toBe("other writer"); expect(await readFile(file, "utf8")).toBe("{}");
});
