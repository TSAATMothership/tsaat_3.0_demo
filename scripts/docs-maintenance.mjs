import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const normalize = text => text.replace(/\r\n/g, '\n');
const posix = value => value.split(path.sep).join('/');
const sourceRoots = ['app', 'components', 'lib', 'scripts', 'public', 'data', 'Database Schema', '.github', 'NoSQL'];
const rootFiles = ['package.json', 'package-lock.json', 'middleware.ts', 'next.config.mjs', 'tsconfig.json', 'vitest.config.ts', 'tailwind.config.ts', 'postcss.config.js', '.eslintrc.json', '.npmrc', '.node-version', 'CreateDB.cmd', 'buildDatabase.cmd', 'compileApp.cmd'];
const isSource = name => !/\.(md|txt|dotx)$/i.test(name) && !name.includes('/last-build-summary') && !name.startsWith("NoSQL/data/") && !name.includes(".initializing-");
const read = name => normalize(fs.readFileSync(name, 'utf8'));
const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const link = value => value.split('/').map(encodeURIComponent).join('/');
const cell = value => String(value).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function walk(root, directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const name = posix(path.join(directory, entry.name));
    return entry.isDirectory() ? walk(root, name) : entry.isFile() ? [name] : [];
  }).sort();
}

export function sourceSnapshot(root) {
  const files = [...sourceRoots.flatMap(dir => walk(root, dir)).filter(isSource), ...rootFiles.filter(file => fs.existsSync(path.join(root, file)))].sort();
  return Object.fromEntries(files.map(file => {
    const bytes = fs.readFileSync(path.join(root, file));
    return [file, hash(/\.(tsx?|mts|cts|jsx?|mjs|cjs|json|css|sql|ps1|cmd|yml|yaml|svg)$/.test(file) || rootFiles.includes(file) ? normalize(bytes.toString('utf8')) : bytes)];
  }));
}

export function databaseCatalogue(sql, migrations) {
  const tables = [...normalize(sql).matchAll(/CREATE TABLE\s+\[([^\]]+)\]\.\[([^\]]+)\]\s*\(([\s\S]*?)\n\);/gi)];
  let text = '# Generated database catalogue\n\nGenerated from the base schema and migration inventory. Do not edit by hand. This is source DDL, not an assertion about a deployed database. Read the migration README and database lifecycle before execution.\n\n';
  text += `Base schema declares **${tables.length} tables**. [Schema source](../../Database%20Schema/database-schema.sql) · [Maintained ERD](../../Database%20Schema/ERD.md) · [Database lifecycle](../database.md).\n\n`;
  for (const [, schema, name, body] of tables) {
    text += `## ${schema}.${name}\n\n| Column | Source definition |\n| --- | --- |\n`;
    for (const line of body.split('\n')) {
      const match = line.match(/^\s*\[([^\]]+)\]\s+(.+?)(?:,)?$/);
      if (match) text += `| ${match[1]} | ${cell(match[2].replace(/,$/, ''))} |\n`;
    }
    const constraints = body.split('\n').map(line => line.trim()).filter(line => /^CONSTRAINT|^PRIMARY KEY|^FOREIGN KEY|^REFERENCES|^UNIQUE|^CHECK/.test(line));
    if (constraints.length) text += '\nDeclared constraints:\n\n```sql\n' + constraints.join('\n') + '\n```\n';
    text += '\n';
  }
  const routines = [...sql.matchAll(/CREATE(?: OR ALTER)?\s+(PROCEDURE|FUNCTION|VIEW)\s+\[([^\]]+)\]\.\[([^\]]+)\]/gi)].map(match => `${match[1].toUpperCase()} ${match[2]}.${match[3]}`);
  text += '## Routines\n\n' + [...new Set(routines)].sort().map(name => `- ${name}`).join('\n') + '\n\n';
  text += '## Ordered migrations\n\nApply approved missing upgrades only; 026 contains demonstration metadata.\n\n| Migration | SHA-256 |\n| --- | --- |\n';
  for (const { name, sha256 } of migrations) text += `| [${name}](${link('../../Database Schema/migrations/' + name)}) | ${sha256} |\n`;
  return text;
}

function applicationInventory(root) {
  const pkg = JSON.parse(read(path.join(root, 'package.json')));
  let text = '# Generated application inventory\n\nGenerated from routes, navigation, package metadata and SQL reference JSON. Do not edit by hand. A route can exist for compatibility without appearing in navigation.\n\n## Visible navigation\n\n| Item | Route | Scope restriction |\n| --- | --- | --- |\n';
  const nav = read(path.join(root, 'lib/workspace-navigation.ts'));
  for (const match of nav.matchAll(/\{ label: "([^"]+)", href: "([^"]+)"(?:, scope: "([^"]+)")? \}/g)) text += `| ${match[1]} | \`${match[2]}\` | ${match[3] ?? 'Both scope types'} |\n`;
  text += '\n## Pages and APIs\n\n| Route | Kind / HTTP methods | Source |\n| --- | --- | --- |\n';
  for (const file of walk(root, 'app').filter(file => /\/(page\.tsx|route\.ts)$/.test(file))) {
    const route = '/' + file.replace(/^app\//, '').replace(/\/(page\.tsx|route\.ts)$/, '').replace(/^(page\.tsx|route\.ts)$/, '');
    const source = read(path.join(root, file));
    const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)].map(match => match[1]);
    text += `| \`${route}\` | ${file.endsWith('page.tsx') ? 'Page' : methods.join(', ') || 'API'} | [Source](${link('../../' + file)}) |\n`;
  }
  text += '\n## Locked package baseline\n\nInstalled versions are resolved by package-lock.json; this table lists declared requirements.\n\n| Package | Requirement | Use |\n| --- | --- | --- |\n';
  for (const [kind, packages] of [['Runtime', pkg.dependencies], ['Development', pkg.devDependencies]]) for (const [name, version] of Object.entries(packages).sort()) text += `| ${name} | ${version} | ${kind} |\n`;
  const definitions = JSON.parse(read(path.join(root, 'Database Schema/data/kpi-definitions.json')));
  const kpis = Array.isArray(definitions) ? definitions : definitions.kpis ?? definitions.definitions ?? [];
  text += '\n## KPI seed catalogue\n\nDeployed SQL configuration is authoritative; these are repository seed defaults.\n\n| ID | Name | Calculation |\n| --- | --- | --- |\n';
  for (const row of kpis) text += `| ${row.id ?? row.kpiId} | ${cell(row.name)} | ${row.calculationKey} |\n`;
  return text;
}

export function documentationImpact(changed, mapping, sourceFiles) {
  const touched = changed.filter(file => sourceFiles.has(file));
  const required = new Map();
  for (const file of touched) {
    const areas = mapping.areas.filter(area => new RegExp(area.pattern).test(file));
    for (const area of areas.length ? areas : [{ name: 'Other source changes', documents: mapping.fallbackDocuments }]) required.set(area.name, area.documents);
  }
  return [...required].filter(([, documents]) => !documents.some(file => changed.includes(file))).map(([name]) => name);
}

export function brokenLocalLinks(root, files) {
  const errors = [];
  for (const file of files) {
    const text = read(path.join(root, file)).replace(/^```[\s\S]*?^```/gm, '');
    for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)]+)\)/g)) {
      let target = match[1].trim().replace(/^<|>$/g, '').split(/\s+"/)[0];
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
      target = decodeURIComponent(target.split('#')[0]);
      if (!target) continue;
      const absolute = target.startsWith('/') ? path.join(root, target) : path.resolve(root, path.dirname(file), target);
      if (!fs.existsSync(absolute)) errors.push(`${file}: ${target}`);
    }
  }
  return errors;
}

function main() {
  const root = process.cwd();
  const writing = process.argv.includes('--write');
  const snapshot = sourceSnapshot(root);
  const migrationDir = path.join(root, 'Database Schema/migrations');
  const migrations = fs.readdirSync(migrationDir).filter(file => file.endsWith('.sql')).sort().map(name => ({ name, sha256: hash(read(path.join(migrationDir, name))) }));
  const generated = {
    'docs/generated/application-inventory.md': applicationInventory(root),
    'docs/generated/database-catalogue.md': databaseCatalogue(read(path.join(root, 'Database Schema/database-schema.sql')), migrations),
    'docs/source-baseline.json': JSON.stringify({ version: 1, files: snapshot }, null, 2) + '\n'
  };
  const errors = [];
  for (const [file, content] of Object.entries(generated)) {
    const absolute = path.join(root, file);
    if (writing) { fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, content); }
    else if (!fs.existsSync(absolute) || read(absolute) !== content) errors.push(`Stale ${file}: review affected docs, then run npm run docs:generate.`);
  }
  const mapping = JSON.parse(read(path.join(root, 'docs/maintenance.json')));
  for (const file of [...mapping.areas.flatMap(area => area.documents), ...mapping.fallbackDocuments]) if (!fs.existsSync(path.join(root, file))) errors.push(`Missing maintained document: ${file}`);
  const markdown = [...walk(root, 'docs'), ...walk(root, 'Requirements Documentation'), ...walk(root, 'Database Schema'), ...walk(root, '.github'), ...fs.readdirSync(root).filter(file => file.endsWith('.md'))].filter(file => file.endsWith('.md'));
  errors.push(...brokenLocalLinks(root, markdown).map(error => `Broken local link ${error}`));
  const base = process.env.DOCS_BASE_REF?.trim();
  if (!writing && base) {
    const changed = execFileSync('git', ['diff', '--name-only', '-z', `${base}...HEAD`], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    // Include deleted source files as well as current ones.
    const relevant = new Set([...Object.keys(snapshot), ...changed.filter(file => (sourceRoots.some(dir => file.startsWith(dir + '/')) || rootFiles.includes(file)) && isSource(file))]);
    for (const name of documentationImpact(changed, mapping, relevant)) errors.push(`Update human-written documentation for: ${name}`);
  }
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`${writing ? 'Generated' : 'Verified'} inventories, ${Object.keys(snapshot).length} source fingerprints, documentation links${base && !writing ? ' and PR documentation impact' : ''}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
