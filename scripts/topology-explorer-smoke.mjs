import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkCmdbTopologyNavigation } from './cmdb-topology-smoke.mjs';
import { checkFilterPopupOpening } from './filter-popup-smoke.mjs';
import { checkModelCiCmdb } from './cmdb-model-ci-smoke.mjs';

/** Run against either compiled provider with the shared disposable sample evidence. */
export async function checkTopologyExplorer(page, { date, historicalDate, artifacts, provider = 'json' }) {
  const base = new URL(page.url()).origin;
  const sample = JSON.parse(fs.readFileSync(new URL('../data/current.json', import.meta.url), 'utf8'));
  const asset = sample.assets.find(row => row.networkId === 'net-1' && row.type === 'server' && row.systemContext && row.installedSoftware.length && row.vulnerabilities.length);
  assert(asset, 'Fixture must support all lookup fields.');
  const visit = async (query = 'network=net-1', snapshot = date) => {
    await page.goto(`${base}/discovery-coverage?discoveryView=topology&${query}&dataDate=${snapshot}`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForSelector('.topology-explorer'); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    assert.equal(await page.$eval('.topology-explorer', node => node.dataset.snapshot), snapshot);
  };
  const openFilter = async (label, search = '') => {
    await checkFilterPopupOpening(page, async () => {
      await page.focus(`.topology-filter-grid button[aria-label^="Filter ${label}"]`); await page.keyboard.press('Enter');
      await page.waitForSelector(`.endpoint-filter-popup[aria-label="Filter ${label}"]`);
    });
    const selector = `input[aria-label="Search ${label} values"]`;
    assert(await page.$eval(selector, node => node === document.activeElement), 'Filter search receives keyboard focus');
    if (search) await page.type(selector, search);
  };
  const closeFilter = async label => {
    await page.keyboard.press('Escape'); await page.waitForSelector('.endpoint-filter-popup', { hidden: true });
    assert(await page.$eval(`.topology-filter-grid button[aria-label^="Filter ${label}"]`, node => node === document.activeElement), 'Escape returns focus to its trigger');
  };
  const selectFilter = async (label, search) => {
    await openFilter(label, search);
    await page.click('.endpoint-filter-values input[type=checkbox]'); await closeFilter(label);
  };
  const choose = async id => {
    await page.click(`[data-topology-result="${id}"]`); await page.waitForSelector('.topology-canvas');
    assert.equal(new URL(page.url()).searchParams.get('topologyCi'), id);
  };
  await page.setViewport({ width: 1600, height: 1000 });
  // The shared control still uses recorded values directly for End Point Explorer.
  await page.goto(`${base}/discovery-coverage?discoveryView=endpoints&network=net-1&dataDate=${date}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.endpoint-table'); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  await page.focus('.endpoint-table th:first-child .endpoint-column-trigger'); await page.keyboard.press('Enter');
  await page.waitForSelector('.endpoint-filter-values label');
  const endpointCount = await page.$eval('.endpoint-filter-values label small', node => Number(node.textContent.replaceAll(',', '')));
  await page.click('.endpoint-filter-values input'); await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(',', ''))), endpointCount);
  await visit();
  if (await page.$('[aria-label="Show sidebar"]')) await page.click('[aria-label="Show sidebar"]');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width > 200);
  const nav = await page.$$eval('.workspace-sidebar a', nodes => nodes.map(node => node.textContent?.trim()));
  assert(nav.indexOf('Topology Explorer') > nav.indexOf('Shadow IT Explorer'));
  assert(await page.$$eval('[data-topology-result]', nodes => nodes.length) === 50, 'All results remain paginated.');
  const firstPage = await page.$eval('[data-topology-result]', node => node.dataset.topologyResult);
  await page.click('.topology-results footer button:last-child');
  assert.notEqual(await page.$eval('[data-topology-result]', node => node.dataset.topologyResult), firstPage);
  await openFilter('CI name or ID');
  const allCount = await page.$eval('.topology-results header span', node => Number(node.textContent.replace(/[^0-9]/g, '')));
  await page.$$eval('.endpoint-filter-actions button', nodes => nodes.find(node => node.textContent === 'Select matches').click());
  await closeFilter('CI name or ID');
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('.topology-results');
  assert.equal(await page.$eval('.topology-results header span', node => Number(node.textContent.replace(/[^0-9]/g, ''))), allCount, 'Select matches includes options beyond the first 150 and reloads without an oversized label URL');
  await page.click('[aria-label="Clear CI name or ID filter"]');
  await selectFilter('CI name or ID', asset.hostname);
  assert(await page.$(`[data-topology-result="asset:${asset.id}"]`));
  await openFilter('CI name or ID', 'nonexistent-ci-12345');
  assert.match(await page.$eval('.endpoint-filter-values', node => node.textContent), /No matching values/);
  assert(await page.$(`[data-topology-result="asset:${asset.id}"]`), 'Searching menu choices does not silently apply a filter');
  await closeFilter('CI name or ID');
  await page.click('[aria-label="Clear CI name or ID filter"]');
  await openFilter('CI type');
  for (const value of ['ICT System', 'Managed Network']) await page.$$eval('.endpoint-filter-values label', (nodes, value) => nodes.find(node => node.querySelector('span')?.textContent === value).querySelector('input').click(), value);
  assert(await page.$$eval('[data-topology-result]', nodes => nodes.every(node => /^(system|network):/.test(node.dataset.topologyResult))), 'Multiple CI types combine with OR');
  await closeFilter('CI type'); await page.click('[aria-label="Clear CI type filter"]');
  await selectFilter('Installed software', `${asset.installedSoftware[0].name} ${asset.installedSoftware[0].version}`.trim());
  assert(await page.$(`[data-topology-result="asset:${asset.id}"]`));
  await selectFilter('CVE code', asset.vulnerabilities[0].cve.toLowerCase());
  await openFilter('IP address', asset.ipAddress);
  await page.$$eval('.endpoint-filter-actions button', nodes => nodes.find(node => node.textContent === 'Select matches').click());
  await closeFilter('IP address');
  assert.equal(await page.$$eval('[data-topology-result]', nodes => nodes.length), 1);
  await choose('asset:' + asset.id);
  assert.match(await page.$eval('.topology-trace-heading', node => node.textContent), /Upstream/);
  for (const kind of ['business', 'mission', 'system', 'network']) assert(await page.$(`[data-topology-node^="${kind}:"]`), `Upstream ${kind}`);
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('.topology-canvas');
  assert(JSON.parse(new URL(page.url()).searchParams.get('topology_filters')).ip.includes(asset.ipAddress));
  assert(await page.$('[aria-label="Clear IP address filter"]'));
  await openFilter('IP address');
  assert.equal(await page.$eval('.endpoint-filter-values input:checked', node => node.closest('label').querySelector('small').textContent), '1', 'Facet count agrees with the matching CI');
  await page.$$eval('.endpoint-filter-actions button', nodes => nodes.find(node => node.textContent === 'Clear filter').click());
  await closeFilter('IP address');
  assert(!JSON.parse(new URL(page.url()).searchParams.get('topology_filters')).ip);
  assert(await page.$('[aria-label="Clear Installed software filter"]'), 'Clearing one field keeps other selections');
  await page.click('.topology-section-heading button');
  assert.equal(new URL(page.url()).searchParams.has('topology_filters'), false);
  assert.equal(new URL(page.url()).searchParams.get('topologyCi'), 'asset:' + asset.id, 'Clear filters retains the graph root');
  await page.click(`[data-cmdb-asset-id="${asset.id}"]`);
  await page.waitForSelector('[data-cmdb-drill-through][open]');
  await page.waitForFunction(() => document.querySelector('[data-cmdb-drill-through]')?.textContent.includes('Security Domain'));
  await page.keyboard.press('Escape'); await page.waitForSelector('[data-cmdb-drill-through][open]', { hidden: true });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-cmdb-asset-id')), asset.id, 'CMDB returns focus.');
  const before = await page.$eval('.topology-canvas', node => node.getAttribute('viewBox'));
  await page.click('[aria-label="Zoom in"]'); assert.notEqual(await page.$eval('.topology-canvas', node => node.getAttribute('viewBox')), before);
  await page.$eval('.topology-canvas', node => node.focus()); await page.keyboard.press('0'); assert.equal(await page.$eval('.topology-canvas', node => node.getAttribute('viewBox')), before);
  await page.keyboard.press('ArrowRight'); assert.notEqual(await page.$eval('.topology-canvas', node => node.getAttribute('viewBox')), before); await page.keyboard.press('0');
  await page.$eval('.topology-canvas', node => node.scrollIntoView({ block: 'center' }));
  const canvas = await page.$eval('.topology-canvas', node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y }; });
  await page.mouse.move(canvas.x + 15, canvas.y + 15); await page.mouse.down(); await page.mouse.move(canvas.x + 65, canvas.y + 40, { steps: 8 }); await page.mouse.up();
  assert.notEqual(await page.$eval('.topology-canvas', node => node.getAttribute('viewBox')), before, 'Pointer drag pans.');
  await page.$eval('.topology-canvas', node => node.focus()); await page.keyboard.press('0');
  for (const layout of ['force', 'circular', 'hierarchical']) {
    await page.select('[aria-label="Topology layout"]', layout);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-topology-node]')].every(node => !/NaN|Infinity/.test(node.getAttribute('transform'))));
  }
  await new Promise(resolve => setTimeout(resolve, 750)); // Let the shared 650ms layout tween finish before capture.
  await checkTopologyFullscreen(page, { artifacts });
  const systemNode = await page.$('[data-topology-node^="system:"]');
  await systemNode.evaluate(node => node.focus()); await page.keyboard.press('Enter');
  assert.match(await page.$eval('.topology-inspector', node => node.textContent), /ICT System/);
  assert(new URL(page.url()).searchParams.get('topologyCi').startsWith('asset:'), 'Inspecting a node retains the root.');
  const inspectionUrl = page.url(), inspectionCamera = await page.$eval('.topology-canvas', node => node.getAttribute('viewBox'));
  const inspectionNodes = await page.$$eval('[data-topology-node]', nodes => nodes.map(node => node.dataset.topologyNode).sort());
  const graphSearch = '.topology-inspector input[type="search"]';
  await page.type(graphSearch, asset.id);
  await page.waitForSelector('.topology-inspector .impact-graph-search-results button');
  await page.focus('.topology-inspector .impact-graph-search-results button'); await page.keyboard.press('Enter');
  assert(await page.$(`[data-topology-node="asset:${asset.id}"][aria-pressed="true"]`), 'Graph search supports keyboard inspection');
  assert.equal(page.url(), inspectionUrl, 'Graph-local inspection preserves lookup, starting CI, mode, date and scope');
  assert.equal(await page.$eval('.topology-canvas', node => node.getAttribute('viewBox')), inspectionCamera, 'Graph search preserves the camera');
  assert.deepEqual(await page.$$eval('[data-topology-node]', nodes => nodes.map(node => node.dataset.topologyNode).sort()), inspectionNodes, 'Graph search does not filter the traced paths');
  await page.focus(graphSearch); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.type(graphSearch, 'no-such-topology-ci');
  assert.match(await page.$eval('.topology-inspector .impact-graph-search-results', node => node.textContent), /0 matching CIs/);
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace');
  await systemNode.evaluate(node => node.focus()); await page.keyboard.press('Enter');
  await page.click('.topology-evidence > summary'); await page.waitForSelector('.topology-evidence .endpoint-table');
  assert(await page.$$eval('.topology-relationship-list li', nodes => nodes.length) > 0);
  if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await (await page.$('.topology-main')).screenshot({ path: path.join(artifacts, `topology-${provider}-impact-graph.png`) }); await page.$eval('.topology-explorer', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, `topology-${provider}-desktop.png`) }); }
  await page.click('.topology-inspector-actions .endpoint-export');
  await page.waitForFunction(() => document.querySelector('.topology-trace-heading')?.textContent.includes('Business Impact'));
  assert(new URL(page.url()).searchParams.get('topologyCi').startsWith('system:'), 'Explore from node changes the starting CI.');
  for (const kind of ['system', 'network', 'business', 'mission']) {
    await visit(`network=net-1&topology_kind=${kind}`);
    const id = await page.$eval('[data-topology-result]', node => node.dataset.topologyResult); await choose(id);
    assert.match(await page.$eval('.topology-trace-heading', node => node.textContent), /Business Impact/);
    assert.equal(await page.$('[data-topology-node^="asset:"]'), null);
    assert(await page.$('[data-topology-node^="network:"]')); assert(await page.$('[data-topology-node^="system:"]'));
  }
  await visit(`network=net-1&topologyCi=asset:${asset.id}&topology_kind=system`);
  assert(await page.$('[aria-label="Clear CI type bookmark search"]'));
  await openFilter('CI type');
  assert.equal(await page.$$eval('.endpoint-filter-values label', nodes => nodes.length), 5, 'Legacy own-field search does not hide other category choices');
  await page.$$eval('.endpoint-filter-actions button', nodes => nodes.find(node => node.textContent === 'Clear filter').click());
  await closeFilter('CI type');
  assert.equal(new URL(page.url()).searchParams.has('topology_kind'), false);
  await visit(`network=net-1&topologyCi=asset:${asset.id}&topology_filters=${encodeURIComponent(JSON.stringify({ name: ['Unavailable CI'] }))}`);
  assert.match(await page.$eval('.topology-results', node => node.textContent), /No matching CIs/);
  await openFilter('CI name or ID', 'Unavailable CI');
  assert.equal(await page.$eval('.endpoint-filter-values input:checked', node => node.closest('label').querySelector('small').textContent), '0');
  await page.click('.endpoint-filter-values input:checked'); await closeFilter('CI name or ID');
  assert.equal(await page.$('[aria-label="Active topology filters"]'), null);
  await visit(`system=${asset.systemContext.systemId}&topologyCi=asset:${asset.id}&topologyMode=dependencies`, historicalDate);
  assert(await page.$('.topology-canvas')); assert.equal(new URL(page.url()).searchParams.get('system'), asset.systemContext.systemId);
  // Modes preserve the selected CI, lookup, header scope and snapshot, with actual directed peer evidence.
  const byAsset = new Map(sample.assets.map(row => [row.id, row]));
  const externalFlow = sample.ciDependencies.find(row => row.dependencyType === 'Flow Dependency' && byAsset.has(row.sourceAssetId) && byAsset.has(row.targetAssetId) && byAsset.get(row.sourceAssetId).networkId !== byAsset.get(row.targetAssetId).networkId);
  assert(externalFlow, 'Sample includes a cross-network communication.');
  const origin = byAsset.get(externalFlow.sourceAssetId), peer = byAsset.get(externalFlow.targetAssetId);
  const rootQuery = 'network=' + origin.networkId + '&topologyCi=asset:' + origin.id + '&topology_name=' + encodeURIComponent(origin.hostname);
  await visit(rootQuery);
  assert(await page.$eval('[aria-label="Topology mode"]', node => !!node.closest('.topology-trace-heading')), 'Mode controls live inside the graph header');
  assert(await page.$eval('.topology-lookup', node => node.nextElementSibling?.classList.contains('topology-workspace')), 'Graph workspace follows lookup without a separate mode row');
  const resultCount = await page.$eval('.topology-results header span', node => node.textContent);
  await page.focus('[role=tab][id$="-business-impact"]'); await page.keyboard.press('ArrowRight');
  await checkTopologyWheelZoom(page);
  assert(await page.$eval('[role=tab][id$="-dependencies"]', node => node === document.activeElement && node.getAttribute('aria-selected') === 'true'));
  assert.equal(new URL(page.url()).searchParams.get('topologyMode'), 'dependencies');
  assert.equal(new URL(page.url()).searchParams.get('topologyCi'), 'asset:' + origin.id);
  assert.equal(await page.$eval('.topology-results header span', node => node.textContent), resultCount, 'External peers do not widen the lookup');
  await page.focus('[data-topology-fullscreen]'); await page.keyboard.press('Enter'); await page.waitForSelector('dialog.topology-fullscreen[open]');
  await page.focus('[role=tab][id$="-dependencies"]'); await page.keyboard.press('Home');
  assert(await page.$('dialog.topology-fullscreen[open] [role=tab][id$="-business-impact"][aria-selected=true]'), 'Business Impact can be selected without leaving full screen');
  await checkTopologyWheelZoom(page);
  await page.keyboard.press('End');
  assert(await page.$('dialog.topology-fullscreen[open] [role=tab][id$="-dependencies"][aria-selected=true]'), 'Dependencies can be restored within full screen');
  await page.keyboard.press('Escape'); await page.waitForSelector('dialog.topology-fullscreen[open]', { hidden: true });
  const selector = '[data-topology-node="asset:' + peer.id + '"]';
  assert(await page.$(selector + '[data-outside-scope=true]'));
  assert(await page.$('[data-topology-node="network:' + peer.networkId + '"]'));
  assert(await page.$('[data-topology-edge-kind=communication][data-source="asset:' + origin.id + '"]'));
  assert(await page.$('[data-topology-edge-kind=communication][data-target="asset:' + origin.id + '"]'));
  const direct = sample.ciDependencies.filter(row => row.dependencyType === 'Flow Dependency' && (row.sourceAssetId === origin.id || row.targetAssetId === origin.id) && byAsset.has(row.sourceAssetId) && byAsset.has(row.targetAssetId) && row.sourceAssetId !== row.targetAssetId && (!row.observedAt || Date.parse(row.observedAt) <= Date.parse(date + 'T23:59:59.999Z')));
  const expectedPeers = [...new Set(direct.flatMap(row => ['asset:' + row.sourceAssetId, 'asset:' + row.targetAssetId]))].sort();
  for (const id of expectedPeers) assert(await page.$('[data-topology-node="' + id + '"]'));
  const expectedPairs = [...new Set(direct.map(row => JSON.stringify(['asset:' + row.sourceAssetId, 'asset:' + row.targetAssetId])))].sort();
  assert.deepEqual(await page.$$eval('[data-topology-edge-kind=communication]', nodes => nodes.map(node => JSON.stringify([node.dataset.source, node.dataset.target])).sort()), expectedPairs, 'Only direct communications are expanded');
  assert.match(await page.$eval('.topology-communication-summary', node => node.textContent), new RegExp(direct.length + ' communication observations'));
  await page.click('.topology-communications > summary'); await page.waitForSelector('.topology-communications .endpoint-table');
  for (const label of ['Source CI', 'Target CI', 'Protocol', 'Source port', 'Target port', 'Observation method', 'Observed at (UTC)']) assert((await page.$eval('.topology-communications', node => node.textContent)).includes(label));
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('.topology-canvas'); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  assert.equal(await page.$eval('.topology-explorer', node => node.dataset.topologyMode), 'dependencies');
  assert.equal(new URL(page.url()).searchParams.get('network'), origin.networkId); assert.equal(new URL(page.url()).searchParams.get('dataDate'), date);
  assert.equal(new URL(page.url()).searchParams.get('topology_name'), origin.hostname);
  await page.focus('[role=tab][id$="-dependencies"]'); await page.keyboard.press('Home');
  assert.equal(await page.$('[data-topology-edge-kind=communication]'), null);
  assert.equal(await page.$$eval('[data-topology-node^="asset:"]', nodes => nodes.length), 1);
  await page.keyboard.press('End');
  await page.$eval(selector, node => node.focus()); await page.keyboard.press('Enter');
  assert.match(await page.$eval('.topology-inspector', node => node.textContent), /Outside lookup scope/);
  await checkTopologyFullscreen(page, { artifacts });
  await new Promise(resolve => setTimeout(resolve, 750)); // Finish the mode's 650ms graph layout tween before visual capture.
  if (artifacts) { await page.$eval('.topology-main', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, 'topology-' + provider + '-dependencies.png') }); }
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 120000 }), page.click('.topology-inspector-actions .endpoint-export')]);
  await page.waitForSelector('.topology-canvas');
  assert.equal(new URL(page.url()).searchParams.get('network'), peer.networkId); assert.equal(new URL(page.url()).searchParams.get('topologyCi'), 'asset:' + peer.id);
  assert.equal(new URL(page.url()).searchParams.get('topologyMode'), 'dependencies');
  // The external peer's CMDB action must also open the correct network, retaining mode/date.
  await visit(rootQuery + '&topologyMode=dependencies'); await page.$eval(selector, node => node.focus()); await page.keyboard.press('Enter');
  await page.click('[data-cmdb-asset-id="' + peer.id + '"]');
  await page.waitForSelector('[data-cmdb-drill-through][data-load-state=ready]');
  await page.waitForFunction(() => document.querySelector('[data-cmdb-drill-through]')?.getBoundingClientRect().left >= -0.5);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 120000 }), page.click('[data-cmdb-explore-topology]')]);
  await page.waitForSelector('.topology-canvas');
  assert.equal(new URL(page.url()).searchParams.get('network'), peer.networkId); assert.equal(new URL(page.url()).searchParams.get('topologyCi'), 'asset:' + peer.id);
  assert.equal(new URL(page.url()).searchParams.get('topologyMode'), 'dependencies'); assert.equal(new URL(page.url()).searchParams.get('dataDate'), date);
  await visit('system=' + asset.systemContext.systemId + '&topologyCi=system:' + asset.systemContext.systemId + '&topologyMode=dependencies');
  assert.match(await page.$eval('.topology-communication-summary', node => node.textContent), /member endpoints/);
  assert(await page.$('[data-topology-edge-kind=communication]'));
  const noFlow = sample.assets.find(row => row.networkId === 'net-1' && !sample.ciDependencies.some(edge => edge.sourceAssetId === row.id || edge.targetAssetId === row.id));
  await visit('network=net-1&topologyCi=asset:' + noFlow.id + '&topologyMode=dependencies');
  assert.match(await page.$eval('.topology-main', node => node.textContent), /No recorded communication/); assert(await page.$('.topology-canvas'));
  await visit('network=net-1&securityDomain=NONE&topologyCi=asset:missing');
  assert.match(await page.$eval('.topology-results', node => node.textContent), /No CIs in this scope/); assert.equal(await page.$('.topology-canvas'), null);
  await visit('network=net-unassigned');
  assert.equal(await page.$$eval('[data-topology-result]', nodes => nodes.length), 0, 'Unassigned scope never widens to all model CIs.');
  await visit(`network=net-1&topologyCi=asset:${asset.id}&topology_name=${encodeURIComponent(asset.hostname)}`);
  await page.setViewport({ width: 390, height: 844 });
  if (await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width < 50);
  await openFilter('Installed software');
  for (const width of [320, 390]) {
    await page.setViewport({ width, height: 844 });
    await page.waitForFunction(() => { const rect = document.querySelector('.endpoint-filter-popup')?.getBoundingClientRect(); return rect && rect.left >= 12 && rect.right <= document.documentElement.getBoundingClientRect().right - 12; });
  }
  assert(await page.$eval('.endpoint-filter-popup', node => { const rect = node.getBoundingClientRect(); return rect.left >= 12 && rect.right <= document.documentElement.getBoundingClientRect().right - 12 && rect.bottom <= innerHeight; }), 'Filter popup fits the usable phone viewport with margins, excluding the stable scrollbar gutter');
  if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `topology-${provider}-phone-filter.png`) }); }
  await closeFilter('Installed software');
  await new Promise(resolve => setTimeout(resolve, 800)); // Sidebar resize starts the compact graph's layout tween.
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'No page-wide mobile overflow');
  assert(await page.$eval('.topology-trace-heading', node => node.getBoundingClientRect().height < 250), 'Narrow graph header fits its title, mode tabs and actions without excess space');
  await page.focus(`[data-topology-result="asset:${asset.id}"]`); await page.keyboard.press('Enter');
  if (artifacts) {
    await page.$eval('.topology-explorer', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, `topology-${provider}-phone.png`) });
    await page.$eval('.topology-main', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, `topology-${provider}-phone-graph.png`) });
    await (await page.$('.topology-graph-canvas')).screenshot({ path: path.join(artifacts, `topology-${provider}-phone-canvas.png`) });
  }
  await page.goto(base + '/discovery-coverage?discoveryView=topology', { waitUntil: 'networkidle0' }); assert.equal(await page.$('.topology-explorer'), null);
  await page.setViewport({ width: 1600, height: 1000 });
  await checkModelCiCmdb(page, { date, historicalDate, artifacts });
  console.log('Topology Explorer browser checks passed: both modes, directed/external peers and context, lookup fields, layouts, keyboard, bookmarks, peer/CMDB scope navigation, history, empty and mobile states.');
  await checkCmdbTopologyNavigation(page, { date, historicalDate, artifacts });
}

/** Real wheel input must zoom without scrolling or changing topology state. */
export async function checkTopologyWheelZoom(page) {
  const canvas = '.topology-canvas';
  await page.$eval(canvas, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await new Promise(resolve => setTimeout(resolve, 750));
  const point = await page.$eval(canvas, node => {
    let { left, right, top, bottom } = node.getBoundingClientRect();
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
    }
    return { x: (Math.max(0, left) + Math.min(innerWidth, right)) / 2, y: (Math.max(0, top) + Math.min(innerHeight, bottom)) / 2 };
  });
  await page.mouse.move(point.x, point.y);
  assert(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.topology-canvas'), point), 'Wheel pointer is over the visible canvas');
  const state = () => page.$eval(canvas, node => {
    const scroll = []; for (let parent = node.parentElement; parent; parent = parent.parentElement) scroll.push([parent.scrollLeft, parent.scrollTop]);
    return { box: node.getAttribute('viewBox').split(' ').map(Number), scroll, url: location.href,
      nodes: [...node.querySelectorAll('[data-topology-node]')].map(item => [item.dataset.topologyNode, item.getAttribute('transform'), item.getAttribute('aria-pressed')]) };
  });
  const before = await state();
  await page.mouse.wheel({ deltaY: -120 });
  await page.waitForFunction(width => Number(document.querySelector('.topology-canvas').getAttribute('viewBox').split(' ')[2]) < width, {}, before.box[2]);
  const zoomed = await state();
  assert.deepEqual(zoomed.scroll, before.scroll, 'Wheel zoom does not scroll the page or graph workspace');
  assert.deepEqual(zoomed.nodes, before.nodes, 'Wheel zoom retains node positions and inspection');
  assert.equal(zoomed.url, before.url, 'Wheel zoom preserves scope, date, root and mode');
  for (const axis of [0, 1]) assert(Math.abs(zoomed.box[axis] + zoomed.box[axis + 2] / 2 - before.box[axis] - before.box[axis + 2] / 2) < 1e-6, 'Wheel zoom retains the panned view centre');
  await page.mouse.wheel({ deltaY: 120 });
  await page.waitForFunction(width => Math.abs(Number(document.querySelector('.topology-canvas').getAttribute('viewBox').split(' ')[2]) - width) < 1e-6, {}, before.box[2]);
  const restored = await state();
  assert.deepEqual(restored.scroll, before.scroll);
  assert.deepEqual(restored.nodes, before.nodes);
}

/** Verify modal expansion without losing the current graph view or scope. */
export async function checkTopologyFullscreen(page, { artifacts } = {}) {
  const button = '[data-topology-fullscreen]', modal = 'dialog.topology-fullscreen[open]';
  const capture = async () => ({
    url: page.url(),
    layout: await page.$eval('[aria-label="Topology layout"]', node => node.value),
    camera: await page.$eval('.topology-canvas', node => node.getAttribute('viewBox').split(' ').map(value => Number(Number(value).toFixed(6)))),
    nodes: await page.$$eval('[data-topology-node]', nodes => nodes.map(node => [node.dataset.topologyNode,
      node.getAttribute('transform').match(/-?[\d.]+(?:e[+-]?\d+)?/gi).map(value => Number(Number(value).toFixed(6))), node.getAttribute('aria-pressed')])),
    search: await page.$eval('.topology-inspector input', node => node.value)
  });
  const before = await capture(), overflow = await page.evaluate(() => document.body.style.overflow);
  await page.focus(button); await page.keyboard.press('Enter'); await page.waitForSelector(modal);
  await new Promise(resolve => setTimeout(resolve, 800));
  assert(await page.$eval(modal, node => { const r = node.getBoundingClientRect(); return node.matches(':modal') && r.x === 0 && r.y === 0 && Math.abs(r.width - innerWidth) <= 1 && Math.abs(r.height - innerHeight) <= 1; }), 'Expanded graph fills the application viewport as a native modal');
  assert.equal(await page.$eval(button, node => node.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$eval(button, node => node === document.activeElement), true, 'Exit toggle receives focus');
  // Compact layout can adapt to the wider canvas, but returning inline must recover its exact view.
  const expanded = await capture();
  assert.equal(expanded.url, before.url); assert.equal(expanded.layout, before.layout); assert.equal(expanded.search, before.search);
  assert.deepEqual(expanded.nodes.map(([id, , selected]) => [id, selected]), before.nodes.map(([id, , selected]) => [id, selected]));
  await page.$eval('.topology-results button', node => node.focus());
  assert(await page.$eval(modal, node => node.contains(document.activeElement)), 'Native modal prevents background focus');
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); await page.keyboard.press('Tab');
  assert(await page.$eval(modal, node => node.contains(document.activeElement)), 'Keyboard navigation stays in the graph');
  assert(await page.$eval(modal, node => node.scrollWidth <= node.clientWidth), 'Full-screen graph has no horizontal overflow');
  const cmdb = modal + ' [data-cmdb-asset-id]';
  if (await page.$(cmdb)) {
    await page.click(cmdb); await page.waitForSelector('[data-cmdb-drill-through][open]');
    await page.waitForFunction(() => document.querySelector('[data-cmdb-drill-through][open]')?.textContent.includes('Security Domain'));
    await page.keyboard.press('Escape'); await page.waitForSelector('[data-cmdb-drill-through][open]', { hidden: true });
    assert(await page.$(modal), 'Closing nested CMDB retains full-screen graph');
    await page.waitForFunction(selector => document.querySelector(selector) === document.activeElement, {}, cmdb);
  }
  if (artifacts) {
    fs.mkdirSync(artifacts, { recursive: true });
    await page.$eval(modal + ' .impact-graph-workspace', node => { node.scrollTop = 0; });
    const mode = await page.$eval('.topology-explorer', node => node.dataset.topologyMode);
    await page.screenshot({ path: path.join(artifacts, `topology-fullscreen-${mode}-${page.viewport().width}.png`) });
  }
  await page.keyboard.press('Escape'); await page.waitForSelector(modal, { hidden: true });
  await new Promise(resolve => setTimeout(resolve, 800));
  assert(await page.$eval(button, node => node === document.activeElement), 'Escape returns focus to the inline toggle');
  assert.deepEqual(await capture(), before, 'Expansion/restoration preserves scope, selection, search, layout, moved nodes and camera');
  assert.equal(await page.evaluate(() => document.body.style.overflow), overflow, 'Exiting restores body scrolling');
  await page.keyboard.press('Enter'); await page.waitForSelector(modal);
  await page.click(button); await page.waitForSelector(modal, { hidden: true });
  await new Promise(resolve => setTimeout(resolve, 800));
  assert(await page.$eval(button, node => node === document.activeElement), 'Exit button also returns focus');
  assert.deepEqual(await capture(), before);
}
