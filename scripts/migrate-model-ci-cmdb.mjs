import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './setup-json-store.mjs';

const migration = 'model-ci-cmdb-v1';
const types = ['business-service', 'mission-capability'];
/** Explicit reference-only upgrade. Preview by default; preserve all existing keys, including empty arrays. */
export async function migrateModelCiCmdb({ target = process.env.TSAAT_JSON_DATA_DIR || path.join(repositoryRoot, 'NoSQL/data'), apply = false,
  backupDirectory = path.join(repositoryRoot, '.local/nosql-backups') } = {}) {
  target = path.resolve(target);
  const manifest = JSON.parse(await fs.readFile(path.join(target, 'store.json'), 'utf8'));
  if (manifest.format !== 'tsaat-json-store' || manifest.schemaVersion !== 1 || !manifest.snapshots?.length) throw new Error('Select an existing valid JSON store.');
  const file = path.join(target, 'references/cmdb-attributes.json'), lockFile = path.join(target, '.write-lock');
  let lock, temporary;
  try {
    if (apply) {
      lock = await fs.open(lockFile, 'wx', 0o600);
      await lock.writeFile(JSON.stringify({ pid: process.pid, operation: migration, startedAt: new Date().toISOString() }));
    }
    const original = await fs.readFile(file, 'utf8'), mappings = JSON.parse(original);
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) throw new Error('Invalid CMDB mappings.');
    const defaults = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'NoSQL/cmdb-attributes.json'), 'utf8'));
    for (const type of types) if (Object.hasOwn(mappings, type) && !Array.isArray(mappings[type])) throw new Error('Invalid existing mapping: ' + type);
    const addedTypes = types.filter(type => !Object.hasOwn(mappings, type));
    const report = { migration, directory: target, applied: false, addedTypes };
    if (!apply || !addedTypes.length) return report;
    backupDirectory = path.resolve(backupDirectory);
    if (backupDirectory.toLowerCase() === target.toLowerCase() || backupDirectory.toLowerCase().startsWith(target.toLowerCase() + path.sep)) throw new Error('Backup must be outside the active store.');
    await fs.mkdir(backupDirectory, { recursive: true });
    const backupFile = path.join(backupDirectory, migration + '-' + randomUUID() + '.json');
    const backup = await fs.open(backupFile, 'wx', 0o600);
    try { await backup.writeFile(original); await backup.sync(); } finally { await backup.close(); }
    for (const type of addedTypes) mappings[type] = defaults[type];
    temporary = file + '.' + randomUUID() + '.tmp';
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(mappings, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, file);
    return { ...report, applied: true, backupFile };
  } finally {
    if (temporary) await fs.rm(temporary, { force: true });
    if (lock) { await lock.close(); await fs.rm(lockFile, { force: true }); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {}, args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') options.apply = true;
    else if (['--target', '--backup-directory'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i] === '--target' ? 'target' : 'backupDirectory'] = args[++i];
    else throw new Error('Usage: node scripts/migrate-model-ci-cmdb.mjs [--target directory] [--apply] [--backup-directory directory]');
  }
  try { console.log(JSON.stringify(await migrateModelCiCmdb(options), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
