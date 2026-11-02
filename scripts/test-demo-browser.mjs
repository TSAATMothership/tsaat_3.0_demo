import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = process.env.DEMO_BROWSER_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find(file => fs.existsSync(file));
assert(executablePath, "Set DEMO_BROWSER_PATH to an installed Chromium browser.");
const browser = await puppeteer.launch({ executablePath, headless: true });
const errors = [], networkRequests = [];
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), "tsaat-demo-downloads-"));
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => { if (!/^(file:|data:|blob:)/.test(request.url())) networkRequests.push(request.url()); });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  const fileUrl = pathToFileURL(path.join(root, "Demo/index.html")).href;
  await page.goto(fileUrl);
  await page.waitForSelector("[data-demo-ready]");
  const date = await page.$eval('[aria-label="Data date"]', node => node.value);
  async function navigate(route, scope = "network=net-1") {
    const href = route + (route.includes("?") ? "&" : "?") + scope + "&dataDate=" + date;
    await page.evaluate(value => { location.hash = value; }, href);
    await page.waitForFunction(value => location.hash === "#" + value && document.querySelector("[data-demo-ready]")?.dataset.demoQuery === value, { timeout: 30000 }, href);
    assert.deepEqual(await page.$$eval('[role="alert"]', nodes => nodes.filter(n => n.getClientRects().length).map(n => n.textContent)), [], route);
  }
  const reports = new Set();
  const routes = ["/measures", "/measures?measuresTab=measures-kpi", "/measures?measuresTab=measures-spi", "/findings",
    "/discovery-coverage?discoveryView=overview", "/discovery-coverage", "/discovery-coverage?discoveryView=compliance",
    "/discovery-coverage?discoveryView=endpoints", "/discovery-coverage?discoveryView=installed-software", "/discovery-coverage?discoveryView=shadow-it",
    "/network-risk-profile", "/ict-system-risk-profile", "/cyber-cop?copView=impact", "/cyber-cop?copView=network-impact-analyser",
    "/cyber-cop?copView=ict-system-impact-analyser", "/report"];
  for (const route of routes) {
    await navigate(route, route.includes("ict-system") ? "system=sys-1" : "network=net-1");
    (await page.$$eval("a", nodes => nodes.map(n => n.getAttribute("href")).filter(h => h?.includes("/api/")))).forEach(href => reports.add(href.slice(href.indexOf("/api/"))));
  }
  // Exercise real client interactions, including linked-file tabs and the bundled worker.
  for (const kind of ["network", "ict-system"]) {
    await navigate("/" + kind + "-risk-profile", kind === "network" ? "network=net-1" : "system=sys-1");
    await page.click('[role="tab"][id$="-tab-heatmap"]');
    assert.equal(await page.$eval('[aria-label="Heatmap square size"]', node => node.value), "40");
    await page.waitForSelector('[role="gridcell"]');
    await page.type('[aria-label="Search compliance heatmap devices"]', "no-such-demo-device-987654");
    await page.waitForFunction(() => !document.querySelector('[role="gridcell"]'));
    await page.click('[aria-label="Clear heatmap search"]');
    await page.waitForSelector('[role="gridcell"]');
    await page.click('[aria-label="Show compliant devices"]');
    await page.click('[aria-label="Show all device statuses"]');
    await page.click('[role="tab"][id$="-tab-explorer"]');
    await page.click('button[aria-label^="Open ' + (kind === "network" ? "Network" : "ICT System") + ' Details"]');
    await page.waitForSelector("dialog[open]");
    await page.waitForFunction(() => { const dialog = document.querySelector("dialog[open]"); const box = dialog?.getBoundingClientRect(); return box && box.right <= innerWidth + 1; });
    const linked = await page.$('dialog[open] a[aria-label$="in a new tab"]');
    assert(linked, "Linked entity missing");
    const targetPromise = browser.waitForTarget(target => target.type() === "page" && target !== page.target() && target.url().startsWith(fileUrl));
    await linked.click();
    const linkedPage = await (await targetPromise).page();
    await linkedPage.waitForSelector("[data-demo-ready]");
    assert.match(linkedPage.url(), kind === "network" ? /system=sys-/ : /network=net-/);
    await linkedPage.close();
    await page.keyboard.press("Escape");
  }
  await navigate("/discovery-coverage?discoveryView=endpoints");
  await page.click("[data-cmdb-asset-id]");
  await page.waitForSelector("dialog[data-cmdb-drill-through][open]");
  await page.waitForFunction(() => document.querySelector("[data-cmdb-drill-through]")?.textContent.includes("10."));
  await page.keyboard.press("Escape");
  await page.waitForSelector("dialog[open]", { hidden: true });
  let workerCount = 0;
  page.on("workercreated", () => workerCount++);
  for (const kind of ["network", "ict-system"]) {
    await navigate("/cyber-cop?copView=" + kind + "-impact-analyser", kind === "network" ? "network=net-1" : "system=sys-1");
    await page.click(kind === "network" ? '[aria-label="Select networks for the Network Impact Analyser"]' : '[aria-label="Select ICT systems for the ICT System Impact Analyser"]');
    await page.waitForSelector('main input[type="checkbox"]', { visible: true });
    await page.click('main input[type="checkbox"]');
    await page.evaluate(() => [...document.querySelectorAll("main button")].find(button => button.textContent.trim().toLowerCase() === "run").click());
    await page.waitForSelector('canvas[aria-label*="Canvas WebGL"]', { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector("main")?.textContent.includes("Loading Diagram"), { timeout: 30000 });
    assert.deepEqual(await page.$$eval('[role="alert"]', nodes => nodes.filter(n => n.getClientRects().length).map(n => n.textContent)), []);
  }
  assert.equal(workerCount, 2, "Both analysers must start their offline worker");

  async function request(url, init) {
    return page.evaluate(async ({ url, init }) => {
      const result = await fetch(url, init);
      const bytes = new Uint8Array(await result.arrayBuffer());
      let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { status: result.status, type: result.headers.get("content-type"), disposition: result.headers.get("content-disposition"), base64: btoa(binary) };
    }, { url, init });
  }
  async function getJson(url, init) {
    const response = await request(url, init);
    assert.equal(response.status, 200, url + " " + Buffer.from(response.base64, "base64").toString());
    return JSON.parse(Buffer.from(response.base64, "base64").toString());
  }
  let pdfCount = 0;
  for (const report of reports) {
    const response = await request(report);
    const bytes = Buffer.from(response.base64, "base64");
    assert.equal(response.status, 200, report + " " + bytes.toString().slice(0, 300));
    assert.match(response.type, /pdf/);
    assert((await PDFDocument.load(bytes)).getPageCount() > 0, report);
    pdfCount++;
  }
  const scope = { network: ["net-1"], system: [], dataDate: date };
  const post = body => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let workbookCount = 0;
  for (const kind of ["endpoints", "installed-software", "shadow-it", "compliance"]) {
    const response = await request("/api/discovery-coverage/" + kind + "/export", post({ scope, filters: { search: "", columns: {}, recency: [] } }));
    assert.equal(response.status, 200, kind + " " + Buffer.from(response.base64, "base64").toString());
    const zip = unzipSync(Buffer.from(response.base64, "base64"));
    assert(zip["xl/workbook.xml"], kind); workbookCount++;
  }
  const template = await request("/api/discovery-coverage/target-state-template?network=net-1&dataDate=" + date);
  assert.equal(template.status, 200);
  assert(unzipSync(Buffer.from(template.base64, "base64"))["xl/workbook.xml"]); workbookCount++;
  const findingData = await getJson("/api/findings/export?format=json&network=net-1&status=open&asOf=" + date);
  const findingWorkbook = await request("/api/findings/export", post({ scope, asOf: date, status: "open", findingIds: findingData.findings.filter(f => f.status === "open").map(f => f.id) }));
  assert.equal(findingWorkbook.status, 200);
  const findingZip = unzipSync(Buffer.from(findingWorkbook.base64, "base64"));
  assert.match(strFromU8(findingZip["xl/workbook.xml"]), /Affected CIs/);
  assert(findingZip["xl/worksheets/sheet2.xml"]); workbookCount++;
  const cmdb = await getJson("/api/assets/cmdb-details?assetId=srv-0001&dataDate=" + date);
  assert(cmdb.asset.attributes.some(row => row.key === "assetIpAddress" && row.value.startsWith("10.")));
  const graph = await getJson("/api/cyber-cop/impact-analyser-2?network=net-1&diagramNetworkIds=net-1&dataDate=" + date);
  assert(graph.rows.length > 0, "Network impact graph has no assets");
  const systemGraph = await getJson("/api/cyber-cop/impact-analyser-2?system=sys-1&diagramSystemIds=sys-1&dataDate=" + date);
  assert(systemGraph.rows.length > 0, "System impact graph has no assets");
  // Exercise settings UI, then verify persistence across reload and shared-handler reads.
  await page.evaluate(() => [...document.querySelectorAll("button")].find(button => button.textContent.includes("Menu / Settings")).click());
  await page.waitForSelector("dialog[open]");
  await page.click("#settings-tab-spi-priority-matrix");
  await page.waitForSelector("#settings-panel-spi-priority-matrix:not([hidden]) select");
  const settings = await getJson("/api/measures/settings");
  const priorityKey = Object.keys(settings.settings.priorityMatrix)[0];
  const changed = structuredClone(settings.settings);
  changed.priorityMatrix[priorityKey] = changed.priorityMatrix[priorityKey] === 1 ? 2 : 1;
  const saved = await getJson("/api/measures/settings", { ...post(changed), method: "PUT" });
  assert.equal(saved.settings.priorityMatrix[priorityKey], changed.priorityMatrix[priorityKey]);
  await page.reload(); await page.waitForSelector("[data-demo-ready]");
  assert.equal((await getJson("/api/measures/settings")).settings.priorityMatrix[priorityKey], changed.priorityMatrix[priorityKey]);
  await navigate("/measures?measuresTab=measures-kpi");
  const downloadLink = await page.$('a[href*="kind=kpi&id=KPI-1"]:not([href*="results="])');
  assert(downloadLink, "KPI report link missing"); await downloadLink.click();
  await page.waitForFunction(() => document.querySelector(".demo-toast")?.textContent.includes("Report downloaded"));
  const deadline = Date.now() + 10000;
  while (!fs.readdirSync(downloads).some(name => name.endsWith(".pdf")) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert(fs.readdirSync(downloads).some(name => name.startsWith("KPI-1") && name.endsWith(".pdf")), "No actual PDF download");
  await page.setViewport({ width: 390, height: 844 });
  await navigate("/measures");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, "Mobile page overflows");
  assert.deepEqual(errors, [], "Browser errors");
  assert.deepEqual(networkRequests, [], "The demo made external network requests");
  console.log("Offline browser checks passed: " + routes.length + " views, " + pdfCount + " PDFs, " + workbookCount + " workbooks, heatmap filters, linked tabs, CMDB panels, both analyser workers, settings persistence, real download, narrow layout; zero network requests.");
} finally {
  await browser.close();
  // Exact temporary directory created above; no user content can be present.
  if (path.dirname(downloads) !== os.tmpdir() || !path.basename(downloads).startsWith("tsaat-demo-downloads-")) throw new Error("Unsafe temporary download path.");
  fs.rmSync(downloads, { recursive: true, force: true });
}
