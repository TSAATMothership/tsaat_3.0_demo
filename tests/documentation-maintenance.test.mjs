import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { databaseCatalogue, documentationImpact, brokenLocalLinks, sourceSnapshot } from '../scripts/docs-maintenance.mjs';

test('SQL inventory captures columns and composite foreign-key constraints', () => {
  const output = databaseCatalogue('CREATE TABLE [tsaat].[child] (\n  [id] BIGINT NOT NULL,\n  [snapshot_id] BIGINT NOT NULL,\n  CONSTRAINT [FK_child] FOREIGN KEY ([id], [snapshot_id])\n  REFERENCES [tsaat].[parent] ([id], [snapshot_id])\n);', [{ name: '001_first.sql', sha256: 'abc' }]);
  assert.match(output, /1 tables/); assert.match(output, /snapshot_id/); assert.match(output, /FK_child/); assert.match(output, /REFERENCES/); assert.match(output, /001_first.sql/);
});
test('documentation mapping identifies review suggestions independently of generated files', () => {
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

test('documentation checks accept implementation-only drift but still reject changed inventories and broken links', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaat-docs-policy-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const script = path.resolve('scripts/docs-maintenance.mjs');
  const run = (flag, base = '') => spawnSync(process.execPath, [script, flag], { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, DOCS_BASE_REF: base } });
  try {
    write('package.json', JSON.stringify({ dependencies: {}, devDependencies: {} }));
    write('lib/workspace-navigation.ts', '{ label: "Overview", href: "/overview" }');
    write('app/overview/page.tsx', 'export default function Page() { return null; }');
    write('Database Schema/database-schema.sql', '');
    fs.mkdirSync(path.join(root, 'Database Schema/migrations'), { recursive: true });
    write('Database Schema/data/database-build-manifest.json', JSON.stringify({ storageSchemaVersion: 2, snapshotFiles: [], packageDataFiles: {} }));
    write('Database Schema/ERD.md', '# ERD');
    write('docs/database.md', '# Database');
    write('docs/maintenance.json', JSON.stringify({ areas: [], fallbackDocuments: [] }));
    assert.equal(run('--write').status, 0);
    write('lib/workspace-navigation.ts', '{ id: "overview", label: "Overview", href: "/overview" }');
    assert.equal(run('--check').status, 0, 'Stable persona IDs must retain navigation inventory entries');
    write('lib/workspace-navigation.ts', '{ id: "overview", label: "Overview", href: "/overview", sidebar: true }\n{ id: "bookmark", label: "Bookmark only", href: "/legacy", sidebar: false }');
    assert.equal(run('--check').status, 0, 'Bookmark-only entries must not appear in the visible navigation inventory');
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    git(['init', '--quiet']);
    git(['add', '.']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'documentation baseline']);
    const base = git(['rev-parse', 'HEAD']).trim();
    write('app/overview/page.tsx', 'export default function Page() { return "new presentation"; }');
    git(['add', '.']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'presentation only']);
    const unchangedInventory = run('--check', base);
    assert.equal(unchangedInventory.status, 0, unchangedInventory.stderr);
    assert.match(unchangedInventory.stdout, /Review documentation impact/);
    write('lib/workspace-navigation.ts', '{ label: "Changed title", href: "/overview" }');
    const changedInventory = run('--check');
    assert.equal(changedInventory.status, 1);
    assert.match(changedInventory.stderr, /Stale docs\/generated\/application-inventory.md/);
    assert.equal(run('--write').status, 0);
    write('docs/broken.md', '[Missing](missing.md)');
    const broken = run('--check');
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /Broken local link/);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(root).startsWith('tsaat-docs-policy-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
