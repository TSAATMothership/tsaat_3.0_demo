import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Header persona selection preserves existing navigation preferences without Settings. */
export async function checkPersonas(page, { artifacts } = {}) {
  const url = page.url(), selector = '.workspace-header .persona-selector select';
  const saved = await page.evaluate(async () => (await (await fetch('/api/settings/personas')).json()).settings);
  await page.waitForSelector(selector + ':not([disabled])');
  for (const persona of saved.personas) {
    await page.select(selector, persona.id);
    await page.waitForFunction(label => document.querySelector('[data-active-persona]')?.textContent === label, {}, persona.label);
    assert.equal(page.url(), url, 'Persona selection preserves route, scope and snapshot');
  }
  if (saved.personas.length) {
    await page.select(selector, ''); await page.focus(selector); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.waitForFunction(id => document.querySelector('.persona-selector select').value === id, {}, saved.personas[0].id);
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector(selector + ':not([disabled])');
    assert.equal(await page.$eval(selector, node => node.value), saved.personas[0].id, 'Persona survives reload');
  }
  for (const width of [1600, 800, 390, 320]) {
    await page.setViewport({ width, height: 844 });
    await page.focus(selector); assert(await page.$eval(selector, node => node === document.activeElement));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'header-persona-' + width + '.png') }); }
  }
  await page.select(selector, ''); await page.setViewport({ width: 1600, height: 1000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('tsaat.active-persona')), null);
  assert.deepEqual(await page.evaluate(async () => (await (await fetch('/api/settings/personas')).json()).settings), saved, 'Selection never writes saved definitions');
  console.log('Header personas passed: saved values, keyboard selection, reload, All sections, scope/date retention and narrow layouts.');
  return saved;
}
