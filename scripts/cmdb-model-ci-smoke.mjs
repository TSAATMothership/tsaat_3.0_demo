import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Shared model-CI modal and snapshot checks against either compiled provider. */
export async function checkModelCiCmdb(page, { date, historicalDate, artifacts } = {}) {
  const base = new URL(page.url()).origin;
  const sample = JSON.parse(fs.readFileSync(new URL('../data/current.json', import.meta.url), 'utf8'));
  const system = sample.ictSystems.find(row => row.id === 'sys-1');
  const models = [
    { type: 'business-service', kind: 'business', ...system.businessServices[0] },
    { type: 'mission-capability', kind: 'mission', ...system.missionCapabilities[0] }
  ];
  const panel = '[data-cmdb-drill-through][open]', ready = panel + '[data-load-state="ready"]';
  const waitReady = async () => {
    await page.waitForSelector(ready);
    await page.waitForFunction(selector => { const node = document.querySelector(selector); return node?.classList.contains('is-open') && node.getBoundingClientRect().left >= -.5; }, {}, ready);
  };
  const press = async selector => { await page.$eval(selector, node => node.focus()); await page.keyboard.press('Enter'); };
  const visit = async route => {
    await page.goto(base + route, { waitUntil: 'networkidle0' }); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    if (page.viewport().width < 500 && await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
    if (page.viewport().width < 500) await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width < 50);
  };
  const verify = async (model, expectedDate, trigger, parent) => {
    await press(trigger); await waitReady();
    const text = await page.$eval(ready, node => node.textContent);
    for (const value of [model.name, expectedDate, 'CI ID', 'CI Type', model.type === 'business-service' ? 'Business Service' : 'Mission Service', 'Related ICT systems', system.id]) assert(text.includes(value), value);
    for (const field of ['IP Address', 'Operating System', 'Patch Status']) assert(!text.includes(field), 'No fabricated endpoint field: ' + field);
    assert(await page.$eval(panel, node => node.matches(':modal') && node.contains(document.activeElement)), 'CMDB is the top modal with focus');
    await page.keyboard.press('Escape'); await page.waitForSelector(panel, { hidden: true });
    assert(await page.$eval(trigger, node => node === document.activeElement), 'CMDB close restores its invoking link');
    if (parent) assert(await page.$(parent), 'Underlying topology stays open');
  };
  for (const width of [1600, 390]) {
    await page.setViewport({ width, height: width > 760 ? 1000 : 844 });
    for (const model of models) for (const mode of ['business-impact', 'dependencies']) {
      const query = new URLSearchParams({ discoveryView: 'topology', system: system.id, dataDate: date, topologyCi: model.kind + ':' + model.id, topologyMode: mode });
      await visit('/discovery-coverage?' + query); await page.waitForSelector('.topology-canvas');
      const trigger = `.topology-inspector [data-cmdb-ci-type="${model.type}"]`;
      await verify(model, date, trigger);
      await press('[data-topology-fullscreen]'); await page.waitForSelector('dialog.topology-fullscreen[open]');
      await verify(model, date, trigger, 'dialog.topology-fullscreen[open]');
      await press(trigger); await waitReady();
      if (artifacts && mode === 'business-impact') {
        fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `cmdb-${model.type}-${width}.png`) });
      }
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), press('[data-cmdb-explore-topology]')]);
      await page.waitForSelector('.topology-canvas');
      const target = new URL(page.url()).searchParams;
      assert.equal(target.get('topologyCi'), model.kind + ':' + model.id); assert.equal(target.get('system'), system.id); assert.equal(target.get('dataDate'), date);
      assert.equal(target.get('topologyMode'), mode === 'dependencies' ? mode : null);
      assert.equal(await page.$(panel), null);
    }
    await visit(`/cyber-cop?copView=impact&system=${system.id}&dataDate=${date}`);
    assert.equal(await page.$('[data-explore-service-impact]'), null, 'Retired Service Impact cannot launch CMDB');
    assert((await page.$eval('main', node => node.textContent)).includes('retired'));
  }
  await page.setViewport({ width: 1600, height: 1000 });
  const model = models[0];
  await visit(`/discovery-coverage?discoveryView=topology&system=${system.id}&dataDate=${historicalDate}&topologyCi=${model.kind}:${model.id}`);
  await verify(model, historicalDate, `.topology-inspector [data-cmdb-ci-type="${model.type}"]`);
  const query = new URLSearchParams({ assetId: model.id, ciType: model.type, dataDate: historicalDate, system: system.id, securityDomain: 'NONE' });
  assert.equal(await page.evaluate(async url => (await fetch(url)).status, '/api/assets/cmdb-details?' + query), 404);
  let fail = true;
  const intercept = request => {
    if (fail && request.url().includes('/api/assets/cmdb-details?')) { fail = false; return request.respond({status: 503, contentType: 'application/json', body: JSON.stringify({error: 'Temporary CMDB failure'})}); }
    return request.continue();
  };
  await page.setRequestInterception(true); page.on('request', intercept);
  try {
    await press(`.topology-inspector [data-cmdb-ci-type="${model.type}"]`); await page.waitForSelector(panel + ' [role="alert"]');
    assert(await page.$eval('[data-cmdb-explore-topology]', node => node.disabled));
    await press(panel + ' .cmdb-scope-state button'); await waitReady();
    await page.keyboard.press('Escape'); await page.waitForSelector(panel, { hidden: true });
  } finally { page.off('request', intercept); await page.setRequestInterception(false); }
  console.log('Model CI CMDB passed: both types, graph surfaces/modes, full-screen nesting, focus/Explore Topology, phone, history/domain and Retry.');
}
