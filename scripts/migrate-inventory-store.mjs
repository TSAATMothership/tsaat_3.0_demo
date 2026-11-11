import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { retireDatasetFields, assertRetainedDataset, RETAINED_REFERENCE_FILES } from '../lib/inventory-schema.mjs';
import { retirePersonaPermissions } from '../lib/retired-capabilities.mjs';
import { validateDemoDataset } from './enrich-demo-dataset.mjs';

async function read(file) { return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
async function write(file, value) { await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); }
function inside(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Expected a relative store path.');
  const full = path.resolve(root, relative);
  if (!full.startsWith(root + path.sep)) throw new Error('Store path escapes the selected directory.');
  return full;
}
async function files(root, relative = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Store migration refuses symbolic links: ' + name);
    if (entry.isDirectory()) result.push(...await files(root, name));
    else if (entry.isFile()) result.push(name);
    else throw new Error('Unsupported store entry: ' + name);
  }
  return result;
}
async function plan(target) {
  const manifest = await read(path.join(target, 'store.json'));
  if (manifest.format !== 'tsaat-json-store' || ![1, 2].includes(manifest.schemaVersion) || !manifest.snapshots?.length) throw new Error('Unsupported or empty JSON store.');
  const names = await files(target), updates = new Map(), removals = [];
  const ids = new Set(), dates = new Set(), activeFiles = new Set();
  for (const entry of manifest.snapshots) {
    if (!Number.isSafeInteger(entry.id) || entry.id < 1 || ids.has(entry.id) || dates.has(entry.date) || activeFiles.has(entry.file)) throw new Error('Invalid snapshot catalogue.');
    ids.add(entry.id); dates.add(entry.date); activeFiles.add(entry.file);
    const source = await read(inside(target, entry.file));
    if (source.snapshotDate !== entry.date) throw new Error('Snapshot date differs from its catalogue: ' + entry.file);
    const projected = retireDatasetFields(source);
    validateDemoDataset(projected);
    if (manifest.schemaVersion === 2) assertRetainedDataset(source);
    updates.set(path.normalize(entry.file), projected);
  }
  for (const name of names) {
    const normalized = name.replaceAll('\\', '/');
    if (normalized.startsWith('snapshots/') && name.endsWith('.json') && !updates.has(name)) {
      // Old population revisions remain useful evidence; remove retired payloads from these too.
      const source = await read(inside(target, name)), projected = retireDatasetFields(source);
      validateDemoDataset(projected); updates.set(name, projected);
    } else if (normalized.startsWith('references/') && !RETAINED_REFERENCE_FILES.includes(path.basename(name))) {
      if (/^(spi-|kpi-|finding-|severity-definitions|reference-versions|measures-settings)/.test(path.basename(name))) removals.push(name);
      else throw new Error('Unrecognized reference file needs review before migration: ' + name);
    } else if (/^settings\/(?:history\/)?measures-settings(?:-|\.json)/.test(normalized)) removals.push(name);
    else if (/^(?:settings\/(?:history\/)?|references\/)personas(?:-|\.json)/.test(normalized)) {
      const source = await read(inside(target, name));
      if (![1, 2, 3].includes(source.schemaVersion) || !Array.isArray(source.personas) || source.personas.some(p => !Array.isArray(p.sections))) throw new Error('Invalid persona revision: ' + name);
      updates.set(name, retirePersonaPermissions(source));
    }
  }
  for (const name of ['settings/personas.json','settings/discovery-tools-settings.json','references/discovery-coverage-rules.json','references/cmdb-attributes.json']) await read(inside(target, name));
  if (manifest.schemaVersion === 2 && removals.length) throw new Error('Version 2 store still contains retired reference/settings files.');
  return { manifest, updates, removals };
}

/** Stop the application first. Default is a read-only preview; apply requires an explicit full backup. */
export async function migrateInventoryStore({ target, backupDirectory, apply = false } = {}) {
  if (!target || !path.isAbsolute(target)) throw new Error('Select an explicit absolute --target store directory.');
  target = await fs.realpath(target);
  if (path.dirname(target) === target) throw new Error('A filesystem root cannot be a store.');
  const lockPath = path.join(target, '.write-lock');
  let lock, staging, recovery, published = false, ownsLock = false;
  try {
    // Preview also respects writers, without creating a lock or modifying the store.
    if (!apply) { try { await fs.access(lockPath); throw new Error('JSON store is busy.'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
    else {
      if (!backupDirectory || !path.isAbsolute(backupDirectory)) throw new Error('--apply requires an explicit absolute --backup-directory.');
      lock = await fs.open(lockPath, 'wx', 0o600).catch(e => { if (e.code === 'EEXIST') throw new Error('JSON store is busy.'); throw e; });
      ownsLock = true;
      await lock.writeFile(JSON.stringify({ pid: process.pid, operation: 'inventory-v2', startedAt: new Date().toISOString() }));
    }
    const { manifest, updates, removals } = await plan(target);
    const report = { directory: target, fromVersion: manifest.schemaVersion, toVersion: 2, applied: false, snapshots: manifest.snapshots.length, removedFiles: removals };
    if (!apply || manifest.schemaVersion === 2) return report;
    const backup = path.resolve(backupDirectory);
    if (backup === target || backup.startsWith(target + path.sep) || target.startsWith(backup + path.sep)) throw new Error('Backup must be a new directory outside the active store.');
    // Resolve the existing parent to prevent junctions from redirecting backup inside the store.
    const backupParent = await fs.realpath(path.dirname(backup));
    if (backupParent !== path.dirname(backup) || backupParent === target || backupParent.startsWith(target + path.sep)) throw new Error('Backup parent must be a real directory outside the store.');
    await fs.mkdir(backup); // exclusive, never merge with an earlier backup
    for (const name of await fs.readdir(target)) if (name !== '.write-lock')
      await fs.cp(path.join(target, name), path.join(backup, name), { recursive: true, force: false, errorOnExist: true });
    const revision = randomUUID();
    staging = target + '.upgrade-' + revision;
    recovery = target + '.recovery-' + revision;
    await fs.cp(target, staging, { recursive: true, force: false, errorOnExist: true });
    for (const [name, value] of updates) await write(inside(staging, name), value);
    for (const name of removals) await fs.unlink(inside(staging, name));
    await write(path.join(staging, 'store.json'), { ...manifest, schemaVersion: 2, dataMigrations: [...new Set([...(manifest.dataMigrations ?? []), 'inventory-v2'])] });
    await plan(staging);
    await lock.close(); lock = undefined; // Windows cannot rename a directory containing an open handle.
    await fs.rename(target, recovery);
    try { await fs.rename(staging, target); published = true; }
    catch (error) { await fs.rename(recovery, target); recovery = undefined; throw error; }
    await fs.unlink(lockPath); ownsLock = false;
    return { ...report, applied: true, backupDirectory: backup };
  } finally {
    if (lock) await lock.close();
    if (ownsLock && (!recovery || published)) await fs.rm(lockPath, { force: true });
    // Cleanup is restricted to this invocation's UUID-named sibling directories.
    for (const [directory, prefix] of [[staging, '.upgrade-'], [published ? recovery : undefined, '.recovery-']]) if (directory) {
      if (path.dirname(directory) !== path.dirname(target) || !path.basename(directory).startsWith(path.basename(target) + prefix)) throw new Error('Unsafe migration cleanup target.');
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {}, args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') options.apply = true;
    else if (['--target', '--backup-directory'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i] === '--target' ? 'target' : 'backupDirectory'] = args[++i];
    else throw new Error('Usage: npm run migrate:inventory -- --target <absolute store> [--apply --backup-directory <new absolute backup>]');
  }
  try { console.log(JSON.stringify(await migrateInventoryStore(options), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
