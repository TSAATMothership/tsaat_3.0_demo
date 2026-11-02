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
  const routes = ["/measures", "/measures?measuresTab=measures-kpi", "/measures?measuresTab=measures-spi", "/findings",
    "/discovery-coverage?discoveryView=overview", "/discovery-coverage", "/discovery-coverage?discoveryView=compliance", "/discovery-coverage?discoveryView=endpoints",
    "/discovery-coverage?discoveryView=installed-software", "/discovery-coverage?discoveryView=shadow-it", "/network-risk-profile", "/ict-system-risk-profile",
    "/cyber-cop?copView=impact", "/cyber-cop?copView=network-impact-analyser", "/cyber-cop?copView=ict-system-impact-analyser", "/report"];
  const reports = new Set();
  for (const route of routes) {
    await navigate(route, route.includes("ict-system") ? "system=sys-1" : "network=net-1");
    (await page.$$eval("a", nodes => nodes.map(node => node.getAttribute("href")).filter(href => href?.startsWith("/api/")))).forEach(href => reports.add(href));
  }
  await navigate("/settings");
  await page.waitForSelector('dialog[open] #settings-tab-database-settings');
  assert.equal(await page.$eval('#settings-tab-database-settings', node => node.textContent.trim()), "JSON Data Files");
  await page.waitForFunction(directory => document.querySelector('dialog[open]')?.textContent.includes(directory), {}, env.TSAAT_JSON_DATA_DIR);
  for (const tab of ["password-settings", "discovery-tools-settings", "spi-risk-matrix", "spi-priority-matrix"]) {
    await page.click('#settings-tab-' + tab);
    await page.waitForFunction(id => document.getElementById('settings-tab-' + id)?.getAttribute('aria-selected') === 'true', {}, tab);
  }
  await page.keyboard.press("Escape");
  for (const kind of ["network", "ict-system"]) {
    await navigate("/" + kind + "-risk-profile", kind === "network" ? "network=net-1" : "system=sys-1");
    await page.click('[role="tab"][id$="-tab-heatmap"]');
    assert.equal(await page.$eval('[aria-label="Heatmap square size"]', node => node.value), "40");
    await page.waitForSelector('[role="gridcell"]');
    await page.type('[aria-label="Search compliance heatmap devices"]', "no-such-device-987654");
    await page.waitForFunction(() => !document.querySelector('[role="gridcell"]'));
    await page.click('[aria-label="Clear heatmap search"]');
    await page.waitForSelector('[role="gridcell"]');
    await page.click('[role="tab"][id$="-tab-explorer"]');
    await page.click('button[aria-label^="Open ' + (kind === "network" ? "Network" : "ICT System") + ' Details"]');
    await page.waitForSelector("dialog[open]");
    await page.keyboard.press("Escape");
  }
  await navigate("/discovery-coverage?discoveryView=endpoints");
  await page.click("[data-cmdb-asset-id]");
  await page.waitForSelector('[data-cmdb-drill-through][data-load-state="ready"]', { timeout: 30000 });
  await page.keyboard.press("Escape"); await page.waitForSelector("dialog[open]", { hidden: true });
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
  for (const kind of ["endpoints", "installed-software", "shadow-it", "compliance"]) {
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
  console.log("No-SQL production smoke passed: authentication, " + routes.length + " views, both heatmaps/analysers, Settings, CMDB, " + pdfCount + " PDFs, " + workbookCount + " workbooks, disk settings and restart persistence; no SQL configuration or executable.");
} catch (error) {
  console.error(serverOutput.slice(-3000)); throw error;
} finally {
  if (browser) await browser.close();
  await stopServer();
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-nosql-runtime-")) throw new Error("Unsafe test directory.");
  fs.rmSync(directory, { recursive: true, force: true });
}
