import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { securityDomainSelection } from '../lib/security-domain.mjs';
import { checkInsightsPdfDownload } from './insights-pdf-smoke.mjs';

export async function checkInventoryInsightsReports(page, { date, historicalDate, directory, artifacts }) {
  const base = new URL(page.url()).origin, button = 'button[data-insights-report]';
  const client = await page.browser().target().createCDPSession();
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const evidence = [];
  try {
    for (const [slug, title] of [['end-point-insights', 'End Point Insights'], ['security-vulnerability-insights', 'Security Vulnerability Insights']]) {
      await page.setViewport({ width: 1600, height: 1000 });
      for (const [name, query] of [['current', `network=net-1&securityDomain=PROTECTED&dataDate=${date}`], ['historical', `system=sys-1&dataDate=${historicalDate}`], ['empty', `network=net-1&securityDomain=NONE&dataDate=${date}`]]) {
        await page.goto(base + '/governance/' + slug + '?' + query, { waitUntil: 'networkidle0' });
        await page.waitForSelector(button); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
        const selected = new URLSearchParams(query), snapshot = await page.$eval('.insight-edition time', node => node.textContent);
        const href = await page.$eval(button, node => node.dataset.insightsReport), target = new URL(href, base);
        assert.equal(target.searchParams.get('dataDate'), snapshot);
        for (const key of ['network', 'system']) assert.equal(target.searchParams.get(key), selected.get(key));
        assert.deepEqual(securityDomainSelection(target.searchParams.get('securityDomain') ?? undefined), securityDomainSelection(selected.get('securityDomain') ?? undefined));
        assert.equal(target.searchParams.has('discoveryFilters'), false);
        const metrics = await page.$$eval('.insight-headline-metrics .insight-metric', nodes => nodes.map(node => ({ label: node.querySelector('span').textContent, value: node.querySelector('strong').textContent })));
        assert.equal(Number(metrics[0].value.replaceAll(',', '')) > 0, name !== 'empty');
        const result = await checkInsightsPdfDownload(page, { date: snapshot, directory, route: target.pathname,
          filenamePrefix: slug, title: title + ' Report', minPages: 6, snapshotAttribute: null, snapshotSubject: false, exerciseRetry: name === 'current' });
        const bytes = fs.readFileSync(result.file);
        if (artifacts) fs.writeFileSync(path.join(artifacts, `${slug}-${name}.pdf`), bytes);
        evidence.push({ slug, title, name, snapshot, metrics, pages: result.pages });
        console.log(`${title}: ${name} browser PDF downloaded (${result.pages} pages)`);
      }
      for (const [width, height] of [[1280,720], [390,844], [320,844]]) {
        await page.setViewport({ width, height });
        if (width < 760 && await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
        if (width < 760) await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 45);
        await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
        assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth + 1));
        await page.focus(button);
        assert(await page.$eval(button, node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; }));
        if (artifacts) await page.screenshot({ path: path.join(artifacts, `${slug}-export-${width}.png`) });
      }
      await page.goto(base + '/governance/' + slug, { waitUntil: 'networkidle0' }); assert.equal(await page.$(button), null);
    }
    if (artifacts) fs.writeFileSync(path.join(artifacts, 'report-evidence.json'), JSON.stringify(evidence, null, 2));
  } finally { await client.detach(); }
  console.log('Both Insights PDF buttons passed: download, retry, progress, duplicate prevention, focus, history/domain/empty scope and narrow layouts.');
}
