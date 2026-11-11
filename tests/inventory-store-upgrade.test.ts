import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { initializeJsonStore } from '../scripts/setup-json-store.mjs';
import { migrateInventoryStore } from '../scripts/migrate-inventory-store.mjs';
import { retireDatasetFields } from '@/lib/inventory-schema.mjs';
const roots: string[] = [];
const read = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
const write = async (file: string, value: unknown) => fs.writeFile(file, JSON.stringify(value));
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tsaat-retirement-')); roots.push(root);
  const target = path.join(root, 'store'), backupDirectory = path.join(root, 'backup');
  await initializeJsonStore({ target });
  const manifest = await read(path.join(target, 'store.json')); manifest.schemaVersion = 1;
  await write(path.join(target, 'store.json'), manifest);
  for (const entry of manifest.snapshots) {
    const file = path.join(target, entry.file), dataset = await read(file);
    dataset.findings = [{ id: 'retired-evidence' }]; dataset.spiEvaluations = [];
    dataset.managedNetworks[0].targetStateAssets = { server: ['retired-target'] };
    dataset.assets[0].patchManagement = { source: 'retired-observation' };
    if (dataset.assets[0].operatingSystem) dataset.assets[0].operatingSystem.nMinus = 3;
    await write(file, dataset);
  }
  await write(path.join(target, 'references/spi-definitions.json'), { retired: true });
  await write(path.join(target, 'settings/measures-settings.json'), { retired: true });
  const personas = await read(path.join(target, 'settings/personas.json'));
  personas.personas[0].sections.push('cyber-security'); personas.personas[0].pages.push('findings-register');
  await write(path.join(target, 'settings/personas.json'), personas);
  return { root, target, backupDirectory, manifest };
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('tsaat-retirement-')) throw new Error('Unsafe test cleanup.');
    await fs.rm(root, { recursive: true, force: true });
  }
});
it('previews without writes, backs up completely, preserves retained evidence, and repeats safely', async () => {
  const options = await fixture(), original = await read(path.join(options.target, options.manifest.snapshots[0].file));
  const settingsBefore = await fs.readFile(path.join(options.target,'settings/discovery-tools-settings.json'),'utf8');
  expect((await migrateInventoryStore(options)).applied).toBe(false);
  expect((await read(path.join(options.target,'store.json'))).schemaVersion).toBe(1);
  await expect(initializeJsonStore({ target: options.target })).rejects.toThrow('not overwritten');
  const result = await migrateInventoryStore({ ...options, apply: true }); expect(result.applied).toBe(true);
  expect(await read(path.join(options.backupDirectory, options.manifest.snapshots[0].file))).toEqual(original);
  expect(await read(path.join(options.target, options.manifest.snapshots[0].file))).toEqual(retireDatasetFields(original));
  expect(await fs.readFile(path.join(options.target,'settings/discovery-tools-settings.json'),'utf8')).toBe(settingsBefore);
  expect((await read(path.join(options.target,'settings/personas.json'))).personas[0].pages).not.toContain('findings-register');
  await expect(fs.access(path.join(options.target,'references/spi-definitions.json'))).rejects.toThrow();
  expect((await migrateInventoryStore({ ...options, apply: true })).applied).toBe(false);
  expect((await initializeJsonStore({ target: options.target })).created).toBe(false);
});
it('fails before publication for malformed evidence and leaves the original store intact', async () => {
  const options = await fixture(), file = path.join(options.target,options.manifest.snapshots[0].file);
  const dataset = await read(file); dataset.assets[0].networkId = 'missing-network'; await write(file,dataset);
  const before = await fs.readFile(file,'utf8');
  await expect(migrateInventoryStore({ ...options, apply: true })).rejects.toThrow('Invalid asset scope');
  expect(await fs.readFile(file,'utf8')).toBe(before);
  expect((await read(path.join(options.target,'store.json'))).schemaVersion).toBe(1);
  await expect(fs.access(path.join(options.target,'.write-lock'))).rejects.toThrow();
});
it('refuses busy stores, escaping snapshot paths, and backups inside the store', async () => {
  const options = await fixture();
  await fs.writeFile(path.join(options.target,'.write-lock'),'busy');
  await expect(migrateInventoryStore(options)).rejects.toThrow('busy');
  await expect(migrateInventoryStore({ ...options, apply:true })).rejects.toThrow('busy');
  await fs.unlink(path.join(options.target,'.write-lock'));
  await expect(migrateInventoryStore({ ...options, apply:true, backupDirectory:path.join(options.target,'backup') })).rejects.toThrow('outside');
  options.manifest.snapshots[0].file = '../outside.json'; await write(path.join(options.target,'store.json'),options.manifest);
  await expect(migrateInventoryStore(options)).rejects.toThrow('escapes');
});
