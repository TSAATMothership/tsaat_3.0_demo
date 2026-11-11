import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { checkInsightsPdfDownload } from "./insights-pdf-smoke.mjs";

/** Uses the compiled facade in either provider; caller owns the isolated store and downloads. */
export async function checkSoftwareInsightsPdf(page, { date, historicalDate, directory, artifacts } = {}) {
  assert(date && directory, "Software PDF checks require a snapshot and temporary download directory");
  const base = new URL(page.url()).origin;
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const selections = [
    { query: "network=net-1&securityDomain=UNKNOWN", date, width: 1600, name: "network" },
    { query: "system=sys-1&securityDomain=UNKNOWN", date: historicalDate ?? date, width: 390, name: "historical-system" }
  ];
  const sidebarWasOpen = await page.$eval('.sidebar-toggle', node => node.getAttribute('aria-expanded') === 'true');
  try {
    for (const selection of selections) {
      await page.setViewport({ width: selection.width, height: 900 });
      await page.goto(`${base}/governance/installed-software-insights?${selection.query}&dataDate=${selection.date}`, { waitUntil: "networkidle0" });
      await page.waitForSelector(".software-insights");
      await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
      if (selection.width === 390) {
        if (await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
        await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 45 && document.querySelector('.workspace-content').clientWidth > 250);
      }
      const total = await page.$eval('.software-insights', node => Number(node.dataset.softwareTotal));
      assert(total > 0, "The scoped browser fixture includes software evidence");
      await page.waitForSelector('.software-insights-briefing [data-insights-report]');
      const href = await page.$eval('[data-insights-report]', node => node.dataset.insightsReport), query = new URL(href, base).searchParams;
      for (const [key, value] of new URLSearchParams(selection.query)) assert.equal(query.get(key), value);
      assert.equal(query.get('dataDate'), selection.date);
      assert.equal(await page.$eval('[data-insights-report]', node => node.textContent.trim()), 'Generate PDF');
      assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth), "No horizontal overflow");
      await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
      if (artifacts) await page.screenshot({ path: path.join(artifacts, selection.name + '.png') });
      const result = await checkInsightsPdfDownload(page, { date: selection.date, directory: path.join(directory, selection.name),
        route: '/api/discovery/installed-software-insights/report', filenamePrefix: 'software-insights', title: 'Software Insights',
        root: '.software-insights', snapshotAttribute: 'softwareSnapshot', minPages: 3 });
      const doc = await PDFDocument.load(fs.readFileSync(result.file)), labels = [];
      for (const [, item] of doc.context.enumerateIndirectObjects()) if (item instanceof PDFRawStream) {
        let stream; try { stream = inflateSync(item.contents); } catch { continue; }
        for (const match of stream.toString('latin1').matchAll(/<([0-9A-F]+)> Tj/g)) labels.push(Buffer.from(match[1], 'hex').toString('latin1'));
      }
      const text = labels.join('\n');
      // The footprint infographic prints each value above its lower-case unit label.
      // Match that specific metric rather than any occurrence of the same count in narrative text.
      const installationLabels = labels.map((label, index) => label === 'recorded installations' ? index : -1).filter(index => index >= 0);
      assert.equal(installationLabels.length, 1, 'PDF has one recorded-installations footprint metric');
      assert.equal(labels[installationLabels[0] - 1], total.toLocaleString('en-AU'), 'Downloaded total matches visible scoped inventory');
      assert(text.includes('Security domains: ' + query.get('securityDomain')));
      assert(text.includes(`Snapshot ${selection.date}`));
      if (artifacts) fs.copyFileSync(result.file, path.join(artifacts, selection.name + '.pdf'));
    }
  } finally {
    await page.setViewport({ width: 1600, height: 1000 });
    if (sidebarWasOpen && await page.$('[aria-label="Show sidebar"]')) await page.click('[aria-label="Show sidebar"]');
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory }); await client.detach();
  }
}
