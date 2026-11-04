import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assessChanges, collectChanges, parseChanges, validationCommands } from '../scripts/change-impact.mjs';

const assess = (...files) => assessChanges(files.map(file => ({ file, status: 'M' })));
test('presentation edits do not schedule documentation, storage, builds or the entire test suite', () => {
  const plan = assess('app/globals.css', 'components/panel.tsx');
  assert.equal(plan.source, true);
  for (const key of ['docs', 'data', 'build', 'full']) assert.equal(plan[key], false, key);
  const commands = validationCommands(plan);
  assert.ok(commands.some(args => args.includes('lint')));
  assert.ok(commands.some(args => args.includes('related')));
  assert.ok(!commands.some(args => args.includes('scripts/docs-maintenance.mjs') || args.includes('scripts/check-data-providers.mjs')));
  assert.ok(!commands.some(args => args[0].includes('vitest') && args[1] === 'run'));
});
test('documentation-only changes need no installation, builds or provider checks', () => {
  const plan = assess('docs/sdlc.md', 'AGENTS.md', 'Database Schema/ERD.md');
  assert.equal(plan.docs, true);
  for (const key of ['install', 'source', 'data', 'build', 'full', 'tooling']) assert.equal(plan[key], false, key);
  assert.deepEqual(validationCommands(plan), [['scripts/repository-check.mjs'], ['scripts/docs-maintenance.mjs', '--check']]);
});
test('SQL, JSON, calculation and persistence changes expand provider validation', () => {
  for (const file of ['Database Schema/migrations/031_example.sql', 'NoSQL/reference.json', 'lib/json-store/store.ts', 'lib/sql-data-loader.ts', 'lib/types.ts', 'lib/spi-evaluation.ts', 'lib/measures-settings.ts', 'scripts/populate-json-store.mjs']) {
    const plan = assess(file);
    assert.equal(plan.data, true, file);
    assert.equal(plan.build, true, file);
    assert.ok(validationCommands(plan).some(args => args.includes('scripts/check-data-providers.mjs')));
  }
});
test('dependency/build changes, deletions, unknown files and manual overrides select broad validation', () => {
  for (const file of ['package-lock.json', 'vendor/npm/package.tgz', 'next.config.mjs', 'unclassified.config']) assert.equal(assess(file).full, true, file);
  assert.equal(assessChanges([{ file: 'lib/old.ts', status: 'D' }]).full, true);
  assert.equal(assessChanges([], { full: true }).full, true);
  assert.equal(assessChanges([], { data: true }).build, true);
  assert.equal(assessChanges([], { docs: true }).docs, true);
});
test('new routes and navigation affect inventories; changed tests run explicitly', () => {
  assert.equal(assessChanges([{ file: 'app/new/page.tsx', status: 'A' }]).docs, true);
  assert.equal(assess('lib/workspace-navigation.ts').docs, true);
  const plan = assess('tests/explorer-table.test.ts');
  assert.deepEqual(plan.tests, ['tests/explorer-table.test.ts']);
  assert.deepEqual(validationCommands(plan).at(-1), ['node_modules/vitest/vitest.mjs', 'run', 'tests/explorer-table.test.ts']);
});
test('tooling changes run Node regression tests without provider or build gates', () => {
  const plan = assess('scripts/change-impact.mjs', '.github/workflows/ci.yml');
  assert.equal(plan.tooling, true);
  assert.equal(plan.full, false);
  assert.equal(plan.data, false);
  assert.ok(validationCommands(plan).some(args => args.includes('tests/change-impact.test.mjs')));
});
test('Git paths with spaces, deletions, renames, local edits and untracked files are retained', () => {
  assert.deepEqual(parseChanges('M\0Database Schema/example.sql\0D\0lib/old.ts\0'), [{ status: 'M', file: 'Database Schema/example.sql' }, { status: 'D', file: 'lib/old.ts' }]);
  assert.throws(() => parseChanges('M\0'), /Invalid/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaat-impact-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  try {
    git(['init', '--quiet']);
    fs.writeFileSync(path.join(root, 'old name.ts'), 'old');
    git(['add', '.']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
    const base = git(['rev-parse', 'HEAD']).trim();
    fs.renameSync(path.join(root, 'old name.ts'), path.join(root, 'new name.ts'));
    git(['add', '.']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'rename']);
    assert.deepEqual(collectChanges(root, base, 'HEAD'), [{ status: 'A', file: 'new name.ts' }, { status: 'D', file: 'old name.ts' }]);
    fs.writeFileSync(path.join(root, 'new name.ts'), 'changed');
    fs.writeFileSync(path.join(root, 'untracked.ts'), 'new');
    assert.deepEqual(collectChanges(root), [{ status: 'M', file: 'new name.ts' }, { status: 'A', file: 'untracked.ts' }]);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(root).startsWith('tsaat-impact-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI emits selective CI outputs and falls back to full validation when its base is unavailable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaat-impact-cli-'));
  const script = path.resolve('scripts/change-impact.mjs');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  try {
    git(['init', '--quiet']);
    git(['config', 'core.autocrlf', 'false']);
    fs.writeFileSync(path.join(root, 'README.md'), '# Before');
    git(['add', '.']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'before']);
    const base = git(['rev-parse', 'HEAD']).trim();
    fs.writeFileSync(path.join(root, 'README.md'), '# After');
    git(['add', '.']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'after']);
    const output = path.join(root, 'ci-output');
    const env = { ...process.env, CI: 'true', GITHUB_OUTPUT: output, IMPACT_FULL: 'false', IMPACT_DATA: 'false', IMPACT_DOCS: 'false' };
    execFileSync(process.execPath, [script, '--base', base], { cwd: root, env, encoding: 'utf8', windowsHide: true });
    const result = fs.readFileSync(output, 'utf8');
    assert.match(result, /^docs=true$/m);
    for (const key of ['full', 'data', 'source', 'tooling', 'build', 'install']) assert.match(result, new RegExp('^' + key + '=false$', 'm'));
    const fallback = path.join(root, 'fallback-output');
    execFileSync(process.execPath, [script, '--base', 'missing-reference'], { cwd: root, env: { ...env, GITHUB_OUTPUT: fallback }, encoding: 'utf8', stdio: 'pipe', windowsHide: true });
    assert.match(fs.readFileSync(fallback, 'utf8'), /^full=true$/m);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(root).startsWith('tsaat-impact-cli-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
