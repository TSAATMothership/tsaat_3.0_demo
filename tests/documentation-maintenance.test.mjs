import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { databaseCatalogue, documentationImpact, brokenLocalLinks, sourceSnapshot } from '../scripts/docs-maintenance.mjs';

test('SQL inventory captures columns and composite foreign-key constraints', () => {
  const output = databaseCatalogue('CREATE TABLE [tsaat].[child] (\n  [id] BIGINT NOT NULL,\n  [snapshot_id] BIGINT NOT NULL,\n  CONSTRAINT [FK_child] FOREIGN KEY ([id], [snapshot_id])\n  REFERENCES [tsaat].[parent] ([id], [snapshot_id])\n);', [{ name: '001_first.sql', sha256: 'abc' }]);
  assert.match(output, /1 tables/); assert.match(output, /snapshot_id/); assert.match(output, /FK_child/); assert.match(output, /REFERENCES/); assert.match(output, /001_first.sql/);
});
test('generated documentation alone cannot satisfy a mapped PR update', () => {
  const mapping = { areas: [{ name: 'UI', pattern: '^components/', documents: ['docs/ui.md'] }], fallbackDocuments: ['docs/architecture.md'] };
  assert.deepEqual(documentationImpact(['components/panel.tsx', 'docs/source-baseline.json'], mapping, new Set(['components/panel.tsx'])), ['UI']);
  assert.deepEqual(documentationImpact(['components/panel.tsx', 'docs/ui.md'], mapping, new Set(['components/panel.tsx'])), []);
  assert.deepEqual(documentationImpact(['lib/other.ts'], mapping, new Set(['lib/other.ts'])), ['Other source changes']);
});
test('source fingerprints ignore platform line endings but detect content changes; link checks decode spaces', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaat-docs-check-'));
  try {
    fs.mkdirSync(path.join(root, 'app')); fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'app/page.tsx'), 'first\r\n');
    fs.mkdirSync(path.join(root, "scripts"));
    fs.writeFileSync(path.join(root, "scripts/setup-json-store.d.mts"), "export function initializeJsonStore(): Promise<void>;\r\n");
    const first = sourceSnapshot(root);
    fs.writeFileSync(path.join(root, "scripts/setup-json-store.d.mts"), "export function initializeJsonStore(): Promise<void>;\n");
    assert.deepEqual(sourceSnapshot(root), first);
    fs.writeFileSync(path.join(root, 'app/page.tsx'), 'first\n'); assert.deepEqual(sourceSnapshot(root), first);
    fs.writeFileSync(path.join(root, 'app/page.tsx'), 'changed\n'); assert.notDeepEqual(sourceSnapshot(root), first);
    fs.writeFileSync(path.join(root, 'docs/with space.md'), '# Target\n');
    fs.writeFileSync(path.join(root, 'docs/index.md'), '[Target](with%20space.md)\n[Missing](missing.md)\n[External](https://example.test)');
    assert.deepEqual(brokenLocalLinks(root, ['docs/index.md']), ['docs/index.md: missing.md']);
  } finally {
    // Only the unique temporary directory created above is removed.
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(root).startsWith('tsaat-docs-check-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
