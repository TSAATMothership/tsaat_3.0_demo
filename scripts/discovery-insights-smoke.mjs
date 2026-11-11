import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { securityDomainSelection } from '../lib/security-domain.mjs';
import { checkInsightsPdfDownload } from './insights-pdf-smoke.mjs';

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
  const governancePages = groups.find(g => g.label === 'Governance').pages;
  const softwareIndex = governancePages.indexOf('Installed Software Insights');
  assert.deepEqual(governancePages.slice(softwareIndex, softwareIndex + 2), ['Installed Software Insights', 'Discovery Insights']);
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
    const result = await checkInsightsPdfDownload(page, { date: snapshot, directory, route: '/api/discovery-coverage/overview-report',
      filenamePrefix: 'discovery-insights', title: 'Discovery Insights Report', minPages: 9, snapshotAttribute: null, snapshotSubject: false, exerciseRetry: false });
    if (artifacts) fs.copyFileSync(result.file, path.join(artifacts, `discovery-insights-${snapshot}.pdf`));
  }
  await visit(`network=net-1&securityDomain=NONE&dataDate=${date}`);
  assert(await page.$('.discovery-insights-empty')); assert.match(await page.$eval('.insight-ring', n => n.textContent), /N\/A/);
  assert.equal(await page.$$('.insight-decision').then(nodes => nodes.length), 0);
  const empty = await checkInsightsPdfDownload(page, { date, directory, route: '/api/discovery-coverage/overview-report',
    filenamePrefix: 'discovery-insights', title: 'Discovery Insights Report', minPages: 1, snapshotAttribute: null, snapshotSubject: false });
  if (artifacts) fs.copyFileSync(empty.file, path.join(artifacts, 'discovery-insights-empty.pdf'));
  await page.goto(base + '/governance/discovery-insights', {waitUntil:'networkidle0'}); assert.equal(await page.$('.discovery-insights'), null);
  await visit(`network=missing-network&dataDate=${date}`, true);
  assert(await page.$('.discovery-insights-empty')); assert.match(await page.$eval('[data-discovery-security]', n => n.textContent), /N\/A\s*patched & verified/);
  console.log('Discovery Insights passed: Governance move/legacy redirect, all chapters, 1600/1280/390/320 layouts, keyboard anchors, all six Explorer counts, historical/domain scope, empty state, PDF export/focus/retry.');
}
