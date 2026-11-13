import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

/** Verifies server JSON evidence, browser PDF output and the shared progress dialog. */
export async function checkInsightsPdfDownload(page, { date, directory, snapshotTimestamp,
  route = '/api/governance/end-point-insights/report', filenamePrefix = 'end-point-insights', title = 'End Point Insights Report',
  root = '.governance-insights', snapshotAttribute = 'insightsSnapshot', minPages = 7, exerciseRetry = true, snapshotSubject = true } = {}) {
  assert(directory && date, 'PDF download checks need an explicit temporary directory and snapshot');
  fs.mkdirSync(directory, { recursive: true });
  const button = '[data-insights-report]', href = await page.$eval(button, node => node.dataset.insightsReport);
  assert.equal(new URL(href, page.url()).searchParams.get('dataDate'), date);
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  let fail = exerciseRetry, attempts = 0, closing = false;
  const interceptionErrors = [];
  const intercept = async ({ requestId, request }) => {
    try {
      if (new URL(request.url).pathname !== route) return await client.send('Fetch.continueRequest', { requestId });
      attempts++;
      if (fail) return await client.send('Fetch.fulfillRequest', { requestId, responseCode: 503,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify({ error: 'Temporary failure' })).toString('base64') });
      await new Promise(resolve => setTimeout(resolve, 350));
      if (!closing) await client.send('Fetch.continueRequest', { requestId });
    } catch (error) { if (!closing) interceptionErrors.push(String(error)); }
  };
  // Intercept only the evidence endpoint. Global page interception can also pause
  // worker artwork fetches, which are unrelated to the retry/duplicate test.
  client.on('Fetch.requestPaused', intercept);
  await client.send('Fetch.enable', { patterns: [{ urlPattern: '*' + route + '*', requestStage: 'Request' }] });
  const expectedFile = path.join(directory, `${filenamePrefix}-${date}.pdf`);
  if (fs.existsSync(expectedFile)) fs.unlinkSync(expectedFile);
  try {
    if (exerciseRetry) {
      await page.focus(button); await page.keyboard.press('Enter');
      await page.waitForSelector('.document-generation-dialog[open] [role="alert"]');
      assert.equal(await page.$eval(button, node => node.disabled), false, 'Failed exports can be retried');
      assert(await page.$eval('.document-generation-dialog', node => node.contains(document.activeElement)), 'Failure keeps keyboard focus inside the actionable dialog');
      fail = false;
    }
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === route && response.status() === 200);
    if (exerciseRetry) {
      await page.focus('.document-generation-actions button:first-child'); await page.keyboard.press('Enter');
    } else {
      await page.focus(button); await page.keyboard.press('Enter');
    }
    await page.waitForFunction(() => document.querySelector('[data-insights-report]').disabled);
    await page.waitForSelector('.document-generation-dialog[open] [role="progressbar"]');
    assert.equal(await page.$eval('.document-generation-dialog h2', node => node.textContent), 'Generating Document');
    await page.$eval(button, node => { node.click(); node.click(); });
    const response = await responsePromise;
    assert.match(response.headers()['content-type'], /application\/json/);
    assert.equal(response.headers()['content-disposition'], undefined);
    const job = await response.json();
    assert.equal(job.version, 1); assert.match(job.kind, /^insights-/); assert.equal(job.filename, path.basename(expectedFile));
    try {
      await page.waitForFunction(() => !document.querySelector('[data-insights-report]').disabled && !document.querySelector('.document-generation-dialog[open]'), { timeout: 60000 });
    } catch (error) {
      const state = await page.evaluate(() => document.querySelector('.document-generation-dialog')?.textContent ?? 'No document dialog');
      throw new Error(`PDF generation did not finish: ${state}; interception errors: ${JSON.stringify(interceptionErrors)}`, { cause: error });
    }
    const deadline = Date.now() + 60000;
    while (!fs.existsSync(expectedFile) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(expectedFile), 'The generated PDF downloads with a snapshot-specific filename');
    const doc = await PDFDocument.load(fs.readFileSync(expectedFile));
    assert.equal(doc.getTitle(), title);
    assert(doc.getPageCount() >= minPages);
    if (snapshotSubject) assert(doc.getSubject().includes('Snapshot ' + date));
    if (snapshotTimestamp) assert(doc.getSubject().includes(new Date(snapshotTimestamp).toISOString().replace('T', ' ').replace('Z', ' UTC')));
    assert.equal(attempts, exerciseRetry ? 2 : 1, 'Busy activation does not duplicate the request');
    assert.deepEqual(interceptionErrors, [], 'Report API interception completed without protocol errors');
    assert.equal(await page.$('.document-generation-dialog [role="alert"]'), null);
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-insights-report]'));
    if (snapshotAttribute) assert.equal(await page.$eval(root, (node, key) => node.dataset[key], snapshotAttribute), date);
    return { file: expectedFile, pages: doc.getPageCount() };
  } finally {
    closing = true; client.off('Fetch.requestPaused', intercept); await client.send('Fetch.disable'); await client.detach();
  }
}
