import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { initializeJsonStore, repositoryRoot } from './setup-json-store.mjs';
import { checkClientDocumentInteraction } from './client-document-ui-smoke.mjs';
import { checkClientDocumentPdfs } from './client-document-pdfs-smoke.mjs';
import { checkClientWorkbookDocuments } from './client-document-workbooks-smoke.mjs';

const provider = process.argv[2] ?? 'json';
const phase = process.argv[3] ?? 'all';
assert(['json', 'sql'].includes(provider), 'Usage: node --import tsx scripts/test-client-documents.mjs [json|sql]');
assert(['all', 'interaction', 'pdf', 'workbooks'].includes(phase), 'Optional phase must be interaction, pdf or workbooks.');
assert(fs.existsSync(path.join(repositoryRoot, provider === 'json' ? '.next-nosql/BUILD_ID' : '.next-sql/BUILD_ID')), 'Build the selected provider first.');
const database = process.env.TSAAT_EVIDENCE_PARITY_DATABASE;
if (provider === 'sql') assert(/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/.test(database ?? ''), 'Select an explicitly disposable SQL validation database.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaat-client-documents-'));
const artifacts = path.resolve(process.env.TSAAT_TEST_ARTIFACT_DIR ?? path.join(repositoryRoot, '.local', 'client-document-artifacts'), provider);
fs.mkdirSync(artifacts, { recursive: true });
const env = { ...process.env, TSAAT_DATA_PROVIDER: provider, TSAAT_JSON_DATA_DIR: path.join(directory, 'store') };
if (provider === 'json') { env.SQLCMD_PATH = path.join(directory, 'sql-must-not-run.exe'); await initializeJsonStore({ target: env.TSAAT_JSON_DATA_DIR }); }
else {
  env.TSAAT_APP_DATABASE = database; env.TSAAT_SQL_TRUSTED_CONNECTION = 'true';
  fs.copyFileSync(path.join(repositoryRoot, 'DB_config'), path.join(directory, 'DB_config'));
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.copyFileSync(path.join(repositoryRoot, 'scripts/invoke-dpapi.ps1'), path.join(directory, 'scripts/invoke-dpapi.ps1'));
}
const date = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data/current.json'), 'utf8')).snapshotDate;
const historicalDate = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data/snapshots/week-01.json'), 'utf8')).snapshotDate;
let server, browser, output = '';
try {
  server = fork(path.join(repositoryRoot, 'scripts/nosql-smoke-server.mjs'), [], { cwd: directory, env, execArgv: [], silent: true, windowsHide: true });
  server.stdout.on('data', bytes => { output += bytes; }); server.stderr.on('data', bytes => { output += bytes; });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Production server start timed out')), 30000);
    server.once('message', message => { clearTimeout(timer); resolve('http://localhost:' + message.port); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error('Production server exited: ' + code)); });
  });
  const executablePath = process.env.TSAAT_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
  assert(executablePath, 'Set TSAAT_TEST_BROWSER to an installed Chrome or Edge browser.');
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  console.log('Checking browser documents with ' + provider + ': ' + base);
  const interaction = ['all', 'interaction'].includes(phase) ? await checkClientDocumentInteraction(page, { base, date, directory: fs.mkdtempSync(path.join(artifacts, 'interaction-')) }) : undefined;
  if (interaction) console.log('Progress, cancellation, retry, focus and narrow layout passed.');
  const pdfs = ['all', 'pdf'].includes(phase) ? await checkClientDocumentPdfs(page, { base, date, historicalDate, directory: path.join(artifacts, 'pdf') }) : undefined;
  const workbooks = ['all', 'workbooks'].includes(phase) ? await checkClientWorkbookDocuments(page, { base, date, historicalDate, directory: path.join(artifacts, 'workbooks'), artifacts }) : undefined;
  fs.writeFileSync(path.join(artifacts, 'validation-' + phase + '.json'), JSON.stringify({ provider, database: provider === 'sql' ? database : undefined, date, historicalDate, interaction, pdfs, workbooks }, null, 2));
  console.log('Browser document validation passed for ' + provider + '. Evidence: ' + artifacts);
} catch (error) {
  console.error(error);
  fs.writeFileSync(path.join(artifacts, 'server.log'), output);
  if (browser) for (const [index, page] of (await browser.pages()).entries()) {
    await Promise.race([page.screenshot({ path: path.join(artifacts, 'failure-' + index + '.png') }).catch(() => {}), new Promise(resolve => setTimeout(resolve, 5000))]);
    fs.writeFileSync(path.join(artifacts, 'failure-' + index + '.txt'), await page.evaluate(() => document.body.innerText).catch(() => 'Unavailable'));
  }
  console.error(output.slice(-2000)); throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) await new Promise(resolve => {
    const timer = setTimeout(() => server.kill(), 5000);
    server.once('exit', () => { clearTimeout(timer); resolve(); }); server.send('stop');
  });
  assert(path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('tsaat-client-documents-'));
  fs.rmSync(directory, { recursive: true, force: true });
}
