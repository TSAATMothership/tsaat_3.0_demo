import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runtimeReachability } from './runtime-reachability.mjs';

const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
const errors = [];
for (const file of runtimeReachability().unused) errors.push(`Unreachable runtime module: ${file}. Connect it to an entry point or remove it.`);
for (const file of files) {
  if (/^(?:node_modules|Dependencies|TSAATDemo[^/]*|\.next|\.local|output|tmp|coverage)\//i.test(file) || /^(?:DB_config|logindetails)(?:$|\.)/i.test(file) || /^\.env(?:$|\.)/.test(file) && file !== '.env.example' || /\.(?:log|tsbuildinfo)$/i.test(file)) errors.push(`Excluded artifact is tracked: ${file}`);
  if (fs.existsSync(file) && fs.statSync(file).size > 100 * 1024 * 1024) errors.push(`File exceeds 100 MiB: ${file}`);
}
const migrations = fs.readdirSync('Database Schema/migrations').filter(file => file.endsWith('.sql')).sort();
const numbers = migrations.map(file => file.match(/^(\d{3})_/s)?.[1]);
if (numbers.some(number => !number) || new Set(numbers).size !== numbers.length) errors.push('Migration filenames need unique three-digit numeric prefixes.');
for (const required of ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'docs/README.md', 'docs/maintenance.json', '.github/workflows/ci.yml', 'package-lock.json']) if (!fs.existsSync(required)) errors.push(`Missing repository contract: ${required}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Repository hygiene verified across ${files.length} source/document files and ${migrations.length} migrations.`);
