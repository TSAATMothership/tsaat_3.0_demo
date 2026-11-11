import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Dataset } from '../lib/types';
import { auditSampleEvidence, auditSampleHistory, completeSampleEvidence, redateSampleDataset } from '../scripts/sample-evidence.mjs';
import { appendSampleEvidence } from '../scripts/append-sample-evidence.mjs';

const current: Dataset = JSON.parse(await fs.readFile('data/current.json', 'utf8'));
describe('common SQL and JSON weekly evidence', () => {
  it('requires four complete weeks, rejects gaps and duplicate dates', () => {
    const history = Array.from({ length: 5 }, (_, index) => redateSampleDataset(current, -7 * index));
    expect(auditSampleHistory(history).errors).toEqual([]);
    expect(auditSampleHistory(history.slice(0, 4)).errors).toContain('At least four complete weeks of weekly evidence are required');
    expect(auditSampleHistory([...history, history[0]]).errors).toContain('Duplicate snapshot dates');
    expect(auditSampleHistory([history[0], ...history.slice(2)]).errors).toContain('Snapshots must be exactly one week apart');
  });
  it('covers applicable attributes without inventing identity or patch completion and remains idempotent', () => {
    expect(auditSampleEvidence(current).errors).toEqual([]);
    expect(completeSampleEvidence(current)).toEqual(current);
    expect(current.assets.filter(asset => asset.type === 'ip-node').every(asset => !asset.macAddress && !asset.deviceModel)).toBe(true);
    expect(current.assets.some(asset => asset.type === 'server' && asset.patchManagement?.deploymentStatus === 'Unknown' && !asset.patchManagement.lastPatchedDate)).toBe(true);
    const broken = structuredClone(current);
    delete broken.assets.find(asset => asset.type === 'server')!.deviceModel;
    expect(auditSampleEvidence(broken).errors).toContain('missingEndpointFields.deviceModel: 1');
  });
  it('shifts observation dates only and excludes future vulnerability observations', () => {
    const shifted = redateSampleDataset(current, 7);
    expect(shifted.snapshotDate).not.toBe(current.snapshotDate);
    expect(shifted.assets[0].vulnerabilities[0].cveCreatedDate).toBe(current.assets[0].vulnerabilities[0].cveCreatedDate);
    const input = structuredClone(current), asset = input.assets.find(asset => asset.vulnerabilities.length)!;
    asset.vulnerabilities.push({ ...asset.vulnerabilities[0], id: 'future-evidence', detectedDate: '2099-01-01', capturedAt: '2099-01-01T00:00:00Z' });
    expect(completeSampleEvidence(input).assets.flatMap(asset => asset.vulnerabilities).some(v => v.id === 'future-evidence')).toBe(false);
    expect(input.assets.flatMap(asset => asset.vulnerabilities).some(v => v.id === 'future-evidence')).toBe(true);
  });
  it('appends matching SQL identities with a backup and preserves existing history/settings on repeat', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tsaat-evidence-'));
    try {
      const target = path.join(root, 'store');
      await fs.mkdir(path.join(target, 'snapshots'), { recursive: true }); await fs.mkdir(path.join(target, 'settings'));
      const old = { ...current, snapshotDate: '2025-01-01', snapshotId: 1 };
      const original = JSON.stringify(old);
      await fs.writeFile(path.join(target, 'snapshots/old.json'), original);
      await fs.writeFile(path.join(target, 'settings/custom.json'), '{"keep":true}');
      await fs.writeFile(path.join(target, 'store.json'), JSON.stringify({ format: 'tsaat-json-store', schemaVersion: 1, snapshots: [{ id: 1, date: old.snapshotDate, file: 'snapshots/old.json' }] }));
      const catalogue = (await Promise.all((await fs.readdir('data/snapshots')).filter(name => /^week-\d+\.json$/.test(name)).sort().map(async (name, index) => ({ id: index + 2, date: JSON.parse(await fs.readFile(path.join('data/snapshots', name), 'utf8')).snapshotDate }))));
      expect((await appendSampleEvidence({ target, catalogue })).changedSnapshots).toBe(8);
      await expect(appendSampleEvidence({ target, catalogue: catalogue.map(entry => ({ ...entry, id: -1 })) })).rejects.toThrow('Invalid source snapshot identity');
      await expect(appendSampleEvidence({ target, catalogue, apply: true })).rejects.toThrow('--apply --demo');
      const result = await appendSampleEvidence({ target, catalogue, apply: true, demo: true, backupDirectory: path.join(root, 'backup') });
      expect(result.applied).toBe(true);
      expect(await fs.readFile(path.join(result.backupDirectory!, 'snapshots/old.json'), 'utf8')).toBe(original);
      expect(await fs.readFile(path.join(target, 'snapshots/old.json'), 'utf8')).toBe(original);
      expect(await fs.readFile(path.join(target, 'settings/custom.json'), 'utf8')).toBe('{"keep":true}');
      expect(JSON.parse(await fs.readFile(path.join(target, 'store.json'), 'utf8')).snapshots.map((entry: { id: number }) => entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect((await appendSampleEvidence({ target, catalogue, apply: true, demo: true })).changedSnapshots).toBe(0);
      await expect(appendSampleEvidence({ target, catalogue: catalogue.map(entry => ({ ...entry, id: entry.id + 1 })) })).rejects.toThrow('identity mismatch');
    } finally {
      if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('tsaat-evidence-')) throw new Error('Unsafe cleanup');
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
