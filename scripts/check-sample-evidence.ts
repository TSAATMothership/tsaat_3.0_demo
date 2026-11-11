import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { SAMPLE_EVIDENCE_PROFILE, auditSampleEvidence, auditSampleHistory } from './sample-evidence.mjs';
import type { Dataset } from '../lib/types';

async function main() {
  const root = path.resolve('.'), references = path.join(root, 'Database Schema/data');
  const manifest = JSON.parse((await fs.readFile(path.join(references, 'database-build-manifest.json'), 'utf8')).replace(/^\uFEFF/, ''));
  const files = (await fs.readdir(path.join(root, 'data/snapshots'))).filter(name => /^week-\d+\.json$/.test(name)).sort();
  assert.deepEqual([...manifest.snapshotFiles].sort(), files, 'SQL manifest and JSON snapshot catalogue must match');
  const datasets: Dataset[] = [];
  for (const file of manifest.snapshotFiles) {
    const dataset = JSON.parse(await fs.readFile(path.join(root, 'data/snapshots', file), 'utf8'));
    assert.equal(dataset.sampleDataProfile, SAMPLE_EVIDENCE_PROFILE, file + ': canonical evidence profile');
    const audit = auditSampleEvidence(dataset);
    assert.deepEqual(audit.errors, [], file + ': applicable attributes and dates');
    datasets.push(dataset);
  }
  const history = auditSampleHistory(datasets);
  assert.deepEqual(history.errors, [], 'At least four complete weeks of evidence');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'data/current.json'), 'utf8')), datasets.at(-1), 'Current dataset must equal latest SQL/JSON snapshot');
  console.log(`Shared SQL/JSON evidence verified: ${datasets.length} weekly snapshots, ${history.dates[0]} to ${history.dates.at(-1)}, complete applicable fields, retained relationships and observation dates.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
