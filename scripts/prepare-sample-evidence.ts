import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeSampleEvidence, redateSampleDataset, auditSampleEvidence, auditSampleHistory } from './sample-evidence.mjs';
import { enrichCoverage, auditCoverage, loadCoverageConfiguration } from './nosql-coverage';
import type { Dataset } from '../lib/types';

export async function prepareSampleEvidence({ root = path.resolve('.'), asOf, apply = false }: { root?: string; asOf?: string; apply?: boolean } = {}) {
  const directory = path.join(root, 'data/snapshots');
  const names = (await fs.readdir(directory)).filter(name => /^week-\d+\.json$/.test(name)).sort();
  const inputs: Dataset[] = await Promise.all(names.map(async name => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'))));
  const latest = inputs.at(-1)!.snapshotDate;
  const target = asOf ?? latest;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target) || new Date(target).toISOString().slice(0, 10) !== target) throw new Error('Use a valid --as-of YYYY-MM-DD.');
  const shift = (Date.parse(target) - Date.parse(latest)) / 86400000;
  const references = path.join(root, 'Database Schema/data');
  const configuration = await loadCoverageConfiguration(root, { references, settings: references });
  const outputs = inputs.map(input => enrichCoverage(completeSampleEvidence(redateSampleDataset(input, shift)), configuration));
  const history = auditSampleHistory(outputs);
  const audits = outputs.map(dataset => ({ ...auditSampleEvidence(dataset), uncovered: auditCoverage(dataset, configuration).uncovered.length }));
  const errors = [...history.errors, ...audits.flatMap(audit => audit.errors), ...audits.filter(audit => audit.uncovered).map(audit => `${audit.date}: uncovered findings`)];
  if (errors.length) throw new Error(errors.slice(0, 25).join('\n') + `\n${errors.length} total evidence failures`);
  if (apply) {
    for (const [index, name] of names.entries()) await fs.writeFile(path.join(directory, name), JSON.stringify(outputs[index], null, 2) + '\n');
    await fs.writeFile(path.join(root, 'data/current.json'), JSON.stringify(outputs.at(-1), null, 2) + '\n');
  }
  return { applied: apply, history, snapshots: audits.map(({ date, assets, knownEndpoints, shadowNodes, installations, findings, vulnerabilities, uncovered }) => ({ date, assets, knownEndpoints, shadowNodes, installations, findings, vulnerabilities, uncovered })) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--as-of');
  prepareSampleEvidence({ asOf: at < 0 ? undefined : process.argv[at + 1], apply: process.argv.includes('--apply') })
    .then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
