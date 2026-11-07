import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkInsightsPdfDownload } from "./insights-pdf-smoke.mjs";

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

export async function checkGovernanceInsightsPdf(page, options = {}) {
  return checkInsightsPdfDownload(page, options);
}
