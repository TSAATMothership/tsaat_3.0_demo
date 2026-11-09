import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import workbookTools from "../lib/xlsx-zip.ts";

const { readXlsxEntries, readXlsxEntriesAsync } = workbookTools;
const decode = bytes => new TextDecoder().decode(bytes);
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const xmlText = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Real UI -> canonical JSON -> document worker -> downloaded workbook checks for either provider.
 * Run against an isolated production server with the shared eight-snapshot evidence fixture.
 * Does not call a workbook renderer in Node or inject a job into the browser runtime.
 */
export async function checkClientWorkbookDocuments(page, { base = new URL(page.url()).origin, date, historicalDate = date, directory, artifacts } = {}) {
  assert(date && directory, "A selected snapshot and dedicated download directory are required.");
  fs.mkdirSync(directory, { recursive: true });
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  await page.setViewport({ width: 1600, height: 1000 });
  const evidence = [], browserErrors = [], serverFiles = [];
  const onError = error => browserErrors.push(error.message);
  const onResponse = response => {
    if (new URL(response.url()).pathname.startsWith("/api/") && /application\/(?:pdf|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml)/i.test(response.headers()["content-type"] ?? "")) serverFiles.push(response.url());
  };
  page.on("pageerror", onError); page.on("response", onResponse);
  const visit = async (route, scope, snapshot) => {
    const url = new URL(route, base);
    for (const [key, value] of new URLSearchParams(scope)) url.searchParams.set(key, value);
    url.searchParams.set("dataDate", snapshot);
    const response = await page.goto(url.href, { waitUntil: "networkidle0", timeout: 60000 });
    assert.equal(response.status(), 200, route);
    await page.waitForSelector("dialog.loading-modal[open]", { hidden: true });
    assert(!await page.$("[data-nextjs-dialog-overlay]"), "Application rendered an error overlay.");
  };
  const rowCount = selector => page.$eval(`${selector} .endpoint-toolbar h2 span`, node => Number(node.textContent.replaceAll(",", "")));
  const download = async (name, trigger, { apiPath, expectedKind, extension = ".xlsx" } = {}) => {
    const target = fs.mkdtempSync(path.join(directory, name + "-"));
    assert.equal(fs.readdirSync(target).length, 0, "Each document check requires a fresh output directory.");
    await page.browser().defaultBrowserContext().setDownloadBehavior({ policy: "allow", downloadPath: target });
    const pending = apiPath ? page.waitForResponse(response => new URL(response.url()).pathname === apiPath && response.status() === 200, { timeout: 60000 }) : null;
    await trigger();
    let job, request;
    if (pending) {
      const response = await pending;
      assert.match(response.headers()["content-type"], /application\/json/);
      assert.equal(response.headers()["content-disposition"], undefined, "Backend returns a model, never a workbook attachment.");
      assert.equal(response.headers()["cache-control"], "no-store");
      job = await response.json(); request = response.request();
      assert.equal(job.version, 1); assert.equal(job.kind, expectedKind);
      assert(job.filename.endsWith(extension)); assert(Number.isFinite(Date.parse(job.generatedAt)));
    }
    let file;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const names = fs.readdirSync(target).filter(entry => entry.endsWith(extension));
      assert(names.length <= 1, "One action must download exactly one workbook.");
      if (names.length) { file = path.join(target, names[0]); break; }
      const error = await page.$eval("body", node => node.querySelector(".document-generation-dialog [role=alert]")?.textContent ?? "");
      assert(!error, `${name}: ${error}`);
      await pause(100);
    }
    assert(file, `${name}: browser workbook download did not complete.`);
    if (job) assert.equal(path.basename(file), job.filename);
    await page.waitForSelector("dialog.document-generation-dialog[open]", { hidden: true });
    const bytes = fs.readFileSync(file); assert(bytes.length > 500);
    if (artifacts) fs.copyFileSync(file, path.join(artifacts, `${name}${extension}`));
    console.log(`Browser workbook ${name}: ${bytes.length} bytes`);
    return { bytes, job, request, file };
  };
  const xlsx = bytes => {
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
    const entries = readXlsxEntries(new Uint8Array(bytes));
    assert(entries.has("xl/workbook.xml") && entries.has("[Content_Types].xml"));
    return { entries, workbook: decode(entries.get("xl/workbook.xml")), sheet: number => decode(entries.get(`xl/worksheets/sheet${number}.xml`)) };
  };
  const sheetRows = xml => (xml.match(/<row\b/g) ?? []).length;
  const xmlSheets = text => page.evaluate(xml => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) throw new Error("Downloaded Excel XML is invalid.");
    return Object.fromEntries([...document.getElementsByTagName("Worksheet")].map(sheet => [sheet.getAttribute("ss:Name"),
      [...sheet.getElementsByTagName("Row")].map(row => [...row.getElementsByTagName("Data")].map(cell => cell.textContent))]));
  }, text);

  try {
    const inventories = [
      { view: "endpoints", kind: "xlsx-endpoints", label: "Endpoint results", search: "Search all endpoint fields", key: "name", scope: "network=net-1", snapshot: date },
      { view: "installed-software", kind: "xlsx-software", label: "Installed software results", search: "Search all software fields", key: "softwareName", scope: "system=sys-1", snapshot: historicalDate, allRows: true },
      { view: "security-vulnerabilities", kind: "xlsx-vulnerabilities", label: "Security vulnerabilities results", search: "Search security vulnerabilities table", key: "cve", scope: "network=net-1", snapshot: date },
      { view: "patch-management", kind: "xlsx-patches", label: "Server patch records results", search: "Search server patch records table", key: "serverName", scope: "system=sys-1", snapshot: date },
      { view: "shadow-it", kind: "xlsx-shadow-it", label: "Shadow IT results", search: "Search all Shadow IT fields", key: "ipAddress", scope: "network=net-1", snapshot: date },
      { view: "compliance", kind: "xlsx-compliance", label: "Discovery compliance results", search: "Search all discovery compliance fields", key: "hostname", scope: "network=net-1", snapshot: historicalDate }
    ];
    for (const item of inventories) {
      await visit(`/discovery-coverage?discoveryView=${item.view}`, item.scope, item.snapshot);
      const selector = `[aria-label="${item.label}"]`;
      await page.waitForSelector(`${selector} tbody tr td`);
      const search = item.allRows ? "" : await page.$eval(`${selector} tbody tr td`, node => {
        const cell = node.cloneNode(true);
        cell.querySelectorAll("small,svg,[aria-hidden=true]").forEach(child => child.remove());
        return cell.textContent.trim();
      });
      if (search) await page.type(`[aria-label="${item.search}"]`, search);
      const matching = await rowCount(selector); assert(matching > 0, `${item.view}: filtered evidence is required.`);
      const visible = await page.$$eval(`${selector} tbody tr`, rows => rows.length);
      const result = await download(item.kind, () => page.click(`${selector} .endpoint-export`), {
        apiPath: `/api/discovery-coverage/${item.view}/export`, expectedKind: item.kind
      });
      const body = JSON.parse(result.request.postData());
      assert.equal(body.scope.dataDate, item.snapshot); assert.equal(body.filters.search, search);
      for (const [key, value] of new URLSearchParams(item.scope)) assert.deepEqual([body.scope[key]].flat(), [value]);
      assert.equal(result.job.data.snapshotDate, item.snapshot); assert.equal(result.job.data.rows.length, matching);
      const workbook = xlsx(result.bytes), sheet = workbook.sheet(1);
      assert.equal(sheetRows(sheet), matching + 1, "Workbook includes every matching row, not only the visible page.");
      assert(sheet.includes("Export Timestamp (UTC)") && sheet.includes("state=\"frozen\"") && sheet.includes("<autoFilter"));
      assert(!sheet.includes("<f>"), "Evidence must remain formula-safe literal cells.");
      for (const row of result.job.data.rows) {
        const value = row[item.key];
        if (value) assert(sheet.includes(xmlText(value)), `${item.view}: canonical row identity missing from workbook.`);
      }
      if (search) assert(sheet.includes(xmlText(search)), `${item.view}: selected filter value is preserved.`);
      evidence.push({ kind: item.kind, control: `${item.view} export`, snapshot: item.snapshot, scope: item.scope, rows: matching, visibleRows: visible, bytes: result.bytes.length });
    }

    await visit("/findings", "network=net-1", historicalDate);
    const findingSelector = '[aria-label="Findings Register results"]';
    await page.waitForSelector(`${findingSelector} tbody tr td`);
    const findingSearch = await page.$eval(`${findingSelector} tbody tr td:first-child`, node => node.textContent.trim());
    await page.type('[aria-label="Search findings register table"]', findingSearch);
    const findingCount = await rowCount(findingSelector); assert(findingCount > 0);
    const findings = await download("xlsx-findings", () => page.click(`${findingSelector} .endpoint-export`), { apiPath: "/api/findings/export", expectedKind: "xlsx-findings" });
    const findingRequest = JSON.parse(findings.request.postData());
    assert.equal(findingRequest.findingIds.length, findingCount); assert.equal(findingRequest.asOf, historicalDate);
    assert.equal(findingRequest.scope.dataDate, historicalDate); assert.deepEqual(findingRequest.scope.network, ["net-1"]);
    assert.deepEqual(findings.job.data.findings.map(row => row.id), findingRequest.findingIds);
    assert(findings.job.data.findings.every(row => `SPI ${row.spiId}-${row.title}` === findingSearch));
    const findingsBook = xlsx(findings.bytes);
    assert(findingsBook.workbook.includes('name="Findings"') && findingsBook.workbook.includes('name="Affected CIs"'));
    assert.equal(sheetRows(findingsBook.sheet(1)), findingCount + 1);
    assert.equal(sheetRows(findingsBook.sheet(2)), new Set(findings.job.data.findings.map(row => row.scope.assetId)).size + 1);
    for (const finding of findings.job.data.findings) assert(findingsBook.sheet(1).includes(xmlText(finding.id)) && findingsBook.sheet(2).includes(xmlText(finding.scope.assetId)));
    evidence.push({ kind: "xlsx-findings", control: "Findings Register export", snapshot: historicalDate, rows: findingCount, bytes: findings.bytes.length });

    const targetUrl = `${base}/api/discovery-coverage/target-state-template?network=net-1&dataDate=${historicalDate}`;
    await page.goto(targetUrl, { waitUntil: "networkidle0" });
    assert.equal(new URL(page.url()).pathname, "/documents/generate", "Compatibility link opens the client generation page.");
    const target = await download("xlsx-target-state", () => page.click('[data-document-source^="/api/discovery-coverage/target-state-template"]'), {
      apiPath: "/api/discovery-coverage/target-state-template", expectedKind: "xlsx-target-state"
    });
    assert.equal(target.job.data.network.id, "net-1"); assert.equal(target.job.data.snapshotDate, historicalDate);
    const targetBook = xlsx(target.bytes);
    assert(targetBook.sheet(1).includes(xmlText(target.job.data.network.name)));
    const templateResponse = await fetch(`${base}/document-assets/network-target-state-template.xlsx`);
    assert.equal(templateResponse.status, 200);
    const templateEntries = await readXlsxEntriesAsync(new Uint8Array(await templateResponse.arrayBuffer()));
    assert.equal(targetBook.entries.size, templateEntries.size);
    for (const [name, bytes] of templateEntries) if (!/^xl\/worksheets\/sheet[12]\.xml$/.test(name)) assert.deepEqual(targetBook.entries.get(name), bytes, `Template part ${name} remains intact.`);
    evidence.push({ kind: "xlsx-target-state", control: "Compatibility template link", snapshot: historicalDate, bytes: target.bytes.length });

    const openAnalyser = async mode => {
      const dependencies = mode === "dependencies";
      await visit(`/cyber-cop?copView=${dependencies ? "ict-system-dependencies" : "ict-system-impact-analyser"}`, "system=sys-1", date);
      await page.click(`[aria-label="Select ICT systems for ${dependencies ? "ICT System Dependencies" : "ICT System Impact Analyser"}"]`);
      await page.click('[data-impact-analyser-selection-option="ict-system"] input[type="checkbox"]');
      await page.evaluate(() => [...document.querySelectorAll("main button")].find(button => button.textContent.trim().toLowerCase() === "run").click());
      await page.waitForSelector(`section[data-impact-analyser-mode="${mode}"] canvas[role="img"]`, { timeout: 60000 });
      await page.waitForFunction(mode => Number(document.querySelector(`section[data-impact-analyser-mode="${mode}"] [data-impact-analyser-filtered-row-count]`)?.getAttribute("data-impact-analyser-filtered-row-count")) > 0, { timeout: 60000 }, mode);
    };
    await openAnalyser("dependencies");
    const dependencyCount = await page.$eval('[data-impact-analyser-filtered-row-count]', node => Number(node.getAttribute("data-impact-analyser-filtered-row-count")));
    const dependencies = await download("xls-dependencies", () => page.click('[aria-label="Export ICT System Dependencies to Excel"]'), { extension: ".xls" });
    const dependencySheets = await xmlSheets(dependencies.bytes.toString("utf8"));
    const dependencyRows = Object.values(dependencySheets)[0]; assert.equal(dependencyRows.length, dependencyCount + 1);
    assert.deepEqual(dependencyRows[0], ["ICT System", "Environment", "Server", "Dependent Server", "Dependent Environment", "Dependent ICT System"]);
    assert(dependencyRows.slice(1).every(row => row[1] === "Production"), "Dependency workbook follows the active environment filter.");
    evidence.push({ kind: "xls-dependencies", control: "ICT System Dependencies export", snapshot: date, rows: dependencyCount, bytes: dependencies.bytes.length });

    await openAnalyser("risk");
    const searchSelector = '[data-impact-analyser-mode="risk"] input[placeholder="Search diagram"]';
    await page.type(searchSelector, "SPI ");
    await page.waitForFunction(() => [...document.querySelectorAll('[data-impact-analyser-mode="risk"] li button')].some(button => button.lastElementChild?.textContent.trim() === "SPI"));
    const options = await page.$$('[data-impact-analyser-mode="risk"] li button');
    let spiOption;
    for (const option of options) if (await option.evaluate(node => node.lastElementChild?.textContent.trim() === "SPI")) { spiOption = option; break; }
    assert(spiOption); await spiOption.click();
    await pause(300);
    // The selected SPI is the sole value on the rightmost visible axis. Activate its rendered + badge.
    const badge = await page.$eval('[data-impact-analyser-mode="risk"] canvas[role="img"]', canvas => {
      const bounds = canvas.getBoundingClientRect(), virtual = canvas.parentElement.parentElement, viewport = virtual.parentElement;
      return { x: bounds.left + bounds.width - 78 + 13, y: bounds.top + 60 + (parseFloat(virtual.style.height) - 94) / 2 - viewport.scrollTop - 13 };
    });
    const riskDataPending = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/impact-analyser-2/findings") && response.status() === 200);
    await page.mouse.click(badge.x, badge.y);
    const riskData = await (await riskDataPending).json();
    await page.waitForSelector('.findings-drillthrough .endpoint-export:not([disabled])');
    const riskSelector = '.findings-drillthrough [aria-label="Findings results"]';
    const riskSearch = await page.$eval(`${riskSelector} tbody tr td:nth-child(4)`, node => node.textContent.trim());
    await page.type("#risk-findings-search", riskSearch);
    const riskCount = await rowCount(riskSelector); assert(riskCount > 0);
    const risk = await download("xls-risk-findings", () => page.click(`${riskSelector} .endpoint-export`), { extension: ".xls" });
    const riskSheets = await xmlSheets(risk.bytes.toString("utf8"));
    assert.deepEqual(Object.keys(riskSheets), ["Findings", "Affected CIs"]);
    assert.equal(riskSheets.Findings.length, riskCount + 1); assert(riskSheets["Affected CIs"].length > 1);
    const allowedFindings = new Set(riskData.allFindings.map(row => row.id));
    const idColumn = riskSheets.Findings[0].indexOf("Finding ID"), titleColumn = riskSheets.Findings[0].indexOf("Title");
    assert(idColumn >= 0 && titleColumn >= 0);
    assert(riskSheets.Findings.slice(1).every(row => allowedFindings.has(row[idColumn]) && row[titleColumn].includes(riskSearch)), "Risk export retains scoped findings and the active search.");
    evidence.push({ kind: "xls-risk-findings", control: "ICT analyser SPI findings slide-out", snapshot: date, rows: riskCount, bytes: risk.bytes.length });
    assert.deepEqual(serverFiles, [], "No API returned a PDF or Excel binary during workbook generation.");
    assert.deepEqual(browserErrors, [], "Workbook controls must not produce browser runtime errors.");
    return { documents: evidence, inactiveControls: [{ component: "NetworkDetailRiskCharts", control: "Export findings + CIs", reason: "Its only caller explicitly disables findings drill-through; the shared risk XML renderer is exercised through the active RiskFindingsDrillThrough control." }] };
  } finally {
    page.off("pageerror", onError); page.off("response", onResponse);
    await page.browser().defaultBrowserContext().setDownloadBehavior({ policy: "allow", downloadPath: directory });
  }
}
