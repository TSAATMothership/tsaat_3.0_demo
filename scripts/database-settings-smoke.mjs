import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork } from "node:child_process";
import puppeteer from "puppeteer-core";
import personaTools from "../lib/personas.ts";

// Run with node --import tsx scripts/database-settings-smoke.mjs after build:sql.
// Browser API fixtures exercise the real compiled form without saving DB_config.
const root = process.cwd();
assert(fs.existsSync(path.join(root, ".next-sql/BUILD_ID")), "Run npm run build:sql first.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tsaat-database-form-"));
const artifacts = path.join(root, ".local/database-settings-controls");
fs.mkdirSync(artifacts, { recursive: true });
const env = { ...process.env, TSAAT_DATA_PROVIDER: "sql", SQLCMD_PATH: path.join(directory, "sql-must-not-run.exe") };
for (const key of Object.keys(env)) if (/^(TSAAT_SQL_|SQL_|SQLCMDUSER$|SQLCMDPASSWORD$|TSAAT_APP_DATABASE$)/.test(key)) delete env[key];
const result = (summary, success = true) => ({ success, summary, diagnostics: summary });
let server, browser, output = "";
try {
  server = fork(path.join(root, "scripts/nosql-smoke-server.mjs"), [], { cwd: directory, env, execArgv: [], silent: true, windowsHide: true });
  server.stdout.on("data", chunk => { output += chunk; });
  server.stderr.on("data", chunk => { output += chunk; });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server timed out: " + output)), 30000);
    server.once("message", ({ port }) => { clearTimeout(timer); resolve("http://localhost:" + port); });
    server.once("exit", code => { clearTimeout(timer); reject(new Error("Server exited " + code + ": " + output)); });
  });
  const executablePath = process.env.TSAAT_TEST_BROWSER || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => fs.existsSync(file));
  assert(executablePath, "Set TSAAT_TEST_BROWSER to Chrome or Edge.");
  browser = await puppeteer.launch({ executablePath, headless: true });
  for (const policy of [{ sslEnabled: false, sslType: "strict" }, { sslEnabled: true, sslType: "strict" }, { sslEnabled: true, sslType: "trust-server-certificate" }]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    let stored = { server: "tcp:fixture,1433", database: "TSAATDB", authMode: "sql", userId: "tsaat_app", password: "********", hasStoredPassword: true, ...policy };
    const requests = [], unexpected = [], errors = [];
    let failPolicy = policy.sslEnabled && policy.sslType === "strict", failSave = true;
    page.on("pageerror", error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", async request => {
      const pathname = new URL(request.url()).pathname;
      if (!pathname.startsWith("/api/")) return request.continue();
      const respond = (payload, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(payload) });
      if (pathname === "/api/settings/personas") return respond({ settings: personaTools.defaultPersonaSettings() });
      if (pathname === "/api/workspace-options") return respond({ networks: [], systems: [] });
      if (pathname === "/api/settings/database" && request.method() === "GET") return respond({ settings: stored });
      const payload = request.postData() ? JSON.parse(request.postData()) : null;
      requests.push({ pathname, payload });
      if (pathname.endsWith("/test-connection")) {
        await new Promise(resolve => setTimeout(resolve, 150));
        return respond({ result: result("Database connection successful.") });
      }
      if (pathname.endsWith("/test-ssl")) return respond({ result: result(failPolicy ? "Certificate validation failed." : "Connection policy passed.", !failPolicy) }, failPolicy ? 400 : 200);
      if (pathname.endsWith("/test-schema")) return respond({ result: result("Schema validation successful.") });
      if (pathname === "/api/settings/database" && request.method() === "PUT") {
        if (failSave) { failSave = false; return respond({ error: "Simulated save failure." }, 400); }
        stored = payload;
        return respond({ settings: stored, connectionResult: result("Database connection successful."), schemaResult: result("Schema validation successful."), sslResult: policy.sslEnabled ? result("Connection policy passed.") : null });
      }
      unexpected.push(pathname);
      return respond({ error: "Unexpected API request" }, 500);
    });
    await page.goto(base, { waitUntil: "networkidle0" });
    const press = async selector => { await page.focus(selector); await page.keyboard.press("Enter"); };
    await press(".workspace-header-menu summary");
    await press(".workspace-header-menu nav button");
    const panel = "#settings-panel-database-settings";
    await page.waitForSelector(panel + ' input[type="password"]');
    assert.equal(await page.$(panel + " select"), null);
    assert.equal(await page.$(panel + ' input[type="checkbox"]'), null);
    assert(!await page.$eval(panel, node => /SSL \/ TLS|Enable SSL|SSL Type|Test SSL/.test(node.textContent)));
    const button = async label => {
      await page.waitForFunction((selector, text) => {
        const button = [...document.querySelectorAll(selector + " button")].find(node => node.textContent.trim() === text);
        return button && !button.disabled;
      }, {}, panel, label);
      const handle = await page.evaluateHandle((selector, text) => [...document.querySelectorAll(selector + " button")].find(node => node.textContent.trim() === text), panel, label);
      assert(handle.asElement(), "Missing button " + label);
      await handle.asElement().focus(); await page.keyboard.press("Enter"); await handle.dispose();
    };
    const disabled = label => page.$eval(panel, (node, text) => [...node.querySelectorAll("button")].find(button => button.textContent.trim() === text)?.disabled, label);
    const waitText = text => page.waitForFunction((selector, message) => document.querySelector(selector)?.textContent.includes(message), {}, panel, text);
    const connection = async () => {
      await button("Test Connection");
      await page.waitForSelector(panel + " input:disabled");
      assert.equal(await disabled("Save"), true);
      await page.waitForFunction(selector => ![...document.querySelectorAll(selector + " button")].some(node => node.textContent.trim() === "Testing..."), {}, panel);
    };
    assert.equal(await disabled("Save"), true);
    if (failPolicy) {
      await connection();
      await waitText("Connection policy validation failed.");
      assert.equal(await disabled("Test Schema"), true);
      assert.equal(await disabled("Save"), true);
      failPolicy = false;
    }
    await connection();
    assert.equal(await disabled("Test Schema"), false);
    assert.equal(await disabled("Save"), true);
    await button("Test Schema"); await waitText("Schema validation successful.");
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector + " button")].find(node => node.textContent.trim() === "Save")?.disabled, {}, panel);
    const serverInput = panel + ' input:not([type="radio"]):not([type="password"])';
    await page.focus(serverInput); await page.keyboard.press("End"); await page.keyboard.type("-edited");
    assert.equal(await disabled("Save"), true);
    await button("Reset");
    assert.equal(await page.$eval(serverInput, node => node.value), stored.server);
    await connection(); await button("Test Schema"); await waitText("Schema validation successful.");
    await button("Save"); await waitText("Simulated save failure.");
    await button("Save"); await waitText("Database settings saved to encrypted DB_config.");
    for (const request of requests) {
      assert.equal(request.payload.sslEnabled, policy.sslEnabled);
      assert.equal(request.payload.sslType, policy.sslType);
      assert.equal(request.payload.password, "********");
    }
    assert.equal(requests.some(request => request.pathname.endsWith("/test-ssl")), policy.sslEnabled);
    await page.keyboard.press("Escape");
    await page.waitForSelector("dialog.settings-popup[open]", { hidden: true });
    await page.waitForFunction(() => document.activeElement === document.querySelector(".workspace-header-menu summary"));
    await press(".workspace-header-menu summary"); await press(".workspace-header-menu nav button");
    await page.waitForSelector(panel + ' input[type="password"]');
    if (!policy.sslEnabled) {
      await page.screenshot({ path: path.join(artifacts, "desktop.png") });
      await page.setViewport({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(artifacts, "mobile.png") });
      assert(await page.$eval("dialog.settings-popup[open]", node => node.scrollWidth <= node.clientWidth + 1), "No horizontal modal overflow");
    }
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Database Settings browser checks passed: removed TLS controls/test button, all saved policies retained, automatic policy validation/failure, save/retry, reset, masked password, keyboard close/focus return and narrow layout. API fixtures only; no SQL or DB_config writes.");
} finally {
  await browser?.close();
  if (server && server.exitCode === null) await new Promise(resolve => {
    const timer = setTimeout(() => server.kill(), 5000);
    server.once("exit", () => { clearTimeout(timer); resolve(); }); server.send("stop");
  });
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-database-form-")) throw new Error("Unsafe test cleanup directory.");
  fs.rmSync(directory, { recursive: true, force: true });
}
