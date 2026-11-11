import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { repositoryRoot } from "./setup-json-store.mjs";
import { DEMO_DATA_PROFILE, enrichDemoDataset, summarizeDemoDataset } from "./enrich-demo-dataset.mjs";

import { datasetsFromSqlExport } from "./sql-export-datasets.mjs";

function inside(root, relative) {
  if (typeof relative !== "string" || path.isAbsolute(relative)) throw new Error("Snapshot path must be relative to its store.");
  const result = path.resolve(root, relative);
  if (!result.startsWith(root + path.sep)) throw new Error("Snapshot path escapes its store.");
  return result;
}
async function readPlan(target, sourceDatasets, transformDataset) {
  const manifest = JSON.parse((await fs.readFile(path.join(target,"store.json"),"utf8")).replace(/^\uFEFF/,""));
  if (manifest.format !== "tsaat-json-store" || manifest.schemaVersion !== 2 || !Array.isArray(manifest.snapshots) || !manifest.snapshots.length) throw new Error("Unsupported or empty JSON store; nothing was changed.");
  const ids = new Set(), dates = new Set(), files = new Set(), snapshots = [];
  for (const entry of manifest.snapshots) {
    if (!Number.isSafeInteger(entry.id) || entry.id < 1 || ids.has(entry.id) || dates.has(entry.date) || files.has(entry.file)) throw new Error("Duplicate or invalid snapshot catalogue entry.");
    ids.add(entry.id); dates.add(entry.date); files.add(entry.file);
    const file = inside(target, entry.file), realFile = await fs.realpath(file);
    if (!realFile.startsWith(target + path.sep)) throw new Error("Snapshot link escapes its store.");
    const original = JSON.parse((await fs.readFile(realFile,"utf8")).replace(/^\uFEFF/,""));
    if (original.snapshotDate !== entry.date) throw new Error("Snapshot date does not match the catalogue.");
    const source = sourceDatasets?.find(dataset=>dataset.snapshotDate===entry.date);
    const populated = await transformDataset(source ? {...source,snapshotId:entry.id} : original);
    snapshots.push({ entry, original, populated, changed: JSON.stringify(original) !== JSON.stringify(populated) });
  }
  for (const source of sourceDatasets ?? []) {
    if (!Number.isSafeInteger(source.snapshotId) || source.snapshotId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(source.snapshotDate)) throw new Error('Invalid source snapshot identity.');
    if (dates.has(source.snapshotDate)) continue;
    if (ids.has(source.snapshotId)) throw new Error("Source snapshot ID conflicts with a different local date.");
    ids.add(source.snapshotId); dates.add(source.snapshotDate);
    snapshots.push({entry:{id:source.snapshotId,date:source.snapshotDate},original:null,populated:await transformDataset(source),changed:true});
  }
  snapshots.sort((a,b)=>a.entry.date.localeCompare(b.entry.date));
  return { manifest, snapshots };
}
export async function populateJsonStore({ target = process.env.TSAAT_JSON_DATA_DIR || path.join(repositoryRoot,"NoSQL/data"), apply = false, demo = false, sourceExport, appendDatasets, transformDataset = enrichDemoDataset, profile = DEMO_DATA_PROFILE, migration, backupDirectory = path.join(repositoryRoot,".local/nosql-backups") } = {}) {
  if (appendDatasets && (sourceExport || migration)) throw new Error('Choose one import source.');
  if (migration && (migration !== "security-domains-v1" || transformDataset === enrichDemoDataset || sourceExport)) throw new Error("Invalid data migration.");
  if (apply && !demo && !migration) throw new Error("This adds demonstration values. Use --apply --demo only for a sample data store.");
  target = await fs.realpath(path.resolve(target));
  let lock, stage, temporaryManifest, committed = false;
  const lockPath = path.join(target,".write-lock");
  try {
    if (apply) {
      try { lock = await fs.open(lockPath,"wx",0o600); }
      catch (error) { if (error.code === "EEXIST") throw new Error("JSON store is busy; no population was applied."); throw error; }
      await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString(),operation:migration ?? "populate-demo"}));
    }
    let sourceDatasets, provenance;
    if (sourceExport) {
      const bytes = await fs.readFile(path.resolve(sourceExport));
      const source = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,""));
      sourceDatasets = datasetsFromSqlExport(source);
      provenance = {kind:"sql-export",database:source.databaseName,exportedAtUtc:source.exportedAtUtc,sha256:createHash("sha256").update(bytes).digest("hex")};
    }
    if (appendDatasets) {
      const existing = JSON.parse(await fs.readFile(path.join(target, 'store.json'), 'utf8'));
      const dates = new Set(existing.snapshots.map(entry => entry.date));
      if (new Set(appendDatasets.map(dataset => dataset.snapshotDate)).size !== appendDatasets.length) throw new Error('Duplicate source snapshot date.');
      sourceDatasets = appendDatasets.filter(dataset => !dates.has(dataset.snapshotDate));
    }
    const { manifest, snapshots } = await readPlan(target, sourceDatasets, transformDataset);
    const report = { directory:target, profile, applied:false, changedSnapshots:snapshots.filter(s=>s.changed).length,
      snapshots:snapshots.map(s=>({id:s.entry.id,before:s.original?summarizeDemoDataset(s.original):null,after:summarizeDemoDataset(s.populated)})) };
    if (!apply || !report.changedSnapshots) return report;
    const revision = randomUUID();
    const snapshotsDirectory = await fs.realpath(path.join(target,"snapshots"));
    if (snapshotsDirectory !== path.join(target,"snapshots")) throw new Error("Snapshot directory must not be a symbolic link.");
    const backupRoot = path.resolve(backupDirectory);
    if (backupRoot === target || backupRoot.startsWith(target + path.sep)) throw new Error("Backup must be outside the active store.");
    await fs.mkdir(backupRoot,{recursive:true});
    const backup = path.join(backupRoot,"before-" + revision);
    await fs.cp(target,backup,{recursive:true,errorOnExist:true,force:false,filter:source=>source!==lockPath});
    report.backupDirectory = backup;
    // Existing snapshots remain immutable. One manifest rename publishes the new revision.
    const relativeStage = "snapshots/populated-" + revision;
    stage = inside(target,relativeStage);
    await fs.mkdir(stage);
    const nextEntries = [];
    for (const snapshot of snapshots) {
      const file = relativeStage + "/snapshot-" + snapshot.entry.id + ".json";
      const handle = await fs.open(inside(target,file),"wx",0o600);
      try { await handle.writeFile(JSON.stringify(snapshot.populated) + "\n"); await handle.sync(); } finally { await handle.close(); }
      nextEntries.push({...snapshot.entry,file});
    }
    const nextManifest = {...manifest,...(migration ? { dataMigrations: [...new Set([...(manifest.dataMigrations ?? []), migration])] } : { sampleDataProfile:profile }),...(provenance?{dataProvenance:provenance}:{}),snapshots:nextEntries};
    temporaryManifest = path.join(target,"store.json.populate-" + revision + ".tmp");
    const handle = await fs.open(temporaryManifest,"wx",0o600);
    try { await handle.writeFile(JSON.stringify(nextManifest,null,2) + "\n"); await handle.sync(); } finally { await handle.close(); }
    // Save recovery evidence before the commit; settings/references and old snapshots are untouched.
    await fs.writeFile(path.join(backupRoot,"population-" + revision + ".json"),JSON.stringify({...report,publication:"Prepared; inspect the active manifest to confirm publication.",revision,provenance},null,2) + "\n");
    await fs.rename(temporaryManifest,path.join(target,"store.json"));
    committed = true;
    return {...report,applied:true};
  } finally {
    if (temporaryManifest) await fs.rm(temporaryManifest,{force:true});
    if (stage && !committed) {
      if (path.dirname(stage)!==path.join(target,"snapshots") || !path.basename(stage).startsWith("populated-")) throw new Error("Unsafe population staging path.");
      await fs.rm(stage,{recursive:true,force:true});
    }
    if (lock) { await lock.close(); await fs.rm(lockPath,{force:true}); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  const args = process.argv.slice(2);
  for (let index=0;index<args.length;index++) {
    const arg = args[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--demo") options.demo = true;
    else if (["--target","--backup-directory","--source"].includes(arg) && args[index+1] && !args[index+1].startsWith("--")) options[arg==="--target"?"target":arg==="--source"?"sourceExport":"backupDirectory"] = args[++index];
    else throw new Error("Usage: npm run populate:nosql -- [--target directory] [--source sql-export.json] [--apply --demo] [--backup-directory directory]");
  }
  try { console.log(JSON.stringify(await populateJsonStore(options),null,2)); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
