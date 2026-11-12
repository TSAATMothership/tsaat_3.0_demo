import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Retired bookmarks stay usable; ordinary header scope/date and navigation remain live. */
export async function checkSettingsRetirement(page, { date, historicalDate, artifacts }) {
  const original = page.url(), base = new URL(original).origin;
  const absent = async () => {
    assert.equal(await page.$('.workspace-header-menu'), null);
    assert.equal(await page.$('dialog.settings-popup'), null);
    assert.equal(await page.$('.workspace-header [aria-label="Main menu"]'), null);
    assert(await page.$('.workspace-header [aria-label="Active persona"]'));
    assert(await page.$('.workspace-header [aria-label="Data date"]'));
  };
  await absent();
  for (const tab of ['', 'personas', 'discovery-tools-settings', 'database-settings', 'password-settings']) {
    const query = new URLSearchParams({ settingsTab: tab, network: 'net-1', securityDomain: 'UNKNOWN', dataDate: historicalDate });
    await page.goto(`${base}/settings?${query}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true }); await absent();
    assert.match(await page.$eval('main', node => node.textContent), /This feature has been retired/);
    const target = new URL(await page.$eval('main a.endpoint-export', node => node.href));
    for (const field of ['network', 'securityDomain', 'dataDate']) assert.equal(target.searchParams.get(field), query.get(field));
    assert.equal(target.searchParams.get('settingsTab'), null);
  }
  await page.focus('main a.endpoint-export'); await page.keyboard.press('Enter');
  await page.waitForSelector('.endpoint-explorer');
  assert.equal(new URL(page.url()).searchParams.get('dataDate'), historicalDate);
  await page.goto(`${base}/discovery-coverage?discoveryView=endpoints&network=net-1&securityDomain=UNKNOWN&dataDate=${date}`, { waitUntil: 'networkidle0' });
  const dateInput = '[aria-label="Data date"]';
  await page.$eval(dateInput, (node, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); }, historicalDate);
  await page.waitForFunction(expected => new URL(location.href).searchParams.get('dataDate') === expected, {}, historicalDate);
  await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  assert.equal(new URL(page.url()).searchParams.get('network'), 'net-1'); assert.equal(new URL(page.url()).searchParams.get('securityDomain'), 'UNKNOWN');
  await page.focus('[aria-label^="Security Domain:"]'); await page.keyboard.press('Enter');
  await page.waitForSelector('#security-domain-options'); await page.keyboard.press('Escape');
  assert(await page.$eval('[aria-label^="Security Domain:"]', node => node === document.activeElement));
  for (const width of [1600, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Header without Menu fits the viewport');
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `header-no-menu-${width}.png`) }); }
  }
  await page.setViewport({ width: 1600, height: 1000 }); await page.goto(original, { waitUntil: 'networkidle0' });
  console.log('Menu/Settings retirement passed: no controls, legacy bookmarks, scoped return, date changes, keyboard focus and narrow layouts.');
}
