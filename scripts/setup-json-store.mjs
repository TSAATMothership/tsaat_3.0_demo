import fs from "node:fs/promises";
import { normalizeDatasetSecurityDomains } from "../lib/security-domain.mjs";
import { enrichVulnerabilityMetadata } from "./enrich-vulnerability-metadata.mjs";
import { enrichPatchManagement } from "./enrich-patch-management.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DEMO_DATA_PROFILE, enrichDemoDataset } from "./enrich-demo-dataset.mjs";
export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function initializeJsonStore({ target = process.env.TSAAT_JSON_DATA_DIR || path.join(repositoryRoot, "NoSQL", "data"), sourceRoot = repositoryRoot } = {}) {
  target = path.resolve(target);
  try {
    const existing = JSON.parse(await fs.readFile(path.join(target, "store.json"), "utf8"));
    if (existing.format !== "tsaat-json-store" || existing.schemaVersion !== 1 || !existing.snapshots?.length) throw new Error("Existing JSON store is invalid; it was not overwritten.");
    return { directory: target, created: false, snapshots: existing.snapshots.length };
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  try {
    if ((await fs.readdir(target)).length) throw new Error("The selected JSON data directory is not empty and has no store.json. Nothing was overwritten.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const staging = target + ".initializing-" + randomUUID();
  await fs.mkdir(path.join(staging, "snapshots"), { recursive: true });
  try {
    const input = path.join(sourceRoot, "data", "snapshots");
    const names = (await fs.readdir(input)).filter(name => /^week-\d+\.json$/.test(name)).sort();
    const current = JSON.parse((await fs.readFile(path.join(sourceRoot, "data", "current.json"), "utf8")).replace(/^\uFEFF/, ""));
    const snapshots = [];
    for (const [index, name] of names.entries()) {
      let value = JSON.parse((await fs.readFile(path.join(input, name), "utf8")).replace(/^\uFEFF/, ""));
      if (value.snapshotDate === current.snapshotDate) value = current;
      if (!Array.isArray(value.findings)) throw new Error("JSON snapshots must include persisted finding history: " + name);
      value = normalizeDatasetSecurityDomains(enrichPatchManagement(enrichVulnerabilityMetadata(enrichDemoDataset(value))));
      const file = "snapshots/" + name;
      await fs.writeFile(path.join(staging, file), JSON.stringify(value) + "\n");
      snapshots.push({ id: index + 1, date: value.snapshotDate, file });
    }
    await fs.mkdir(path.join(staging, "references"));
    const referenceRoot = path.join(sourceRoot, "Database Schema", "data");
    for (const name of (await fs.readdir(referenceRoot)).filter(name => name.endsWith(".json") && name !== "database-build-manifest.json")) {
      await fs.copyFile(path.join(referenceRoot, name), path.join(staging, "references", name));
    }
    await fs.copyFile(path.join(sourceRoot, "NoSQL", "cmdb-attributes.json"), path.join(staging, "references", "cmdb-attributes.json"));
    await fs.mkdir(path.join(staging, "settings"));
    for (const name of ["measures-settings", "discovery-tools-settings"]) {
      await fs.copyFile(path.join(referenceRoot, name + ".json"), path.join(staging, "settings", name + ".json"));
    }
    await fs.writeFile(path.join(staging, "store.json"), JSON.stringify({ format: "tsaat-json-store", schemaVersion: 1, sampleDataProfile: DEMO_DATA_PROFILE, snapshots }, null, 2) + "\n");
    try { await fs.rmdir(target); } catch (error) { if (error.code !== "ENOENT") throw error; }
    await fs.rename(staging, target);
    return { directory: target, created: true, snapshots: snapshots.length };
  } finally {
    // Only this invocation's exact sibling staging directory is eligible for cleanup.
    if (path.dirname(staging) !== path.dirname(target) || !path.basename(staging).startsWith(path.basename(target) + ".initializing-")) throw new Error("Unsafe staging directory.");
    await fs.rm(staging, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await initializeJsonStore());
