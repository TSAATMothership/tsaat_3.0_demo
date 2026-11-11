import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export async function checkLifeCycleManagement(page, { date, historicalDate, artifacts } = {}) {
  const base = new URL(page.url()).origin;
  const visit = async (scope = "network=net-1", snapshot = date) => {
    await page.goto(`${base}/discovery-coverage?discoveryView=life-cycle-management&${scope}&dataDate=${snapshot}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-lifecycle-page]");
  };
  const metric = key => page.$eval(`[data-lifecycle-metric="${key}"] strong`, node => Number(node.textContent.replaceAll(",", "")));
  const count = () => page.$eval(".lifecycle-table .endpoint-toolbar h2 span", node => Number(node.textContent.replaceAll(",", "")));
  await visit();
  assert.equal(await page.$eval(".lifecycle-hero h1", node => node.textContent), "Life Cycle Management");
  assert(await page.$('#workspace-navigation a[aria-current="page"][href*="life-cycle-management"]'));
  assert.equal(await count(), await metric("servers"));
  const priorities = await page.$$eval(".lifecycle-area-count", nodes => nodes.map(node => Number(node.textContent.split(" / ")[0])));
  assert(priorities.length > 0, "Sample fixture exercises server priorities");
  assert(priorities.every((value, i) => !i || value <= priorities[i - 1]));
  for (const key of ["warranty", "software", "os"]) {
    const expected = await metric(key);
    await page.click(`[data-lifecycle-metric="${key}"]`);
    await page.waitForFunction(expected => Number(document.querySelector(".lifecycle-table .endpoint-toolbar h2 span")?.textContent.replaceAll(",", "")) === expected, {}, expected);
    assert.equal(await count(), expected);
  }
  assert.equal(await page.$eval('select[aria-label="Lifecycle records"]', node => node.value), "n-2");
  assert(await page.$$eval('.lifecycle-table tbody tr[data-lifecycle-row] td:nth-child(4)', nodes => nodes.every(node => Number(node.textContent.trim().slice(2)) >= 2)));
  await page.select('select[aria-label="Lifecycle records"]', "unknown");
  await page.waitForFunction(() => document.querySelector('select[aria-label="Lifecycle records"]')?.value === "unknown");
  await page.focus('[role=tab][aria-selected=true]'); await page.keyboard.press("Home");
  await page.waitForFunction(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent === "Servers to prioritise");
  assert.equal(await page.$eval('[role=tab][aria-selected=true]', node => node === document.activeElement), true);
  // Export exactly the searched rows, with the resolved snapshot in the filename.
  const server = await page.$eval('.lifecycle-table [data-cmdb-asset-id]', node => node.textContent);
  await page.type('input[aria-label="Search servers to prioritise table"]', server);
  await page.waitForFunction(() => document.querySelector('.lifecycle-table tbody tr[data-lifecycle-row]'));
  await page.evaluate(() => {
    window.__lifecycleOriginalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download.startsWith("life-cycle-")) window.__lifecycleCsv = fetch(this.href).then(response => response.text()).then(text => ({ text, filename: this.download }));
      else window.__lifecycleOriginalClick.call(this);
    };
  });
  try {
    await page.click('.lifecycle-table .endpoint-export');
    const exported = await page.evaluate(() => window.__lifecycleCsv);
    assert.equal(exported.filename, `life-cycle-servers-${date}.csv`);
    assert(exported.text.includes(server)); assert(exported.text.startsWith("Attention,Server,"));
  } finally { await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__lifecycleOriginalClick; delete window.__lifecycleOriginalClick; delete window.__lifecycleCsv; }); }
  await page.click('.lifecycle-table [data-cmdb-asset-id]');
  await page.waitForSelector('dialog[aria-labelledby="cmdb-drill-through-title"][open]');
  await page.keyboard.press("Escape");
  await page.waitForSelector('dialog[aria-labelledby="cmdb-drill-through-title"][open]', { hidden: true });
  await visit();
  if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, "life-cycle-desktop.png") }); }
  await page.setViewport({ width: 390, height: 844 });
  const sidebarWasOpen = await page.$eval('.sidebar-toggle', node => node.getAttribute('aria-expanded') === 'true');
  if (sidebarWasOpen) await page.click('.sidebar-toggle');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 56);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert(await page.$eval('.lifecycle-hero', node => { const bounds = node.getBoundingClientRect(); return bounds.width > 300 && bounds.right <= innerWidth; }));
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "life-cycle-narrow.png") });
  await page.$eval('.lifecycle-priority', node => node.scrollIntoView({ block: 'start' }));
  assert(await page.$$eval('.lifecycle-priority-card', nodes => nodes.every(node => node.getBoundingClientRect().right <= innerWidth)));
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "life-cycle-narrow-priorities.png") });
  await page.setViewport({ width: 1600, height: 1000 });
  if (sidebarWasOpen) await page.click('.sidebar-toggle');
  await visit("system=sys-1", historicalDate ?? date);
  assert.equal(await page.$eval('.lifecycle-snapshot strong', node => node.textContent), historicalDate ?? date);
  await visit("network=missing-network");
  assert.equal(await metric("servers"), 0); assert.equal(await count(), 0);
  assert(await page.$(".lifecycle-no-priority"));
  await visit("network=net-1&securityDomain=NONE");
  assert.equal(await metric("servers"), 0);
  await visit();
  console.log("Life Cycle Management browser checks passed: ranked servers, reconciled issue counts, tabs/keyboard, CSV, CMDB, historical scope, empty states and narrow layout.");
}
