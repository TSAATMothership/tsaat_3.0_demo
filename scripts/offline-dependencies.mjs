import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivePrefix = 'file:vendor/npm/';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function verifyIntegrity(bytes, integrity, label) {
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity ?? '')) throw new Error(`Missing SHA-512 integrity: ${label}`);
  const actual = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
  if (actual !== integrity) throw new Error(`Archive integrity mismatch: ${label}`);
}
function assertSource(source) {
  const url = new URL(source);
  if (url.origin !== 'https://registry.npmjs.org' || url.username || url.password || !url.pathname.endsWith('.tgz') || url.search || url.hash) {
    throw new Error(`Unapproved package source: ${source}`);
  }
}
function lockEntries(lock) {
  if (lock.lockfileVersion !== 2 && lock.lockfileVersion !== 3) throw new Error('Offline dependencies require lockfile version 2 or 3.');
  const entries = Object.entries(lock.packages ?? {}).filter(([name]) => name).map(([, entry]) => entry);
  function legacy(entriesByName) {
    for (const entry of Object.values(entriesByName ?? {})) { entries.push(entry); legacy(entry.dependencies); }
  }
  legacy(lock.dependencies);
  return entries;
}
export function checkOfflineDependencies(root = repositoryRoot) {
  const lock = readJson(path.join(root, 'package-lock.json'));
  const directory = path.join(root, 'vendor/npm');
  const manifest = readJson(path.join(directory, 'manifest.json'));
  if (manifest.version !== 1 || !Array.isArray(manifest.packages)) throw new Error('Invalid offline package manifest.');
  const records = new Map();
  for (const record of manifest.packages) {
    if (!/^[a-f0-9]{20}-[A-Za-z0-9_.-]+\.tgz$/.test(record.file) || records.has(record.file)) throw new Error(`Invalid/duplicate archive name: ${record.file}`);
    assertSource(record.source);
    const file = path.join(directory, record.file);
    if (!fs.lstatSync(file).isFile()) throw new Error(`Archive must be a regular file: ${record.file}`);
    verifyIntegrity(fs.readFileSync(file), record.integrity, record.file);
    records.set(record.file, record);
  }
  const used = new Set();
  for (const entry of lockEntries(lock)) {
    if (!entry.resolved?.startsWith(archivePrefix)) throw new Error(`Nonlocal locked package: ${entry.resolved ?? entry.version}`);
    const name = entry.resolved.slice(archivePrefix.length);
    const record = records.get(name);
    if (!record || record.integrity !== entry.integrity) throw new Error(`Missing/mismatched offline package: ${name}`);
    used.add(name);
  }
  for (const name of records.keys()) if (!used.has(name)) throw new Error(`Unused offline package: ${name}`);
  for (const name of fs.readdirSync(directory)) if (!records.has(name) && !['manifest.json', 'README.md'].includes(name)) throw new Error(`Unexpected offline artifact: ${name}`);
  return records.size;
}

// The only network-enabled dependency maintenance command. Never called by a build.
async function refresh(root) {
  const directory = path.join(root, 'vendor/npm');
  fs.mkdirSync(directory, { recursive: true });
  const manifestPath = path.join(directory, 'manifest.json');
  const previous = fs.existsSync(manifestPath) ? readJson(manifestPath).packages : [];
  const sources = new Map(previous.map(record => [archivePrefix + record.file, record.source]));
  const lock = readJson(path.join(root, 'package-lock.json'));
  const entries = lockEntries(lock);
  const records = new Map();
  for (const entry of entries) {
    const source = sources.get(entry.resolved) ?? entry.resolved;
    assertSource(source);
    if (!/^sha512-/.test(entry.integrity ?? '')) throw new Error(`SHA-512 integrity required: ${source}`);
    const file = crypto.createHash('sha256').update(entry.integrity).digest('hex').slice(0, 20) + '-' + new URL(source).pathname.split('/').at(-1);
    records.set(file, { file, source, integrity: entry.integrity });
    entry.resolved = archivePrefix + file;
  }
  const queue = [...records.values()];
  let completed = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const record = queue.shift();
      const file = path.join(directory, record.file);
      if (fs.existsSync(file)) verifyIntegrity(fs.readFileSync(file), record.integrity, record.file);
      else {
        const response = await fetch(record.source, { redirect: 'error', signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`Package download failed (${response.status}): ${record.source}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        verifyIntegrity(bytes, record.integrity, record.file);
        fs.writeFileSync(file, bytes, { flag: 'wx' });
      }
      if (++completed % 50 === 0) console.log(`Verified ${completed}/${records.size} package archives.`);
    }
  }));
  const packages = [...records.values()].sort((a, b) => a.file.localeCompare(b.file, 'en'));
  fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, packages }, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  // Only obsolete archives directly inside this fixed repository directory are removed.
  for (const name of fs.readdirSync(directory)) if (/^[a-f0-9]{20}-[A-Za-z0-9_.-]+\.tgz$/.test(name) && !records.has(name)) fs.unlinkSync(path.join(directory, name));
  console.log(`Vendored ${checkOfflineDependencies(root)} verified package archives.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--refresh') await refresh(repositoryRoot);
    else if (!process.argv[2] || process.argv[2] === '--check') console.log(`Offline dependencies verified: ${checkOfflineDependencies()} archives.`);
    else throw new Error('Usage: node scripts/offline-dependencies.mjs [--check|--refresh]');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
