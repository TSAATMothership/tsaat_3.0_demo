import assert from "node:assert/strict";
import path from "node:path";

/** Runs against a Service Impact page in either provider build. */
export async function checkServiceImpactGraph(page, { date, artifacts } = {}) {
  const popup = "dialog.service-impact-graph-popup[open]", trigger = "[data-explore-service-impact]";
  const focusToggle = '[data-impact-focus]';
  const checkFocusCorner = async () => assert(await page.$eval(focusToggle, node => {
    const button = node.getBoundingClientRect(), canvas = node.closest('.impact-graph-canvas').getBoundingClientRect();
    return button.top >= canvas.top && button.top - canvas.top <= 24 && button.right <= canvas.right && canvas.right - button.right <= 24;
  }), 'Focus connections stays at the top-right of the graph workspace');
  const systemSearch = 'input[aria-label="Search ict systems table"]';
  const bounds = selector => page.$eval(selector, node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  const press = async selector => { await page.$eval(selector, node => node.focus()); await page.keyboard.press("Enter"); };
  const open = async () => {
    await press(trigger); await page.waitForSelector(popup); await checkDefaultRiskFilters(page);
    await checkMinimisedDefaults(page);
    await press('[data-impact-toggle-controls]');
  };
  const close = async () => {
    await page.keyboard.press("Escape"); await page.waitForSelector(popup, { hidden: true });
    await page.waitForFunction(selector => document.querySelector(selector) === document.activeElement, {}, trigger);
    assert.equal(await page.$eval(trigger, node => node === document.activeElement), true, "Focus returns to Explore selection");
  };
  const search = async (selector, value) => { await page.focus(selector); await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); if (value) await page.type(selector, value); };
  await page.waitForSelector("dialog.loading-modal[open]", { hidden: true });
  assert.equal(await page.$('#service-impact-view-tab-analysis'), null);
  assert.equal(await page.$$eval('[role="tab"]', nodes => nodes.some(node => node.textContent === "Explore the Impact")), false);
  await press(".workspace-header-menu summary"); await press('.workspace-header-menu nav button');
  await page.waitForSelector("dialog.settings-popup[open]");
  const settingsBounds = await bounds("dialog.settings-popup[open]");
  await press('[aria-label="Close settings"]');
  await page.waitForSelector('dialog.settings-popup[open]', { hidden: true });
  await page.waitForFunction(() => document.querySelector('.workspace-header-menu summary') === document.activeElement);

  const systemNames = await page.$$eval('.service-impact-system-check', nodes => nodes.map(node => node.textContent.trim()));
  assert(systemNames.length > 0, "Fixture must contain systems with impact");
  await open();
  await checkFocusCorner();
  assert.deepEqual(await bounds(popup), settingsBounds, "Graph has the same dimensions as Settings");
  await checkGraphViewToggles(page, { artifacts, settingsBounds });
  assert.equal(await page.$$eval('[data-impact-kind="system"]', nodes => nodes.length), systemNames.length);
  if (date) assert((await page.$eval('.impact-graph-header', node => node.textContent)).includes(date));
  const totals = await page.$eval('.impact-graph-summary', node => node.textContent);
  const expandAll = '.impact-graph-filter-group [data-impact-expand-all]';
  assert(await page.$(expandAll), 'Expand all affected CIs belongs to Filters');
  const initiallyExpanded = await page.$eval(expandAll, node => node.getAttribute('aria-pressed') === 'true');
  if (initiallyExpanded) await press(expandAll);
  assert.equal(await page.$$eval('[data-impact-kind="asset"]', nodes => nodes.length), 0);
  await press(expandAll);
  assert.equal(await page.$eval(expandAll, node => node.getAttribute('aria-pressed')), 'true');
  assert(await page.$$eval('[data-impact-kind="asset"]', nodes => nodes.length > 0), 'Expand all reveals affected devices');
  const matchingNodes = await page.$eval('.impact-graph-filter-context', node => Number(node.textContent.split(' / ')[0].replaceAll(',', '')));
  assert.equal(await page.$$eval('[data-impact-node]', nodes => nodes.length), Math.min(140, matchingNodes), 'All matching nodes are expanded within the scene limit');
  assert.equal(await page.$eval('.impact-graph-status', node => node.textContent.includes('Select a system to expand')), false);
  assert.equal(await page.$eval('.impact-graph-summary', node => node.textContent), totals, 'Expansion does not change filtered totals');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-expanded.png') });
  await press(expandAll);
  assert.equal(await page.$eval(expandAll, node => node.getAttribute('aria-pressed')), 'false');
  assert.equal(await page.$$eval('[data-impact-kind="asset"]', nodes => nodes.length), 0, 'Second press collapses affected devices');
  if (initiallyExpanded) await press(expandAll);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "impact-graph-desktop.png") });
  const firstNode = '[data-impact-kind="system"]';
  await page.click(firstNode);
  await page.waitForSelector('.impact-graph-node-detail');
  assert.equal(await page.$eval(firstNode, node => node.getAttribute('aria-pressed')), 'true', "Pointer selects a graph node");
  const beforeExpansion = await page.$$eval('[data-impact-kind="asset"]', nodes => nodes.length);
  await press('.impact-graph-node-detail > button:nth-of-type(2)');
  assert.notEqual(await page.$$eval('[data-impact-kind="asset"]', nodes => nodes.length), beforeExpansion, "System expansion changes the device scene");
  await press('.impact-graph-node-detail > button:nth-of-type(2)');
  assert.equal(await page.$$eval('[data-impact-kind="asset"]', nodes => nodes.length), beforeExpansion);
  const transform = await page.$eval(firstNode, node => node.getAttribute('transform'));
  const disc = await page.$eval(firstNode + ' .impact-graph-disc', node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(disc.x, disc.y); await page.mouse.down(); await page.mouse.move(disc.x + 35, disc.y + 25, { steps: 5 }); await page.mouse.up();
  assert.notEqual(await page.$eval(firstNode, node => node.getAttribute('transform')), transform, "Nodes can be repositioned");
  const svgSelector = 'svg[aria-label="Service impact relationship graph"]';
  const originalView = await page.$eval(svgSelector, node => node.getAttribute('viewBox'));
  const canvas = await bounds(svgSelector);
  await page.mouse.move(canvas[0] + 10, canvas[1] + 10); await page.mouse.down(); await page.mouse.move(canvas[0] + 60, canvas[1] + 40, { steps: 5 }); await page.mouse.up();
  assert.notEqual(await page.$eval(svgSelector, node => node.getAttribute('viewBox')), originalView, "Background drag pans the graph");
  await press('[aria-label="Zoom in"]');
  const readCamera = () => page.evaluate(() => ({
    zoom: document.querySelector('.impact-graph-toolbar [aria-live]').textContent,
    viewBox: document.querySelector('svg[aria-label="Service impact relationship graph"]').getAttribute('viewBox')
  }));
  const selectionCamera = await readCamera();
  assert.equal(selectionCamera.zoom, '125%');
  const selectedBeforeResize = await page.$eval('[data-impact-node][aria-pressed="true"]', node => node.dataset.impactNode);
  await press('[data-impact-toggle-controls]'); await press('[data-impact-fullscreen]');
  assert.deepEqual(await readCamera(), selectionCamera, 'Full screen and minimised controls preserve zoom and pan');
  assert.equal(await page.$eval('[data-impact-node][aria-pressed="true"]', node => node.dataset.impactNode), selectedBeforeResize);
  await press('[data-impact-toggle-controls]');
  await page.keyboard.press('Escape');
  assert(await page.$(popup), 'Escape exits full screen before closing the graph');
  assert.equal(await page.$eval('[data-impact-fullscreen]', node => node === document.activeElement), true);
  assert.deepEqual(await readCamera(), selectionCamera, 'Restoring the dialog preserves zoom and pan');
  const checkSelectionCamera = async source => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await readCamera(), selectionCamera, source + ' preserves zoom and pan');
  };
  const pointerTarget = await page.$$eval('[data-impact-node]:not([aria-pressed="true"])', nodes => nodes.map(node => {
    const rect = node.querySelector('.impact-graph-disc').getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    return document.elementFromPoint(x, y)?.closest('[data-impact-node]') === node ? { id: node.dataset.impactNode, x, y } : null;
  }).find(Boolean));
  assert(pointerTarget, 'A node is visible in the zoomed and panned scene');
  await page.mouse.click(pointerTarget.x, pointerTarget.y);
  assert.equal(await page.$eval('[data-impact-node][aria-pressed="true"]', node => node.dataset.impactNode), pointerTarget.id, 'Pointer selects the visible node');
  await checkSelectionCamera('Pointer node selection');
  await press(firstNode);
  await checkSelectionCamera('Keyboard node selection');
  await page.$eval('[data-impact-kind="system"]:not([aria-pressed="true"])', node => node.focus()); await page.keyboard.press('Space');
  await checkSelectionCamera('Space node selection');
  await press('.impact-graph-connections button');
  await checkSelectionCamera('Connected node selection');
  await search('.impact-graph-search input', systemNames[0]);
  await press('.impact-graph-search-results li button');
  await checkSelectionCamera('Search result selection');
  await search('.impact-graph-search input', '');
  await press('.impact-graph-toolbar > div button:last-child');
  assert.equal(await page.$eval('.impact-graph-toolbar [aria-live]', node => node.textContent), '100%', 'Fit graph explicitly resets zoom');
  await press(focusToggle);
  assert.equal(await page.$eval('.impact-graph-summary', node => node.textContent), totals, "Connection focus preserves analysis totals");
  assert.equal(await page.$eval(focusToggle, node => node.getAttribute('aria-pressed')), 'true');
  await press(expandAll);
  assert.equal(await page.$eval(focusToggle, node => node.getAttribute('aria-pressed')), 'false', 'Bulk expansion leaves connection focus');
  if (await page.$eval(expandAll, node => node.getAttribute('aria-pressed') === 'true')) await press(expandAll);
  await press('[aria-label="Zoom in"]');
  assert.equal(await page.$eval('.impact-graph-toolbar [aria-live]', node => node.textContent), "125%");
  await page.$eval('svg[aria-label="Service impact relationship graph"]', node => node.focus()); await page.keyboard.press('0');
  assert.equal(await page.$eval('.impact-graph-toolbar [aria-live]', node => node.textContent), "100%");
  await press('[data-impact-kind="system"]');
  await press('.impact-graph-node-detail > button');
  await page.waitForSelector('dialog.service-impact-findings[open]');
  await checkNestedCmdb(page, { artifacts });
  await page.keyboard.press('Escape'); await page.waitForSelector('dialog.service-impact-findings[open]', { hidden: true });
  assert(await page.$(popup), "Closing nested findings keeps the graph open");
  assert.equal(await page.$eval('.impact-graph-node-detail > button', node => node === document.activeElement), true);
  await search('.impact-graph-search input', 'definitely-no-matching-node');
  await page.waitForFunction(() => document.querySelector('.impact-graph-search-results')?.textContent.includes('0 matching nodes'));
  await search('.impact-graph-search input', systemNames[0]);
  await page.waitForSelector('.impact-graph-search-results li button');
  await press('.impact-graph-search-results li button');
  assert((await page.$eval('.impact-graph-node-detail h3', node => node.textContent)).includes(systemNames[0]));
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "impact-graph-focused.png") });
  await close();

  await page.focus('.service-impact-system-check input'); await page.keyboard.press('Space');
  await open();
  assert.equal(await page.$$eval('[data-impact-kind="system"]', nodes => nodes.length), 1, "Only checked systems appear");
  assert((await page.$eval('[data-impact-kind="system"]', node => node.getAttribute('aria-label'))).includes(systemNames[0]));
  await close();
  assert.equal(await page.$eval('.service-impact-system-check input', node => node.checked), true, "Checkbox selection survives closing");
  await page.focus('.service-impact-system-check input'); await page.keyboard.press('Space');
  await search(systemSearch, systemNames[0]);
  await page.waitForFunction(() => document.querySelectorAll('.service-impact-system-check').length === 1);
  await open();
  assert.equal(await page.$$eval('[data-impact-kind="system"]', nodes => nodes.length), 1, "Search controls graph scope");
  await close();
  await search(systemSearch, 'definitely-no-matching-system');
  await page.waitForFunction(() => document.querySelectorAll('.service-impact-system-check').length === 0);
  await open();
  assert.equal(await page.$('[data-impact-node]'), null, "Empty scope never broadens");
  assert((await page.$eval(popup, node => node.textContent)).includes('No ICT systems in this selection'));
  await close();
  await search(systemSearch, '');
  await page.waitForFunction(() => document.querySelectorAll('.service-impact-system-check').length > 0);

  await press('.service-impact-entity-table tbody .service-impact-link');
  const serviceSystems = await page.$$eval('.service-impact-system-check', nodes => nodes.map(node => node.textContent.trim()));
  await open();
  assert.equal(await page.$$eval('[data-impact-kind="system"]', nodes => nodes.length), serviceSystems.length, "Service selection narrows the graph");
  await close();
  await press('.service-impact-entity-table tbody .service-impact-link[aria-pressed="true"]');
  await press('#service-impact-scope-tab-mission');
  await search('input[aria-label="Search mission capabilities table"]', 'definitely-no-matching-capability');
  await page.waitForFunction(() => document.querySelectorAll('.service-impact-system-check').length === 0);
  await open();
  assert.equal(await page.$('[data-impact-node]'), null, "Capability table filters apply to the graph");
  await close();
  await press('#service-impact-scope-tab-business');
  await page.waitForFunction(() => document.querySelectorAll('.service-impact-system-check').length > 0);

  await page.setViewport({ width: 390, height: 844 });
  await open();
  await press('[data-impact-toggle-controls]');
  const narrowBounds = await bounds(popup);
  await checkFocusCorner();
  assert.equal(narrowBounds[0], 16); assert.equal(narrowBounds[2], 358);
  assert.equal(await page.$eval(popup, node => node.scrollWidth <= node.clientWidth), true, "No horizontal modal overflow");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.$eval(popup, node => node.contains(document.activeElement)), true, "Keyboard focus stays inside the modal");
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.impact-graph-controls'))), false, 'Minimised controls are not keyboard-focusable');
  }
  await press('[data-impact-fullscreen]');
  assert.deepEqual(await bounds(popup), [0, 0, 390, 844], 'Full screen fills the narrow viewport');
  assert.equal(await page.$eval(popup, node => node.scrollWidth <= node.clientWidth), true);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-narrow-fullscreen.png') });
  await page.keyboard.press('Escape');
  assert(await page.$(popup));
  assert.deepEqual(await bounds(popup), narrowBounds);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "impact-graph-narrow.png") });
  await close();
  await page.setViewport({ width: 1600, height: 1000 });
  await checkGraphFiltersAndLayouts(page, { artifacts });
}

async function checkMinimisedDefaults(page) {
  assert.equal(await page.$eval('[data-impact-toggle-controls]', node => node.getAttribute('aria-expanded')), 'false', 'Filters and layout start minimised on every open');
  assert.equal(await page.$eval('.impact-graph-controls', node => getComputedStyle(node).display), 'none');
  assert.equal(await page.$eval('[data-impact-fullscreen]', node => node.getAttribute('aria-pressed')), 'false', 'Graph opens at its standard dialog size');
}

async function checkGraphViewToggles(page, { artifacts, settingsBounds }) {
  const popup = 'dialog.service-impact-graph-popup[open]';
  const press = async selector => { await page.focus(selector); await page.keyboard.press('Enter'); };
  const bounds = selector => page.$eval(selector, node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  const state = () => page.evaluate(() => ({
    url: location.href,
    totals: document.querySelector('.impact-graph-summary').textContent,
    layout: document.querySelector('[aria-label="Impact graph layout"]').value,
    range: [...document.querySelectorAll('.impact-graph-range input')].map(input => input.value),
    severity: [...document.querySelectorAll('.impact-graph-severity-filter input:checked')].map(input => input.value),
    camera: document.querySelector('svg[aria-label="Service impact relationship graph"]').getAttribute('viewBox')
  }));
  const before = await state();
  const expandedHeight = (await bounds('.impact-graph-canvas'))[3];
  await press('[data-impact-toggle-controls]');
  assert.equal(await page.$eval('[data-impact-toggle-controls]', node => node.getAttribute('aria-expanded')), 'false');
  assert((await bounds('.impact-graph-canvas'))[3] > expandedHeight, 'Minimising the controls makes the chart taller');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-minimised.png') });
  await press('[data-impact-fullscreen]');
  assert.deepEqual(await bounds(popup), [0, 0, 1600, 1000]);
  assert.equal(await page.evaluate(() => document.documentElement.clientWidth), 1600, 'Full screen removes the reserved page scrollbar strip');
  assert.equal(await page.$eval('[data-impact-fullscreen]', node => node.getAttribute('aria-pressed')), 'true');
  assert.deepEqual(await state(), before, 'View toggles preserve filters, layout, camera, totals and URL scope');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-fullscreen.png') });
  await page.setViewport({ width: 1366, height: 768 });
  assert.deepEqual(await bounds(popup), [0, 0, 1366, 768]);
  const fullscreenHeight = (await bounds('.impact-graph-canvas'))[3];
  assert(await page.$eval('.impact-graph-canvas', node => { const r = node.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'Chart fits a short desktop viewport in full screen');
  await press('[data-impact-fullscreen]');
  assert(fullscreenHeight > (await bounds('.impact-graph-canvas'))[3], 'Full screen gives the chart more space on short desktop windows');
  await page.setViewport({ width: 1600, height: 1000 });
  assert.deepEqual(await bounds(popup), settingsBounds, 'Leaving full screen restores the original Settings-sized dialog');
  await press('[data-impact-toggle-controls]');
  assert.deepEqual(await state(), before);
}

async function checkNestedCmdb(page, { artifacts }) {
  const findings = 'dialog.service-impact-findings[open]', cmdb = 'dialog[data-cmdb-drill-through][open]';
  for (const [tab, width, height, title] of [['findings', 1600, 1000, 'open findings'], ['devices', 390, 844, 'affected cis']]) {
    await page.setViewport({ width, height });
    await page.click(findings + ' [role="tab"][id$="-tab-' + tab + '"]');
    const panel = findings + ' [role="tabpanel"]:not([hidden])';
    const device = panel + ' [data-cmdb-asset-id]';
    await page.waitForSelector(device);
    const name = await page.$eval(device, node => node.textContent.trim());
    const search = panel + ' input[aria-label="Search ' + title + ' table"]';
    await page.type(search, name);
    await page.waitForSelector(device);
    if (tab === 'findings') await page.$eval(panel + ' tbody details', node => { node.open = true; });
    await page.$eval(device, node => node.focus());
    const before = await page.$eval(panel, node => ({
      search: node.querySelector('input[type="search"]').value,
      scroll: node.querySelector('.endpoint-table-scroll').scrollTop,
      expanded: [...node.querySelectorAll('tbody details')].filter(detail => detail.open).length
    }));
    const assetId = await page.$eval(device, node => node.dataset.cmdbAssetId);
    await page.keyboard.press('Enter');
    await page.waitForSelector(cmdb + '[data-load-state="ready"]');
    await page.waitForFunction(selector => Math.abs(document.querySelector(selector)?.getBoundingClientRect().left ?? -1) < .5, {}, cmdb);
    assert(await page.$(findings), 'CMDB opening keeps the findings panel mounted and open');
    assert(await page.$('dialog.service-impact-graph-popup[open]'), 'CMDB keeps the graph open beneath findings');
    const bounds = await page.$eval(cmdb, node => ({
      width: node.getBoundingClientRect().width,
      expected: Math.min(56 * parseFloat(getComputedStyle(document.documentElement).fontSize), innerWidth * .96) * .8,
      fits: node.scrollWidth <= node.clientWidth
    }));
    assert(Math.abs(bounds.width - bounds.expected) < 1, 'CMDB is 20% narrower at desktop and phone widths');
    assert(bounds.fits, 'CMDB content does not overflow its narrower panel');
    for (let index = 0; index < 6; index++) {
      await page.keyboard.press('Tab');
      assert(await page.$eval(cmdb, node => node.contains(document.activeElement)), 'Keyboard focus stays in the top CMDB dialog');
    }
    if (artifacts) await page.screenshot({ path: path.join(artifacts, 'cmdb-left-' + width + '.png') });
    await page.keyboard.press('Escape');
    await page.waitForSelector(cmdb, { hidden: true });
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-cmdb-asset-id') === id, {}, assetId);
    assert(await page.$(findings), 'Escape closes only CMDB and leaves findings open');
    assert.equal(await page.$eval(findings + ' [role="tab"][aria-selected="true"]', (node, value) => node.id.endsWith('-tab-' + value), tab), true);
    assert.deepEqual(await page.$eval(panel, node => ({
      search: node.querySelector('input[type="search"]').value,
      scroll: node.querySelector('.endpoint-table-scroll').scrollTop,
      expanded: [...node.querySelectorAll('tbody details')].filter(detail => detail.open).length
    })), before, 'Findings retain search, scroll and expanded evidence after closing CMDB');
    await page.focus(search); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace');
  }
  await page.setViewport({ width: 1600, height: 1000 });
}

async function checkGraphFiltersAndLayouts(page, { artifacts }) {
  const popup = 'dialog.service-impact-graph-popup[open]', layout = '[aria-label="Impact graph layout"]';
  const press = async selector => { await page.$eval(selector, node => node.focus()); await page.keyboard.press('Enter'); };
  const settle = () => page.waitForFunction(() => document.querySelector('.service-impact-graph-popup')?.dataset.impactAnimating === 'false');
  const numeric = async (selector, value) => {
    await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
    await page.keyboard.press('Backspace'); await page.type(selector, String(value));
  };
  const reset = () => press('[data-impact-reset-filters]');
  const chooseCritical = async () => {
    await press('.impact-graph-severity-filter summary');
    await press('.impact-graph-severity-actions button:last-child');
    assert.equal(await page.$('[data-impact-node]'), null, 'No selected severities stays empty');
    assert(await page.$eval('[data-impact-expand-all]', node => node.disabled), 'No matching CIs disables bulk expansion');
    assert((await page.$eval(popup, node => node.textContent)).includes('No nodes match these risk filters'));
    await page.click('.impact-graph-severity-filter input[value="Critical Exposure"]');
    await page.keyboard.press('Escape');
    assert(await page.$(popup), 'Escape closes the severity menu before the graph');
    assert.equal(await page.$eval('.impact-graph-severity-filter', node => node.open), false);
  };
  await press('[data-explore-service-impact]'); await page.waitForSelector(popup);
  await checkDefaultRiskFilters(page);
  await checkMinimisedDefaults(page); await press('[data-impact-toggle-controls]');
  await press('.impact-graph-severity-filter summary');
  await press('.impact-graph-severity-actions button:first-child');
  assert(await page.$$eval('.impact-graph-severity-filter input', nodes => nodes.length > 2 && nodes.every(node => node.checked)), 'All severity categories remain selectable');
  await page.waitForFunction(() => document.querySelector('[aria-label="Minimum matching findings"]')?.value === '0');
  assert.equal(await page.$eval('[aria-label="Minimum matching findings"]', node => node.value), '0');
  await page.keyboard.press('Escape');
  await reset();
  await checkDefaultRiskFilters(page);
  assert(await page.$('.impact-graph-filter-group .impact-graph-severity-filter'));
  assert(await page.$('.impact-graph-filter-group .impact-graph-range'));
  assert(await page.$('.impact-graph-layout-group [aria-label="Impact graph layout"]'));
  assert(await page.$('.impact-graph-layout-group [aria-label="Graph navigation"]'));
  assert.equal(await page.$eval(layout, node => node.value), 'hierarchical');
  assert.equal(await page.$eval('[aria-label="Hierarchy direction"]', node => node.value), 'top-down');
  const initialCounts = await page.$eval('.impact-graph-summary', node => node.textContent);
  const baseline = await page.$$eval('[data-impact-node]', nodes => nodes.map(node => {
    const [, total, critical, high] = node.getAttribute('aria-label').match(/(\d+) matching findings, (\d+) critical, (\d+) high/);
    return { id: node.dataset.impactNode, total: Number(total), critical: Number(critical), high: Number(high) };
  }));
  const assertExactBadges = async () => assert(await page.$$eval('[data-impact-node]', nodes => nodes.every(node =>
    node.querySelector('.impact-graph-count').textContent === Number(node.dataset.impactFindings).toLocaleString('en-AU'))), 'Badges show exact selected-severity counts, including counts above 99');
  await assertExactBadges();
  await chooseCritical();
  const criticalTotals = await page.$eval('.impact-graph-summary', node => node.textContent);
  const criticalRange = await page.$$eval('.impact-graph-range input', nodes => nodes.map(node => node.value));
  const criticalInitiallyExpanded = await page.$eval('[data-impact-expand-all]', node => node.getAttribute('aria-pressed') === 'true');
  if (criticalInitiallyExpanded) await press('[data-impact-expand-all]');
  await press('[data-impact-expand-all]');
  assert.equal(await page.$eval('.impact-graph-summary', node => node.textContent), criticalTotals);
  assert.deepEqual(await page.$$eval('.impact-graph-range input', nodes => nodes.map(node => node.value)), criticalRange);
  assert(await page.$$eval('[data-impact-kind="asset"]', nodes => nodes.length > 0 && nodes.every(node => {
    const [, total, critical, high] = node.getAttribute('aria-label').match(/(\d+) matching findings, (\d+) critical, (\d+) high/);
    return total === critical && high === '0';
  })), 'Bulk expansion respects selected risk severity');
  await press('[data-impact-expand-all]');
  if (criticalInitiallyExpanded) await press('[data-impact-expand-all]');
  assert((await page.$eval('.impact-graph-range-context', node => node.textContent)).includes('Critical Exposure'));
  assert.equal(await page.$eval('[aria-label="Minimum matching findings"]', node => node.value), '1');
  assert(await page.$$eval('[data-impact-node]', nodes => nodes.length > 0 && nodes.every(node => {
    const [, total, critical, high] = node.getAttribute('aria-label').match(/(\d+) matching findings, (\d+) critical, (\d+) high/);
    return total === critical && Number(high) === 0;
  })), 'Badges and risk details use selected severity findings');
  await assertExactBadges();
  assert(await page.evaluate(rows => [...document.querySelectorAll('[data-impact-node]')].every(node => {
    const original = rows.find(row => row.id === node.dataset.impactNode);
    return !original || Number(node.dataset.impactFindings) === original.critical;
  }), baseline), 'Critical counts align with the same nodes before filtering');
  await press('[data-impact-node]');
  const selectedCount = await page.$eval('[data-impact-node][aria-pressed="true"]', node => Number(node.dataset.impactFindings).toLocaleString('en-AU'));
  assert.equal(await page.$eval('[data-impact-selected-findings]', node => node.textContent), selectedCount);
  assert.deepEqual(await page.$$eval('.impact-graph-severity-breakdown dt', nodes => nodes.map(node => node.textContent)), ['Critical Exposure']);
  const criticalMaximum = await page.$eval('[aria-label="Maximum matching findings"]', node => Number(node.value));
  assert.equal(criticalMaximum, Math.max(...baseline.map(row => row.critical)), 'Range maximum follows selected-severity node counts');
  await press('.impact-graph-severity-filter summary');
  await page.click('.impact-graph-severity-filter input[value="High Risk"]');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(rows => [...document.querySelectorAll('[data-impact-node]')].every(node => {
    const original = rows.find(row => row.id === node.dataset.impactNode);
    return !original || Number(node.dataset.impactFindings) === original.critical + original.high;
  }), baseline), 'Multiple severities combine their findings per node');
  await assertExactBadges();
  await chooseCritical();
  // Enriched/imported stores need not contain a node with exactly two critical findings.
  const exactCount = await page.$$eval('[data-impact-node]', nodes => Math.min(...nodes.map(node => Number(node.dataset.impactFindings))));
  await numeric('[aria-label="Maximum matching findings"]', exactCount);
  await numeric('[aria-label="Minimum matching findings"]', exactCount);
  const rangeState = await page.evaluate(() => ({
    minimum: document.querySelector('[aria-label="Minimum matching findings"]').value,
    maximum: document.querySelector('[aria-label="Maximum matching findings"]').value,
    summary: document.querySelector('.impact-graph-summary').textContent,
    counts: [...document.querySelectorAll('[data-impact-node]')].map(node => node.dataset.impactFindings)
  }));
  assert.equal(rangeState.minimum, String(exactCount));
  assert.equal(rangeState.maximum, String(exactCount));
  assert(rangeState.counts.length > 0 && rangeState.counts.every(count => count === String(exactCount)), 'Both range endpoints are inclusive: ' + JSON.stringify(rangeState));
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-risk-filter.png') });
  await press('.impact-graph-summary button'); await page.waitForSelector('dialog.service-impact-findings[open]');
  const severityCells = await page.$$eval('dialog.service-impact-findings[open] .service-impact-severity', cells => cells.map(cell => cell.textContent.trim()));
  assert(severityCells.length > 0 && severityCells.every(value => value === 'Critical Exposure'), 'Finding drill-through follows severity filtering');
  await page.keyboard.press('Escape'); await page.waitForSelector('dialog.service-impact-findings[open]', { hidden: true });
  await reset();
  assert.equal(await page.$eval('.impact-graph-summary', node => node.textContent), initialCounts);
  await checkDefaultRiskFilters(page);

  const nodeSelector = '[data-impact-kind="system"]';
  await page.select(layout, 'force'); await settle();
  const before = await page.$eval(nodeSelector, node => node.getAttribute('transform'));
  await page.select(layout, 'hierarchical');
  await page.waitForFunction(previous => document.querySelector('.service-impact-graph-popup')?.dataset.impactAnimating === 'true'
    && document.querySelector('[data-impact-kind="system"]')?.getAttribute('transform') !== previous, { polling: 'raf' }, before);
  const during = await page.$eval(nodeSelector, node => node.getAttribute('transform'));
  await settle();
  const after = await page.$eval(nodeSelector, node => node.getAttribute('transform'));
  assert.notEqual(before, after); assert.notEqual(during, after, 'Nodes tween through intermediate positions');
  for (const direction of ['top-down', 'bottom-up', 'right-left', 'left-right']) { await page.select('[aria-label="Hierarchy direction"]', direction); await settle(); }
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-hierarchical.png') });
  await page.select(layout, 'circular'); await settle();
  await page.select('[aria-label="Circular arrangement"]', 'radial'); await settle();
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-radial.png') });
  await page.select(layout, 'force'); await page.select(layout, 'hierarchical'); await page.select(layout, 'spatial'); await settle();
  assert.equal(await page.$eval(layout, node => node.value), 'spatial', 'Rapid layout changes settle on the final selection');
  assert(await page.$$eval('[data-impact-node]', nodes => nodes.every(node => !/NaN|Infinity/.test(node.getAttribute('transform')))));
  const spatialId = await page.$eval(nodeSelector, node => node.dataset.impactNode);
  await press(nodeSelector);
  const originalX = await page.$eval('[aria-label="Node X coordinate"]', node => Number(node.value));
  await numeric('[aria-label="Node X coordinate"]', originalX + 75);
  const transformFor = id => page.evaluate(value => [...document.querySelectorAll('[data-impact-node]')].find(node => node.dataset.impactNode === value)?.getAttribute('transform'), id);
  const edited = await transformFor(spatialId);
  assert(edited.startsWith('translate(' + (originalX + 75) + ','), 'Spatial layout uses the generated/editable X coordinate');
  await chooseCritical();
  assert.equal(await transformFor(spatialId), edited, 'Spatial positions stay stable through risk filtering');
  await reset();
  await page.select(layout, 'circular'); await settle(); await page.select(layout, 'spatial'); await settle();
  assert.equal(await transformFor(spatialId), edited, 'Spatial coordinates survive layout switching');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-spatial.png') });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.select(layout, 'force');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.$eval(popup, node => node.dataset.impactAnimating), 'false', 'Reduced motion skips tweening');
  await page.emulateMediaFeatures([]);
  await page.setViewport({ width: 390, height: 844 });
  await press('.impact-graph-severity-filter summary');
  assert.equal(await page.$eval(popup, node => node.scrollWidth <= node.clientWidth), true, 'Risk and layout controls fit narrow screens');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'impact-graph-filters-narrow.png') });
  await page.keyboard.press('Escape'); assert(await page.$(popup));
  await page.keyboard.press('Escape'); await page.waitForSelector(popup, { hidden: true });
  await page.setViewport({ width: 1600, height: 1000 });
  await page.waitForFunction(() => document.querySelector('[data-explore-service-impact]') === document.activeElement);
  assert.equal(await page.$eval('[data-explore-service-impact]', node => node === document.activeElement), true);
  const zeroCritical = await page.evaluate(() => [...document.querySelectorAll('.service-impact-system-table tbody tr')]
    .find(row => row.cells[3]?.textContent.trim() === '0')?.querySelector('input[type="checkbox"]')?.getAttribute('aria-label'));
  if (zeroCritical) {
    const zeroCriticalInput = await page.evaluateHandle(label => document.querySelector('.service-impact-system-table input[aria-label="' + CSS.escape(label) + '"]'), zeroCritical);
    await zeroCriticalInput.asElement().focus(); await page.keyboard.press('Space');
    await page.waitForFunction(label => document.querySelector('.service-impact-system-table input[aria-label="' + CSS.escape(label) + '"]')?.checked, {}, zeroCritical);
    await page.click('[data-explore-service-impact]'); await page.waitForSelector(popup);
    await checkMinimisedDefaults(page); await press('[data-impact-toggle-controls]');
    await chooseCritical();
    assert.equal(await page.$('[data-impact-node]'), null, 'A severity with no findings must not broaden to zero-count nodes');
    assert.equal(await page.$eval('[aria-label="Minimum matching findings"]', node => node.value), '1');
    await numeric('[aria-label="Minimum matching findings"]', 0);
    assert(await page.$('[data-impact-kind="system"]'), 'An explicit Min 0 can include zero-count nodes');
    await page.keyboard.press('Escape'); await page.waitForSelector(popup, { hidden: true });
    await page.evaluate(label => document.querySelector('.service-impact-system-table input[aria-label="' + CSS.escape(label) + '"]').click(), zeroCritical);
  }
}

async function checkDefaultRiskFilters(page) {
  await page.waitForFunction(() => document.querySelector('[aria-label="Minimum matching findings"]')?.value === '1');
  assert.deepEqual(await page.$$eval('.impact-graph-severity-filter input:checked', nodes => nodes.map(node => node.value).sort()),
    ['Critical Exposure', 'High Risk'], 'Opening and resetting the graph selects critical exposure and high risk');
  assert.equal(await page.$eval('[aria-label="Minimum matching findings"]', node => node.value), '1');
  assert(await page.$$eval('[data-impact-node]', nodes => nodes.every(node => {
    const [, total, critical, high] = node.getAttribute('aria-label').match(/(\d+) matching findings, (\d+) critical, (\d+) high/);
    return Number(total) > 0 && Number(total) === Number(critical) + Number(high);
  })), 'Default node counts include only critical and high findings');
}
