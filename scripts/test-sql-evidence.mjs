import { checkSoftwareInsightsPdf } from './software-insights-pdf-smoke.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { PDFDocument } from 'pdf-lib';
import { repositoryRoot } from './setup-json-store.mjs';
import { checkInstalledSoftwareInsights } from './installed-software-insights-smoke.mjs';
import { checkDiscoveryComplianceExplorer } from './discovery-compliance-smoke.mjs';
import { checkLifeCycleManagement } from './life-cycle-management-smoke.mjs';
import { checkGovernanceTrends } from './governance-trends-smoke.mjs';
import { checkTopologyExplorer } from "./topology-explorer-smoke.mjs";
import { checkMeasuresTrends } from './measures-trends-smoke.mjs';

const database = process.env.TSAAT_EVIDENCE_PARITY_DATABASE;
assert(/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/.test(database ?? ''), 'Select an explicitly disposable TSAAT_EvidenceParity_* database.');
assert(fs.existsSync(path.join(repositoryRoot, '.next-sql/BUILD_ID')), 'Run npm run build:sql first.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaat-sql-evidence-'));
// Same-user DPAPI copy preserves the saved server/transport policy without revealing credentials.
fs.copyFileSync(path.join(repositoryRoot, 'DB_config'), path.join(directory, 'DB_config'));
fs.mkdirSync(path.join(directory, 'scripts'));
fs.copyFileSync(path.join(repositoryRoot, 'scripts/invoke-dpapi.ps1'), path.join(directory, 'scripts/invoke-dpapi.ps1'));
const date = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data/current.json'), 'utf8')).snapshotDate;
const historicalDate = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data/snapshots/week-01.json'), 'utf8')).snapshotDate;
let server, browser, output = '';
try {
  server = fork(path.join(repositoryRoot, 'scripts/nosql-smoke-server.mjs'), [], {
    cwd: directory, env: { ...process.env, TSAAT_DATA_PROVIDER: 'sql', TSAAT_APP_DATABASE: database, TSAAT_SQL_TRUSTED_CONNECTION: 'true' }, execArgv: [], silent: true, windowsHide: true
  });
  server.stdout.on('data', bytes => { output += bytes; }); server.stderr.on('data', bytes => { output += bytes; });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SQL server start timed out')), 30000);
    server.once('message', message => { clearTimeout(timer); resolve('http://localhost:' + message.port); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error('SQL app exited: ' + code)); });
  });
  const executablePath = process.env.TSAAT_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
  assert(executablePath, 'Set TSAAT_TEST_BROWSER.');
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage(), errors = [], reports = new Set();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1600, height: 1000 });
  const routes = ['/governance/trends', '/governance/insights', '/governance/installed-software-insights', '/measures/trends', '/measures', '/measures?measuresTab=measures-kpi', '/measures?measuresTab=measures-spi', '/findings',
    ...['overview', 'tool-coverage', 'compliance', 'endpoints', 'installed-software-insights', 'security-vulnerabilities', 'patch-management', 'life-cycle-management', 'installed-software', 'shadow-it', 'topology'].map(view => '/discovery-coverage?discoveryView=' + view),
    '/network-risk-profile', '/ict-system-risk-profile', '/cyber-cop?copView=impact', '/cyber-cop?copView=ict-system-impact-analyser', '/cyber-cop?copView=ict-system-dependencies', '/report'];
  async function navigate(route, scope = 'network=net-1', selectedDate = date) {
    const response = await page.goto(base + route + (route.includes('?') ? '&' : '?') + scope + '&dataDate=' + selectedDate, { waitUntil: 'networkidle0', timeout: 120000 });
    assert.equal(response.status(), 200, route);
    assert(!await page.$('[data-nextjs-dialog-overlay]'), route);
    assert(!await page.evaluate(() => document.body.innerText.includes('Application error')), route + ': rendering failed');
    assert.deepEqual(errors, [], route);
  }
  for (const route of routes) {
    await navigate(route, route.includes('ict-system') ? 'system=sys-1' : 'network=net-1');
    (await page.$$eval('a[href], [data-document-source]', nodes => nodes.map(node => node.dataset.documentSource || node.getAttribute('href')).filter(href => href?.startsWith('/api/')))).forEach(href => reports.add(href));
    console.log('SQL rendered ' + route);
  }
  await navigate('/discovery-coverage?discoveryView=installed-software-insights');
  await checkInstalledSoftwareInsights(page, { date, historicalDate });
  await checkSoftwareInsightsPdf(page, { date, historicalDate, directory: path.join(directory, 'software-pdf-downloads') });
  await checkDiscoveryComplianceExplorer(page, { date, historicalDate, directory: path.join(directory, 'compliance-downloads') });
  await navigate('/discovery-coverage?discoveryView=life-cycle-management');
  await checkLifeCycleManagement(page, { date, historicalDate });
  await navigate('/governance/trends');
  const snapshotDates = fs.readdirSync(path.join(repositoryRoot, 'data/snapshots')).filter(name => /^week-\d+\.json$/.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data/snapshots', name), 'utf8')).snapshotDate);
  await checkGovernanceTrends(page, { date, historicalDate, snapshotDates });
  await checkTopologyExplorer(page, { date, historicalDate, artifacts: process.env.TSAAT_TEST_ARTIFACT_DIR, provider: 'sql' });
  await checkMeasuresTrends(page, { date, historicalDate, snapshotDates: snapshotDates.sort(), directory: path.join(directory, 'downloads'), artifacts: process.env.TSAAT_TEST_ARTIFACT_DIR, provider: 'sql' });
  for (const view of ['endpoints', 'installed-software', 'security-vulnerabilities', 'shadow-it']) {
    await navigate('/discovery-coverage?discoveryView=' + view, 'network=net-1&securityDomain=NONE', historicalDate);
  }
  const downloadDirectory = path.join(directory, 'report-downloads'); fs.mkdirSync(downloadDirectory);
  const downloadClient = await page.createCDPSession();
  await downloadClient.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDirectory });
  let pdfs = 0;
  for (const href of reports) {
    const response = await fetch(base + href, { headers: { Accept: 'application/json' } });
    assert.equal(response.status, 200, href);
    assert(!response.headers.get('content-type')?.includes('application/pdf'), 'SQL API must not render PDF bytes');
    if (!response.headers.get('content-type')?.includes('application/json')) continue;
    const job = await response.json();
    if (!/^(?:pdf-|insights-)/.test(job.kind ?? '')) continue;
    assert.equal(job.version, 1); assert.match(job.filename, /\.pdf$/); assert.equal(response.headers.get('content-disposition'), null);
    const file = path.join(downloadDirectory, job.filename); if (fs.existsSync(file)) fs.unlinkSync(file);
    await page.goto(base + href, { waitUntil: 'networkidle0', timeout: 120000 });
    assert.equal(new URL(page.url()).pathname, '/documents/generate', 'Bookmarked report API opens its browser generator');
    const button = 'button[data-document-source]'; await page.waitForSelector(button);
    assert.equal(await page.$eval(button, node => node.dataset.documentSource), href);
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('[data-document-source]').disabled && !document.querySelector('.document-generation-dialog[open]'), { timeout: 60000 });
    const deadline = Date.now() + 60000;
    while (!fs.existsSync(file) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(file), 'SQL-backed report downloaded from the browser: ' + href);
    assert((await PDFDocument.load(fs.readFileSync(file))).getPageCount() > 0, href); pdfs++;
  }
  await downloadClient.detach();
  assert(pdfs > 10, 'SQL reports were exercised.');
  assert.deepEqual(errors, []);
  console.log(`Compiled SQL evidence smoke passed: ${routes.length} views, ${pdfs} browser-generated PDFs from JSON models, historical/domain/empty scopes, software story, lifecycle and trends.`);
} catch (error) {
  console.error(output.slice(-3000)); throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) await new Promise(resolve => { const timer = setTimeout(() => server.kill(), 5000); server.once('exit', () => { clearTimeout(timer); resolve(); }); server.send('stop'); });
  assert(path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('tsaat-sql-evidence-'));
  fs.rmSync(directory, { recursive: true, force: true });
}
