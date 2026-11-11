import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";

const legacy = [
  ["posture-summary", "/api/report/summary?format=pdf", "pdf-posture-summary"],
  ["networks-remediation", "/api/networks/remediation-report", "pdf-networks-remediation"],
  ["systems-remediation", "/api/systems/remediation-report", "pdf-systems-remediation"],
  ["unsupported-os", "/api/systems/out-of-support-os-report", "pdf-unsupported-os"],
  ["modelling-status", "/api/systems/modelling-status-report", "pdf-modelling-status"],
  ["discovery-remediation", "/api/discovery-coverage/remediation-report", "pdf-discovery-remediation"],
  ["network-remediation", "/api/networks/net-1/remediation-report", "pdf-network-remediation"],
  ["system-remediation", "/api/systems/sys-1/remediation-report", "pdf-system-remediation", "system=sys-1"],
  ["system-coverage-gaps", "/api/systems/sys-1/coverage-gaps-report", "pdf-system-coverage-gaps", "system=sys-1"],
  ["network-performance", "/api/networks/performance-report", "pdf-network-performance"],
  ["system-performance", "/api/systems/performance-report", "pdf-system-performance", "system=sys-1"],
  ["network-discovery", "/api/discovery-coverage/network-report", "pdf-network-discovery"]
];
const insights = [
  ["cyber-insights", "/api/governance/insights/report", "insights-cyber"],
  ["software-insights", "/api/discovery/installed-software-insights/report", "insights-software"],
  ["discovery-insights", "/api/discovery-coverage/overview-report", "insights-discovery"],
  ["endpoint-insights", "/api/governance/end-point-insights/report", "insights-endpoint"],
  ["vulnerability-insights", "/api/governance/security-vulnerability-insights/report", "insights-vulnerability"]
];
const tasking = [
  ["spi-current", "/api/tasking-report?kind=spi&id=10", "pdf-tasking-spi"],
  ["spi-noncompliance", "/api/tasking-report?kind=spi&id=10&results=non-compliant", "pdf-tasking-spi"],
  ["spi-all", "/api/tasking-report?kind=spi-all&id=all", "pdf-tasking-spi-all"],
  ["spi-trend", "/api/tasking-report?kind=spi-trend&id=10", "pdf-tasking-spi-trend"],
  ["kpi-ato", "/api/tasking-report?kind=kpi&id=KPI-1", "pdf-tasking-kpi", "system=sys-1"],
  ["kpi-diis", "/api/tasking-report?kind=kpi&id=KPI-2", "pdf-tasking-kpi", "system=sys-1"],
  ["kpi-noncompliance", "/api/tasking-report?kind=kpi&id=KPI-1&results=non-compliant", "pdf-tasking-kpi"],
  ["kpi-trend", "/api/tasking-report?kind=kpi-trend&id=KPI-1", "pdf-tasking-kpi-trend"]
];

function sourceFor(base, route, scope, date) {
  const source = new URL(route, base);
  for (const [key, value] of new URLSearchParams(scope)) source.searchParams.set(key, value);
  source.searchParams.set("dataDate", date);
  return source.pathname + source.search;
}
function stableEvidence(job) {
  // Narrative reports repeat this job's export time in their lines. Keep snapshot/observation times intact.
  return JSON.parse(JSON.stringify(job.data).split(job.generatedAt).join("<document-generation-time>"));
}
async function pdfEvidence(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", "Downloaded file is an actual PDF");
  const pdf = await PDFDocument.load(bytes), labels = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    for (const stream of streams) if (stream instanceof PDFRawStream) {
      let decoded; try { decoded = inflateSync(stream.contents).toString("latin1"); } catch { decoded = Buffer.from(stream.contents).toString("latin1"); }
      for (const match of decoded.matchAll(/<([0-9A-F]+)> Tj/g)) labels.push(Buffer.from(match[1], "hex").toString("latin1"));
    }
  }
  return { pages: pdf.getPageCount(), title: pdf.getTitle(), bytes: bytes.length, text: labels.join("\n") };
}

/** Exercise all PDF families against a running SQL or JSON build. Caller owns its data and browser. */
export async function checkClientDocumentPdfs(page, { base = new URL(page.url()).origin, date, historicalDate = date, directory } = {}) {
  assert(date && directory, "PDF checks require an explicitly selected snapshot and artifact directory");
  fs.mkdirSync(directory, { recursive: true });
  const cases = [...legacy, ...insights, ...tasking].map(([name, route, kind, scope = "network=net-1"]) => ({ name, route, kind, scope, date }));
  for (const family of [legacy[0], insights[0], tasking[0]]) {
    const [name, route, kind] = family;
    cases.push({ name: `${name}-historical`, route, kind, scope: "system=sys-1", date: historicalDate });
    cases.push({ name: `${name}-empty`, route, kind, scope: "network=net-1&securityDomain=NONE", date });
  }
  const session = await page.createCDPSession(), evidence = [], errors = [];
  const onError = error => errors.push(error.message);
  page.on("pageerror", onError);
  try {
    for (const item of cases) {
      const source = sourceFor(base, item.route, item.scope, item.date);
      const response = await fetch(new URL(source, base), { headers: { Accept: "application/json" } });
      assert.equal(response.status, 200, `${item.name}: JSON evidence request`);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(response.headers.get("content-disposition"), null, `${item.name}: no server attachment`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const job = await response.json();
      assert.equal(job.version, 1); assert.equal(job.kind, item.kind);
      assert(job.data && job.filename.endsWith(".pdf") && Number.isFinite(Date.parse(job.generatedAt)));
      const downloadDirectory = fs.mkdtempSync(path.join(directory, item.name + "-"));
      await session.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: path.resolve(downloadDirectory) });
      await page.goto(new URL(source, base).href, { waitUntil: "networkidle0", timeout: 60000 });
      assert.equal(new URL(page.url()).pathname, "/documents/generate", `${item.name}: compatibility redirect`);
      assert.equal(new URL(page.url()).searchParams.get("source"), source);
      for (const key of ["network", "system", "securityDomain", "dataDate"]) {
        assert.deepEqual(new URL(page.url()).searchParams.getAll(key), new URL(source, base).searchParams.getAll(key), `${item.name}: bookmark header scope`);
      }
      const button = "[data-document-source]";
      await page.waitForSelector(button);
      assert.equal(await page.$eval(button, node => node.dataset.documentSource), source);
      await page.evaluate(() => {
        window.__documentProgressSeen = false;
        window.__documentProgressObserver?.disconnect();
        window.__documentProgressObserver = new MutationObserver(() => {
          const dialog = document.querySelector(".document-generation-dialog[open]");
          if (dialog?.querySelector('[role="progressbar"]') && dialog.textContent.includes("Generating Document")) window.__documentProgressSeen = true;
        });
        window.__documentProgressObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
      });
      const loaded = page.waitForResponse(result => result.request().resourceType() === "fetch" && new URL(result.url()).pathname === new URL(source, base).pathname && result.status() === 200, { timeout: 60000 });
      await page.focus(button); await page.keyboard.press("Enter");
      const browserResponse = await loaded;
      assert.match(browserResponse.headers()["content-type"] ?? "", /application\/json/);
      const browserJob = await browserResponse.json();
      assert.equal(browserJob.kind, job.kind); assert.deepEqual(stableEvidence(browserJob), stableEvidence(job), `${item.name}: immutable scoped data`);
      await page.waitForFunction(() => document.querySelector(".document-generation-dialog [role=alert]") ||
        (!document.querySelector("[data-document-source]")?.disabled && !document.querySelector(".document-generation-dialog[open]")), { timeout: 90000 });
      const failure = await page.$eval("body", node => node.querySelector(".document-generation-dialog [role=alert]")?.textContent);
      assert(!failure, `${item.name}: ${failure}`);
      assert(await page.evaluate(() => window.__documentProgressSeen), `${item.name}: progress animation observed`);
      await page.waitForFunction(() => document.activeElement === document.querySelector("[data-document-source]"));
      const filename = browserJob.filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().slice(0, 220);
      const file = path.join(downloadDirectory, filename), deadline = Date.now() + 30000;
      while (!fs.existsSync(file) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      assert(fs.existsSync(file), `${item.name}: browser download exists with declared filename`);
      const pdf = await pdfEvidence(file);
      assert(pdf.pages > 0 && pdf.text.length > 0, `${item.name}: readable PDF pages`);
      assert(pdf.text.includes(item.date), `${item.name}: selected snapshot present in document`);
      const record = { ...item, source, filename, file, pages: pdf.pages, title: pdf.title, bytes: pdf.bytes };
      evidence.push(record);
      fs.writeFileSync(path.join(downloadDirectory, "document-job.json"), JSON.stringify(browserJob, null, 2));
      fs.writeFileSync(path.join(downloadDirectory, "document-text.txt"), pdf.text);
      console.log(`Browser PDF ${item.name}: ${pdf.pages} pages, ${pdf.bytes} bytes`);
      assert.deepEqual(errors, [], `${item.name}: browser runtime errors`);
    }
    // Current reference data deliberately retires these definitions. Configured legacy handlers are tested separately.
    for (const id of ["KPI-3", "KPI-4", "KPI-5"]) {
      const response = await fetch(new URL(sourceFor(base, `/api/tasking-report?kind=kpi&id=${id}`, "network=net-1", date), base), { headers: { Accept: "application/json" } });
      assert.equal(response.status, 404, `${id}: retired catalogue entry is not resurrected by export`);
    }
    fs.writeFileSync(path.join(directory, "pdf-browser-evidence.json"), JSON.stringify(evidence, null, 2));
    return evidence;
  } finally {
    await page.evaluate(() => window.__documentProgressObserver?.disconnect()).catch(() => {});
    page.off("pageerror", onError);
    await session.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: path.resolve(directory) });
    await session.detach();
  }
}

// Run against an already-started isolated provider build; this command never mutates a store/database.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [base, date, historicalDate, directory] = process.argv.slice(2);
  assert(base && date && historicalDate && directory, "Usage: node scripts/client-document-pdfs-smoke.mjs <base> <snapshot> <historical-snapshot> <artifact-directory>");
  const { default: puppeteer } = await import("puppeteer-core");
  const executablePath = process.env.TSAAT_TEST_BROWSER || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => fs.existsSync(file));
  assert(executablePath, "Set TSAAT_TEST_BROWSER to a locally installed Chrome or Edge executable");
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 1000 });
    await checkClientDocumentPdfs(page, { base, date, historicalDate, directory });
  } finally { await browser.close(); }
}
