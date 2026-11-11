import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as sql from '../lib/sql-data-loader';
import * as json from '../lib/json-store/data-loader';
import { resolveAppDatabaseName } from '../lib/sql-server';
import { buildInstalledSoftwareInsights } from '../lib/installed-software-insights';

/** Representation-only normalization: absent optional values, object/row order and UTC formatting. */
export function parityValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const key = (item: unknown) => {
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        if (row.id !== undefined) return String(row.id);
        if (row.assetId !== undefined) return JSON.stringify([row.assetId, row.softwareOrdinal, row.vulnerabilityId, row.cve]);
        if (row.name !== undefined) return JSON.stringify([row.name, row.version]);
      }
      return JSON.stringify(item);
    };
    return value.map(parityValue).sort((a, b) => key(a).localeCompare(key(b)));
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, parityValue(item)]));
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return value;
}
function firstDifference(a: unknown, b: unknown, prefix = ''): string | undefined {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const difference = firstDifference(left[key], right[key], prefix + '.' + key);
      if (difference) return difference;
    }
  }
  return `${prefix}: SQL=${JSON.stringify(a)?.slice(0, 180)} JSON=${JSON.stringify(b)?.slice(0, 180)}`;
}
export async function checkEvidenceParity() {
  const database = process.env.TSAAT_EVIDENCE_PARITY_DATABASE;
  if (!database || !/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/.test(database)) throw new Error('Select an explicitly disposable TSAAT_EvidenceParity_* database using TSAAT_EVIDENCE_PARITY_DATABASE.');
  process.env.TSAAT_APP_DATABASE = database;
  const target = process.env.TSAAT_JSON_DATA_DIR;
  if (!target || !path.isAbsolute(target)) throw new Error('Select an isolated absolute TSAAT_JSON_DATA_DIR.');
  assert.equal(await resolveAppDatabaseName(), database);
  execFileSync(process.execPath, ['scripts/setup-json-store.mjs'], { stdio: 'inherit', windowsHide: true });
  const manifest = JSON.parse(await fs.readFile(path.join(target, 'store.json'), 'utf8'));
  const failures: string[] = [];
  const compare = (label: string, left: unknown, right: unknown) => {
    const difference = firstDifference(parityValue(left), parityValue(right));
    if (difference) failures.push(`${label}${difference}`);
  };
  compare('Discovery settings', await sql.loadDiscoveryToolsSettings(), await json.loadDiscoveryToolsSettings());
  for (const { date } of manifest.snapshots) {
    const [left, right] = await Promise.all([sql.loadDatasetForDate(date, { profile: 'full' }), json.loadDatasetForDate(date, { profile: 'full' })]);
    for (const key of ['assets', 'managedNetworks', 'ictSystems', 'ciDependencies', 'discoveryCoverageEvaluations'] as const) compare(`${date} ${key}`, left[key], right[key]);
    for (const scope of [{ network: 'net-1' }, { system: 'sys-1' }, { network: 'net-1', securityDomain: 'UNKNOWN' }, { network: 'net-1', securityDomain: 'NONE' }]) {
      const params = { ...scope, dataDate: date };
      for (const operation of ['loadEndpointExplorerData', 'loadInstalledSoftwareExplorerData', 'loadSecurityVulnerabilityExplorerData', 'loadShadowItExplorerData'] as const) {
        const [sqlRows, jsonRows] = await Promise.all([sql[operation](params), json[operation](params)]).catch(async error => {
          await fs.writeFile('.local/evidence-parity-results.json', JSON.stringify({ database, failures }, null, 2));
          throw new Error(`${date} ${JSON.stringify(scope)} ${operation}: ${error.message}`);
        });
        compare(`${date} ${JSON.stringify(scope)} ${operation}`, sqlRows, jsonRows);
        if (operation === 'loadInstalledSoftwareExplorerData') {
          const a = await sql.loadInstalledSoftwareExplorerData(params), b = await json.loadInstalledSoftwareExplorerData(params);
          compare(`${date} software insights`, buildInstalledSoftwareInsights(a.rows, a.snapshotDate), buildInstalledSoftwareInsights(b.rows, b.snapshotDate));
        }
      }
    }
    console.log(`Compared ${date}: ${left.assets.length} SQL / ${right.assets.length} JSON assets; ${failures.length} differences so far.`);
  }
  await fs.mkdir('.local', { recursive: true });
  await fs.writeFile('.local/evidence-parity-results.json', JSON.stringify({ database, snapshots: manifest.snapshots.map((entry: { date: string }) => entry.date), failures }, null, 2));
  if (failures.length) throw new Error(`${failures.length} parity differences:\n${failures.slice(0, 25).join('\n')}`);
  console.log('SQL/JSON evidence parity passed across all weekly snapshots and selected scopes.');
}
