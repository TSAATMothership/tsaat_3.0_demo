import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Navigation-only acceptance checks against a compiled app and isolated sample store. */
export async function checkCmdbTopologyNavigation(page, { date, historicalDate, artifacts }) {
  const base = new URL(page.url()).origin;
  const button = '[data-cmdb-explore-topology]';
  const popup = '[data-cmdb-drill-through]';
  const visit = async query => {
    await page.goto(`${base}/discovery-coverage?${query}`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  };
  const openFirst = async () => {
    const assetId = await page.$eval('[data-cmdb-asset-id]', node => node.dataset.cmdbAssetId);
    await page.focus(`[data-cmdb-asset-id="${assetId}"]`); await page.keyboard.press('Enter');
    await page.waitForSelector(`${popup}[data-load-state="ready"]`);
    await page.waitForFunction(selector => document.querySelector(selector)?.getBoundingClientRect().left >= -0.5, {}, popup);
    return assetId;
  };
  const explore = async (assetId, snapshot) => {
    // The drawer sets initial focus during its opening animation; wait before sending Enter.
    await page.waitForFunction(selector => {
      const panel = document.querySelector(selector);
      return panel?.open && panel.classList.contains('is-open') && panel.getBoundingClientRect().left >= -0.5;
    }, {}, popup);
    assert.equal(await page.$eval(button, node => node.disabled), false);
    await page.focus(button);
    assert(await page.$eval(button, node => node === document.activeElement), 'Explore Topology receives keyboard focus');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 120000 }), page.keyboard.press('Enter')]);
    await page.waitForSelector('.topology-canvas');
    const params = new URL(page.url()).searchParams;
    assert.equal(params.get('discoveryView'), 'topology'); assert.equal(params.get('topologyCi'), `asset:${assetId}`); assert.equal(params.get('dataDate'), snapshot);
    assert(await page.$(`[data-topology-node="asset:${assetId}"].is-root`)); assert.equal(await page.$(`${popup}[open]`), null);
    assert.equal(await page.$eval('.topology-explorer', node => node.dataset.snapshot), snapshot);
    return params;
  };
  await page.setViewport({ width: 1600, height: 1000 });
  await visit(`discoveryView=endpoints&network=net-1&securityDomain=PROTECTED&dataDate=${historicalDate}`);
  const networkAsset = await openFirst();
  if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'cmdb-explore-topology-desktop.png') }); }
  const networkParams = await explore(networkAsset, historicalDate);
  assert.equal(networkParams.get('network'), 'net-1'); assert.equal(networkParams.get('securityDomain'), 'PROTECTED');

  // Same-page launch must replace the root and discard stale lookup filters.
  const sample = JSON.parse(fs.readFileSync(new URL('../data/current.json', import.meta.url), 'utf8'));
  const arp = sample.assets.find(row => row.type === 'ip-node' && row.networkId === 'net-1' && row.arpOwnerAssetId && sample.assets.some(owner => owner.id === row.arpOwnerAssetId));
  assert(arp);
  await visit(`discoveryView=topology&network=net-1&dataDate=${date}&topologyCi=asset:${arp.id}&topology_name=not-a-match&topology_kind=system&topology_filters=${encodeURIComponent(JSON.stringify({ kind: ['ICT System'] }))}`);
  await page.$eval(`[data-topology-node="asset:${arp.arpOwnerAssetId}"]`, node => node.focus()); await page.keyboard.press('Enter');
  await page.click(`[data-cmdb-asset-id="${arp.arpOwnerAssetId}"]`); await page.waitForSelector(`${popup}[data-load-state="ready"]`);
  const rootParams = await explore(arp.arpOwnerAssetId, date);
  assert.equal(rootParams.has('topology_name'), false); assert.equal(rootParams.has('topology_kind'), false);
  assert.equal(rootParams.has('topology_filters'), false);
  assert.equal(await page.$('[aria-label="Active topology filters"]'), null);
  assert.equal(await page.$$eval('.topology-filter-grid .endpoint-column-trigger', nodes => nodes.length), 5);

  await visit(`discoveryView=endpoints&system=sys-1&dataDate=${historicalDate}`);
  await page.setViewport({ width: 390, height: 844 });
  const systemAsset = await openFirst();
  await page.waitForFunction(selector => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight; }, { timeout: 5000 }, button);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'cmdb-explore-topology-phone.png') });
  const systemParams = await explore(systemAsset, historicalDate);
  assert.equal(systemParams.get('system'), 'sys-1'); assert.equal(systemParams.has('network'), false);
  await page.setViewport({ width: 1600, height: 1000 });

  // Browser fixtures exercise loading/error/persona gating without saving any settings or evidence.
  const personas = await page.evaluate(async () => (await fetch('/api/settings/personas')).json());
  const restricted = structuredClone(personas);
  restricted.settings.personas.find(row => row.id === 'analyst').pages = restricted.settings.personas.find(row => row.id === 'analyst').pages.filter(id => id !== 'discovery-topology');
  let pending, failDetails = true;
  await page.setRequestInterception(true);
  const intercept = request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/settings/personas') { void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(restricted) }); return; }
    if (pathname === '/api/assets/cmdb-details' && failDetails) { pending = request; return; }
    void request.continue();
  };
  page.on('request', intercept);
  try {
    await visit(`discoveryView=endpoints&network=net-1&dataDate=${date}`);
    await page.focus('[data-cmdb-asset-id]'); await page.keyboard.press('Enter'); await page.waitForSelector(`${popup}[data-load-state="loading"]`);
    assert.equal(await page.$eval(button, node => node.disabled), true);
    assert(pending); await pending.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture unavailable' }) }); pending = null;
    await page.waitForSelector(`${popup}[data-load-state="error"]`); assert.equal(await page.$eval(button, node => node.disabled), true);
    await page.keyboard.press('Escape'); await page.waitForSelector(`${popup}[open]`, { hidden: true });
    failDetails = false;
    await page.evaluate(() => localStorage.setItem('tsaat.active-persona', 'analyst'));
    await page.reload({ waitUntil: 'networkidle0' }); await openFirst();
    assert.equal(await page.$eval(button, node => node.disabled), true); assert.equal(await page.$eval(button, node => node.title), 'Unavailable for the active persona');
    const before = page.url(); await page.$eval(button, node => node.click()); assert.equal(page.url(), before);
    await page.keyboard.press('Escape'); await page.waitForSelector(`${popup}[open]`, { hidden: true });
  } finally {
    if (pending) await pending.abort();
    page.off('request', intercept); await page.setRequestInterception(false);
    await page.evaluate(() => localStorage.removeItem('tsaat.active-persona'));
  }
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  console.log('CMDB topology navigation passed: selected CI, network/system/domain/date, same-page root replacement, keyboard/mobile and loading/error/persona gating.');
}
