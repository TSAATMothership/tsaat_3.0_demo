import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork } from "node:child_process";
import puppeteer from "puppeteer-core";
import personaTools from "../lib/personas.ts";
import discoveryTools from "../lib/discovery-tools-settings.ts";
import fixtures from "../tests/spi-definition-fixtures.ts";
import { checkPersonas } from "./personas-smoke.mjs";
import { checkReadOnlySettings } from "./settings-read-only-smoke.mjs";

// Compiled SQL UI with read-only API fixtures. No operational database or DB_config.
const root = process.cwd();
assert(fs.existsSync(path.join(root, ".next-sql/BUILD_ID")), "Run build:sql first.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tsaat-settings-view-"));
const artifacts = path.join(root, ".local/settings-read-only-sql");
const env = { ...process.env, TSAAT_DATA_PROVIDER: "sql" };
for (const key of Object.keys(env)) if (/^(TSAAT_SQL_|SQL_|SQLCMDUSER$|SQLCMDPASSWORD$|TSAAT_APP_DATABASE$)/.test(key)) delete env[key];
env.SQLCMD_PATH = path.join(directory, "sql-must-not-run.exe");
let server, browser, output = "";
try {
  server = fork(path.join(root, "scripts/nosql-smoke-server.mjs"), [], { cwd: directory, env, execArgv: [], silent: true, windowsHide: true });
  server.stdout.on("data", chunk => { output += chunk; }); server.stderr.on("data", chunk => { output += chunk; });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server timed out: " + output)), 30000);
    server.once("message", ({ port }) => { clearTimeout(timer); resolve("http://localhost:" + port); });
    server.once("exit", code => { clearTimeout(timer); reject(new Error("Server exited " + code + ": " + output)); });
  });
  const savedConfigurations = [
    ["/api/settings/personas", personaTools.defaultPersonaSettings()],
    ["/api/measures/settings", fixtures.testMeasuresSettings],
    ["/api/discovery-tools/settings", discoveryTools.defaultDiscoveryToolsSettings()]
  ];
  for (const [endpoint, settings] of savedConfigurations) {
    for (const body of ["not-json", JSON.stringify(settings)]) {
      const response = await fetch(base + endpoint, { method: "PUT", body });
      assert.equal(response.status, 405); assert.equal(response.headers.get("Allow"), "GET");
    }
  }
  for (const [endpoint, method] of [["", "GET"], ["", "PUT"], ["/test-connection", "POST"], ["/test-schema", "POST"], ["/test-ssl", "POST"]])
    assert.equal((await fetch(base + "/api/settings/database" + endpoint, { method })).status, 410);
  const executablePath = process.env.TSAAT_TEST_BROWSER || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => fs.existsSync(file));
  assert(executablePath, "Set TSAAT_TEST_BROWSER to Chrome or Edge.");
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage(), errors = [], unexpected = [];
  await page.setViewport({ width: 1600, height: 1000 });
  page.on("pageerror", error => errors.push(error.message));
  const payloads = {
    "/api/settings/personas": { settings: personaTools.defaultPersonaSettings() },
    "/api/workspace-options": { networks: [], systems: [] },
    "/api/measures/settings": { settings: fixtures.testMeasuresSettings, spiDefinitions: fixtures.testSpiDefinitions, severityDefinitions: fixtures.testSeverityDefinitions, priorityDefinitions: fixtures.testPriorityDefinitions },
    "/api/discovery-tools/settings": { settings: discoveryTools.defaultDiscoveryToolsSettings() }
  };
  const failOnce = new Set();
  const intercept = request => {
    if (request.isInterceptResolutionHandled()) return;
    const pathname = new URL(request.url()).pathname;
    if (!pathname.startsWith("/api/")) return void request.continue();
    if (request.method() !== "GET" || pathname.startsWith("/api/settings/database")) unexpected.push(pathname + " " + request.method());
    if (failOnce.delete(pathname)) return void request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture unavailable." }) });
    if (payloads[pathname]) return void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(payloads[pathname]) });
    void request.continue();
  };
  await page.setRequestInterception(true); page.on("request", intercept);
  await page.goto(base + "/settings?settingsTab=personas&network=net-1&dataDate=2026-11-04", { waitUntil: "networkidle0" });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => location.pathname !== "/settings");
  await checkPersonas(page, { artifacts });
  await checkReadOnlySettings(page, { artifacts });
  for (const [tab, endpoint] of [["discovery-tools-settings", "/api/discovery-tools/settings"], ["spi-risk-matrix", "/api/measures/settings"]]) {
    failOnce.add(endpoint);
    await page.goto(base + "/settings?settingsTab=" + tab, { waitUntil: "networkidle0" });
    await page.waitForSelector("#settings-panel-" + tab + " [role=alert]");
    await page.$$eval("#settings-panel-" + tab + " button", nodes => nodes.find(node => node.textContent.includes("Retry")).click());
    await page.waitForSelector("#settings-panel-" + tab + " table");
  }
  payloads["/api/discovery-tools/settings"].settings = { ...payloads["/api/discovery-tools/settings"].settings, tools: [] };
  payloads["/api/measures/settings"].spiDefinitions = [];
  for (const [tab, message] of [["discovery-tools-settings", "No discovery tools are configured."], ["spi-risk-matrix", "No SPI definitions are available."]]) {
    await page.goto(base + "/settings?settingsTab=" + tab, { waitUntil: "networkidle0" });
    await page.waitForFunction(({ tab, message }) => document.querySelector("#settings-panel-" + tab)?.textContent.includes(message), {}, { tab, message });
  }
  page.off("request", intercept);
  await page.setRequestInterception(false);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  assert(!fs.existsSync(path.join(directory, "DB_config")));
  console.log("Compiled SQL Settings smoke passed with API fixtures; real write/retirement routes reject requests without SQL.");
} finally {
  await browser?.close();
  if (server && server.exitCode === null) await new Promise(resolve => {
    const timer = setTimeout(() => server.kill(), 5000);
    server.once("exit", () => { clearTimeout(timer); resolve(); }); server.send("stop");
  });
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-settings-view-")) throw new Error("Unsafe test cleanup directory.");
  fs.rmSync(directory, { recursive: true, force: true });
}
