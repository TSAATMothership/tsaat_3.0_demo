import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export async function checkReadOnlySettings(page, { artifacts } = {}) {
  const original = page.url(), origin = new URL(original).origin, query = new URL(original).searchParams;
  query.set("settingsTab", "database-settings");
  await page.goto(origin + "/settings?" + query, { waitUntil: "networkidle0" });
  await page.waitForSelector("#settings-tab-personas[aria-selected=true]");
  const ids = ["personas", "discovery-tools-settings"];
  assert.deepEqual(await page.$$eval('[aria-label="Settings sections"] [role=tab]', nodes => nodes.map(node => node.id)), ids.map(id => "settings-tab-" + id));
  await page.focus("#settings-tab-personas"); await page.keyboard.press("End");
  await page.waitForSelector("#settings-panel-discovery-tools-settings table");
  assert(await page.$eval("#settings-tab-discovery-tools-settings", node => node === document.activeElement));
  await page.keyboard.press("Home");
  assert(await page.$eval("#settings-tab-personas", node => node === document.activeElement));
  const discovery = await page.evaluate(async () => (await (await fetch("/api/discovery-tools/settings")).json()).settings);
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  for (const tab of ids.slice(1)) {
    await page.click("#settings-tab-" + tab);
    const panel = "#settings-panel-" + tab;
    await page.waitForSelector(panel + " table");
    assert((await page.$eval(panel, node => node.textContent)).includes("Read-only"));
    assert.equal(await page.$(panel + " select"), null);
    assert.equal(await page.$(panel + 'input[type="number"]'), null);
    assert(await page.$$eval(panel + " button", nodes => nodes.every(node => !/save|reset|cancel/i.test(node.textContent))));
    {
      assert.equal(await page.$$eval(panel + " tbody tr", nodes => nodes.length), discovery.tools.length);
      await page.click(panel + ' button[aria-haspopup="listbox"]');
      await page.type(panel + ' input[type="search"]', "no-such-tool-98765");
      await page.waitForFunction(() => document.querySelector("#settings-panel-discovery-tools-settings")?.textContent.includes("No matching tool names"));
      await page.keyboard.press("Escape");
      assert(await page.$("dialog.settings-popup[open]"), "Filter Escape must not close Settings");
    }
    for (const [width, height] of [[1366, 768], [390, 844]]) {
      await page.setViewport({ width, height });
      const region = panel + " [role=region]";
      await page.focus(region); await page.keyboard.press("End");
      assert(await page.$eval("dialog.settings-popup", node => node.scrollWidth <= node.clientWidth + 1));
      if (artifacts) await page.screenshot({ path: path.join(artifacts, tab + "-" + width + ".png") });
    }
    await page.setViewport({ width: 1600, height: 1000 });
  }
  await page.keyboard.press("Escape");
  assert.equal(new URL(page.url()).searchParams.get("network"), query.get("network"));
  assert.equal(new URL(page.url()).searchParams.get("dataDate"), query.get("dataDate"));
  await page.goto(original, { waitUntil: "networkidle0" });
  console.log("Read-only Settings passed: two tabs, legacy links, saved mappings, filtering, keyboard scrolling and mobile layout.");
}
