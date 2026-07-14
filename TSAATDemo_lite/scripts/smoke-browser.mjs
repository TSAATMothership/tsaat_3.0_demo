import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const liteRoot = path.resolve(scriptDirectory, "..");
const htmlPath = process.env.TSAAT_HTML_PATH
  ? path.resolve(process.env.TSAAT_HTML_PATH)
  : path.join(liteRoot, "TSAATDemo_lite.html");
assert(existsSync(htmlPath), `TSAAT HTML file was not found at ${htmlPath}.`);

function browserPath() {
  const candidates = [
    process.env.TSAAT_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : null
  ].filter(Boolean);
  const selected = candidates.find((candidate) => existsSync(candidate));
  if (!selected) {
    throw new Error("Chrome or Microsoft Edge was not found. Set TSAAT_BROWSER_PATH to a Chromium executable.");
  }
  return selected;
}

async function clearAndType(page, selector, value) {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
}

async function navigateAndWait(page, href, expectedText) {
  await page.evaluate((target) => globalThis.__TSAAT_NAVIGATE__(target), href);
  await page.waitForFunction(
    (target, expected) =>
      window.location.hash === `#${target}` &&
      !document.body.innerText.includes("Loading TSAAT...") &&
      !document.body.innerText.includes("This TSAAT view could not be rendered.") &&
      document.body.innerText.toLowerCase().includes(expected.toLowerCase()),
    {},
    href,
    expectedText
  );
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: browserPath(),
  args: ["--no-first-run", "--disable-background-networking"]
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120_000);
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.setOfflineMode(true);

  const runtimeErrors = [];
  const networkRequests = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  page.on("request", (request) => {
    if (/^https?:/i.test(request.url())) {
      networkRequests.push(request.url());
    }
  });

  await page.goto(`${pathToFileURL(htmlPath).href}#/login`, { waitUntil: "load" });
  await page.waitForSelector('input[autocomplete="username"]');
  assert.equal(await page.$eval("h1", (element) => element.textContent?.trim()), "Sign In");

  await page.type('input[autocomplete="username"]', "demo");
  await page.type('input[autocomplete="current-password"]', "incorrect");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.innerText.includes("Invalid username or password."));

  await clearAndType(page, 'input[autocomplete="current-password"]', "demo123");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.location.hash === "#/cyber-cop");
  await page.waitForFunction(
    () => document.querySelector("[data-route-ready-key]") && document.body.innerText.includes("COMPLIANCE SCORES")
  );
  assert(
    await page.$eval('a[href*="/networks"]', (anchor) => anchor.getAttribute("href")?.startsWith("#/networks")),
    "Internal links must retain the standalone HTML document as their native destination."
  );

  const routes = [
    ["/networks", "Networks Roll-Up Posture Summary"],
    ["/networks/net-1", "Aegis Mesh North"],
    ["/systems", "ICT Systems Roll-Up Posture Summary"],
    ["/systems/sys-1", "Falcon Ops Hub"],
    ["/discovery-coverage", "Discovery"],
    ["/measures", "Measures"],
    ["/findings", "Findings"],
    ["/report", "Reports"],
    ["/cyber-cop", "Compliance Scores"]
  ];
  for (const [href, expectedText] of routes) {
    await navigateAndWait(page, href, expectedText);
  }

  // Exercise the menu's router.replace path under file://. Chromium treats
  // local files as opaque origins, so this catches regressions where a full
  // file URL is passed to history.replaceState.
  await navigateAndWait(page, "/networks", "Networks Roll-Up Posture Summary");
  await page.waitForSelector('input[aria-label="Data date"]');
  await page.evaluate(() => {
    globalThis.__TSAAT_SMOKE_ROUTE_EVENTS__ = [];
    for (const eventName of ["tsaat:route-loading:start", "tsaat:route-loading:complete"]) {
      window.addEventListener(eventName, () => globalThis.__TSAAT_SMOKE_ROUTE_EVENTS__.push(eventName));
    }
  });
  await page.$eval('input[aria-label="Data date"]', (input) => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, "2026-04-16");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  try {
    await page.waitForFunction(
      () =>
        window.location.hash === "#/networks?dataDate=2026-04-16" &&
        !document.body.innerText.includes("Loading selected date...") &&
        document.body.innerText.toLowerCase().includes("networks roll-up posture summary".toLowerCase()),
      { timeout: 15_000 }
    );
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      hash: window.location.hash,
      events: globalThis.__TSAAT_SMOKE_ROUTE_EVENTS__,
      inputValue: document.querySelector('input[aria-label="Data date"]')?.value,
      overlayVisible: document.body.innerText.includes("Loading selected date..."),
      readyMarkers: Array.from(document.querySelectorAll("[data-route-ready-key]"), (marker) =>
        marker.getAttribute("data-route-ready-key")
      )
    }));
    throw new Error(`The file-origin date replacement did not settle: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  assert.equal(
    await page.$eval('input[aria-label="Data date"]', (input) => input.value),
    "2026-04-16",
    "The data date route replacement did not complete."
  );
  assert.deepEqual(
    await page.evaluate(() => globalThis.__TSAAT_SMOKE_ROUTE_EVENTS__),
    ["tsaat:route-loading:start", "tsaat:route-loading:complete"],
    "The standalone route lifecycle did not complete exactly once."
  );

  const apiResults = await page.evaluate(async () => {
    const summaryResponse = await fetch("/api/report/summary");
    const summary = await summaryResponse.json();
    const findingsResponse = await fetch("/api/findings/export?format=json");
    const findings = await findingsResponse.json();
    const discoveryResponse = await fetch("/api/discovery-tools/settings");
    const discovery = await discoveryResponse.json();
    const measuresResponse = await fetch("/api/measures/settings");
    const measures = await measuresResponse.json();

    const measuresSave = await fetch("/api/measures/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        severityMatrix: measures.settings.severityMatrix,
        priorityMatrix: measures.settings.priorityMatrix
      })
    });
    const discoverySave = await fetch("/api/discovery-tools/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tools: discovery.settings.tools })
    });

    const binaryChecks = [];
    for (const [href, expectedType, expectedMagic] of [
      ["/api/report/summary?format=pdf", "application/pdf", [37, 80, 68, 70]],
      [
        "/api/discovery-coverage/target-state-template?network=net-1",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [80, 75, 3, 4]
      ],
      ["/api/networks/net-1/discovery-coverage-export", "text/csv", null],
      ["/api/systems/sys-1/discovery-coverage-export", "text/csv", null]
    ]) {
      const response = await fetch(href);
      const bytes = new Uint8Array(await response.arrayBuffer());
      binaryChecks.push({
        href,
        status: response.status,
        contentType: response.headers.get("Content-Type"),
        size: bytes.length,
        magic: Array.from(bytes.slice(0, 4)),
        expectedType,
        expectedMagic
      });
    }

    return {
      summaryStatus: summaryResponse.status,
      snapshotDate: summary.snapshotDate,
      findingsStatus: findingsResponse.status,
      findingCount: Array.isArray(findings) ? findings.length : findings.findings?.length,
      discoveryStatus: discoveryResponse.status,
      discoveryTools: discovery.settings?.tools?.length,
      measuresStatus: measuresResponse.status,
      measuresSaveStatus: measuresSave.status,
      discoverySaveStatus: discoverySave.status,
      binaryChecks
    };
  });

  assert.equal(apiResults.summaryStatus, 200);
  assert.equal(apiResults.snapshotDate, "2026-04-23");
  assert.equal(apiResults.findingsStatus, 200);
  assert.equal(apiResults.findingCount, 1415);
  assert.equal(apiResults.discoveryStatus, 200);
  assert.equal(apiResults.discoveryTools, 7);
  assert.equal(apiResults.measuresStatus, 200);
  assert.equal(apiResults.measuresSaveStatus, 200);
  assert.equal(apiResults.discoverySaveStatus, 200);
  for (const check of apiResults.binaryChecks) {
    assert.equal(check.status, 200, check.href);
    assert(check.contentType?.startsWith(check.expectedType), `${check.href} returned ${check.contentType}`);
    assert(check.size > 100, `${check.href} returned an unexpectedly small payload.`);
    if (check.expectedMagic) {
      assert.deepEqual(check.magic, check.expectedMagic, `${check.href} has the wrong file signature.`);
    }
  }

  await navigateAndWait(page, "/cyber-cop", "Compliance Scores");
  const tabSelected = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "ICT System Impact Analyser"
    );
    button?.click();
    return Boolean(button);
  });
  assert(tabSelected, "ICT System Impact Analyser tab was not found.");
  await page.waitForSelector('button[aria-label="Select ICT systems for the ICT System Impact Analyser"]');
  await page.click('button[aria-label="Select ICT systems for the ICT System Impact Analyser"]');
  await page.waitForSelector('[role="listbox"] input[type="checkbox"]');
  await page.click('[role="listbox"] input[type="checkbox"]');
  const runSelected = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Run" && !candidate.disabled
    );
    button?.click();
    return Boolean(button);
  });
  assert(runSelected, "Impact analyser Run button was not enabled.");
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return !text.includes("Running...") && /open server findings|finding paths|relationship path/.test(text);
  });

  const logoutSelected = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim().toLowerCase() === "logout"
    );
    button?.click();
    return Boolean(button);
  });
  assert(logoutSelected, "Logout button was not found.");
  await page.waitForFunction(() => window.location.hash === "#/login");
  const session = await page.evaluate(async () => (await fetch("/api/auth/session")).json());
  assert.equal(session.authenticated, false);

  assert.deepEqual(networkRequests, [], "The offline application attempted an HTTP request.");
  assert.deepEqual(runtimeErrors, [], "The offline application emitted browser errors.");
  console.log(
    "Browser smoke passed: login, 9 routes, file-origin date replacement, dynamic details, APIs, settings, exports, worker, and logout."
  );
  console.log("Network audit passed: zero HTTP or HTTPS requests while Chromium was offline.");
} finally {
  await browser.close();
}
