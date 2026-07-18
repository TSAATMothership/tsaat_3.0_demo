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
const dependencyButtonLabel = "ICT System Dependencies";
const dependencyAxisContract =
  "ICT System -> Environment -> Server -> Dependent Server -> Dependent Environment -> Dependent ICT System";

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

async function assertAlignedWorkspaceFooters(page, viewport, routes) {
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  const measurements = [];

  for (const [href, expectedText] of routes) {
    await navigateAndWait(page, href, expectedText);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-risk-trend-chart="true"] .recharts-line-curve').length === 2,
      { timeout: 15_000 }
    );
    const measurement = await page.evaluate(() => {
      const workspaces = Array.from(document.querySelectorAll('[data-full-height-workspace="true"]'));
      const footers = Array.from(document.querySelectorAll('[data-workspace-footer="true"]'));
      const workspaceRect = workspaces[0]?.getBoundingClientRect();
      const footerRect = footers[0]?.getBoundingClientRect();
      const riskTrendPanels = Array.from(document.querySelectorAll('[data-risk-trend-chart="true"]'));
      const riskTrendPanel = riskTrendPanels[0];
      const riskChartsHost = riskTrendPanel?.closest('[data-risk-charts="true"]');
      const riskTrendSvg = riskTrendPanel?.querySelector("svg");
      const riskTrendPanelRect = riskTrendPanel?.getBoundingClientRect();
      const riskChartsHostRect = riskChartsHost?.getBoundingClientRect();
      const riskTrendSvgRect = riskTrendSvg?.getBoundingClientRect();
      const riskTrendCurves = Array.from(riskTrendPanel?.querySelectorAll(".recharts-line-curve") ?? []);
      return {
        workspaceCount: workspaces.length,
        footerCount: footers.length,
        workspace: workspaceRect
          ? { top: workspaceRect.top, bottom: workspaceRect.bottom, height: workspaceRect.height }
          : null,
        footer: footerRect ? { top: footerRect.top, bottom: footerRect.bottom, height: footerRect.height } : null,
        riskTrend: {
          panelCount: riskTrendPanels.length,
          panel: riskTrendPanelRect
            ? { top: riskTrendPanelRect.top, bottom: riskTrendPanelRect.bottom, height: riskTrendPanelRect.height }
            : null,
          host: riskChartsHostRect
            ? { top: riskChartsHostRect.top, bottom: riskChartsHostRect.bottom, height: riskChartsHostRect.height }
            : null,
          svg: riskTrendSvgRect ? { width: riskTrendSvgRect.width, height: riskTrendSvgRect.height } : null,
          curveLengths: riskTrendCurves.map((curve) => curve.getTotalLength()),
          xAxisLabels: Array.from(
            riskTrendPanel?.querySelectorAll(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value") ?? [],
            (label) => label.textContent?.trim() ?? ""
          )
        },
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight
      };
    });

    assert.equal(measurement.workspaceCount, 1, `${href} must render exactly one full-height workspace.`);
    assert.equal(measurement.footerCount, 1, `${href} must render exactly one workspace footer.`);
    assert(measurement.workspace, `${href} workspace geometry was not available.`);
    assert(measurement.footer, `${href} footer geometry was not available.`);
    assert.equal(measurement.riskTrend.panelCount, 1, `${href} must render exactly one Risk Trend chart.`);
    assert(measurement.riskTrend.panel, `${href} Risk Trend panel geometry was not available.`);
    assert(measurement.riskTrend.host, `${href} Risk Trend host geometry was not available.`);
    assert(measurement.riskTrend.svg, `${href} Risk Trend SVG geometry was not available.`);
    assert(measurement.riskTrend.svg.width > 0, `${href} Risk Trend SVG must have a positive width.`);
    assert(measurement.riskTrend.svg.height > 0, `${href} Risk Trend SVG must have a positive height.`);
    assert.equal(measurement.riskTrend.curveLengths.length, 2, `${href} must render both Risk Trend lines.`);
    assert(
      measurement.riskTrend.curveLengths.every((length) => length > 0),
      `${href} Risk Trend lines must contain more than one plotted point.`
    );
    assert(
      measurement.riskTrend.xAxisLabels.length >= 2,
      `${href} Risk Trend must render multiple weekly date labels.`
    );
    assert(
      measurement.riskTrend.panel.top >= measurement.riskTrend.host.top - 1 &&
        measurement.riskTrend.panel.bottom <= measurement.riskTrend.host.bottom + 1,
      `${href} Risk Trend panel must not be clipped by its chart host.`
    );
    assert.equal(
      measurement.documentHeight,
      measurement.viewportHeight,
      `${href} must not push its workspace footer below the viewport.`
    );
    measurements.push({ href, ...measurement });
  }

  const reference = measurements[0];
  for (const measurement of measurements.slice(1)) {
    for (const property of ["top", "bottom", "height"]) {
      assert(
        Math.abs(measurement.workspace[property] - reference.workspace[property]) <= 1,
        `${measurement.href} workspace ${property} differs from Cyber COP at ${viewport.width}x${viewport.height}.`
      );
      assert(
        Math.abs(measurement.footer[property] - reference.footer[property]) <= 1,
        `${measurement.href} footer ${property} differs from Cyber COP at ${viewport.width}x${viewport.height}.`
      );
    }
  }
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: browserPath(),
  args: ["--no-first-run", "--disable-background-networking"]
});

try {
  const page = await browser.newPage();
  let drillThroughPage = null;
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

  const workspaceRoutes = [
    ["/cyber-cop", "Compliance Scores"],
    ["/networks", "Networks Roll-Up Posture Summary"],
    ["/systems", "ICT Systems Roll-Up Posture Summary"],
    ["/networks/net-1", "Aegis Mesh North"],
    ["/systems/sys-1", "Falcon Ops Hub"]
  ];
  await assertAlignedWorkspaceFooters(page, { width: 1600, height: 1000 }, workspaceRoutes);
  await assertAlignedWorkspaceFooters(page, { width: 1440, height: 900 }, workspaceRoutes);
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });

  // Internal drill-throughs intentionally use noreferrer/noopener. Prove the
  // shared offline session authenticates the independent file:// tab without
  // weakening that isolation or prompting for the demo credentials again.
  await navigateAndWait(page, "/networks/net-1", "Aegis Mesh North");
  const drillThroughSelector = 'a[target="_blank"][href^="#/systems/"]';
  await page.waitForSelector(drillThroughSelector);
  const drillThrough = await page.$eval(drillThroughSelector, (anchor) => ({
    hash: anchor.getAttribute("href"),
    label: anchor.textContent?.trim()
  }));
  assert(drillThrough.hash?.startsWith("#/systems/"), "The ICT system drill-through route was not available.");
  assert(drillThrough.label, "The ICT system drill-through label was not available.");

  const existingTargets = new Set(browser.targets());
  await page.click(drillThroughSelector);
  const drillThroughTarget = await browser.waitForTarget(
    (target) => target.type() === "page" && !existingTargets.has(target),
    { timeout: 15_000 }
  );
  drillThroughPage = await drillThroughTarget.page();
  assert(drillThroughPage, "The ICT system drill-through did not open a browser tab.");
  drillThroughPage.setDefaultTimeout(120_000);
  drillThroughPage.on("pageerror", (error) => runtimeErrors.push(error.message));
  drillThroughPage.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  drillThroughPage.on("request", (request) => {
    if (/^https?:/i.test(request.url())) {
      networkRequests.push(request.url());
    }
  });
  await drillThroughPage.setOfflineMode(true);
  await drillThroughPage.waitForFunction(
    (expectedHash, expectedLabel) =>
      window.location.hash === expectedHash &&
      !document.body.innerText.includes("Loading TSAAT...") &&
      document.body.innerText.includes(expectedLabel),
    {},
    drillThrough.hash,
    drillThrough.label
  );
  assert.equal(new URL(drillThroughPage.url()).protocol, "file:");
  assert.equal(await drillThroughPage.evaluate(() => window.opener === null), true);
  assert.equal(
    await drillThroughPage.evaluate(() => Boolean(document.querySelector('input[autocomplete="username"]'))),
    false,
    "The authenticated drill-through tab unexpectedly displayed Sign In."
  );
  assert.deepEqual(
    await drillThroughPage.evaluate(async () => (await fetch("/api/auth/session")).json()),
    { authenticated: true, username: "demo" },
    "The drill-through tab did not inherit the active offline session."
  );
  assert.equal(
    await page.evaluate(() => window.location.hash),
    "#/networks/net-1",
    "Opening the drill-through tab must not navigate the source tab."
  );
  await page.bringToFront();

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
      bodyText: document.body.innerText.slice(0, 1200),
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

  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    globalThis.__TSAAT_CMDB_REQUESTS__ = [];
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/assets/cmdb-details")) {
        globalThis.__TSAAT_CMDB_REQUESTS__.push(url);
      }
      return originalFetch(input, init);
    };
  });

  await navigateAndWait(
    page,
    "/systems/sys-1?dataDate=2026-04-16&systemDetailTab=discovery-compliance",
    "Falcon Ops Hub"
  );
  await page.waitForSelector("[data-cmdb-asset-id]");
  const baseCmdbAsset = await page.$eval("[data-cmdb-asset-id]", (button) => ({
    assetId: button.getAttribute("data-cmdb-asset-id"),
    name: button.textContent?.trim()
  }));
  assert(baseCmdbAsset.assetId, "The system discovery table CMDB trigger had no asset ID.");
  await page.click("[data-cmdb-asset-id]");
  await page.waitForSelector('[data-cmdb-drill-through] aside[data-load-state="ready"]');
  const baseCmdbResult = await page.evaluate(() => {
    const panel = document.querySelector("[data-cmdb-drill-through]");
    const request = globalThis.__TSAAT_CMDB_REQUESTS__.at(-1);
    return {
      panelText: panel?.textContent ?? "",
      requestDataDate: request ? new URL(request, window.location.href).searchParams.get("dataDate") : null,
      requestAssetId: request ? new URL(request, window.location.href).searchParams.get("assetId") : null,
      bodyOverflow: document.body.style.overflow,
      panelBackgroundColor: panel?.querySelector("aside")
        ? getComputedStyle(panel.querySelector("aside")).backgroundColor
        : null
    };
  });
  assert(baseCmdbResult.panelText.includes("CMDB Drill Through"));
  assert(baseCmdbResult.panelText.includes("Asset Details"));
  assert(baseCmdbResult.panelText.includes("CMDB Record"));
  assert(baseCmdbResult.panelText.includes(baseCmdbAsset.name), "The CMDB panel did not show the selected device.");
  assert.equal(baseCmdbResult.requestDataDate, "2026-04-16", "CMDB lookup lost the lite hash-route snapshot date.");
  assert.equal(baseCmdbResult.requestAssetId, baseCmdbAsset.assetId, "CMDB lookup used the wrong asset ID.");
  assert.equal(baseCmdbResult.bodyOverflow, "hidden", "The CMDB panel did not lock background scrolling.");
  assert.equal(
    baseCmdbResult.panelBackgroundColor,
    "rgb(2, 6, 23)",
    "The CMDB panel surface must be fully opaque."
  );
  await page.waitForFunction(() =>
    document.querySelector("[data-cmdb-drill-through] aside")?.classList.contains("translate-x-0")
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  const assertCmdbFocusIsContained = async () => {
    const activeLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    assert.equal(activeLabel, "Close CMDB Drill Through", "The CMDB drawer did not receive initial focus.");
  };
  await assertCmdbFocusIsContained();
  await page.keyboard.press("Tab");
  await assertCmdbFocusIsContained();
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  await assertCmdbFocusIsContained();
  await page.click('button[aria-label="Close CMDB Drill Through"]');
  await page.waitForFunction(() => !document.querySelector("[data-cmdb-drill-through]"));
  const baseCmdbClosed = await page.evaluate((assetId) => ({
    bodyOverflow: document.body.style.overflow,
    focusReturned: document.activeElement?.getAttribute("data-cmdb-asset-id") === assetId
  }), baseCmdbAsset.assetId);
  assert.equal(baseCmdbClosed.bodyOverflow, "", "Closing CMDB did not restore background scrolling.");
  assert(baseCmdbClosed.focusReturned, "Closing CMDB did not return focus to the selected device name.");

  const unknownCmdbStatus = await page.evaluate(async () =>
    (await fetch("/api/assets/cmdb-details?assetId=unknown-device&dataDate=2026-04-16")).status
  );
  assert.equal(unknownCmdbStatus, 404, "Unknown CMDB device IDs must return 404.");

  await navigateAndWait(page, "/findings?dataDate=2026-04-16&findingsViewTab=register", "Findings Register");
  const affectedCisOpened = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find(
      (candidate) => candidate.textContent?.trim() === "Findings Register"
    );
    const register = heading?.closest(".panel");
    const titleButton = register?.querySelector("tbody tr button");
    titleButton?.click();
    return Boolean(titleButton);
  });
  assert(affectedCisOpened, "A Findings Register affected-CI drill-through could not be opened.");
  const nestedCmdbSelector =
    'aside[aria-labelledby="findings-register-asset-details-title"] [data-cmdb-asset-id]';
  await page.waitForSelector(nestedCmdbSelector);
  const nestedAssetName = await page.$eval(nestedCmdbSelector, (button) => button.textContent?.trim() ?? "");
  await page.click(nestedCmdbSelector);
  await page.waitForSelector('[data-cmdb-drill-through] aside[data-load-state="ready"]');
  assert(
    await page.$eval("[data-cmdb-drill-through]", (panel, name) => panel.textContent?.includes(name), nestedAssetName),
    "The nested affected-CI device name did not open its CMDB details."
  );
  await page.waitForFunction(() =>
    document.querySelector("[data-cmdb-drill-through] aside")?.classList.contains("translate-x-0")
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("[data-cmdb-drill-through]"));
  assert(
    await page.$('aside[aria-labelledby="findings-register-asset-details-title"]'),
    "Escaping nested CMDB details also closed the underlying Affected CIs panel."
  );

  await navigateAndWait(page, "/cyber-cop", "Compliance Scores");
  await page.click("#cyber-cop-tab-action");
  await page.waitForSelector('[role="tablist"][aria-label="Cyber COP action plan tabs"]');
  const readActionPlanState = async () =>
    page.evaluate(() => {
      const tablist = document.querySelector('[role="tablist"][aria-label="Cyber COP action plan tabs"]');
      const selectedTab = tablist?.querySelector('[role="tab"][aria-selected="true"]');
      const panels = Array.from(document.querySelectorAll('[id^="cyber-cop-action-plan-panel-"]'));
      const activePanel = panels.find((panel) => !panel.classList.contains("hidden"));
      return {
        selectedTabId: selectedTab?.id ?? null,
        selectedTabText: selectedTab?.textContent?.trim() ?? "",
        focusedElementId: document.activeElement?.id ?? null,
        activePanelText: activePanel?.textContent ?? "",
        visiblePanelCount: panels.filter((panel) => !panel.classList.contains("hidden")).length,
        panelCount: panels.length
      };
    });
  const threatActionPlanState = await readActionPlanState();
  assert.equal(threatActionPlanState.selectedTabId, "cyber-cop-action-plan-tab-threat-surface");
  assert.equal(threatActionPlanState.panelCount, 3, "The Action view must provide exactly three plan panels.");
  assert.equal(threatActionPlanState.visiblePanelCount, 1, "Only one Action plan panel may be visible.");
  assert(threatActionPlanState.activePanelText.includes("Critical/High Open Findings > 60 days old"));
  assert(threatActionPlanState.activePanelText.includes("Immediate action (critical and High-risk findings)"));
  assert(threatActionPlanState.activePanelText.includes("Quick Wins by Recommended Action"));
  assert(!threatActionPlanState.activePanelText.includes("Oldest Open Findings"));

  await page.focus("#cyber-cop-action-plan-tab-threat-surface");
  await page.keyboard.press("ArrowRight");
  const discoveryActionPlanState = await readActionPlanState();
  assert.equal(discoveryActionPlanState.selectedTabId, "cyber-cop-action-plan-tab-discovery");
  assert.equal(discoveryActionPlanState.focusedElementId, "cyber-cop-action-plan-tab-discovery");
  assert.equal(discoveryActionPlanState.visiblePanelCount, 1);
  assert(discoveryActionPlanState.activePanelText.includes("Networks without discovery enabled"));
  assert(
    discoveryActionPlanState.activePanelText.includes(
      "Enable discovery on managed networks currently marked Discovery Non Enabled."
    )
  );
  assert(!discoveryActionPlanState.activePanelText.includes("Critical/High Open Findings > 60 days old"));

  await page.keyboard.press("End");
  const modellingActionPlanState = await readActionPlanState();
  assert.equal(modellingActionPlanState.selectedTabId, "cyber-cop-action-plan-tab-ict-system-modelling");
  assert.equal(modellingActionPlanState.focusedElementId, "cyber-cop-action-plan-tab-ict-system-modelling");
  assert.equal(modellingActionPlanState.visiblePanelCount, 1);
  assert(modellingActionPlanState.activePanelText.includes("ICT Systems not modelled"));
  assert(
    modellingActionPlanState.activePanelText.includes(
      "Complete TSAAT models for DIIS-defined ICT systems that are not modelled."
    )
  );
  assert(!modellingActionPlanState.activePanelText.includes("Networks without discovery enabled"));

  await page.keyboard.press("ArrowLeft");
  const discoveryViaLeftActionPlanState = await readActionPlanState();
  assert.equal(discoveryViaLeftActionPlanState.selectedTabId, "cyber-cop-action-plan-tab-discovery");
  assert.equal(discoveryViaLeftActionPlanState.focusedElementId, "cyber-cop-action-plan-tab-discovery");
  assert.equal(discoveryViaLeftActionPlanState.visiblePanelCount, 1);

  await page.keyboard.press("Home");
  const threatViaHomeActionPlanState = await readActionPlanState();
  assert.equal(threatViaHomeActionPlanState.selectedTabId, "cyber-cop-action-plan-tab-threat-surface");
  assert.equal(threatViaHomeActionPlanState.focusedElementId, "cyber-cop-action-plan-tab-threat-surface");
  assert.equal(threatViaHomeActionPlanState.visiblePanelCount, 1);
  assert(threatViaHomeActionPlanState.activePanelText.includes("Critical/High Open Findings > 60 days old"));

  const tabSelected = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "ICT System Impact Analyser"
    );
    button?.click();
    return Boolean(button);
  });
  assert(tabSelected, "ICT System Impact Analyser tab was not found.");
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    globalThis.__TSAAT_ICT_DEPENDENCY_REQUESTS__ = [];
    globalThis.__TSAAT_SERVER_COMPLIANCE_REQUESTS__ = [];
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/cyber-cop/impact-analyser-2/dependencies")) {
        globalThis.__TSAAT_ICT_DEPENDENCY_REQUESTS__.push(url);
      }
      if (url.includes("/api/cyber-cop/impact-analyser-2/compliance")) {
        globalThis.__TSAAT_SERVER_COMPLIANCE_REQUESTS__.push(url);
      }
      return originalFetch(input, init);
    };
  });
  await page.waitForSelector('button[aria-label="Select ICT systems for the ICT System Impact Analyser"]');
  await page.click('button[aria-label="Select ICT systems for the ICT System Impact Analyser"]');
  await page.waitForSelector('[role="listbox"] input[type="checkbox"]');
  const selectedIctSystemName = await page.$eval(
    '[role="listbox"] label[role="option"]',
    (label) => label.textContent?.trim() ?? ""
  );
  assert(selectedIctSystemName, "The selected ICT system option had no name.");
  const ictSystemOptionSelector = '[data-impact-analyser-selection-option="ict-system"]';
  await page.click(`${ictSystemOptionSelector} span[title]`);
  await page.waitForFunction(
    (selector) => {
      const option = document.querySelector(selector);
      const checkbox = option?.querySelector('input[type="checkbox"]');
      const trigger = document.querySelector('button[aria-label="Select ICT systems for the ICT System Impact Analyser"]');
      return checkbox?.checked && option?.getAttribute("aria-selected") === "true" && trigger?.getAttribute("aria-expanded") === "true";
    },
    {},
    ictSystemOptionSelector
  );
  await page.click(`${ictSystemOptionSelector} input[type="checkbox"]`);
  await page.waitForFunction(
    (selector) => !document.querySelector(selector)?.querySelector('input[type="checkbox"]')?.checked,
    {},
    ictSystemOptionSelector
  );
  await page.focus(`${ictSystemOptionSelector} input[type="checkbox"]`);
  await page.keyboard.press("Space");
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.querySelector('input[type="checkbox"]')?.checked,
    {},
    ictSystemOptionSelector
  );
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
  await page.waitForFunction(() => {
    const trigger = document.querySelector('button[aria-controls="cyber-cop-ict-system-dependencies-overlay"]');
    return trigger instanceof HTMLButtonElement && !trigger.disabled;
  });
  const dependencyTriggerPlacement = await page.evaluate((expectedLabel) => {
    const trigger = document.querySelector('button[aria-controls="cyber-cop-ict-system-dependencies-overlay"]');
    const filterRow = trigger?.parentElement;
    const triggerRect = trigger?.getBoundingClientRect();
    const filterRowRect = filterRow?.getBoundingClientRect();
    return {
      label: trigger?.textContent?.trim() ?? "",
      isLastControl: Boolean(trigger && filterRow?.lastElementChild === trigger),
      isRightAligned: Boolean(
        triggerRect && filterRowRect && Math.abs(filterRowRect.right - triggerRect.right) <= 2
      ),
      hasExpectedLabel: trigger?.textContent?.trim() === expectedLabel
    };
  }, dependencyButtonLabel);
  assert(dependencyTriggerPlacement.hasExpectedLabel, "The ICT dependency trigger did not use its exact label.");
  assert(dependencyTriggerPlacement.isLastControl, "The ICT dependency trigger was not the final analyser filter control.");
  assert(dependencyTriggerPlacement.isRightAligned, "The ICT dependency trigger was not aligned to the filter row's far right.");
  assert(
    await page.$('[data-impact-analyser-filter-row="risk"]'),
    "The parent ICT System Impact Analyser filter row was not visible before dependencies opened."
  );

  await page.click('button[aria-controls="cyber-cop-ict-system-dependencies-overlay"]');
  await page.waitForSelector('#cyber-cop-ict-system-dependencies-overlay[role="dialog"]');
  const dependencyOverlayGeometry = await page.evaluate(() => {
    const overlay = document.querySelector('[data-impact-analyser-diagram-overlay="true"]');
    const diagramPane = overlay?.parentElement;
    const parentChart = diagramPane?.closest('[data-impact-analyser-mode="risk"]');
    const dialog = document.querySelector('#cyber-cop-ict-system-dependencies-overlay[role="dialog"]');
    const overlayRect = overlay?.getBoundingClientRect();
    const diagramPaneRect = diagramPane?.getBoundingClientRect();
    const coversDiagramPane = Boolean(
      overlayRect &&
        diagramPaneRect &&
        Math.abs(overlayRect.left - diagramPaneRect.left) <= 1 &&
        Math.abs(overlayRect.top - diagramPaneRect.top) <= 1 &&
        Math.abs(overlayRect.right - diagramPaneRect.right) <= 1 &&
        Math.abs(overlayRect.bottom - diagramPaneRect.bottom) <= 1
    );
    return {
      coversDiagramPane,
      parentFilterHidden: !parentChart?.querySelector('[data-impact-analyser-filter-row="risk"]'),
      parentTriggerHidden: !parentChart?.querySelector(
        'button[aria-controls="cyber-cop-ict-system-dependencies-overlay"]'
      ),
      dependencyFilterVisible: Boolean(dialog?.querySelector('[data-impact-analyser-filter-row="dependencies"]')),
      closeVisible: Boolean(dialog?.querySelector('button[aria-label="Close ICT System Dependencies"]')),
      exportVisible: Boolean(dialog?.querySelector('button[aria-label="Export ICT System Dependencies to Excel"]'))
    };
  });
  assert(dependencyOverlayGeometry.coversDiagramPane, "The dependency overlay did not cover the base diagram pane.");
  assert(dependencyOverlayGeometry.parentFilterHidden, "Opening dependencies did not hide the parent analyser filters.");
  assert(dependencyOverlayGeometry.parentTriggerHidden, "Opening dependencies did not hide the parent dependency trigger.");
  assert(dependencyOverlayGeometry.dependencyFilterVisible, "The dependency view's own filter row was hidden.");
  assert(dependencyOverlayGeometry.closeVisible, "The dependency Close control was not visible.");
  assert(dependencyOverlayGeometry.exportVisible, "The dependency Excel export control was not visible.");

  await page.waitForFunction(
    (expectedOrder) => {
      const dialog = document.querySelector('#cyber-cop-ict-system-dependencies-overlay[role="dialog"]');
      const axisMarker = dialog?.querySelector("[data-dependency-axis-order]");
      return (
        axisMarker?.getAttribute("data-dependency-axis-order") === expectedOrder &&
        !dialog?.textContent?.includes("Loading analyser data...") &&
        Boolean(dialog?.querySelector('canvas[aria-label="ICT System Dependencies Canvas WebGL parallel coordinates"]'))
      );
    },
    {},
    dependencyAxisContract
  );
  await page.waitForFunction(() => globalThis.__TSAAT_ICT_DEPENDENCY_REQUESTS__.length > 0);
  const dependencyApiResult = await page.evaluate(async () => {
    const requests = globalThis.__TSAAT_ICT_DEPENDENCY_REQUESTS__.slice();
    const requestUrl = requests.find((url) => url.includes("/api/cyber-cop/impact-analyser-2/dependencies"));
    if (!requestUrl) {
      return { requests, requestUrl: null };
    }
    const response = await fetch(requestUrl);
    const payload = await response.json();
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const parsedRequest = new URL(requestUrl, window.location.href);
    const scope = parsedRequest.searchParams.get("diagramSystemIds")?.split(",").filter(Boolean) ?? [];
    return {
      requests,
      requestUrl,
      status: response.status,
      requestDataDate: parsedRequest.searchParams.get("dataDate"),
      scope,
      totalRows: payload.totalRows,
      rowCount: rows.length,
      allServerToServer: rows.every(
        (row) =>
          row.assetType === "server" &&
          row.relatedAssetType === "server" &&
          Boolean(row.assetId) &&
          Boolean(row.relatedAssetId) &&
          row.assetId !== row.relatedAssetId
      ),
      allRowsHaveDependencyIds: rows.every((row) => Boolean(row.dependencyId)),
      allRowsUseAppliedScope: rows.every((row) => scope.includes(row.systemId)),
      notModelledRowCount: rows.filter((row) => row.relatedSystemName === "Not Modelled").length,
      hasNotModelled: rows.some(
        (row) => row.relatedSystemName === "Not Modelled" && row.relatedSystemId === null
      )
    };
  });
  assert(dependencyApiResult.requestUrl, "Opening ICT System Dependencies did not call its dependency endpoint.");
  assert.equal(dependencyApiResult.status, 200, "The ICT System Dependencies endpoint did not return HTTP 200.");
  assert.equal(dependencyApiResult.scope.length, 1, "The dependency request did not preserve the applied ICT system scope.");
  assert.equal(
    dependencyApiResult.requestDataDate,
    apiResults.snapshotDate,
    "The dependency request did not preserve the Cyber COP snapshot date."
  );
  assert(dependencyApiResult.rowCount > 0, "The ICT System Dependencies endpoint returned no rows.");
  assert.equal(dependencyApiResult.totalRows, dependencyApiResult.rowCount, "The dependency totalRows contract was inconsistent.");
  assert(dependencyApiResult.allServerToServer, "The dependency endpoint returned a non-server or self dependency.");
  assert(dependencyApiResult.allRowsHaveDependencyIds, "A dependency endpoint row did not retain its dependency ID.");
  assert(dependencyApiResult.allRowsUseAppliedScope, "A dependency endpoint row escaped the applied ICT system scope.");
  assert(dependencyApiResult.hasNotModelled, "The dependency endpoint returned no Not Modelled dependent system.");
  assert(dependencyApiResult.notModelledRowCount > 0, "No Not Modelled rows were available to verify the new filter.");

  const dependencyDiagramResult = await page.evaluate((expectedOrder) => {
    const dialog = document.querySelector('#cyber-cop-ict-system-dependencies-overlay[role="dialog"]');
    const axisMarker = dialog?.querySelector("[data-dependency-axis-order]");
    const legend = dialog?.querySelector('[data-not-modelled-node-legend="true"]');
    const circle = legend?.querySelector("span");
    const circleRect = circle?.getBoundingClientRect();
    const circleStyle = circle ? getComputedStyle(circle) : null;
    return {
      axisOrder: axisMarker?.getAttribute("data-dependency-axis-order") ?? "",
      axisOrderMatches: axisMarker?.getAttribute("data-dependency-axis-order") === expectedOrder,
      legendText: legend?.textContent?.trim() ?? "",
      circleIsRed: circleStyle?.backgroundColor === "rgb(239, 68, 68)",
      circleIsRound: Boolean(
        circleRect &&
          circleStyle &&
          circleRect.width > 0 &&
          Math.abs(circleRect.width - circleRect.height) <= 0.5 &&
          Number.parseFloat(circleStyle.borderRadius) >= circleRect.width / 2
      )
    };
  }, dependencyAxisContract);
  assert(dependencyDiagramResult.axisOrderMatches, `The dependency axes were not ${dependencyAxisContract}.`);
  assert.equal(dependencyDiagramResult.legendText, "Not Modelled", "The terminal-node legend label was incorrect.");
  assert(dependencyDiagramResult.circleIsRed, "The Not Modelled terminal-node legend was not red.");
  assert(dependencyDiagramResult.circleIsRound, "The Not Modelled terminal-node legend was not circular.");

  const dependentSystemFilterSelector =
    '[data-impact-analyser-multi-filter="Dependent ICT Systems"]';
  const dependentSystemFilterIsOpen = await page.$eval(
    `${dependentSystemFilterSelector} > button`,
    (button) => button.getAttribute("aria-expanded") === "true"
  );
  if (!dependentSystemFilterIsOpen) {
    await page.click(`${dependentSystemFilterSelector} > button`);
  }
  const dependentSystemFilterOptions = await page.$eval(dependentSystemFilterSelector, (filter) =>
    Array.from(filter.querySelectorAll("label"), (label) => label.textContent?.trim() ?? "")
  );
  assert.equal(
    dependentSystemFilterOptions[0],
    "Not Modelled",
    "Not Modelled was not the first Dependent ICT Systems option."
  );
  const selectedNotModelled = await page.$eval(dependentSystemFilterSelector, (filter) => {
    const option = Array.from(filter.querySelectorAll("label")).find(
      (label) => label.textContent?.trim() === "Not Modelled"
    );
    const checkbox = option?.querySelector('input[type="checkbox"]');
    checkbox?.click();
    return Boolean(checkbox);
  });
  assert(selectedNotModelled, "The Not Modelled dependent ICT system option was not selectable.");
  await page.waitForFunction(
    (selector, expectedCount) => {
      const filter = document.querySelector(selector);
      const count = document
        .querySelector('#cyber-cop-ict-system-dependencies-overlay [data-impact-analyser-filtered-row-count]')
        ?.getAttribute("data-impact-analyser-filtered-row-count");
      return filter?.querySelector(":scope > button span")?.textContent?.trim() === "Not Modelled" &&
        Number(count) === expectedCount;
    },
    {},
    dependentSystemFilterSelector,
    dependencyApiResult.notModelledRowCount
  );

  await page.evaluate(() => {
    globalThis.__TSAAT_DEPENDENCY_EXCEL_CAPTURE__ = {
      fileName: "",
      mimeType: "",
      workbookXml: ""
    };
    globalThis.__TSAAT_ORIGINAL_CREATE_OBJECT_URL__ = URL.createObjectURL.bind(URL);
    globalThis.__TSAAT_ORIGINAL_ANCHOR_CLICK__ = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      const objectUrl = globalThis.__TSAAT_ORIGINAL_CREATE_OBJECT_URL__(blob);
      if (blob.type.startsWith("application/vnd.ms-excel")) {
        globalThis.__TSAAT_DEPENDENCY_EXCEL_CAPTURE__.mimeType = blob.type;
        blob.text().then((workbookXml) => {
          globalThis.__TSAAT_DEPENDENCY_EXCEL_CAPTURE__.workbookXml = workbookXml;
        });
      }
      return objectUrl;
    };
    HTMLAnchorElement.prototype.click = function captureDependencyExcelDownload() {
      if (this.download.startsWith("ict-system-dependencies-")) {
        globalThis.__TSAAT_DEPENDENCY_EXCEL_CAPTURE__.fileName = this.download;
        return;
      }
      return globalThis.__TSAAT_ORIGINAL_ANCHOR_CLICK__.call(this);
    };
  });
  await page.click('button[aria-label="Export ICT System Dependencies to Excel"]');
  await page.waitForFunction(
    () =>
      Boolean(globalThis.__TSAAT_DEPENDENCY_EXCEL_CAPTURE__?.fileName) &&
      Boolean(globalThis.__TSAAT_DEPENDENCY_EXCEL_CAPTURE__?.workbookXml)
  );
  const dependencyExcelExport = await page.evaluate(() => {
    const capture = globalThis.__TSAAT_DEPENDENCY_EXCEL_CAPTURE__;
    const workbook = new DOMParser().parseFromString(capture.workbookXml, "application/xml");
    const parserError = workbook.querySelector("parsererror")?.textContent ?? "";
    const rows = Array.from(workbook.getElementsByTagName("Row"), (row) =>
      Array.from(row.getElementsByTagName("Data"), (cell) => cell.textContent ?? "")
    );
    URL.createObjectURL = globalThis.__TSAAT_ORIGINAL_CREATE_OBJECT_URL__;
    HTMLAnchorElement.prototype.click = globalThis.__TSAAT_ORIGINAL_ANCHOR_CLICK__;
    return {
      fileName: capture.fileName,
      mimeType: capture.mimeType,
      workbookXml: capture.workbookXml,
      parserError,
      rows
    };
  });
  assert.equal(
    dependencyExcelExport.fileName,
    `ict-system-dependencies-${apiResults.snapshotDate}.xls`,
    "The dependency Excel filename did not retain the snapshot date."
  );
  assert(
    dependencyExcelExport.mimeType.startsWith("application/vnd.ms-excel"),
    "The dependency export did not use an Excel MIME type."
  );
  assert.equal(dependencyExcelExport.parserError, "", "The dependency SpreadsheetML export was invalid XML.");
  assert(dependencyExcelExport.workbookXml.includes("Excel.Sheet"), "The export was not an Excel workbook.");
  assert.deepEqual(
    dependencyExcelExport.rows[0],
    dependencyAxisContract.split(" -> "),
    "The dependency workbook columns did not match the diagram."
  );
  const dependencyExcelDataRows = dependencyExcelExport.rows.slice(1);
  assert.equal(
    dependencyExcelDataRows.length,
    dependencyApiResult.notModelledRowCount,
    "The dependency workbook did not export the currently filtered diagram rows."
  );
  assert(
    dependencyExcelDataRows.every((row) => row.length === 6 && row[5] === "Not Modelled"),
    "The Not Modelled export contained a row outside the selected dependent ICT system."
  );

  const dependentSystemFilterIsStillOpen = await page.$eval(
    `${dependentSystemFilterSelector} > button`,
    (button) => button.getAttribute("aria-expanded") === "true"
  );
  if (!dependentSystemFilterIsStillOpen) {
    await page.click(`${dependentSystemFilterSelector} > button`);
  }
  const clearedDependentSystemFilter = await page.$eval(dependentSystemFilterSelector, (filter) => {
    const allButton = Array.from(filter.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "All"
    );
    allButton?.click();
    return Boolean(allButton);
  });
  assert(clearedDependentSystemFilter, "The Dependent ICT Systems filter could not be cleared.");
  await page.waitForFunction(
    (selector, expectedCount) => {
      const filter = document.querySelector(selector);
      const count = document
        .querySelector('#cyber-cop-ict-system-dependencies-overlay [data-impact-analyser-filtered-row-count]')
        ?.getAttribute("data-impact-analyser-filtered-row-count");
      return filter?.querySelector(":scope > button span")?.textContent?.trim() === "All" &&
        Number(count) === expectedCount;
    },
    {},
    dependentSystemFilterSelector,
    dependencyApiResult.rowCount
  );

  await page.click('button[aria-label="Close ICT System Dependencies"]');
  await page.waitForFunction(
    () =>
      !document.querySelector("#cyber-cop-ict-system-dependencies-overlay") &&
      document.activeElement?.getAttribute("aria-controls") === "cyber-cop-ict-system-dependencies-overlay"
  );
  const dependencyCloseState = await page.evaluate(() => ({
    baseCanvasRestored: Boolean(
      document.querySelector('canvas[aria-label="ICT System Impact Analyser Canvas WebGL parallel coordinates"]')
    ),
    focusReturned:
      document.activeElement?.getAttribute("aria-controls") === "cyber-cop-ict-system-dependencies-overlay",
    parentFilterRestored: Boolean(document.querySelector('[data-impact-analyser-filter-row="risk"]')),
    expanded: document
      .querySelector('button[aria-controls="cyber-cop-ict-system-dependencies-overlay"]')
      ?.getAttribute("aria-expanded")
  }));
  assert(dependencyCloseState.baseCanvasRestored, "Closing dependencies did not restore the base ICT analyser diagram.");
  assert(dependencyCloseState.focusReturned, "Closing dependencies did not return focus to its trigger.");
  assert(dependencyCloseState.parentFilterRestored, "Closing dependencies did not restore the parent analyser filters.");
  assert.equal(dependencyCloseState.expanded, "false", "The dependency trigger remained expanded after Close.");

  await page.click('button[aria-controls="cyber-cop-ict-system-dependencies-overlay"]');
  await page.waitForSelector("#cyber-cop-ict-system-dependencies-overlay");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      !document.querySelector("#cyber-cop-ict-system-dependencies-overlay") &&
      Boolean(document.querySelector('[data-impact-analyser-filter-row="risk"]')) &&
      document.activeElement?.getAttribute("aria-controls") === "cyber-cop-ict-system-dependencies-overlay"
  );
  const ictSearchAsset = await page.evaluate(async (systemName) => {
    const response = await fetch("/api/cyber-cop/impact-analyser-2");
    const payload = await response.json();
    const row = (payload.rows ?? []).find((candidate) => candidate.systemName === systemName);
    return row ? { assetId: row.assetId, assetName: row.assetName } : null;
  }, selectedIctSystemName);
  assert(ictSearchAsset?.assetId, "No CMDB-backed device was available in the selected ICT system.");
  await clearAndType(page, 'input[placeholder="Search diagram"]', ictSearchAsset.assetName);
  const analyserSearchCmdbTrigger = await page.waitForFunction((assetId) => {
    const searchInput = document.querySelector('input[placeholder="Search diagram"]');
    const searchResults = searchInput?.parentElement?.querySelector("ul");
    return Array.from(searchResults?.querySelectorAll("[data-cmdb-asset-id]") ?? []).find(
      (element) => element.getAttribute("data-cmdb-asset-id") === assetId
    );
  }, {}, ictSearchAsset.assetId);
  const analyserSearchCmdbElement = analyserSearchCmdbTrigger.asElement();
  assert(analyserSearchCmdbElement, "The analyser device-name search result was not CMDB-enabled.");
  await analyserSearchCmdbElement.click();
  await page.waitForSelector('[data-cmdb-drill-through] aside[data-load-state="ready"]');
  assert(
    await page.$eval(
      "[data-cmdb-drill-through]",
      (panel, assetName) => panel.textContent?.includes(assetName),
      ictSearchAsset.assetName
    ),
    "The analyser search-result device name did not open CMDB details."
  );
  await page.waitForFunction(() =>
    document.querySelector("[data-cmdb-drill-through] aside")?.classList.contains("translate-x-0")
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("[data-cmdb-drill-through]"));

  await clearAndType(page, 'input[placeholder="Search diagram"]', ictSearchAsset.assetName);
  const analyserSearchSelectTrigger = await page.waitForFunction((assetId) => {
    const cmdbTrigger = Array.from(document.querySelectorAll("[data-cmdb-asset-id]")).find(
      (element) => element.getAttribute("data-cmdb-asset-id") === assetId
    );
    return Array.from(cmdbTrigger?.parentElement?.querySelectorAll("button") ?? []).find(
      (button) => button.getAttribute("aria-label")?.startsWith("Select ")
    );
  }, {}, ictSearchAsset.assetId);
  const analyserSearchSelectElement = analyserSearchSelectTrigger.asElement();
  assert(analyserSearchSelectElement, "The analyser search result did not expose its diagram selection action.");
  await analyserSearchSelectElement.click();
  await page.waitForFunction(
    (assetId) => {
      const action = document.querySelector('[data-impact-analyser-node-action="server-compliance"]');
      return action instanceof HTMLButtonElement && action.dataset.assetId === assetId;
    },
    {},
    ictSearchAsset.assetId
  );
  const serverComplianceActionGeometry = await page.evaluate((assetId) => {
    const action = document.querySelector(
      `[data-impact-analyser-node-action="server-compliance"][data-asset-id="${CSS.escape(assetId)}"]`
    );
    const rect = action?.getBoundingClientRect();
    const style = action ? getComputedStyle(action) : null;
    return {
      label: action?.textContent?.trim() ?? "",
      ariaLabel: action?.getAttribute("aria-label") ?? "",
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      isRound: Boolean(rect && style && Number.parseFloat(style.borderRadius) >= rect.width / 2)
    };
  }, ictSearchAsset.assetId);
  assert.equal(serverComplianceActionGeometry.label, "C", "The selected server Compliance action was not labelled C.");
  assert(
    serverComplianceActionGeometry.ariaLabel.includes(ictSearchAsset.assetName),
    "The selected server Compliance action did not name its server."
  );
  assert.equal(serverComplianceActionGeometry.width, 14, "The selected server Compliance action width changed.");
  assert.equal(serverComplianceActionGeometry.height, 14, "The selected server Compliance action height changed.");
  assert(serverComplianceActionGeometry.isRound, "The selected server Compliance action was not circular.");

  await page.click(
    `[data-impact-analyser-node-action="server-compliance"][data-asset-id="${ictSearchAsset.assetId}"]`
  );
  await page.waitForSelector('[data-server-compliance-view][data-load-state="ready"]');
  await page.waitForFunction(() => globalThis.__TSAAT_SERVER_COMPLIANCE_REQUESTS__.length > 0);
  const serverComplianceResult = await page.evaluate(async (expectedAssetId) => {
    const requests = globalThis.__TSAAT_SERVER_COMPLIANCE_REQUESTS__.slice();
    const requestUrl = requests.find((url) => url.includes("/api/cyber-cop/impact-analyser-2/compliance"));
    const parsedRequest = requestUrl ? new URL(requestUrl, window.location.href) : null;
    const response = requestUrl ? await fetch(requestUrl) : null;
    const payload = response ? await response.json() : null;
    const backdrop = document.querySelector("[data-server-compliance-view]");
    const dialog = backdrop?.querySelector('[role="dialog"][aria-modal="true"]');
    const backdropRect = backdrop?.getBoundingClientRect();
    const dialogRect = dialog?.getBoundingClientRect();
    const overview = dialog?.querySelector('[data-server-compliance-section="overview"]');
    const scoreTiles = dialog?.querySelector('[data-server-compliance-score-tiles]');
    const measures = payload?.complianceOverview?.measures ?? [];
    const detailMeasure = measures.find((measure) => measure.findings?.length) ?? measures[0] ?? null;
    return {
      requestUrl,
      requestAssetId: parsedRequest?.searchParams.get("assetId") ?? null,
      requestDataDate: parsedRequest?.searchParams.get("dataDate") ?? null,
      status: response?.status ?? 0,
      payloadAssetId: payload?.asset?.id ?? null,
      complianceMeasureCount: payload?.complianceOverview?.measures?.length ?? 0,
      discoveryToolCount: payload?.discoveryCompliance?.tools?.length ?? 0,
      detailMeasureSpiId: detailMeasure?.spiId ?? null,
      detailMeasureFindingCount: detailMeasure?.findings?.length ?? 0,
      allMeasureLabelsUseSpiContract: measures.every((measure) => /^SPI \d+ - .+/.test(measure.label)),
      viewAssetId: backdrop?.getAttribute("data-asset-id") ?? null,
      fixedDialog: dialog?.getAttribute("data-server-compliance-dialog") === "fixed",
      dialogWidth: dialogRect?.width ?? 0,
      dialogHeight: dialogRect?.height ?? 0,
      overviewVisible: Boolean(overview),
      hasDrillThroughScoreTiles:
        scoreTiles?.textContent?.includes("Compliance Score") === true &&
        scoreTiles?.textContent?.includes("Discovery Compliance Score") === true,
      overviewHasSpiBreakdown: overview?.textContent?.includes("Security Posture Indicator breakdown") ?? false,
      overviewHasParityColumns:
        overview?.textContent?.includes("Score") === true &&
        overview?.textContent?.includes("Status Mix") === true &&
        overview?.textContent?.includes("Impacted Assets") === true &&
        overview?.textContent?.includes("Top Non-Compliance Reason") === true,
      centered: Boolean(
        backdropRect &&
          dialogRect &&
          Math.abs((backdropRect.left + backdropRect.right) / 2 - (dialogRect.left + dialogRect.right) / 2) <= 2 &&
          Math.abs((backdropRect.top + backdropRect.bottom) / 2 - (dialogRect.top + dialogRect.bottom) / 2) <= 2
      ),
      expectedAssetId
    };
  }, ictSearchAsset.assetId);
  assert(serverComplianceResult.requestUrl, "Selecting C did not request the server Compliance endpoint.");
  assert.equal(serverComplianceResult.status, 200, "The server Compliance endpoint did not return HTTP 200.");
  assert.equal(serverComplianceResult.requestAssetId, ictSearchAsset.assetId, "The Compliance request used the wrong server.");
  assert.equal(
    serverComplianceResult.requestDataDate,
    apiResults.snapshotDate,
    "The Compliance request did not preserve the Cyber COP snapshot date."
  );
  assert.equal(serverComplianceResult.payloadAssetId, ictSearchAsset.assetId, "The Compliance response used the wrong server.");
  assert.equal(serverComplianceResult.viewAssetId, ictSearchAsset.assetId, "The centered Compliance view used the wrong server.");
  assert(serverComplianceResult.centered, "The server Compliance view was not centered in its backdrop.");
  assert(serverComplianceResult.fixedDialog, "The resized server Compliance dialog did not expose its fixed-size contract.");
  assert(serverComplianceResult.dialogWidth > 1200, "The resized server Compliance dialog was not wide enough for its SPI table.");
  assert(serverComplianceResult.dialogHeight > 800, "The resized server Compliance dialog was not tall enough for its tab content.");
  assert(serverComplianceResult.overviewVisible, "Compliance Overview was not the initial Compliance view.");
  assert(serverComplianceResult.hasDrillThroughScoreTiles, "The drill-through-style Compliance score tiles were not rendered.");
  assert(serverComplianceResult.overviewHasSpiBreakdown, "Compliance Overview did not expose its SPI breakdown.");
  assert(serverComplianceResult.overviewHasParityColumns, "The SPI breakdown did not match the ICT-system measure columns.");
  assert(serverComplianceResult.allMeasureLabelsUseSpiContract, "A server measure did not use the SPI label contract.");
  assert(serverComplianceResult.complianceMeasureCount > 0, "The selected server returned no compliance measures.");
  assert(serverComplianceResult.discoveryToolCount > 0, "The selected server returned no discovery tools.");

  assert(serverComplianceResult.detailMeasureSpiId, "No SPI row was available for the nested Findings and Evidence view.");
  await page.click(
    `[data-server-compliance-measure-action="${serverComplianceResult.detailMeasureSpiId}"]`
  );
  await page.waitForSelector('[data-server-compliance-measure-detail="true"]');
  const serverMeasureDetailState = await page.$eval('[data-server-compliance-measure-detail="true"]', (detail) => ({
    hasTitle: detail.textContent?.includes("Findings and Evidence") ?? false,
    hasWorkflowFilter: Boolean(detail.querySelector("#server-spi-workflow-filter")),
    hasSeverityFilter: Boolean(detail.querySelector("#server-spi-severity-filter")),
    hasSearch: Boolean(detail.querySelector("#server-spi-findings-search")),
    findingRows: detail.querySelectorAll("tbody tr").length
  }));
  assert(serverMeasureDetailState.hasTitle, "Selecting an SPI did not open Findings and Evidence.");
  assert(serverMeasureDetailState.hasWorkflowFilter, "The SPI detail did not expose Workflow Status filtering.");
  assert(serverMeasureDetailState.hasSeverityFilter, "The SPI detail did not expose Findings Severity filtering.");
  assert(serverMeasureDetailState.hasSearch, "The SPI detail did not expose Text Search.");
  assert(serverMeasureDetailState.findingRows > 0, "The SPI detail did not render its findings/evidence table state.");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() =>
    !document.querySelector('[data-server-compliance-measure-detail="true"]') &&
    Boolean(document.querySelector("[data-server-compliance-view]"))
  );

  const discoveryComplianceSelected = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('[data-server-compliance-view] button')).find(
      (candidate) => candidate.textContent?.trim() === "Discovery Compliance"
    );
    button?.click();
    return Boolean(button);
  });
  assert(discoveryComplianceSelected, "The Discovery Compliance tab was not found.");
  await page.waitForSelector('[data-server-compliance-section="discovery"]');
  const discoveryComplianceState = await page.$eval('[data-server-compliance-section="discovery"]', (section) => {
    const dialog = section.closest('[data-server-compliance-dialog="fixed"]');
    const dialogRect = dialog?.getBoundingClientRect();
    return {
      hasScore: dialog?.querySelector('[data-server-compliance-score-tiles]')?.textContent?.includes("Discovery Compliance Score") ?? false,
      hasToolCoverage: section.textContent?.includes("Discovery Tool Coverage") ?? false,
      toolCards: section.querySelectorAll('article[class*="border-sky-300"]').length,
      toolRows: section.querySelectorAll("tbody tr").length,
      dialogWidth: dialogRect?.width ?? 0,
      dialogHeight: dialogRect?.height ?? 0
    };
  });
  assert(discoveryComplianceState.hasScore, "Discovery Compliance did not retain its drill-through score tile.");
  assert(discoveryComplianceState.hasToolCoverage, "Discovery Compliance did not expose tool coverage.");
  assert(discoveryComplianceState.toolCards > 0, "Discovery Compliance did not use the resized space for tool cards.");
  assert(discoveryComplianceState.toolRows > 0, "Discovery Compliance did not render its tool rows.");
  assert.equal(discoveryComplianceState.dialogWidth, serverComplianceResult.dialogWidth, "Switching tabs changed the server Compliance dialog width.");
  assert.equal(discoveryComplianceState.dialogHeight, serverComplianceResult.dialogHeight, "Switching tabs changed the server Compliance dialog height.");

  await page.click('button[aria-label="Close Server Compliance"]');
  await page.waitForFunction(() =>
    !document.querySelector("[data-server-compliance-view]") &&
    Boolean(document.querySelector('[data-impact-analyser-node-action="server-compliance"]'))
  );

  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    globalThis.__TSAAT_NETWORK_IMPACT_REQUESTS__ = [];
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/cyber-cop/impact-analyser-2")) {
        globalThis.__TSAAT_NETWORK_IMPACT_REQUESTS__.push(url);
      }
      return originalFetch(input, init);
    };
  });
  const networkTabSelected = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Network Impact Analyser"
    );
    button?.click();
    return Boolean(button);
  });
  assert(networkTabSelected, "Network Impact Analyser tab was not found.");
  await page.waitForSelector('button[aria-label="Select networks for the Network Impact Analyser"]');
  const networkHasDependencyTrigger = await page.evaluate((label) => {
    const selector = document.querySelector('button[aria-label="Select networks for the Network Impact Analyser"]');
    const panel = selector?.closest('[role="tabpanel"]');
    return Array.from(panel?.querySelectorAll("button") ?? []).some(
      (candidate) =>
        candidate.textContent?.trim() === label ||
        candidate.getAttribute("aria-controls") === "cyber-cop-ict-system-dependencies-overlay"
    );
  }, dependencyButtonLabel);
  assert.equal(networkHasDependencyTrigger, false, "Network Impact Analyser unexpectedly exposed ICT System Dependencies.");
  const initialNetworkRunDisabled = await page.evaluate(() => {
    const selector = document.querySelector('button[aria-label="Select networks for the Network Impact Analyser"]');
    const panel = selector?.closest('[role="tabpanel"]');
    const run = Array.from(panel?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.textContent?.trim() === "Run"
    );
    return Boolean(run?.disabled);
  });
  assert(initialNetworkRunDisabled, "Network Impact Analyser Run must start disabled.");
  await page.click('button[aria-label="Select networks for the Network Impact Analyser"]');
  await page.waitForSelector('[role="group"][aria-label="Networks"] input[type="checkbox"]');
  const networkOptionCount = await page.$$eval(
    '[data-impact-analyser-selection-option="network"]',
    (options) => options.length
  );
  assert(networkOptionCount >= 2, "Network Impact Analyser requires at least two demo network options.");
  const networkOptionSelector = '[data-impact-analyser-selection-option="network"]';
  const networkOptions = await page.$$(networkOptionSelector);
  await networkOptions[0].click({ offset: { x: 200, y: 12 } });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const firstNetworkRowSelection = await page.evaluate((optionSelector) => {
    const trigger = document.querySelector('button[aria-label="Select networks for the Network Impact Analyser"]');
    const firstOption = document.querySelector(optionSelector);
    return {
      stayedOpen:
        trigger?.getAttribute("aria-expanded") === "true" &&
        Boolean(document.querySelector('[role="group"][aria-label="Networks"]')),
      checked: firstOption?.querySelector('input[type="checkbox"]')?.checked ?? false
    };
  }, networkOptionSelector);
  assert(firstNetworkRowSelection.stayedOpen, "The network selector closed after the first option-row selection.");
  assert(firstNetworkRowSelection.checked, "Selecting the network option row did not tick its checkbox.");
  const remainingNetworkCheckboxes = await page.$$(
    '[role="group"][aria-label="Networks"] input[type="checkbox"]'
  );
  await remainingNetworkCheckboxes[1].click();
  await page.click('button[aria-label="Select networks for the Network Impact Analyser"]');
  await page.waitForFunction(() => {
    const selector = document.querySelector('button[aria-label="Select networks for the Network Impact Analyser"]');
    return selector?.getAttribute("aria-expanded") === "false";
  });
  const preRunNetworkRequests = await page.evaluate(() => globalThis.__TSAAT_NETWORK_IMPACT_REQUESTS__.slice());
  assert.deepEqual(preRunNetworkRequests, [], "Selecting networks must not load the analyser before Run.");
  const networkRunSelected = await page.evaluate(() => {
    const selector = document.querySelector('button[aria-label="Select networks for the Network Impact Analyser"]');
    const panel = selector?.closest('[role="tabpanel"]');
    const button = Array.from(panel?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.textContent?.trim() === "Run" && !candidate.disabled
    );
    button?.click();
    return Boolean(button);
  });
  assert(networkRunSelected, "Network Impact Analyser Run button was not enabled.");
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return !text.includes("Running...") && /finding paths across/.test(text);
  });
  const mountedNetworkHasDependencyTrigger = await page.evaluate((label) => {
    const selector = document.querySelector('button[aria-label="Select networks for the Network Impact Analyser"]');
    const panel = selector?.closest('[role="tabpanel"]');
    return Array.from(panel?.querySelectorAll("button") ?? []).some(
      (candidate) =>
        candidate.textContent?.trim() === label ||
        candidate.getAttribute("aria-controls") === "cyber-cop-ict-system-dependencies-overlay"
    );
  }, dependencyButtonLabel);
  assert.equal(
    mountedNetworkHasDependencyTrigger,
    false,
    "The mounted Network Impact Analyser unexpectedly exposed ICT System Dependencies."
  );
  const networkImpactResult = await page.evaluate(() => {
    const requests = globalThis.__TSAAT_NETWORK_IMPACT_REQUESTS__.slice();
    const dataRequest = requests.find((url) => !url.includes("/findings"));
    const scope = dataRequest
      ? new URL(dataRequest, window.location.href).searchParams.get("diagramNetworkIds")?.split(",").filter(Boolean) ?? []
      : [];
    const requestDataDate = dataRequest
      ? new URL(dataRequest, window.location.href).searchParams.get("dataDate")
      : null;
    return {
      requests,
      scope,
      requestDataDate,
      hasNetworkCanvas: Boolean(
        document.querySelector('canvas[aria-label="Network Impact Analyser Canvas WebGL parallel coordinates"]')
      ),
      hasAssetTypeFilter: document.body.textContent?.includes("Asset Type") ?? false
    };
  });
  assert.equal(networkImpactResult.scope.length, 2, "The analyser request must contain both selected network IDs.");
  assert.equal(
    networkImpactResult.requestDataDate,
    apiResults.snapshotDate,
    "The analyser request must preserve the Cyber COP snapshot date in the lite hash router."
  );
  assert.deepEqual(
    networkImpactResult.scope,
    [...networkImpactResult.scope].sort(),
    "The analyser request network scope must be stable and sorted."
  );
  assert(networkImpactResult.hasNetworkCanvas, "Network Impact Analyser canvas was not rendered.");
  assert(networkImpactResult.hasAssetTypeFilter, "Network Impact Analyser Asset Type filter was not rendered.");
  await page.click('button[aria-label="Select networks for the Network Impact Analyser"]');
  await page.waitForSelector('[role="group"][aria-label="Networks"]');
  const clearedNetworkSelection = await page.evaluate(() => {
    const group = document.querySelector('[role="group"][aria-label="Networks"]');
    const clear = Array.from(group?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.textContent?.includes("Clear selection")
    );
    clear?.click();
    return Boolean(clear);
  });
  assert(clearedNetworkSelection, "Network selection Clear action was not found.");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Select one or more networks, then select Run to load the analyser.") &&
      !document.querySelector('canvas[aria-label="Network Impact Analyser Canvas WebGL parallel coordinates"]')
  );
  const postClearNetworkRequests = await page.evaluate(() => globalThis.__TSAAT_NETWORK_IMPACT_REQUESTS__.slice());
  assert.deepEqual(
    postClearNetworkRequests,
    networkImpactResult.requests,
    "Clearing the pending network selection must not auto-load another report."
  );
  const networkFindingsApiResult = await page.evaluate(async (networkIds) => {
    const params = new URLSearchParams({ diagramNetworkIds: networkIds.join(",") });
    const dataResponse = await fetch(`/api/cyber-cop/impact-analyser-2?${params}`);
    params.set("spiId", "1");
    const findingsResponse = await fetch(`/api/cyber-cop/impact-analyser-2/findings?${params}`);
    const dualScopeParams = new URLSearchParams(params);
    dualScopeParams.set("diagramSystemIds", "unknown-system");
    const dualScopeFindingsResponse = await fetch(
      `/api/cyber-cop/impact-analyser-2/findings?${dualScopeParams}`
    );
    const unknownScopeResponse = await fetch(
      "/api/cyber-cop/impact-analyser-2?diagramNetworkIds=unknown-network"
    );
    const data = await dataResponse.json();
    const findings = await findingsResponse.json();
    const dualScopeFindings = await dualScopeFindingsResponse.json();
    const unknownScope = await unknownScopeResponse.json();
    const filterDomain =
      (data.rows ?? []).find((row) => row.hasIctSystem)?.securityDomain ?? data.rows?.[0]?.securityDomain ?? null;
    const filteredParams = new URLSearchParams({ diagramNetworkIds: networkIds.join(",") });
    if (filterDomain) {
      filteredParams.set("securityDomain", filterDomain);
    }
    const filteredResponse = await fetch(`/api/cyber-cop/impact-analyser-2?${filteredParams}`);
    const filteredData = await filteredResponse.json();
    const modelAssetIds = new Set((data.rows ?? []).map((row) => row.assetId));
    return {
      dataStatus: dataResponse.status,
      findingsStatus: findingsResponse.status,
      dualScopeFindingsStatus: dualScopeFindingsResponse.status,
      filteredStatus: filteredResponse.status,
      unknownScopeStatus: unknownScopeResponse.status,
      rowCount: data.rows?.length ?? 0,
      allFindingCount: findings.allFindings?.length ?? 0,
      dualScopeAllFindingCount: dualScopeFindings.allFindings?.length ?? -1,
      outOfScopeFindingCount: (findings.allFindings ?? []).filter((finding) => !modelAssetIds.has(finding.assetId)).length,
      hasNumericTotalCount: typeof findings.totalCount === "number",
      unknownScopeRowCount: unknownScope.rows?.length ?? -1,
      filteredRowCount: filteredData.rows?.length ?? 0,
      filteredWrongDomainCount: (filteredData.rows ?? []).filter((row) => row.securityDomain !== filterDomain).length,
      filteredAssignedSystemRowCount: (filteredData.rows ?? []).filter((row) => row.hasIctSystem).length
    };
  }, networkImpactResult.scope);
  assert.equal(networkFindingsApiResult.dataStatus, 200);
  assert.equal(networkFindingsApiResult.findingsStatus, 200);
  assert.equal(networkFindingsApiResult.dualScopeFindingsStatus, 200);
  assert.equal(networkFindingsApiResult.filteredStatus, 200);
  assert.equal(networkFindingsApiResult.unknownScopeStatus, 200);
  assert(networkFindingsApiResult.rowCount > 0, "Multi-network analyser API returned no model rows.");
  assert(networkFindingsApiResult.allFindingCount > 0, "Multi-network analyser findings API returned no findings.");
  assert.equal(
    networkFindingsApiResult.outOfScopeFindingCount,
    0,
    "The multi-network findings API must use the same model asset scope as the analyser rows."
  );
  assert(networkFindingsApiResult.hasNumericTotalCount, "Multi-network findings API did not return a numeric total.");
  assert.equal(networkFindingsApiResult.unknownScopeRowCount, 0, "An unknown network scope must fail closed.");
  assert.equal(
    networkFindingsApiResult.dualScopeAllFindingCount,
    networkFindingsApiResult.allFindingCount,
    "Network-scoped findings must consistently ignore an incompatible diagramSystemIds parameter."
  );
  assert(networkFindingsApiResult.filteredRowCount > 0, "The active Cyber COP security-domain scope returned no rows.");
  assert.equal(
    networkFindingsApiResult.filteredWrongDomainCount,
    0,
    "Network analyser rows must respect the active Cyber COP security-domain filter."
  );
  assert(
    networkFindingsApiResult.filteredAssignedSystemRowCount > 0,
    "Filtered network analyser rows lost their ICT system attribution."
  );

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
  assert(drillThroughPage, "The drill-through tab was unavailable for logout verification.");
  await drillThroughPage.bringToFront();
  await drillThroughPage.waitForFunction(() => window.location.hash.startsWith("#/login"), { polling: 100 });
  const drillThroughSession = await drillThroughPage.evaluate(async () => (await fetch("/api/auth/session")).json());
  assert.equal(drillThroughSession.authenticated, false);
  await drillThroughPage.close();

  assert.deepEqual(networkRequests, [], "The offline application attempted an HTTP request.");
  assert.deepEqual(runtimeErrors, [], "The offline application emitted browser errors.");
  console.log(
    "Browser smoke passed: login, 9 routes, authenticated new-tab drill-through, file-origin date replacement, global and nested CMDB drill-throughs, Cyber COP action-plan tabs, dynamic details, APIs, settings, exports, ICT dependencies, ICT and multi-network analyser runs, worker, and cross-tab logout."
  );
  console.log("Network audit passed: zero HTTP or HTTPS requests while Chromium was offline.");
} finally {
  await browser.close();
}
