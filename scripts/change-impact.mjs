import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const documentation = file => /(?:^|\/)[^/]+\.(?:md|txt|dotx)$/i.test(file) || /^docs\//.test(file);
const dependencies = /^(?:package(?:-lock)?\.json|vendor\/|\.npmrc$|\.node-version$|next\.config\.mjs$|tsconfig\.json$|vitest\.config\.ts$|tailwind\.config\.ts$|postcss\.config\.js$|\.eslintrc\.json$|eslint\.config\.mjs$|(?:compileApp|install-offline|tsaat-npm)\.cmd$|scripts\/(?:lint\.mjs|run-app\.mjs|offline-[^/]+|ci-offline\.ps1)$)/;
const data = /^(?:Database Schema\/|NoSQL\/|data\/|lib\/(?:json-store\/|sql-|data-loader\.|cmdb-attribute-loader\.|cmdb-attributes\.|cmdb-model-ci\.|cmdb-ci-types\.|types\.|inventory-schema\.|inventory-context(?:-data)?\.|retired-capabilities\.|app-data|analytics|selectors\.|rollup\.|spi-|kpi-|measures(?:\.|-settings\.|-summary\.|-trends(?:-data)?\.)|topology-explorer(?:-data)?\.|asset-taxonomy\.|security-domain\.|network-scope\.|discovery-(?:coverage|filter-scope|tools-settings)\.|scoped-discovery-tool-coverage\.|.*-settings\.|patch-management-explorer\.|security-vulnerability-explorer\.)|scripts\/(?:setup-json|populate-|enrich-|migrate-|sql-export-|sample-evidence|prepare-sample-evidence|append-sample-evidence|check-evidence-parity|check-sample-evidence|generate-seed|validate-seed|nosql-coverage|check-data-providers|bootstrap-demo|stage-db-|ensure-db-|emit-db-)|(?:CreateDB|buildDatabase)\.cmd$)/;
const runtime = /^(?:app\/|components\/|lib\/|public\/|middleware\.ts$)/;
const sourceTest = /^tests\/.*\.(?:ts|tsx)$/;
const tooling = /^(?:scripts\/|\.github\/|tests\/.*\.mjs$)/;
const inventory = file => file === 'lib/workspace-navigation.ts' || file === 'package.json' || file === 'Database Schema/database-schema.sql' || /^Database Schema\/migrations\/.*\.sql$/.test(file) || file === 'Database Schema/data/database-build-manifest.json' || file === 'Database Schema/retired-storage-v2.json';

// Paths provide a conservative starting point. Reviewers assess semantics and can
// broaden the plan; matching an area does not require meaningless documentation edits.
export function assessChanges(changes, options = {}) {
  const plan = { full: !!options.full, data: !!options.data, docs: !!options.docs, source: false, tooling: false, files: [], related: [], tests: [], reasons: [] };
  if (plan.full) plan.reasons.push('Explicit full validation or unavailable comparison base.');
  if (plan.data) plan.reasons.push('Explicit data-impact assessment.');
  if (plan.docs) plan.reasons.push('Explicit documentation-impact assessment.');
  for (const { file, status = 'M' } of changes) {
    plan.files.push(file);
    if (documentation(file)) { plan.docs = true; continue; }
    if (dependencies.test(file)) { plan.full = true; plan.reasons.push('Installation/build contract: ' + file); }
    if (data.test(file)) { plan.data = true; plan.reasons.push('Data/rule contract: ' + file); }
    if (inventory(file) || (/^app\/(?:.*\/)?(?:page\.tsx|route\.ts)$/.test(file) && status !== 'M')) plan.docs = true;
    if (runtime.test(file) || sourceTest.test(file) || /^scripts\/.*\.(?:ts|mts)$/.test(file)) {
      plan.source = true;
      if (status === 'D') { plan.full = true; plan.reasons.push('Deleted source needs broader regression coverage: ' + file); }
      else if (/\.test\.ts$/.test(file)) plan.tests.push(file);
      else if (/\.(?:tsx?|mts|mjs|cjs|jsx?)$/.test(file)) plan.related.push(file);
    } else if (tooling.test(file)) {
      plan.tooling = true;
      if (status !== 'D' && /\.(?:mjs|cjs|ps1)$/.test(file)) plan.related.push(file);
    } else if (!data.test(file) && !dependencies.test(file) && !/^\.git(?:ignore|attributes)$/.test(file)) {
      plan.full = true; plan.reasons.push('Unclassified change requires full validation: ' + file);
    }
  }
  plan.related = [...new Set(plan.related)].sort();
  plan.tests = [...new Set(plan.tests)].sort();
  plan.build = plan.full || plan.data;
  plan.install = plan.full || plan.data || plan.source || plan.related.length > 0;
  return plan;
}

export function parseChanges(output) {
  const entries = output.split('\0').filter(Boolean);
  if (entries.length % 2) throw new Error('Invalid Git name/status output.');
  return Array.from({ length: entries.length / 2 }, (_, i) => ({ status: entries[i * 2], file: entries[i * 2 + 1] }));
}

export function validationCommands(plan) {
  const commands = [['scripts/repository-check.mjs']];
  if (plan.docs) commands.push(['scripts/docs-maintenance.mjs', '--check']);
  if (plan.tooling) commands.push(['--test', 'tests/change-impact.test.mjs', 'tests/documentation-maintenance.test.mjs', 'tests/runtime-reachability.test.mjs', 'tests/offline-build.test.mjs']);
  if (plan.source || plan.data) {
    commands.push(['scripts/lint.mjs'], ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']);
  }
  if (plan.data) {
    commands.push(['scripts/check-data-providers.mjs'], ['node_modules/vitest/vitest.mjs', 'run']);
  } else {
    if (plan.tests.length) commands.push(['node_modules/vitest/vitest.mjs', 'run', ...plan.tests]);
    if (plan.related.length) commands.push(['node_modules/vitest/vitest.mjs', 'related', '--run', '--passWithNoTests', ...plan.related]);
  }
  return commands;
}

export function collectChanges(root, base, head) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (base) return parseChanges(git(['diff', '--no-renames', '--name-status', '-z', base + '..' + (head || 'HEAD'), '--']));
  const changed = parseChanges(git(['diff', '--no-renames', '--name-status', '-z', 'HEAD', '--']));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).map(file => ({ status: 'A', file }));
  return [...changed, ...untracked];
}

function main() {
  const args = process.argv.slice(2);
  const value = flag => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Missing value for ' + flag);
    return args[i + 1];
  };
  const root = process.cwd();
  const base = value('--base') || process.env.IMPACT_BASE;
  const options = {
    full: args.includes('--full') || process.env.IMPACT_FULL === 'true',
    data: args.includes('--data') || process.env.IMPACT_DATA === 'true',
    docs: args.includes('--docs') || process.env.IMPACT_DOCS === 'true'
  };
  let changes;
  try {
    if (process.env.CI && (!base || /^0+$/.test(base))) throw new Error('No CI comparison base.');
    changes = collectChanges(root, base, value('--head'));
  } catch (error) {
    console.warn('Using full validation: ' + error.message);
    changes = []; options.full = true;
  }
  const plan = assessChanges(changes, options);
  console.log(JSON.stringify(plan, null, 2));
  console.log('Review semantic impacts and dynamic/file-reading tests; use --data, --docs or --full to broaden this plan.');
  if (process.env.GITHUB_OUTPUT && !args.includes('--run')) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, ['full', 'data', 'docs', 'source', 'tooling', 'build', 'install'].map(key => key + '=' + plan[key]).join('\n') + '\n');
  }
  if (!args.includes('--run')) return;
  if (plan.full) throw new Error('Full validation selected: use the offline release gate in docs/sdlc.md (CI uses scripts/ci-offline.ps1).');
  for (const command of validationCommands(plan)) {
    console.log('Running: node ' + command.join(' '));
    const result = spawnSync(process.execPath, command, { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status || 1; return; }
  }
  if (plan.build) console.log('Data impact also requires npm run build:all and npm run test:nosql; record relevant disposable-SQL parity separately.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
