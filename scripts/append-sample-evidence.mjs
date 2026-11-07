import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { populateJsonStore } from './populate-json-store.mjs';
import { repositoryRoot } from './setup-json-store.mjs';
import { SAMPLE_EVIDENCE_PROFILE, auditSampleEvidence, auditSampleHistory } from './sample-evidence.mjs';

/** Append reviewed sample history; existing dates, references and settings are immutable. */
export async function appendSampleEvidence({ target = process.env.TSAAT_JSON_DATA_DIR || path.join(repositoryRoot, 'NoSQL/data'), apply = false, demo = false, catalogue, backupDirectory } = {}) {
  const manifest = JSON.parse(await fs.readFile(path.join(target, 'store.json'), 'utf8'));
  const names = (await fs.readdir(path.join(repositoryRoot, 'data/snapshots'))).filter(name => /^week-\d+\.json$/.test(name)).sort();
  let nextId = Math.max(...manifest.snapshots.map(entry => entry.id));
  const datasets = [];
  for (const name of names) {
    const dataset = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'data/snapshots', name), 'utf8'));
    if (dataset.sampleDataProfile !== SAMPLE_EVIDENCE_PROFILE) throw new Error('Unreviewed sample evidence profile.');
    const audit = auditSampleEvidence(dataset);
    if (audit.errors.length) throw new Error(audit.errors.join('\n'));
    const existing = manifest.snapshots.find(entry => entry.date === dataset.snapshotDate);
    const sqlEntry = catalogue?.find(entry => entry.date === dataset.snapshotDate);
    if (catalogue && !sqlEntry) throw new Error('SQL catalogue is missing sample date ' + dataset.snapshotDate);
    if (existing && sqlEntry && existing.id !== sqlEntry.id) throw new Error('SQL/JSON snapshot identity mismatch.');
    dataset.snapshotId = existing?.id ?? sqlEntry?.id ?? ++nextId;
    datasets.push(dataset);
  }
  const history = auditSampleHistory(datasets);
  if (history.errors.length) throw new Error(history.errors.join('\n'));
  return populateJsonStore({ target, apply, demo, appendDatasets: datasets, transformDataset: dataset => dataset, profile: SAMPLE_EVIDENCE_PROFILE, backupDirectory });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
  const cataloguePath = value('--sql-catalogue');
  const catalogue = cataloguePath ? JSON.parse(await fs.readFile(cataloguePath, 'utf8')).snapshots : undefined;
  appendSampleEvidence({ target: value('--target'), apply: process.argv.includes('--apply'), demo: process.argv.includes('--demo'), catalogue })
    .then(({ directory, applied, changedSnapshots, backupDirectory }) => console.log(JSON.stringify({ directory, applied, changedSnapshots, backupDirectory }, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
