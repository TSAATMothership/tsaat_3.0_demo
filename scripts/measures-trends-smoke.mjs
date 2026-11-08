import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

/** Layout and real keyboard scrolling must stay inside the available desktop workspace. */
export async function checkMeasuresTrendsViewport(page, { date, artifacts }) {
  const base = new URL(page.url()).origin;
  const fit = async (coreVisible = true) => {
    const state = await page.evaluate(() => {
      const workspace = document.querySelector('.workspace-content'), article = document.querySelector('.measures-trends');
      const picker = document.querySelector('.measure-trend-picker'), detail = document.querySelector('.measure-trend-detail');
      const bounds = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
      return { width: innerWidth, height: innerHeight, workspace: bounds(workspace), article: bounds(article), picker: bounds(picker), detail: bounds(detail),
        outsideScroll: workspace.scrollHeight - workspace.clientHeight, clippedArticle: article.scrollHeight - article.clientHeight,
        detailScroll: detail.scrollHeight - detail.clientHeight, horizontal: document.documentElement.scrollWidth - innerWidth,
        chartHeight: document.querySelector('.measure-trend-chart').getBoundingClientRect().height,
        supportBottom: document.querySelector('.measure-trend-support').getBoundingClientRect().bottom };
    });
    const context = JSON.stringify(state);
    assert(state.outsideScroll <= 2 && state.clippedArticle <= 2 && state.horizontal <= 2, 'Workspace fits without outer scrolling/clipping: ' + context);
    assert(Math.abs(state.picker.top - state.detail.top) <= 2 && Math.abs(state.picker.bottom - state.detail.bottom) <= 2, 'Panels align: ' + context);
    assert(state.article.bottom <= state.workspace.bottom && state.chartHeight >= 110, 'Usable chart within workspace: ' + context);
    if (coreVisible) assert(state.detailScroll <= 2 && state.supportBottom <= state.detail.bottom, 'Default trend controls fit without detail scrolling: ' + context);
    return state;
  };
  for (const [width, height] of [[1920,1080], [1600,900], [1366,768], [1280,720], [1024,768]]) {
    await page.setViewport({ width, height });
    await page.goto(`${base}/measures/trends?network=net-1&dataDate=${date}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    for (const tab of ['kpi', 'spi']) {
      await page.click(`#measure-trends-tab-${tab}`);
      await page.waitForFunction(value => document.querySelector('.measures-trends')?.dataset.measureTab === value, {}, tab);
      await fit();
    }
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `measures-trends-fit-${width}.png`) });
  }
  await page.setViewport({ width: 1280, height: 720 });
  const identifiers = await page.$$eval('.measure-trend-option', nodes => nodes.map(node => node.getAttribute('aria-label')));
  for (const label of identifiers) {
    const selector = `.measure-trend-option[aria-label=${JSON.stringify(label)}]`;
    await page.focus(selector); await page.keyboard.press('Enter');
    await page.waitForFunction(value => document.querySelector('.measure-trend-option[aria-pressed=true]')?.getAttribute('aria-label') === value, {}, label);
    await fit();
  }
  assert(await page.$eval('.measure-trend-options', node => node.scrollTop > 0), 'Keyboard reaches the last indicator using internal list scrolling');
  await page.focus('.measure-trend-definition summary'); await page.keyboard.press('Enter');
  assert(await page.$eval('.measure-trend-definition', node => node.open));
  await page.focus('.measure-trend-detail'); await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('.measure-trend-detail').scrollTop > 0);
  await fit(false);
  assert(await page.$eval('.workspace-content', node => node.scrollTop === 0), 'Expanded guidance does not scroll the workspace');
  await page.focus('.measure-trend-definition summary'); await page.keyboard.press('Enter');
  await page.focus('.measure-trend-evidence summary'); await page.keyboard.press('Enter');
  await page.focus('.measure-trend-detail'); await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('.measure-trend-detail').scrollTop > 0);
  assert(await page.$('.measure-trend-evidence tbody tr'), 'Expanded evidence remains reachable');
  await fit(false);
  assert(await page.$eval('.workspace-content', node => node.scrollTop === 0), 'Expanded evidence does not scroll the workspace');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'measures-trends-expanded-evidence.png') });
  console.log('Measures Trends viewport checks passed: 1920/1600/1366/1280/1024 widths, both tabs, all SPIs, visible core controls, internal list/detail keyboard scrolling.');
}

/** Shared acceptance checks against either compiled provider's disposable sample store. */
export async function checkMeasuresTrends(page, { date, historicalDate, snapshotDates, directory, artifacts, provider = 'json' }) {
  const base = new URL(page.url()).origin;
  const visit = async (query = 'network=net-1', cutoff = date) => {
    await page.goto(`${base}/measures/trends?${query}&dataDate=${cutoff}`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForSelector('.measures-trends'); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  };
  const choosePeriod = async value => {
    await page.click(`.measure-trends-period label:has(input[value="${value}"]) span`);
    await page.waitForFunction(expected => document.querySelector('.measures-trends')?.dataset.measureHistory === expected, {}, value);
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  };
  const chooseTab = async tab => {
    await page.click(`#measure-trends-tab-${tab}`);
    await page.waitForFunction(expected => document.querySelector('.measures-trends')?.dataset.measureTab === expected, {}, tab);
  };
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  await checkMeasuresTrendsViewport(page, { date, artifacts });
  await page.setViewport({ width: 1600, height: 1000 }); await visit();
  assert.equal(await page.$eval('.workspace-navigation [aria-current=page]', node => node.textContent.trim()), 'Measures Trends');
  assert.equal(await page.$eval('.measures-trends', node => node.dataset.measureHistory), '4weeks');
  assert.deepEqual(await page.$$eval('.measure-trends-period label span', nodes => nodes.map(node => node.textContent)), ['1 week', '4 weeks', '3 months', '6 months', '12 months']);
  await page.focus('.measure-trends-period input[value="4weeks"]'); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.measures-trends')?.dataset.measureHistory === '3months');
  await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), '3months', 'Period navigation retains keyboard focus');
  const points = () => page.$$eval('[aria-label="Inspect measure snapshot"] option', nodes => nodes.map(node => node.value));
  for (const tab of ['kpi', 'spi']) {
    await chooseTab(tab);
    assert.equal(await page.$$('.measure-trend-option').then(nodes => nodes.length), tab === 'kpi' ? 2 : 10);
    for (const period of ['week', '4weeks', '3months', '6months', '12months']) {
      await choosePeriod(period);
      const state = await page.$eval('.measures-trends', node => ({ from: node.dataset.measureFrom, cutoff: node.dataset.measureCutoff }));
      assert.equal(state.cutoff, date);
      if (period === 'week' || period === '4weeks') assert.equal((Date.parse(date) - Date.parse(state.from)) / 86400000, period === 'week' ? 7 : 28);
      assert.deepEqual(await points(), snapshotDates.filter(value => value >= state.from && value <= date));
      assert.equal(new URL(page.url()).searchParams.get('network'), 'net-1');
      assert.equal(await page.$eval('.measures-trends', node => node.dataset.measureTab), tab);
    }
  }
  assert.match(await page.$eval('.measure-trends-coverage', node => node.textContent), /Earlier dates in this period have no snapshots/);
  await page.type('#measure-trend-search', 'no matching indicator');
  assert.equal(await page.$$('.measure-trend-option').then(nodes => nodes.length), 0);
  assert.match(await page.$eval('.measure-trend-options', node => node.textContent), /No indicators match/);
  await page.focus('#measure-trend-search'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.type('#measure-trend-search', 'SPI-3');
  assert.equal(await page.$$('.measure-trend-option').then(nodes => nodes.length), 1);
  await page.focus('.measure-trend-option'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.measure-trend-detail')?.dataset.measureId === 'SPI-3');
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  assert.equal(await page.$eval('.measure-trend-detail', node => node.dataset.measureId), 'SPI-3');
  assert.equal(await page.$eval('.measures-trends', node => node.dataset.measureHistory), '12months');
  await page.focus('#measure-trends-tab-spi'); await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => document.querySelector('#measure-trends-tab-kpi')?.getAttribute('aria-selected') === 'true');
  assert(await page.$eval('#measure-trends-tab-kpi', node => node === document.activeElement));
  await page.keyboard.press('End'); await page.waitForFunction(() => document.querySelector('#measure-trends-tab-spi')?.getAttribute('aria-selected') === 'true');
  const firstDate = (await points())[0]; await page.select('[aria-label="Inspect measure snapshot"]', firstDate);
  const href = await page.$eval('.measure-trend-inspector a', node => node.getAttribute('href'));
  assert.equal(new URL(href, base).searchParams.get('dataDate'), firstDate); assert.equal(new URL(href, base).searchParams.get('network'), 'net-1');
  await page.click('.measure-trend-evidence summary'); assert.equal(await page.$$('.measure-trend-evidence tbody tr').then(nodes => nodes.length), snapshotDates.length);
  if (directory) {
    fs.mkdirSync(directory, { recursive: true });
    const session = await page.browser().target().createCDPSession();
    await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
    const filename = path.join(directory, `measures-trends-spi-12months-${date}.csv`);
    await page.click('.measure-trends-coverage button');
    const deadline = Date.now() + 10000; while (!fs.existsSync(filename) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(filename));
    const rows = Papa.parse(fs.readFileSync(filename, 'utf8'), { header: true, skipEmptyLines: true }).data;
    assert.equal(rows.length, snapshotDates.length * 10); assert.deepEqual([...new Set(rows.map(row => row.Snapshot))], snapshotDates);
    assert(rows.every(row => row['Network IDs'] === 'net-1' && row.Period === '12 months'));
    await session.detach();
  }
  if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.$eval('.measures-trends', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, `measures-trends-${provider}-desktop.png`) }); }
  await visit('system=sys-1&measureTrendTab=spi&measureHistory=week', historicalDate);
  assert.equal((await points()).length, 1); assert.match(await page.$eval('.measure-trend-stats', node => node.textContent), /No comparison/);
  await visit('network=net-1&securityDomain=NONE');
  assert.equal(await page.$eval('.measure-trend-stats strong', node => node.textContent), 'N/A');
  await chooseTab('spi'); assert.equal(await page.$eval('.measure-trend-stats strong', node => node.textContent), 'N/A');
  await visit('network=net-1', '1900-01-01'); assert.match(await page.$eval('.measure-trend-empty', node => node.textContent), /No snapshots/);
  await visit('network=net-1&securityDomain=PROTECTED&measureTrendTab=spi');
  await page.setViewport({ width: 390, height: 844 });
  if (await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width < 50);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'No page-wide mobile overflow');
  await page.focus('#measure-trends-tab-spi'); await page.keyboard.press('Home');
  await page.waitForFunction(() => document.querySelector('.measures-trends')?.dataset.measureTab === 'kpi');
  await page.keyboard.press('End'); await page.waitForFunction(() => document.querySelector('.measures-trends')?.dataset.measureTab === 'spi');
  if (artifacts) {
    await page.$eval('.measures-trends', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, `measures-trends-${provider}-phone.png`) });
    await page.$eval('.measure-trend-detail', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, `measures-trends-${provider}-phone-detail.png`) });
  }
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844 });
    await page.focus('.measure-trend-definition summary'); await page.keyboard.press('Enter');
    assert(await page.$eval('.measure-trend-definition', node => node.open), 'Phone guidance expands with the keyboard');
    await page.focus('.measure-trend-evidence summary'); await page.keyboard.press('Enter');
    assert(await page.$eval('.measure-trend-evidence', node => node.open), 'Phone evidence expands with the keyboard');
    assert(await page.evaluate(() => {
      const workspace = document.querySelector('.workspace-content');
      return document.documentElement.scrollWidth <= innerWidth + 2 && workspace.scrollWidth <= workspace.clientWidth + 2;
    }), `No horizontal workspace overflow with expanded evidence at ${width}px`);
    await page.$eval('.measure-trend-evidence', node => node.scrollIntoView({ block: 'end' }));
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `measures-trends-phone-evidence-${width}.png`) });
    await page.focus('.measure-trend-definition summary'); await page.keyboard.press('Enter');
    await page.focus('.measure-trend-evidence summary'); await page.keyboard.press('Enter');
  }
  await page.goto(base + '/measures/trends', { waitUntil: 'networkidle0' }); assert.equal(await page.$('.measures-trends'), null);
  await page.setViewport({ width: 1600, height: 1000 });
  console.log('Measures Trends browser checks passed: both tabs, all five periods, actual history, selection/search/reload, keyboard, CSV, scoped/empty/single states and narrow layout.');
}
