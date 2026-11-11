import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Shared presentation checks for either compiled data provider. */
export async function checkDiscoveryComplianceExplorer(page, { date, historicalDate = date, directory, artifacts } = {}) {
  const base = new URL(page.url()).origin;
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  await page.setViewport({ width: 1600, height: 1000 });
  const visit = async (view = 'compliance', scope = 'network=net-1', snapshot = date) => {
    await page.goto(`${base}/discovery-coverage?discoveryView=${view}&${scope}&dataDate=${snapshot}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  };
  const style = () => page.evaluate(() => Object.fromEntries([
    ['.endpoint-explorer', 'gap'], ['.endpoint-chart', 'backgroundImage'], ['.endpoint-chart', 'borderRadius'],
    ['.endpoint-toolbar', 'padding'], ['.endpoint-table td', 'padding'], ['.endpoint-pagination', 'padding']
  ].map(([selector, property]) => [selector + property, getComputedStyle(document.querySelector(selector))[property]])));
  const count = () => page.$eval('.endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(',', '')));
  const clear = async () => { if (await page.$('.endpoint-clear-all')) await page.click('.endpoint-clear-all'); };
  await visit('installed-software');
  const reference = await style();
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'installed-software-reference.png') });
  const charts = [['Discovery compliance', 'compliant'], ['Missing discovery tools', 'missingTools'], ['Discovered by', 'discoveredBy'], ['Last discovered', 'lastDiscoveredDate']];
  for (const selection of [{ scope: 'network=net-1&securityDomain=UNKNOWN', snapshot: date }, { scope: 'system=sys-1', snapshot: historicalDate }]) {
    await visit('compliance', selection.scope, selection.snapshot);
    assert.deepEqual(await style(), reference, 'Compliance shares the reference explorer styles');
    assert.equal(await page.$('.discovery-compliance-page .panel.no-print, .discovery-compliance-page .coverage-snapshot'), null);
    assert.equal(await page.$$eval('.endpoint-chart', nodes => nodes.length), 4);
    const total = await count(); assert(total > 1);
    for (const [title, column] of charts) {
      const selector = `section[aria-label="${title} summary chart"] .endpoint-chart-bars button`;
      const bar = await page.$eval(selector, node => ({ value: node.querySelector('.endpoint-chart-label > span').textContent, count: Number(node.querySelector('strong').textContent.replaceAll(',', '')) }));
      await page.focus(selector); await page.keyboard.press('Enter');
      await page.waitForFunction(expected => Number(document.querySelector('.endpoint-toolbar h2 span').textContent.replaceAll(',', '')) === expected, {}, bar.count);
      assert.equal(await page.$eval(selector, node => node.getAttribute('aria-pressed')), 'true');
      assert(await page.$('.endpoint-active-filters'));
      if (column === 'missingTools' && directory) {
        const downloadDir = path.join(directory, 'discovery-compliance'); fs.mkdirSync(downloadDir, { recursive: true });
        await page.browser().defaultBrowserContext().setDownloadBehavior({ policy: 'allow', downloadPath: downloadDir });
        try {
          const pending = page.waitForResponse(response => response.url().endsWith('/api/discovery-coverage/compliance/export') && response.request().method() === 'POST');
          await page.click('.endpoint-export'); const response = await pending;
          assert.equal(response.status(), 200); assert.match(response.headers()['content-type'], /application\/json/);
          assert.equal(response.headers()['content-disposition'], undefined, 'Workbook bytes are generated in the browser.');
          const payload = JSON.parse(response.request().postData());
          assert.deepEqual(payload.filters.columns[column], [bar.value]); assert.equal(payload.scope.dataDate, selection.snapshot);
          for (const [key, value] of new URLSearchParams(selection.scope)) assert.equal(payload.scope[key], value);
          const file = path.join(downloadDir, `discovery-compliance-explorer-${selection.snapshot}.xlsx`), deadline = Date.now() + 15000;
          while (!fs.existsSync(file) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
          assert(fs.existsSync(file), 'Filtered workbook downloads');
          const bytes = fs.readFileSync(file); assert(bytes.length > 1000 && bytes.subarray(0, 2).toString() === 'PK');
        } finally { await page.browser().defaultBrowserContext().setDownloadBehavior({ policy: 'allow', downloadPath: directory }); }
      }
      if (column === 'discoveredBy') {
        const trigger = '.endpoint-column-trigger[aria-label^="Filter Discovered By"]';
        await page.focus(trigger); await page.keyboard.press('Enter');
        await page.waitForSelector('.endpoint-filter-popup input[type=checkbox]:checked');
        await page.keyboard.press('Escape');
        assert.equal(await page.$('.endpoint-filter-popup'), null);
        assert(await page.$eval(trigger, node => node === document.activeElement), 'Column popup returns keyboard focus');
      }
      await clear(); assert.equal(await count(), total);
    }
    const asset = await page.$eval('.endpoint-name small', node => node.textContent);
    await page.focus('input[aria-label="Search all discovery compliance fields"]'); await page.keyboard.type(asset);
    assert((await count()) < total); await clear(); assert.equal(await count(), total);
    await page.focus('.endpoint-name [data-cmdb-asset-id]'); await page.keyboard.press('Enter');
    await page.waitForSelector('dialog[data-cmdb-drill-through][open][data-load-state=ready]');
    await page.keyboard.press('Escape'); await page.waitForSelector('dialog[data-cmdb-drill-through][open]', { hidden: true });
    assert(await page.$eval('.endpoint-name [data-cmdb-asset-id]', node => node === document.activeElement));
    const query = new URL(page.url()).searchParams;
    for (const [key, value] of new URLSearchParams(selection.scope)) assert.equal(query.get(key), value);
    assert.equal(query.get('dataDate'), selection.snapshot);
  }
  await visit();
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'discovery-compliance-desktop.png') });
  await page.setViewport({ width: 390, height: 844 });
  const sidebarOpen = await page.$eval('.sidebar-toggle', node => node.getAttribute('aria-expanded') === 'true');
  if (sidebarOpen) await page.click('.sidebar-toggle');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 56);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'discovery-compliance-phone.png') });
  await page.$eval('.endpoint-results', node => node.scrollIntoView());
  assert(await page.$eval('.endpoint-table-scroll', node => node.clientHeight <= 34 * 16 + 1), 'Phone table uses reference height cap');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'discovery-compliance-table-phone.png') });
  await page.setViewport({ width: 1600, height: 1000 });
  if (sidebarOpen) await page.click('.sidebar-toggle');
  await visit('compliance', 'network=net-1&securityDomain=NONE');
  assert.equal(await page.$$eval('.endpoint-chart-empty', nodes => nodes.length), 4);
  assert.equal(await page.$eval('.endpoint-export', node => node.disabled), true);
  assert(await page.$('.endpoint-empty'));
  await page.goto(base + '/discovery-coverage?discoveryView=compliance', { waitUntil: 'networkidle0' });
  assert.equal(await page.$('.discovery-compliance-page'), null);
  await visit();
  console.log('Discovery Compliance Explorer passed: shared software styling, four chart/table filters, keyboard facets and search, CMDB focus return, Excel download, scoped history, empty states and phone layout.');
}
