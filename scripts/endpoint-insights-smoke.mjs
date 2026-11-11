import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { securityDomainSelection } from '../lib/security-domain.mjs';

/** Count reconciliation and presentation checks against a compiled app and isolated evidence store. */
export async function checkEndpointInsights(page, { date, historicalDate, artifacts }) {
  const base = new URL(page.url()).origin;
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const visit = async (query = `network=net-1&dataDate=${date}`) => {
    await page.goto(base + '/governance/end-point-insights?' + query, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.endpoint-insights');
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  };
  const noOverflow = () => page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth + 1);
  await page.setViewport({ width: 1600, height: 1000 }); await visit();
  assert.equal(await page.$eval('.workspace-navigation [aria-current=page]', node => node.textContent.trim()), 'End Point Insights');
  const governance = await page.$$eval('.workspace-nav-group', nodes => nodes.find(node => node.querySelector('.workspace-group-toggle').textContent.trim() === 'Governance').textContent);
  assert(governance.indexOf('End Point Insights') > governance.indexOf('Installed Software Insights'));
  assert.equal(await page.$$('.endpoint-insights .endpoint-insight-field').then(nodes => nodes.length), 9);
  await page.$eval('.insight-footer', node => node.scrollIntoView());
  await page.waitForFunction(() => [...document.querySelectorAll('.endpoint-insights img')].every(img => img.complete && img.naturalWidth > 0));
  for (const [width, height] of [[1600,1000], [1280,720], [390,844], [320,844]]) {
    await page.setViewport({ width, height });
    if (width < 760 && await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
    if (width < 760) await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 45);
    await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
    assert(await noOverflow(), `No horizontal overflow at ${width}px`);
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `endpoint-insights-${width}.png`) });
    for (const chapter of ['inventory','gaps','freshness','coverage','actions']) {
      await page.focus(`.endpoint-insights .insight-chapters a[href="#endpoint-insights-${chapter}"]`); await page.keyboard.press('Enter');
      await page.waitForFunction(id => location.hash === '#endpoint-insights-' + id, {}, chapter);
      assert(await page.$eval('#endpoint-insights-' + chapter, node => node.getBoundingClientRect().top) < height);
      assert(await noOverflow());
      if (artifacts && [1600,390].includes(width)) await page.screenshot({ path: path.join(artifacts, `endpoint-insights-${chapter}-${width}.png`) });
    }
    await page.focus('.endpoint-insights summary'); await page.keyboard.press('Enter');
    assert(await page.$eval('.endpoint-insights details', node => node.open)); await page.keyboard.press('Enter');
    await page.focus('.endpoint-insights .insight-footer a'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.workspace-content').scrollTop < 30);
  }
  await page.setViewport({ width: 1600, height: 1000 });
  if (await page.$('[aria-label="Show sidebar"]')) await page.click('[aria-label="Show sidebar"]');
  for (const query of [`network=net-1&dataDate=${date}`, `system=sys-1&securityDomain=PROTECTED,SECRET,UNKNOWN&dataDate=${historicalDate}`]) {
    await visit(query);
    const selected = new URLSearchParams(query);
    assert.equal(await page.$eval('.insight-edition time', node => node.textContent), selected.get('dataDate'));
    assert(await page.$eval('.insight-headline-metrics strong', node => Number(node.textContent.replaceAll(',', '')) > 0));
    const links = await page.$$eval('.endpoint-insights a[data-endpoint-insight-count]', nodes => nodes.map(node => ({ href: node.getAttribute('href'), count: Number(node.dataset.endpointInsightCount) })));
    const unique = new Map(links.map(link => [link.href, link]));
    assert(unique.size > 20);
    let first = true;
    for (const link of unique.values()) {
      const url = new URL(link.href, base);
      for (const key of ['network','system','dataDate']) if (selected.has(key)) assert.equal(url.searchParams.get(key), selected.get(key));
      assert.deepEqual(securityDomainSelection(url.searchParams.get('securityDomain') ?? undefined), securityDomainSelection(selected.get('securityDomain') ?? undefined));
      if (first) {
        await page.focus(`.endpoint-insights a[href=${JSON.stringify(link.href)}]`);
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]); first = false;
      } else await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
      assert.equal(await page.$eval('.endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(',', ''))), link.count, `Evidence count matches ${url.searchParams.get('discoveryView')}: ${link.href}`);
    }
    console.log(`End Point Insights: reconciled ${unique.size} Explorer links for ${query}`);
  }
  for (const query of [`network=net-1&securityDomain=NONE&dataDate=${date}`, `network=missing-network&dataDate=${date}`]) {
    await visit(query);
    assert(await page.$eval('.endpoint-insights', node => node.textContent.includes('No endpoint records in this scope') && node.textContent.includes('N/A')));
    assert(!await page.$eval('.endpoint-insights', node => /NaN|Infinity/.test(node.textContent)));
  }
  await page.goto(base + '/governance/end-point-insights', { waitUntil: 'networkidle0' });
  assert.equal(await page.$('.endpoint-insights'), null);
  await visit();
  console.log('End Point Insights passed: navigation, desktop/phone layouts, keyboard chapters, all Explorer counts, current/historical scopes, domains and empty states.');
}
