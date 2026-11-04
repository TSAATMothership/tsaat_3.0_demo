import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

/** Runs on an already-loaded scoped Insights page in either provider build. */
export async function checkGovernanceInsights(page, { date, artifacts } = {}) {
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  await page.waitForSelector('.governance-insights');
  await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  if (date) assert.equal(await page.$eval('.governance-insights', node => node.dataset.insightsSnapshot), date);
  assert.equal(await page.$$eval('.insight-chapters a', nodes => nodes.length), 5);
  assert.equal(await page.$$eval('.insight-headline-metrics .insight-metric', nodes => nodes.length), 4);
  await page.$eval('.insight-footer', node => node.scrollIntoView());
  await page.waitForFunction(() => [...document.querySelectorAll('.governance-insights img')].every(image => image.complete && image.naturalWidth > 0));
  const scope = Object.fromEntries(new URL(page.url()).searchParams);
  const links = await page.$$eval('.governance-insights a[href^="/"]', nodes => nodes.map(node => node.href));
  for (const href of links) {
    const target = new URL(href);
    for (const key of ['network', 'system', 'securityDomain']) if (scope[key]) assert.equal(target.searchParams.get(key), scope[key], 'Evidence links preserve ' + key);
    if (date) assert.equal(target.searchParams.get('dataDate'), date);
  }
  assert(await page.$eval('.workspace-content', node => node.scrollHeight > node.clientHeight), 'Briefing scrolls vertically in the workspace');
  assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth), 'No horizontal desktop overflow');
  await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'insights-desktop.png') });
  if (artifacts) for (const section of ['terrain', 'exposure', 'mission']) {
    await page.$eval('#insights-' + section, node => node.scrollIntoView());
    await page.screenshot({ path: path.join(artifacts, 'insights-' + section + '.png') });
  }
  await page.focus('.insight-chapters a:last-child'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#insights-decisions' && document.querySelector('.workspace-content').scrollTop > 500);
  const initialScroll = await page.$eval('.workspace-content', node => node.scrollTop);
  assert(initialScroll > 0, 'Keyboard chapter navigation scrolls to the leadership agenda');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'insights-priorities.png') });
  await page.focus('.insight-footer summary'); await page.keyboard.press('Enter');
  assert(await page.$eval('.insight-footer details', node => node.open));
  await page.focus('.insight-footer > div a'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.workspace-content').scrollTop < 30);
  const sidebarWasOpen = await page.$eval('.sidebar-toggle', node => node.getAttribute('aria-expanded') === 'true');
  await page.setViewport({ width: 390, height: 844 });
  if (sidebarWasOpen) await page.click('[aria-label="Hide sidebar"]');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 45 && document.querySelector('.workspace-content').clientWidth > 250);
  assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth), 'No horizontal phone overflow');
  await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'insights-phone.png') });
  await page.focus('.insight-chapters a[href="#insights-resilience"]'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#insights-resilience');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'insights-phone-resilience.png') });
  await page.setViewport({ width: 1600, height: 1000 });
  if (sidebarWasOpen) await page.click('[aria-label="Show sidebar"]');
  await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
}

export async function checkGovernanceInsightsPdf(page, { date, directory, snapshotTimestamp } = {}) {
  assert(directory && date, 'PDF download checks need an explicit temporary directory and snapshot');
  fs.mkdirSync(directory, { recursive: true });
  const button = '[data-insights-report]', href = await page.$eval(button, node => node.dataset.insightsReport);
  assert.equal(new URL(href, page.url()).searchParams.get('dataDate'), date);
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  let fail = true, attempts = 0;
  const intercept = async request => {
    if (new URL(request.url()).pathname !== '/api/governance/insights/report') return request.continue();
    attempts++;
    if (fail) return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
    await new Promise(resolve => setTimeout(resolve, 350));
    return request.continue();
  };
  await page.setRequestInterception(true); page.on('request', intercept);
  const expectedFile = path.join(directory, `cyber-terrain-insights-${date}.pdf`);
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
    assert.equal(doc.getTitle(), 'Cyber Terrain Posture - Insights');
    assert(doc.getPageCount() >= 7);
    assert(doc.getSubject().includes('Snapshot ' + date));
    if (snapshotTimestamp) assert(doc.getSubject().includes(new Date(snapshotTimestamp).toISOString().replace('T', ' ').replace('Z', ' UTC')));
    assert.equal(attempts, 2, 'One failed attempt and one retry; busy activation does not duplicate the request');
    assert.equal(await page.$('.insight-report-download [role="alert"]'), null);
    assert(await page.$eval(button, node => document.activeElement === node), 'Keyboard focus remains available after download');
    assert.equal(await page.$eval('.governance-insights', node => node.dataset.insightsSnapshot), date);
    return { file: expectedFile, pages: doc.getPageCount() };
  } finally {
    page.off('request', intercept); await page.setRequestInterception(false); await client.detach();
  }
}
