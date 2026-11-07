import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

/** Shared download interaction checks for both Insights briefings. */
export async function checkInsightsPdfDownload(page, { date, directory, snapshotTimestamp,
  route = '/api/governance/insights/report', filenamePrefix = 'cyber-terrain-insights', title = 'Cyber Terrain Posture - Insights',
  root = '.governance-insights', snapshotAttribute = 'insightsSnapshot', minPages = 7 } = {}) {
  assert(directory && date, 'PDF download checks need an explicit temporary directory and snapshot');
  fs.mkdirSync(directory, { recursive: true });
  const button = '[data-insights-report]', href = await page.$eval(button, node => node.dataset.insightsReport);
  assert.equal(new URL(href, page.url()).searchParams.get('dataDate'), date);
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  let fail = true, attempts = 0;
  const intercept = async request => {
    if (new URL(request.url()).pathname !== route) return request.continue();
    attempts++;
    if (fail) return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
    await new Promise(resolve => setTimeout(resolve, 350));
    return request.continue();
  };
  await page.setRequestInterception(true); page.on('request', intercept);
  const expectedFile = path.join(directory, `${filenamePrefix}-${date}.pdf`);
  try {
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForSelector('.insight-report-download [role="alert"]');
    assert.equal(await page.$eval(button, node => node.disabled), false, 'Failed exports can be retried');
    assert(await page.$eval(button, node => document.activeElement === node), 'Keyboard focus remains available after a failed export');
    fail = false;
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-insights-report]').disabled);
    assert((await page.$eval(button, node => node.textContent)).includes('Generating PDF'));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('[data-insights-report]').disabled);
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(expectedFile) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(expectedFile), 'The generated PDF downloads with a snapshot-specific filename');
    const doc = await PDFDocument.load(fs.readFileSync(expectedFile));
    assert.equal(doc.getTitle(), title);
    assert(doc.getPageCount() >= minPages);
    assert(doc.getSubject().includes('Snapshot ' + date));
    if (snapshotTimestamp) assert(doc.getSubject().includes(new Date(snapshotTimestamp).toISOString().replace('T', ' ').replace('Z', ' UTC')));
    assert.equal(attempts, 2, 'One failed attempt and one retry; busy activation does not duplicate the request');
    assert.equal(await page.$('.insight-report-download [role="alert"]'), null);
    assert(await page.$eval(button, node => document.activeElement === node), 'Keyboard focus remains available after download');
    assert.equal(await page.$eval(root, (node, key) => node.dataset[key], snapshotAttribute), date);
    return { file: expectedFile, pages: doc.getPageCount() };
  } finally {
    page.off('request', intercept); await page.setRequestInterception(false); await client.detach();
  }
}
