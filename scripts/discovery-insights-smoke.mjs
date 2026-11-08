import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { securityDomainSelection } from '../lib/security-domain.mjs';

/** Shared presentation/route checks against an isolated store in either compiled provider. */
export async function checkDiscoveryInsights(page, { date, historicalDate, artifacts, directory }) {
  const base = new URL(page.url()).origin;
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const visit = async (query = `network=net-1&dataDate=${date}`, legacy = false) => {
    await page.goto(base + (legacy ? '/discovery-coverage?discoveryView=overview&' : '/governance/discovery-insights?') + query, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.discovery-insights'); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  };
  const noOverflow = () => page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth + 1);
  await page.setViewport({ width: 1600, height: 1000 }); await visit(undefined, true);
  assert.equal(new URL(page.url()).pathname, '/governance/discovery-insights');
  assert.equal(await page.$eval('.workspace-navigation [aria-current=page]', n => n.textContent.trim()), 'Discovery Insights');
  const groups = await page.$$eval('.workspace-nav-group', nodes => nodes.map(node => ({ label: node.querySelector('.workspace-group-toggle').textContent.trim(), pages: [...node.querySelectorAll('.workspace-nav-link')].map(a => a.textContent.trim()) })));
  assert.deepEqual(groups.find(g => g.label === 'Governance').pages.slice(-2), ['Installed Software Insights', 'Discovery Insights']);
  assert(!groups.find(g => g.label === 'Discovery').pages.includes('Overview'));
  assert.equal(await page.$$('.discovery-insights .insight-chapters a').then(n => n.length), 5);
  await page.$eval('.insight-footer', node => node.scrollIntoView());
  await page.waitForFunction(() => [...document.querySelectorAll('.discovery-insights img')].every(img => img.complete && img.naturalWidth > 0));
  for (const [width, height] of [[1600,1000],[1280,720],[390,844],[320,844]]) {
    await page.setViewport({ width, height });
    if (width < 760 && await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
    if (width < 760) await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 45);
    assert(await noOverflow(), `No horizontal overflow at ${width}px`);
    await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `discovery-insights-${width}.png`) });
    for (const chapter of ['footprint','coverage','evidence','security','actions']) {
      await page.focus(`.insight-chapters a[href="#discovery-insights-${chapter}"]`); await page.keyboard.press('Enter');
      await page.waitForFunction(id => location.hash === '#discovery-insights-' + id, {}, chapter);
      const position = await page.$eval('#discovery-insights-' + chapter, node => node.getBoundingClientRect().top);
      assert(position < height, 'Chapter anchor enters viewport'); assert(await noOverflow());
      if (artifacts && [1600,390].includes(width)) await page.screenshot({ path: path.join(artifacts, `discovery-insights-${chapter}-${width}.png`) });
    }
    await page.focus('.discovery-insight-method summary'); await page.keyboard.press('Enter');
    assert(await page.$eval('.discovery-insight-method', node => node.open));
    await page.keyboard.press('Enter');
    await page.focus('.insight-footer a'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.workspace-content').scrollTop < 30);
  }
  await page.setViewport({ width: 1600, height: 1000 });
  if (await page.$('[aria-label="Show sidebar"]')) await page.click('[aria-label="Show sidebar"]');
  for (const query of [`network=net-1&dataDate=${date}`, `system=sys-1&securityDomain=PROTECTED,SECRET,UNKNOWN&dataDate=${historicalDate}`]) {
    await visit(query, true);
    const selected = new URLSearchParams(query), snapshot = selected.get('dataDate');
    assert.equal(await page.$eval('.insight-edition time', node => node.textContent), snapshot);
    assert(await page.$eval('.insight-headline-metrics .insight-metric strong', node => Number(node.textContent.replaceAll(',', '')) > 0), 'Count reconciliation uses populated current and historical scopes');
    const links = await page.$$eval('.discovery-insights a[data-overview-count]', nodes => nodes.map(a => ({ href: a.getAttribute('href'), count: Number(a.dataset.overviewCount) })));
    const targets = new Map();
    for (const link of links) {
      const url = new URL(link.href, base), view = url.searchParams.get('discoveryView');
      for (const key of ['network','system','dataDate']) if (selected.has(key)) assert.equal(url.searchParams.get(key), selected.get(key));
      assert.deepEqual(securityDomainSelection(url.searchParams.get('securityDomain') ?? undefined), securityDomainSelection(selected.get('securityDomain') ?? undefined), 'Domain selections retain their meaning, including the omitted all-domains default');
      if (!targets.has(view)) targets.set(view, link);
      if (view === 'patch-management' && link.href.includes('daysOverdue')) targets.set('overdue-patches', link);
    }
    assert.equal(targets.size, 7);
    for (const [view, link] of targets) {
      if (['security-vulnerabilities', 'patch-management', 'overdue-patches'].includes(view)) {
        await visit(query);
        await page.focus(`.discovery-insights a[href=${JSON.stringify(link.href)}]`);
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
      } else await page.goto(base + link.href, { waitUntil: 'networkidle0' });
      await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
      assert.equal(await page.$eval('.endpoint-toolbar h2 span', n => Number(n.textContent.replaceAll(',', ''))), link.count, `${view} count matches its Explorer`);
      if (view === 'patch-management' || view === 'overdue-patches') {
        await page.click('#patch-explorer-tab-restarts'); await page.click('#patch-explorer-tab-posture');
        assert.equal(await page.$eval('.patch-results .endpoint-toolbar h2 span', n => Number(n.textContent.replaceAll(',', ''))), link.count, 'Patch drill-through filters survive tab changes');
      }
    }
    await visit(query);
    const button = 'button[data-insights-report]', href = await page.$eval(button, n => n.dataset.insightsReport);
    const client = await page.browser().target().createCDPSession();
    await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
    const file = path.join(directory, `discovery-insights-${snapshot}.pdf`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    const responsePromise = page.waitForResponse(r => r.url() === base + href);
    await page.focus(button); await page.keyboard.press('Enter');
    assert.equal((await responsePromise).status(), 200);
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(file) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(file));
    const bytes = fs.readFileSync(file), pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getTitle(), 'Discovery Insights Report'); assert(pdf.getPageCount() >= 9);
    if (artifacts) fs.writeFileSync(path.join(artifacts, `discovery-insights-${snapshot}.pdf`), bytes);
    await page.waitForFunction(() => !document.querySelector('button[data-insights-report]').disabled);
    assert(await page.$eval(button, node => node === document.activeElement), 'PDF retains keyboard focus');
    await client.detach();
  }
  await visit(`network=net-1&securityDomain=NONE&dataDate=${date}`);
  assert(await page.$('.discovery-insights-empty')); assert.match(await page.$eval('.insight-ring', n => n.textContent), /N\/A/);
  assert.equal(await page.$$('.insight-decision').then(nodes => nodes.length), 0);
  const emptyPdf = await page.evaluate(async () => {const r = await fetch(document.querySelector('button[data-insights-report]').dataset.insightsReport); return [...new Uint8Array(await r.arrayBuffer())];});
  if (artifacts) fs.writeFileSync(path.join(artifacts, 'discovery-insights-empty.pdf'), Buffer.from(emptyPdf));
  let fail = true;
  const intercept = request => request.url().includes('/api/discovery-coverage/overview-report') && fail ? request.respond({status:503, contentType:'application/json', body:'{}'}) : request.continue();
  await page.setRequestInterception(true); page.on('request', intercept);
  await page.click('button[data-insights-report]'); await page.waitForSelector('.insight-report-download [role=alert]');
  assert(!await page.$eval('button[data-insights-report]', n => n.disabled));
  fail = false; await page.click('button[data-insights-report]');
  await page.waitForFunction(() => !document.querySelector('button[data-insights-report]').disabled && !document.querySelector('.insight-report-download [role=alert]'));
  await page.setRequestInterception(false); page.off('request', intercept);
  await page.goto(base + '/governance/discovery-insights', {waitUntil:'networkidle0'}); assert.equal(await page.$('.discovery-insights'), null);
  await visit(`network=missing-network&dataDate=${date}`, true);
  assert(await page.$('.discovery-insights-empty')); assert.match(await page.$eval('[data-discovery-security]', n => n.textContent), /N\/A\s*patched & verified/);
  console.log('Discovery Insights passed: Governance move/legacy redirect, all chapters, 1600/1280/390/320 layouts, keyboard anchors, all six Explorer counts, historical/domain scope, empty state, PDF export/focus/retry.');
}
