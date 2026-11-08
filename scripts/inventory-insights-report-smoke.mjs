import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { securityDomainSelection } from '../lib/security-domain.mjs';

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
        const file = path.join(directory, `${slug}-${snapshot}.pdf`); if (fs.existsSync(file)) fs.unlinkSync(file);
        let intercept, release, attempts = 0;
        if (name === 'current') {
          let fail = true, hold = true;
          const pending = new Promise(resolve => { release = resolve; });
          intercept = async request => {
            if (request.url() !== target.href) { await request.continue(); return; }
            attempts++;
            if (fail) { await request.respond({ status: 503, contentType: 'application/json', body: '{}' }); return; }
            if (hold) await pending;
            await request.continue();
          };
          await page.setRequestInterception(true); page.on('request', intercept);
          await page.focus(button); await page.keyboard.press('Enter');
          await page.waitForSelector('.insight-report-download [role=alert]');
          assert(!await page.$eval(button, node => node.disabled));
          fail = false; attempts = 0;
          const responsePromise = page.waitForResponse(response => response.url() === target.href);
          await page.$eval(button, node => { node.focus(); node.click(); node.click(); });
          await page.waitForFunction(() => document.querySelector('button[data-insights-report]').disabled);
          assert.match(await page.$eval('.insight-report-download [role=status]', node => node.textContent), /Generating/);
          // Let the single held request reach interception, then release it after checking the busy UI.
          const deadline = Date.now() + 5000;
          while (attempts < 1 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
          assert.equal(attempts, 1, 'Duplicate activation starts one request'); hold = false; release();
          assert.equal((await responsePromise).status(), 200);
        } else {
          const responsePromise = page.waitForResponse(response => response.url() === target.href);
          await page.focus(button); await page.keyboard.press('Enter'); assert.equal((await responsePromise).status(), 200);
        }
        const deadline = Date.now() + 15000;
        while (!fs.existsSync(file) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
        assert(fs.existsSync(file), 'Generated PDF downloaded');
        const bytes = fs.readFileSync(file), pdf = await PDFDocument.load(bytes);
        assert.equal(pdf.getTitle(), title + ' Report'); assert(pdf.getPageCount() >= 6);
        await page.waitForFunction(() => !document.querySelector('button[data-insights-report]').disabled && !document.querySelector('.insight-report-download [role=alert]'));
        assert(await page.$eval(button, node => node === document.activeElement), 'Export returns keyboard focus');
        if (intercept) { page.off('request', intercept); await page.setRequestInterception(false); }
        if (artifacts) fs.writeFileSync(path.join(artifacts, `${slug}-${name}.pdf`), bytes);
        evidence.push({ slug, title, name, snapshot, metrics, pages: pdf.getPageCount() });
        console.log(`${title}: ${name} PDF downloaded (${pdf.getPageCount()} pages)`);
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
