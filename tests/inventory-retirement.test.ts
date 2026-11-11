import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { WORKSPACE_GROUPS, WORKSPACE_LINKS } from '@/lib/workspace-navigation';
import { retiredFeatureResponse } from '@/lib/retired-feature';
import { RetiredFeature } from '@/components/retired-feature';
import { assertRetainedDataset } from '@/lib/inventory-schema.mjs';
import { auditSampleEvidence, auditSampleHistory } from '../scripts/sample-evidence.mjs';

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());
it('contains only retained workspace sections and destinations', () => {
  expect(WORKSPACE_GROUPS.map(group => group.label)).toEqual(['Governance', 'Discovery']);
  expect(WORKSPACE_LINKS).toEqual([]);
  expect(WORKSPACE_GROUPS.flatMap(group => group.items).filter(item => item.sidebar !== false).map(item => item.label)).toEqual([
    'Installed Software Insights', 'End Point Insights', 'Security Vulnerability Insights',
    'End Point Explorer', 'Installed Software Explorer', 'Security Vulnerability Explorer', 'Shadow IT Explorer', 'Topology Explorer'
  ]);
});
it('keeps retirement responses uncached and links back with the selected scope, domain and date', async () => {
  const response = retiredFeatureResponse();
  expect(response.status).toBe(410); expect(response.headers.get('Cache-Control')).toBe('no-store');
  const html = renderToStaticMarkup(React.createElement(RetiredFeature, { pathname: '/findings', searchParams: { system: 'sys-1', securityDomain: 'SECRET', dataDate: '2026-10-31' } }));
  expect(html).toContain('retired'); expect(html).toContain('system=sys-1'); expect(html).toContain('securityDomain=SECRET'); expect(html).toContain('dataDate=2026-10-31');
});
it('retires old APIs before any provider or document operation', async () => {
  const walk = (root: string): string[] => fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(root, entry.name)) : [path.join(root, entry.name)]);
  const routes = walk('app/api').filter(file => file.endsWith('route.ts') && fs.readFileSync(file, 'utf8').includes('retiredFeatureResponse'));
  expect(routes.length).toBeGreaterThan(25);
  for (const route of routes) {
    const source = fs.readFileSync(route, 'utf8');
    expect(source).not.toMatch(/data-loader|sql-server|documents\//);
    const handlers = await import('../' + route.replaceAll('\\', '/'));
    for (const method of ['GET','POST','PUT','PATCH','DELETE']) if (typeof handlers[method] === 'function') expect((await handlers[method]()).status, route + ' ' + method).toBe(410);
  }
});
it('keeps eight complete weekly snapshots with applicable evidence and no retired payloads', () => {
  const datasets = fs.readdirSync('data/snapshots').filter(name => /^week-\d+\.json$/.test(name)).sort().map(name => JSON.parse(fs.readFileSync(path.join('data/snapshots', name), 'utf8')));
  expect(datasets).toHaveLength(8); expect(auditSampleHistory(datasets).errors).toEqual([]);
  for (const dataset of datasets) { expect(() => assertRetainedDataset(dataset)).not.toThrow(); expect(auditSampleEvidence(dataset).errors).toEqual([]); }
  expect(JSON.parse(fs.readFileSync('data/current.json','utf8'))).toEqual(datasets.at(-1));
});
