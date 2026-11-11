import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Runs the data-driven editor against either real provider; restores the original catalogue. */
export async function checkPersonaCatalogue(page, { artifacts } = {}) {
  const initialUrl = page.url(), api = new URL('/api/settings/personas', initialUrl).href;
  const read = () => page.evaluate(async url => (await (await fetch(url, { cache: 'no-store' })).json()).settings, api);
  const write = value => page.evaluate(async ({ api, value }) => {
    const response = await fetch(api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    return { status: response.status, ...await response.json() };
  }, { api, value });
  const original = await read(), previousSelection = await page.evaluate(() => localStorage.getItem('tsaat.active-persona'));
  const press = async selector => { await page.focus(selector); await page.keyboard.press('Enter'); };
  const open = async () => {
    await press('.workspace-header-menu summary'); await press('.workspace-header-menu nav button');
    await page.waitForSelector('dialog.settings-popup[open]');
    await press('#settings-tab-personas'); await page.waitForSelector('#settings-panel-personas [data-add-persona]');
  };
  const close = async () => { await page.keyboard.press('Escape'); await page.waitForSelector('dialog.settings-popup[open]', { hidden: true }); };
  const name = async value => { await page.focus('[aria-label="Persona name"]'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type(value); };
  const save = async () => { await press('[data-save-personas]'); await page.waitForFunction(() => document.querySelector('#settings-panel-personas')?.textContent.includes('Personas saved.')); };
  const select = '#settings-panel-personas .persona-selector select';
  try {
    await page.setViewport({ width: 1600, height: 1000 });
    await open(); await press('[data-add-persona]');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Persona name');
    await name("Reviewer's café $(literal)");
    assert.equal(await page.$$eval('.persona-card input[type=checkbox]:checked', nodes => nodes.length), 0);
    await save();
    let current = await read(); const created = current.personas.find(persona => persona.label === "Reviewer's café $(literal)");
    assert(created); assert.equal(current.schemaVersion, 3); assert.equal(current.personas.length, original.personas.length + 1);
    assert.equal(await page.$eval('[data-active-persona]', node => node.textContent), created.label);
    await name('Renamed review'); await save();
    assert.equal((await read()).personas.find(persona => persona.id === created.id).label, 'Renamed review');
    // Duplicate and empty labels are validated before a source write, retaining the draft.
    await name(original.personas[0].label); await press('[data-save-personas]');
    await page.waitForSelector('.personas-save-error');
    assert.equal((await read()).personas.find(persona => persona.id === created.id).label, 'Renamed review');
    await name(''); await press('[data-save-personas]'); await page.waitForSelector('.personas-save-error');
    await name('Renamed review');
    // A real concurrent write must win; the stale editor retains its draft until reload.
    current = await read(); current.personas.find(persona => persona.id === created.id).label = 'Updated by another session';
    assert.equal((await write(current)).status, 200);
    await name('Stale edit'); await press('[data-save-personas]');
    await page.waitForFunction(() => document.querySelector('.personas-save-error')?.textContent.includes('changed in the data source'));
    assert(await page.$eval('[data-save-personas]', node => node.disabled));
    assert.equal((await read()).personas.find(persona => persona.id === created.id).label, 'Updated by another session');
    await page.$$eval('.persona-action', nodes => nodes.find(node => node.textContent === 'Reload saved personas').click());
    await page.waitForFunction(() => document.querySelector('[aria-label="Persona name"]')?.value === 'Updated by another session');
    // Reversible draft removal and a source-backed rename survive reload.
    await press('[data-remove-persona]');
    await page.$$eval('.persona-action', nodes => nodes.find(node => node.textContent === 'Discard changes').click());
    assert(await page.$('[aria-label="Persona name"]'));
    await close(); await page.reload({ waitUntil: 'networkidle0' }); await open();
    assert.equal(await page.$eval(select, node => node.value), created.id);
    assert.equal(await page.$eval('[aria-label="Persona name"]', node => node.value), 'Updated by another session');
    if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
    for (const [width, height] of [[1280, 720], [390, 844], [320, 667]]) {
      await page.setViewport({ width, height });
      assert(await page.$eval('dialog.settings-popup', node => node.scrollWidth <= node.clientWidth + 1));
      for (const control of ['[data-add-persona]', '[aria-label="Persona name"]', '[data-remove-persona]']) {
        await page.focus(control); assert(await page.$eval(control, node => document.activeElement === node));
      }
      if (artifacts) await page.screenshot({ path: path.join(artifacts, `persona-catalogue-${width}.png`) });
    }
    await page.setViewport({ width: 1600, height: 1000 });
    await press('[data-remove-persona]'); await save();
    await page.waitForFunction(() => document.querySelector('[data-active-persona]')?.textContent === 'All sections (no persona)');
    assert.equal((await read()).personas.some(persona => persona.id === created.id), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('tsaat.active-persona')), null);
    await close();
    // A source-defined ID/name/order that never existed in code is read on reload.
    current = await read(); current.personas = [{ id: 'source-defined-reviewer', label: 'Source-defined reviewer', sections: [], pages: [], popups: [] }, ...current.personas.reverse()];
    assert.equal((await write(current)).status, 200);
    await page.reload({ waitUntil: 'networkidle0' }); await open();
    const options = await page.$$eval(select + ' option', nodes => nodes.map(node => [node.value, node.textContent]));
    assert.deepEqual(options[1], ['source-defined-reviewer', 'Source-defined reviewer']);
    assert.deepEqual(options.slice(1).map(([id]) => id), current.personas.map(persona => persona.id));
    await page.select(select, 'source-defined-reviewer'); await close();
    assert.equal(await page.$eval('[data-active-persona]', node => node.textContent), 'Source-defined reviewer');
    current = await read(); current.personas = []; assert.equal((await write(current)).status, 200);
    await page.reload({ waitUntil: 'networkidle0' }); await open();
    assert.equal(await page.$$eval(select + ' option', nodes => nodes.length), 1);
    assert(await page.$('[data-add-persona]:not([disabled])'));
    await close();
    assert.equal(new URL(page.url()).search, new URL(initialUrl).search);
    console.log('Persona catalogue checks passed: create/rename/remove/discard, Unicode, source-defined names/order, validation, concurrent-save conflict, empty/deleted selection recovery and keyboard/mobile controls.');
  } finally {
    const latest = await read(); assert.equal((await write({ ...original, updatedAt: latest.updatedAt })).status, 200);
    await page.evaluate(value => { if (value === null) localStorage.removeItem('tsaat.active-persona'); else localStorage.setItem('tsaat.active-persona', value); }, previousSelection);
    await page.goto(initialUrl, { waitUntil: 'networkidle0' });
  }
}
