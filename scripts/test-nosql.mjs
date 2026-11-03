import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fork, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import workbookTools from "../lib/network-target-state-template-workbook.ts";
const { readXlsxEntries } = workbookTools;
import coverageTools from "./nosql-coverage.ts";
const { enrichJsonStore } = coverageTools;
import { populateVulnerabilityMetadata } from "./populate-vulnerability-metadata.mjs";
import { populatePatchManagement } from "./populate-patch-management.mjs";
import { populateJsonStore } from "./populate-json-store.mjs";
import { initializeJsonStore, repositoryRoot } from "./setup-json-store.mjs";

assert(fs.existsSync(path.join(repositoryRoot, ".next-nosql", "BUILD_ID")), "Run npm run build:nosql first.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tsaat-nosql-runtime-"));
const password = randomBytes(24).toString("base64url");
const env = { ...process.env, TSAAT_DATA_PROVIDER: "json", TSAAT_JSON_DATA_DIR: path.join(directory, "store"),
  SQLCMD_PATH: path.join(directory, "sql-must-not-run.exe"), TSAAT_LOGIN_USERNAME: "provider-test", TSAAT_LOGIN_PASSWORD: password };
let server, browser, serverOutput = "";
async function startServer() {
  server = fork(path.join(repositoryRoot, "scripts/nosql-smoke-server.mjs"), [], { cwd: directory, env, execArgv: [], silent: true, windowsHide: true });
  server.stdout.on("data", bytes => { serverOutput += bytes; }); server.stderr.on("data", bytes => { serverOutput += bytes; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server start timed out: " + serverOutput)), 30000);
    server.once("message", message => { clearTimeout(timer); resolve("http://localhost:" + message.port); });
    server.once("exit", code => { clearTimeout(timer); reject(new Error("Server exited: " + code + "\n" + serverOutput)); });
  });
}
async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  await new Promise(resolve => {
    const timer = setTimeout(() => child.kill(), 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); }); child.send("stop");
  });
}
try {
  await initializeJsonStore({ target: env.TSAAT_JSON_DATA_DIR });
  if (process.env.TSAAT_TEST_SQL_EXPORT) await populateJsonStore({ target: env.TSAAT_JSON_DATA_DIR,
    sourceExport: process.env.TSAAT_TEST_SQL_EXPORT, apply: true, demo: true, backupDirectory: path.join(directory, "before-source-import") });
  await populateVulnerabilityMetadata({ target: env.TSAAT_JSON_DATA_DIR, apply: true, demo: true, backupDirectory: path.join(directory, "before-vulnerability-population") });
  await populatePatchManagement({ target: env.TSAAT_JSON_DATA_DIR, apply: true, demo: true, backupDirectory: path.join(directory, "before-patch-population") });
  await enrichJsonStore({ target: env.TSAAT_JSON_DATA_DIR, apply: true, demo: true, backupDirectory: path.join(directory, "before-coverage-enrichment") });
  fs.mkdirSync(path.join(directory, "scripts"));
  fs.copyFileSync(path.join(repositoryRoot, "scripts/invoke-dpapi.ps1"), path.join(directory, "scripts/invoke-dpapi.ps1"));
  fs.mkdirSync(path.join(directory, "data/templates"), { recursive: true });
  fs.copyFileSync(path.join(repositoryRoot, "data/templates/network-target-state-template.xlsx"), path.join(directory, "data/templates/network-target-state-template.xlsx"));
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(repositoryRoot, "scripts/ensure-logindetails.ps1"),
    "-RepoRoot", repositoryRoot, "-LoginDetailsPath", path.join(directory, "logindetails")], { env, windowsHide: true, stdio: "pipe" });
  let base = await startServer();
  assert.equal((await fetch(base + "/api/workspace-options")).status, 401, "Data APIs must require authentication.");
  async function login() {
    const response = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "provider-test", password }) });
    assert.equal(response.status, 200, await response.clone().text());
    return response.headers.get("set-cookie").split(";")[0];
  }
  let cookie = await login();
  async function request(url, init = {}) {
    const response = await fetch(base + url, { ...init, headers: { Cookie: cookie, ...init.headers } });
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, url + ": " + bytes.toString().slice(0,300) + "\n" + serverOutput.slice(-1200));
    return { response, bytes };
  }
  async function getJson(url, init) { return JSON.parse((await request(url, init)).bytes.toString()); }
  const storage = await getJson("/api/settings/storage");
  assert.equal(storage.provider, "json");
  assert.equal(storage.directory, env.TSAAT_JSON_DATA_DIR);
  const date = storage.snapshots.at(-1).date;
  assert.equal((await fetch(base + "/api/settings/database", { headers: { Cookie: cookie } })).status, 409);
  const executablePath = process.env.TSAAT_TEST_BROWSER || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => fs.existsSync(file));
  assert(executablePath, "Set TSAAT_TEST_BROWSER to Chrome or Edge.");
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage(), errors = [], sqlRequests = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/settings/database")) sqlRequests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewport({ width: 1600, height: 1000 });
  await page.setCookie({ name: "tsaat_session", value: cookie.slice(cookie.indexOf("=") + 1), url: base, httpOnly: true, secure: true, sameSite: "Lax" });
  async function navigate(route, scope = "network=net-1") {
    const response = await page.goto(base + route + (route.includes("?") ? "&" : "?") + scope + "&dataDate=" + date, { waitUntil: "networkidle0", timeout: 45000 });
    assert.equal(response.status(), 200, route);
    assert(!page.url().includes("/login"), "Authentication did not persist in the browser");
    assert(!await page.$('[data-nextjs-dialog-overlay]'), route);
    assert(!await page.evaluate(() => document.body.innerText.includes('Application error')), route + ': server rendering failed');
    assert.deepEqual(errors, [], route + ': browser runtime errors');
  }
  const routes = ["/governance/overview", "/governance/trends", "/governance/insights", "/measures", "/measures?measuresTab=measures-kpi", "/measures?measuresTab=measures-spi", "/findings",
    "/discovery-coverage?discoveryView=overview", "/discovery-coverage", "/discovery-coverage?discoveryView=compliance", "/discovery-coverage?discoveryView=endpoints",
    "/discovery-coverage?discoveryView=security-vulnerabilities", "/discovery-coverage?discoveryView=patch-management", "/discovery-coverage?discoveryView=installed-software", "/discovery-coverage?discoveryView=shadow-it", "/network-risk-profile", "/ict-system-risk-profile",
    "/cyber-cop?copView=impact", "/cyber-cop?copView=network-impact-analyser", "/cyber-cop?copView=ict-system-impact-analyser", "/report"];
  const reports = new Set();
  for (const route of routes) {
    await navigate(route, route.includes("ict-system") ? "system=sys-1" : "network=net-1");
    (await page.$$eval("a", nodes => nodes.map(node => node.getAttribute("href")).filter(href => href?.startsWith("/api/")))).forEach(href => reports.add(href));
  }
  // Domain scope defaults to all, stages edits, survives navigation and supports an explicit empty scope.
  await navigate('/discovery-coverage?discoveryView=endpoints');
  const domainTrigger='button[aria-controls="security-domain-options"]';
  await page.click(domainTrigger);
  assert.equal(await page.$$eval('#security-domain-options input[type="checkbox"]:checked',nodes=>nodes.length),3);
  await page.click('#security-domain-options label:nth-child(1) input');
  await page.click('#security-domain-options label:nth-child(3) input');
  assert.equal(new URL(page.url()).searchParams.get('securityDomain'),null,'Domain edits must be staged');
  await page.click('[aria-label="Update Security Domain filter"]');
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('securityDomain')==='SECRET');
  await page.waitForSelector('dialog.loading-modal[open]',{hidden:true});
  assert.equal(new URL(page.url()).searchParams.get('network'),'net-1');
  assert.equal(new URL(page.url()).searchParams.get('dataDate'),date);
  assert(await page.$('a[href*="securityDomain=SECRET"]'),'Sidebar links must retain domain scope');
  await page.click(domainTrigger);
  await page.click('#security-domain-options .workspace-scope-none');
  await page.click('[aria-label="Update Security Domain filter"]');
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('securityDomain')==='NONE');
  await page.waitForSelector('dialog.loading-modal[open]',{hidden:true});
  assert.equal(await page.$$eval('.endpoint-explorer tbody tr button',nodes=>nodes.length),0);
  await page.click(domainTrigger);
  await page.click('#security-domain-options button[title^="Select all"]');
  await page.click('[aria-label="Update Security Domain filter"]');
  await page.waitForFunction(()=>!new URL(location.href).searchParams.has('securityDomain'));
  await page.waitForSelector('dialog.loading-modal[open]',{hidden:true});
  await page.focus(domainTrigger); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  assert.equal(await page.$eval(domainTrigger,node=>document.activeElement===node),true);
  await navigate('/governance/overview');
  assert.equal(await page.$eval('.workspace-nav-group:first-child .workspace-group-toggle', node => node.textContent.trim()), 'Governance');
  assert.deepEqual(await page.$$eval('.workspace-nav-group:first-child a', nodes => nodes.map(node => node.textContent.trim())), ['Overview', 'Trends', 'Insights']);
  for (const view of ['trends', 'insights', 'overview']) {
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    await page.focus(`.workspace-nav-group:first-child a[href^="/governance/${view}"]`);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
    await page.waitForFunction(selected => window.location.pathname === '/governance/' + selected &&
      document.querySelector('.governance-placeholder h1')?.textContent === selected[0].toUpperCase() + selected.slice(1), {}, view);
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    assert.equal(new URL(page.url()).searchParams.get('network'), 'net-1');
    assert.equal(new URL(page.url()).searchParams.get('dataDate'), date);
    assert.equal(await page.$eval('.governance-placeholder h1', node => node.textContent), view[0].toUpperCase() + view.slice(1));
    assert.equal(await page.$$eval('.workspace-navigation [aria-current="page"]', nodes => nodes.length), 1);
    assert.equal(await page.$eval('.workspace-navigation [aria-current="page"]', node => new URL(node.href).pathname), '/governance/' + view);
    assert.equal(await page.$$eval('.governance-placeholder table, .governance-placeholder canvas, .governance-placeholder button', nodes => nodes.length), 0);
  }
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) {
    fs.mkdirSync(process.env.TSAAT_TEST_ARTIFACT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, 'governance-desktop.png'), fullPage: true });
  }
  await navigate('/governance/insights', 'system=sys-1');
  assert.equal(new URL(page.url()).searchParams.get('system'), 'sys-1');
  assert.equal(await page.$$eval('.workspace-nav-group:first-child a', nodes => nodes.length), 3);
  await navigate('/governance/trends', '');
  assert.equal(await page.$('.governance-placeholder h1'), null);
  // Overview counts and destinations must agree for both scope kinds and resolved historical dates.
  for (const overviewScope of [{ query: 'network=net-1', date }, { query: 'system=sys-1', date: storage.snapshots[0].date }]) {
    const overviewUrl = base + '/discovery-coverage?discoveryView=overview&' + overviewScope.query + '&dataDate=' + overviewScope.date;
    await page.goto(overviewUrl, { waitUntil: 'networkidle0' });
    assert(await page.$('[aria-label="Open Security Vulnerability Explorer"]'));
    assert(await page.$('[aria-label="Open Patch Management Explorer"]'));
    assert.equal(await page.$eval('.discovery-overview-snapshot strong', node => node.textContent), overviewScope.date);
    const overviewLinks = await page.$$eval('.discovery-overview a[data-overview-count]', nodes => nodes.map(node => ({ href: node.getAttribute('href'), count: Number(node.getAttribute('data-overview-count')) })));
    const overviewTargets = overviewLinks.filter(link => {
      const params = new URL(link.href, base).searchParams;
      const filters = JSON.parse(params.get('discoveryFilters') || '{}');
      return (params.get('discoveryView') === 'security-vulnerabilities' && filters.columns?.severity?.length === 2) ||
        (params.get('discoveryView') === 'patch-management' && (filters.ranges?.daysOverdue?.min === 1 || filters.columns?.status?.[0] === 'Unknown'));
    }).filter((link, index, links) => links.findIndex(item => item.href === link.href) === index);
    assert.equal(overviewTargets.length, 3);
    if (overviewScope.query.startsWith('network')) {
      if (process.env.TSAAT_TEST_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.TSAAT_TEST_ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, 'discovery-overview-desktop.png'), fullPage: true });
      }
      await page.setViewport({ width: 390, height: 844 }); await page.click('[aria-label="Hide sidebar"]');
      await page.waitForFunction(() => document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width < 50);
      assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth + 1));
      await page.$eval('[data-discovery-security]', node => node.scrollIntoView({ block: 'start' }));
      if (process.env.TSAAT_TEST_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, 'discovery-overview-narrow.png'), fullPage: true });
      await page.setViewport({ width: 1600, height: 1000 }); await page.click('[aria-label="Show sidebar"]');
    }
    for (const link of overviewTargets) {
      await page.goto(overviewUrl, { waitUntil: 'networkidle0' });
      await page.focus(`.discovery-overview a[href="${link.href}"]`);
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
      const destination = new URL(page.url());
      assert.equal(destination.searchParams.get('dataDate'), overviewScope.date);
      const [kind, id] = overviewScope.query.split('='); assert.equal(destination.searchParams.get(kind), id);
      const table = destination.searchParams.get('discoveryView') === 'patch-management' ? '.patch-results' : '.vulnerability-results';
      assert.equal(await page.$eval(table + ' .endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(',', ''))), link.count);
      assert(await page.$(table + ' .endpoint-active-filters'));
      if (table === '.patch-results') {
        const initial = await page.$eval(table + ' .endpoint-toolbar h2 span', node => node.textContent);
        await page.click('#patch-explorer-tab-restarts'); await page.click('#patch-explorer-tab-posture');
        assert.equal(await page.$eval(table + ' .endpoint-toolbar h2 span', node => node.textContent), initial);
      }
    }
  }
  await navigate('/discovery-coverage?discoveryView=overview', 'network=missing-network');
  assert((await page.$eval('[data-discovery-security]', node => node.textContent)).includes('N/A patched & verified'));
  assert((await page.$eval('[data-discovery-security]', node => node.textContent)).includes('No vulnerability observations'));
  await navigate('/discovery-coverage?discoveryView=endpoints');
  const endpointLayout = await page.$eval('.endpoint-results', node => ({
    width: node.getBoundingClientRect().width,
    cellPadding: getComputedStyle(node.querySelector('tbody td')).padding,
    toolbarPadding: getComputedStyle(node.querySelector('.endpoint-toolbar')).padding,
    minTableWidth: getComputedStyle(node.querySelector('table')).minWidth
  }));
  async function verifyInventoryLayoutAndCharts(selector, chartTitle, patchTabs = false) {
    assert.equal(await page.$eval(selector, node => node.getBoundingClientRect().width), endpointLayout.width);
    assert.deepEqual(await page.$eval(selector, node => ({
      cellPadding: getComputedStyle(node.querySelector('tbody td')).padding,
      toolbarPadding: getComputedStyle(node.querySelector('.endpoint-toolbar')).padding,
      minTableWidth: getComputedStyle(node.querySelector('table')).minWidth
    })), { cellPadding: endpointLayout.cellPadding, toolbarPadding: endpointLayout.toolbarPadding, minTableWidth: endpointLayout.minTableWidth });
    const body = selector + ' .endpoint-table-scroll';
    const originalHeight = await page.$eval(body, node => node.clientHeight);
    assert(originalHeight > 220 && originalHeight < 700, 'Inventory rows need useful space within a bounded desktop panel.');
    await page.select(selector + ' .endpoint-pagination select', '250');
    assert(Math.abs(await page.$eval(body, node => node.clientHeight) - originalHeight) <= 1, 'Increasing page size must not grow the table panel.');
    assert(await page.$eval(body, node => node.scrollHeight > node.clientHeight));
    await page.select(selector + ' .endpoint-pagination select', '50');
    assert.equal(await page.$$('.endpoint-charts .endpoint-chart').then(charts => charts.length), 4);
    const chart = `[aria-label="${chartTitle} summary chart"]`;
    const button = chart + ' .endpoint-chart-bars > button:first-child';
    const count = await page.$eval(button + ' strong', node => Number(node.textContent.replaceAll(',', '')));
    const total = await page.$eval(selector + ' h2 span', node => node.textContent);
    await page.focus(button); await page.keyboard.press('Space');
    await page.waitForSelector(button + '[aria-pressed="true"]');
    assert.equal(await page.$eval(selector + ' h2 span', node => Number(node.textContent.replaceAll(',', ''))), count);
    assert(await page.$(selector + ' .endpoint-active-filters'));
    assert.equal(await page.$eval(button + ' strong', node => Number(node.textContent.replaceAll(',', ''))), count, 'Chart facets ignore their own selection.');
    if (patchTabs) {
      await page.click('#patch-explorer-tab-restarts'); await page.click('#patch-explorer-tab-posture');
      assert.equal(await page.$eval(button, node => node.getAttribute('aria-pressed')), 'true');
      assert.equal(await page.$eval(selector + ' h2 span', node => Number(node.textContent.replaceAll(',', ''))), count);
    }
    await page.click(selector + ' .endpoint-clear-all');
    await page.waitForSelector(button + '[aria-pressed="false"]');
    assert.equal(await page.$eval(selector + ' h2 span', node => node.textContent), total);
  }
  await navigate("/discovery-coverage?discoveryView=patch-management");
  await verifyInventoryLayoutAndCharts('.patch-results', 'Patch status', true);
  const patchSearch = 'input[aria-label="Search server patch records table"]';
  const patchAsset = await page.$eval('.patch-results [data-cmdb-asset-id]', node => node.getAttribute('data-cmdb-asset-id'));
  await page.focus('.explorer-guidance summary'); await page.keyboard.press('Enter');
  await page.waitForSelector('.explorer-guidance[open]');
  assert((await page.$eval('.explorer-guidance[open]', node => node.textContent)).includes('Patched requires current assessment evidence'));
  await page.keyboard.press('Enter'); await page.waitForSelector('.explorer-guidance:not([open])');
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) { fs.mkdirSync(process.env.TSAAT_TEST_ARTIFACT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "patch-posture.png"), fullPage: true }); }
  await page.type(patchSearch, patchAsset);
  await page.waitForFunction(() => document.querySelectorAll('.patch-results [data-cmdb-asset-id]').length === 1);
  const patchDownloadDirectory = path.join(directory, 'patch-downloads');
  fs.mkdirSync(patchDownloadDirectory);
  await browser.defaultBrowserContext().setDownloadBehavior({ policy: 'allow', downloadPath: patchDownloadDirectory });
  const patchDownload = page.waitForResponse(response => response.url().includes('/api/discovery-coverage/patch-management/export'));
  await page.click('.patch-results .endpoint-export');
  const patchWorkbook = await patchDownload;
  assert.equal(patchWorkbook.status(), 200);
  assert(patchWorkbook.headers()['content-type']?.includes('spreadsheetml.sheet'), 'Patch export must return an Excel workbook.');
  // Validate the completed browser download; DevTools can expose an empty body after a blob download.
  const patchFile = path.join(patchDownloadDirectory, `patch-management-explorer-${date}.xlsx`);
  const patchDownloadDeadline = Date.now() + 30000;
  while (!fs.existsSync(patchFile) && Date.now() < patchDownloadDeadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert(fs.existsSync(patchFile), 'Patch workbook download did not complete.');
  const patchBytes = fs.readFileSync(patchFile);
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) fs.writeFileSync(path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, 'patch-export.xlsx'), patchBytes);
  const patchSheet = readXlsxEntries(patchBytes).get('xl/worksheets/sheet1.xml').toString();
  assert.equal((patchSheet.match(/<row /g) ?? []).length, 2);
  assert(patchSheet.includes(patchAsset) && patchSheet.includes('Last Restarted (UTC)') && patchSheet.includes('Change Reference'));
  await page.focus('#patch-explorer-tab-posture'); await page.keyboard.press('ArrowRight');
  await page.waitForSelector('#patch-explorer-tab-restarts[aria-selected="true"]');
  assert((await page.$eval('.patch-results', node => node.textContent)).includes('Assessment Valid Until'));
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "patch-restarts.png"), fullPage: true });
  await page.focus('#patch-explorer-tab-restarts'); await page.keyboard.press('End');
  await page.waitForSelector('#patch-explorer-tab-planning[aria-selected="true"]');
  assert((await page.$eval('.patch-results', node => node.textContent)).includes('Maintenance Window'));
  await page.focus('#patch-explorer-tab-planning'); await page.keyboard.press('Home');
  await page.waitForSelector('#patch-explorer-tab-posture[aria-selected="true"]');
  assert.equal(await page.$eval(patchSearch, node => node.value), patchAsset);
  await page.focus('.patch-results [data-cmdb-asset-id]'); await page.keyboard.press('Enter');
  await page.waitForSelector('[data-cmdb-drill-through][data-load-state="ready"]');
  await page.waitForSelector('[data-cmdb-network-impact]');
  await page.keyboard.press('Escape'); await page.waitForSelector('dialog[open]', { hidden: true });
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-cmdb-asset-id') === id, {}, patchAsset);
  await page.click(patchSearch, { clickCount: 3 }); await page.type(patchSearch, 'no-such-patch-server');
  await page.waitForFunction(() => document.querySelector('.patch-results')?.textContent.includes('No matching records'));
  await page.click(patchSearch, { clickCount: 3 }); await page.keyboard.press('Backspace');
  await page.setViewport({ width: 390, height: 844 }); await page.click('[aria-label="Hide sidebar"]');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width < 50);
  assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth + 1));
  assert(await page.$eval('.patch-results .endpoint-table-scroll', node => node.scrollWidth > node.clientWidth));
  assert(await page.$eval('.patch-results .endpoint-table-scroll', node => node.clientHeight <= 34 * parseFloat(getComputedStyle(document.documentElement).fontSize) + 1));
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "patch-narrow.png"), fullPage: true });
  await page.setViewport({ width: 1600, height: 1000 }); await page.click('[aria-label="Show sidebar"]');
  await navigate('/discovery-coverage?discoveryView=patch-management', 'system=sys-1'); assert(await page.$('.patch-results [data-cmdb-asset-id]'));
  await navigate('/discovery-coverage?discoveryView=patch-management', 'network=missing-network');
  assert((await page.$eval('.patch-results', node => node.textContent)).includes('No matching records'));
  await navigate("/discovery-coverage?discoveryView=security-vulnerabilities");
  await verifyInventoryLayoutAndCharts('.vulnerability-results', 'Severity');
  const vulnerabilitySearch = 'input[aria-label="Search security vulnerabilities table"]';
  assert(await page.$('.vulnerability-results [data-cmdb-asset-id]'));
  await page.type(vulnerabilitySearch, "CVE-2024-34750");
  await page.waitForFunction(() => [...document.querySelectorAll('.vulnerability-results tbody tr')].every(row => row.textContent.includes('CVE-2024-34750')));
  const filteredWorkbook = await request("/api/discovery-coverage/security-vulnerabilities/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: { network: ["net-1"], system: [], dataDate: date }, filters: { search: "CVE-2024-34750", columns: {} } }) });
  const vulnerabilitySheet = readXlsxEntries(filteredWorkbook.bytes).get("xl/worksheets/sheet1.xml").toString();
  assert(vulnerabilitySheet.includes("Tomcat") && vulnerabilitySheet.includes("CVE-2024-34750") && vulnerabilitySheet.includes("Date CVE Code Created"));
  assert(!vulnerabilitySheet.includes("CVE-2024-38475"));
  await page.focus('.vulnerability-results [data-cmdb-asset-id]');
  const focusedAsset = await page.$eval('.vulnerability-results [data-cmdb-asset-id]', node => node.getAttribute('data-cmdb-asset-id'));
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-cmdb-drill-through][data-load-state="ready"]', { timeout: 30000 });
  await page.keyboard.press("Escape"); await page.waitForSelector('dialog[open]', { hidden: true });
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-cmdb-asset-id') === id, {}, focusedAsset);
  await page.$eval('.vulnerability-results .endpoint-table-scroll', node => { node.scrollLeft = 0; });
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) { fs.mkdirSync(process.env.TSAAT_TEST_ARTIFACT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "vulnerability-desktop.png"), fullPage: true }); }
  await page.setViewport({ width: 390, height: 844 });
  await page.click('[aria-label="Hide sidebar"]');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width < 50);
  assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth + 1));
  assert(await page.$eval('.vulnerability-results .endpoint-table-scroll', node => node.scrollWidth > node.clientWidth));
  assert(await page.$eval('.vulnerability-results .endpoint-table-scroll', node => node.clientHeight <= 34 * parseFloat(getComputedStyle(document.documentElement).fontSize) + 1));
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "vulnerability-narrow.png"), fullPage: true });
  await page.$eval('.vulnerability-results', node => node.scrollIntoView({ block: "start" }));
  if (process.env.TSAAT_TEST_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "vulnerability-narrow-table.png"), fullPage: true });
  await page.click(vulnerabilitySearch, { clickCount: 3 }); await page.type(vulnerabilitySearch, "no-such-cve-record");
  await page.waitForFunction(() => document.querySelector('.vulnerability-results')?.textContent.includes('No matching records'));
  await page.setViewport({ width: 1600, height: 1000 });
  await navigate("/discovery-coverage?discoveryView=security-vulnerabilities", "system=sys-1");
  assert(await page.$('.vulnerability-results'));
  await navigate("/discovery-coverage?discoveryView=security-vulnerabilities", "network=missing-network");
  assert((await page.$eval('.vulnerability-results', node => node.textContent)).includes('No matching records'));
  await navigate("/settings");
  await page.waitForSelector('dialog[open] #settings-tab-database-settings');
  assert.equal(await page.$eval('#settings-tab-database-settings', node => node.textContent.trim()), "JSON Data Files");
  await page.waitForFunction(directory => document.querySelector('dialog[open]')?.textContent.includes(directory), {}, env.TSAAT_JSON_DATA_DIR);
  for (const tab of ["password-settings", "discovery-tools-settings", "spi-risk-matrix", "spi-priority-matrix"]) {
    await page.click('#settings-tab-' + tab);
    await page.waitForFunction(id => document.getElementById('settings-tab-' + id)?.getAttribute('aria-selected') === 'true', {}, tab);
  }
  await page.keyboard.press("Escape");
  let drillThroughTabs = 0;
  for (const kind of ["network", "ict-system"]) {
    await navigate("/" + kind + "-risk-profile", kind === "network" ? "network=net-1,net-2" : "system=sys-1,sys-2");
    await page.click('[role="tab"][id$="-tab-heatmap"]');
    assert.equal(await page.$eval('[aria-label="Heatmap square size"]', node => node.value), "40");
    await page.waitForSelector('[role="gridcell"]');
    await page.type('[aria-label="Search compliance heatmap devices"]', "no-such-device-987654");
    await page.waitForFunction(() => !document.querySelector('[role="gridcell"]'));
    await page.click('[aria-label="Clear heatmap search"]');
    await page.waitForSelector('[role="gridcell"]');
    await page.click('[role="tab"][id$="-tab-explorer"]');
    const scopeKey = kind === "network" ? "network" : "system";
    const orderControl = '[aria-label="Order ' + (kind === "network" ? "networks" : "ICT systems") + '"]';
    await page.select(orderControl, "name");
    const firstRow = ".network-risk-table tbody tr:first-child";
    const selectedId = await page.$eval(firstRow + " a", (link, key) => new URL(link.href).searchParams.get(key), scopeKey);
    const searchControl = '.network-risk-table input[type="search"]';
    await page.type(searchControl, selectedId);
    await page.waitForFunction(() => document.querySelectorAll(".network-risk-table tbody tr").length === 1);
    const links = await page.$$eval(firstRow + " a", nodes => nodes.map(node => ({ href: node.href, target: node.target, rel: node.rel, label: node.getAttribute("aria-label") })));
    const expected = [
      { path: "/" + kind + "-risk-profile", extra: { [scopeKey + "Details"]: selectedId } },
      { path: "/discovery-coverage", extra: { discoveryView: "endpoints" } },
      { path: "/measures", extra: { measuresTab: "measures-spi" } },
      { path: "/discovery-coverage", extra: { discoveryView: "compliance" } },
      ...[{}, { severity: "Critical Exposure" }, { severity: "High Risk" }, { durationMin: "91" }].map(extra => ({ path: "/findings", extra: { findingsTab: "open", asOf: date, ...extra } }))
    ];
    assert.equal(links.length, expected.length);
    const originalUrl = page.url();
    for (const [index, link] of links.entries()) {
      const targetUrl = new URL(link.href);
      assert.equal(link.target, "_blank");
      assert(link.rel.includes("noopener") && link.rel.includes("noreferrer"));
      assert.match(link.label, /opens in a new tab/);
      assert.equal(targetUrl.pathname, expected[index].path);
      assert.deepEqual(Object.fromEntries(targetUrl.searchParams), { dataDate: date, [scopeKey]: selectedId, ...expected[index].extra });
      await page.bringToFront();
      const targetPromise = browser.waitForTarget(target => target.type() === "page" && target.url() === link.href, { timeout: 45000 });
      const control = (await page.$$(firstRow + " a"))[index];
      if (index === 0) { await control.focus(); await page.keyboard.press("Enter"); } else await control.click();
      const popup = await (await targetPromise).page();
      assert(popup, "The explorer drill-through must open a browser tab");
      popup.on("pageerror", error => errors.push(error.message));
      await popup.waitForSelector("main h1", { timeout: 45000 });
      assert.equal(popup.url(), link.href);
      assert.equal(await popup.evaluate(() => window.opener === null), true);
      assert(!await popup.evaluate(() => document.body.innerText.includes("Application error")));
      if (index === 0) {
        await popup.waitForSelector("dialog[open]");
        assert((await popup.$eval("dialog[open]", node => node.textContent)).includes(selectedId));
        await popup.keyboard.press("Escape");
        await popup.waitForSelector("dialog[open]", { hidden: true });
      }
      if (targetUrl.searchParams.has("severity")) {
        const selector = '[aria-label="Clear Severity table filter"]';
        await popup.waitForSelector(selector);
        assert((await popup.$eval(selector, node => node.textContent)).includes(targetUrl.searchParams.get("severity")));
      }
      if (targetUrl.searchParams.has("durationMin")) {
        const selector = '[aria-label="Clear Duration range filter"]';
        await popup.waitForSelector(selector);
        assert((await popup.$eval(selector, node => node.textContent)).includes("91"));
      }
      await popup.close(); drillThroughTabs++;
      assert.equal(page.url(), originalUrl);
      assert.equal(await page.$eval(searchControl, node => node.value), selectedId);
      assert.equal(await page.$eval(orderControl, node => node.value), "name");
      assert.equal(await page.$eval('[role="tab"][id$="-tab-explorer"]', node => node.getAttribute("aria-selected")), "true");
      assert.equal(await page.$("dialog[open]"), null);
    }
  }
  for (const assetScope of ["network=net-1", "system=sys-1"]) {
    await navigate("/discovery-coverage?discoveryView=endpoints", assetScope);
    const originUrl = page.url();
    const assetId = await page.$eval('[data-cmdb-asset-id]', node => node.getAttribute('data-cmdb-asset-id'));
    await page.focus('[data-cmdb-asset-id]'); await page.keyboard.press("Enter");
    await page.waitForSelector('[data-cmdb-drill-through][data-load-state="ready"]', { timeout: 30000 });
    const cmdb = (await getJson(`/api/assets/cmdb-details?assetId=${encodeURIComponent(assetId)}&dataDate=${date}`)).asset;
    if (assetScope.startsWith("network")) {
      await page.setViewport({ width: 390, height: 844 });
      await page.waitForFunction(() => {
        const bounds = document.querySelector('[data-cmdb-network-impact]')?.getBoundingClientRect();
        return bounds && bounds.left >= 0 && bounds.right <= innerWidth;
      });
      if (process.env.TSAAT_TEST_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "cmdb-impact-narrow.png"), fullPage: true });
      await page.setViewport({ width: 1600, height: 1000 });
    }
    const targetPromise = browser.waitForTarget(target => target.type() === "page" && target.url().startsWith(base + "/cyber-cop?") &&
      new URL(target.url()).searchParams.get("impactAssetId") === assetId, { timeout: 45000 });
    await page.focus('[data-cmdb-network-impact]'); await page.keyboard.press("Enter");
    const popup = await (await targetPromise).page();
    assert(popup, "CMDB impact action must open a separate window");
    popup.on("pageerror", error => errors.push(error.message));
    await popup.setViewport({ width: 1440, height: 960 });
    await popup.waitForSelector('[data-network-impact-asset]', { timeout: 45000 });
    assert.equal(await popup.$eval('[data-network-impact-asset]', node => node.getAttribute('data-network-impact-asset')), assetId);
    const targetUrl = new URL(popup.url());
    assert.equal(targetUrl.searchParams.get("dataDate"), date);
    assert.equal(targetUrl.searchParams.get(assetScope.split("=")[0]), assetScope.split("=")[1]);
    assert.equal(await popup.evaluate(() => window.opener === null), true);
    await popup.waitForSelector('canvas[aria-label*="Canvas WebGL"]', { timeout: 30000 });
    await popup.waitForFunction(() => !document.querySelector("main")?.textContent.includes("Loading Diagram"), { timeout: 30000 });
    const query = `${assetScope}&dataDate=${date}&diagramNetworkIds=${encodeURIComponent(cmdb.networkId)}&impactAssetId=${encodeURIComponent(assetId)}`;
    const diagram = await getJson("/api/cyber-cop/impact-analyser-2?" + query);
    assert(diagram.rows.length > 0 && diagram.rows.every(row => row.assetId === assetId));
    const findingSpi = diagram.rows.find(row => row.spiId)?.spiId ?? 1;
    const findings = await getJson("/api/cyber-cop/impact-analyser-2/findings?" + query + "&spiId=" + findingSpi);
    assert(findings.allFindings.every(row => row.assetId === assetId));
    assert.equal(findings.totalCount, diagram.rows.filter(row => row.findingId && row.spiId === findingSpi).length);
    if (process.env.TSAAT_TEST_ARTIFACT_DIR) await popup.screenshot({ path: path.join(process.env.TSAAT_TEST_ARTIFACT_DIR, "asset-impact-" + assetScope.split("=")[0] + ".png"), fullPage: true });
    await popup.reload({ waitUntil: "networkidle0" });
    await popup.waitForSelector('[data-network-impact-asset]');
    await popup.click('[data-network-impact-asset] button');
    await popup.waitForFunction(() => !new URL(location.href).searchParams.has("impactAssetId"));
    await popup.waitForSelector('[aria-label="Select networks for the Network Impact Analyser"]:not([disabled])');
    assert.equal(await popup.$('[data-network-impact-asset]'), null);
    await popup.close(); await page.bringToFront();
    assert.equal(page.url(), originUrl);
    assert(await page.$('[data-cmdb-drill-through][open]'));
    await page.keyboard.press("Escape"); await page.waitForSelector("dialog[open]", { hidden: true });
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-cmdb-asset-id') === id, {}, assetId);
  }
  await navigate("/cyber-cop?copView=network-impact-analyser&impactAssetId=missing-asset");
  assert((await page.$eval('[data-network-impact-asset]', node => node.textContent)).includes("unavailable"));
  assert.equal(await page.$('canvas[aria-label*="Canvas WebGL"]'), null);
  for (const kind of ["network", "ict-system"]) {
    await navigate("/cyber-cop?copView=" + kind + "-impact-analyser", kind === "network" ? "network=net-1" : "system=sys-1");
    await page.click(kind === "network" ? '[aria-label="Select networks for the Network Impact Analyser"]' : '[aria-label="Select ICT systems for the ICT System Impact Analyser"]');
    await page.waitForSelector('main input[type="checkbox"]');
    await page.click('main input[type="checkbox"]');
    await page.evaluate(() => [...document.querySelectorAll("main button")].find(button => button.textContent.trim().toLowerCase() === "run").click());
    await page.waitForSelector('canvas[aria-label*="Canvas WebGL"]', { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector("main")?.textContent.includes("Loading Diagram"), { timeout: 30000 });
  }
  let pdfCount = 0;
  for (const report of reports) {
    const { response, bytes } = await request(report);
    assert.match(response.headers.get("content-type"), /pdf/);
    assert((await PDFDocument.load(bytes)).getPageCount() > 0); pdfCount++;
  }
  const scope = { network: ["net-1"], system: [], dataDate: date };
  const post = value => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  let workbookCount = 0;
  for (const kind of ["endpoints", "installed-software", "security-vulnerabilities", "shadow-it", "compliance"]) {
    const result = await request("/api/discovery-coverage/" + kind + "/export", post({ scope, filters: { search: "", columns: {}, recency: [] } }));
    assert(readXlsxEntries(result.bytes).has("xl/workbook.xml")); workbookCount++;
  }
  const template = await request("/api/discovery-coverage/target-state-template?network=net-1&dataDate=" + date);
  assert(readXlsxEntries(template.bytes).has("xl/workbook.xml")); workbookCount++;
  const findingData = await getJson("/api/findings/export?format=json&network=net-1&status=open&asOf=" + date);
  const findingWorkbook = await request("/api/findings/export", post({ scope, asOf: date, status: "open", findingIds: findingData.findings.filter(f => f.status === "open").map(f => f.id) }));
  assert.match(readXlsxEntries(findingWorkbook.bytes).get("xl/workbook.xml").toString(), /Affected CIs/); workbookCount++;
  const settings = (await getJson("/api/measures/settings")).settings;
  settings.priorityMatrix["1"] = settings.priorityMatrix["1"] === 1 ? 7 : 1;
  settings.severityMatrix["1:server"] = "Critical Exposure";
  await getJson("/api/measures/settings", { ...post(settings), method: "PUT" });
  const discoverySettings = (await getJson("/api/discovery-tools/settings")).settings;
  discoverySettings.tools[0].assetTypeScope.server = discoverySettings.tools[0].assetTypeScope.server === "na" ? "required" : "na";
  const savedDiscovery = (await getJson("/api/discovery-tools/settings", { ...post(discoverySettings), method: "PUT" })).settings;
  const beforeRestart = await getJson("/api/findings/export?format=json&network=net-1&status=open&asOf=" + date);
  const updatedFindings = beforeRestart.findings.filter(f => f.spiId === 1 && f.complianceStatus === "Non-compliant");
  assert(updatedFindings.length > 0, "Persistence check must include findings affected by the matrix change");
  assert(updatedFindings.every(f => f.priorityRank === settings.priorityMatrix["1"]));
  await browser.close(); browser = undefined;
  await stopServer(); base = await startServer(); cookie = await login();
  const afterRestart = (await getJson("/api/measures/settings")).settings;
  assert.equal(afterRestart.priorityMatrix["1"], settings.priorityMatrix["1"]);
  assert.equal(afterRestart.severityMatrix["1:server"], "Critical Exposure");
  assert.deepEqual((await getJson("/api/discovery-tools/settings")).settings.tools, savedDiscovery.tools);
  assert(!fs.existsSync(path.join(directory, "DB_config")), "No-SQL runtime created SQL configuration");
  assert.deepEqual(errors, []);
  assert.deepEqual(sqlRequests, [], "No-SQL UI must not request SQL administration");
  console.log("No-SQL production smoke passed: authentication, " + routes.length + " views, " + drillThroughTabs + " explorer drill-through tabs, both heatmaps/analysers, Settings, CMDB, " + pdfCount + " PDFs, " + workbookCount + " workbooks, disk settings and restart persistence; no SQL configuration or executable.");
} catch (error) {
  console.error(serverOutput.slice(-3000)); throw error;
} finally {
  if (browser) await browser.close();
  await stopServer();
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-nosql-runtime-")) throw new Error("Unsafe test directory.");
  fs.rmSync(directory, { recursive: true, force: true });
}
