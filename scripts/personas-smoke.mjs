import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Saved persona selection, read-only permissions, keyboard and responsive layout. */
export async function checkPersonas(page, { artifacts } = {}) {
  const url = page.url(), dialog = "dialog.settings-popup[open]", panel = "#settings-panel-personas";
  const selector = panel + " .persona-selector select";
  const saved = await page.evaluate(async () => (await (await fetch("/api/settings/personas")).json()).settings);
  const press = async control => { await page.focus(control); await page.keyboard.press("Enter"); };
  const open = async () => {
    await press(".workspace-header-menu summary"); await press(".workspace-header-menu nav button");
    await page.waitForSelector(dialog);
    await page.waitForSelector("#settings-tab-personas[aria-selected=true]");
    await page.waitForSelector(selector + ":not([disabled])");
    assert.equal(await page.$("#settings-tab-database-settings"), null);
    assert.equal(await page.$("#workspace-navigation select"), null);
    assert.equal(await page.$(".workspace-header select"), null);
  };
  const close = async () => {
    await page.keyboard.press("Escape"); await page.waitForSelector(dialog, { hidden: true });
    await page.waitForFunction(() => document.activeElement === document.querySelector(".workspace-header-menu summary"));
  };
  await open();
  for (const persona of saved.personas) {
    await page.select(selector, persona.id);
    await page.waitForFunction(label => document.querySelector("[data-active-persona]")?.textContent === label, {}, persona.label);
    assert.equal(await page.$eval("[data-persona-name]", node => node.textContent), persona.label);
    assert(await page.$$eval(panel + " input[type=checkbox]", nodes => nodes.length > 0 && nodes.every(node => node.disabled)));
    for (const control of ["[data-add-persona]", "[data-remove-persona]", "[data-save-personas]", 'input[type="text"]'])
      assert.equal(await page.$(panel + " " + control), null);
  }
  if (saved.personas.length) {
    await page.select(selector, saved.personas[0].id);
    await close(); await page.reload({ waitUntil: "networkidle0" }); await open();
    assert.equal(await page.$eval(selector, node => node.value), saved.personas[0].id, "Selection survives reload");
    if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
    for (const [width, height] of [[1600, 1000], [1366, 768], [800, 600], [390, 844], [390, 667], [320, 667]]) {
      await page.setViewport({ width, height });
      const expected = await page.$$eval(panel + " input[type=checkbox]", nodes => nodes.length), reached = new Set();
      for (const view of await page.$$eval(".persona-permission-picker option", nodes => nodes.map(node => node.value))) {
        if (await page.$eval(".persona-permission-picker", node => node.getClientRects().length > 0))
          await page.select(".persona-permission-picker select", view);
        else await press("#persona-permissions-tab-" + view);
        for (let index = 0; index < 8; index++) {
          for (const label of await page.$$eval(panel + " input[type=checkbox]", nodes => nodes.filter(node => node.getClientRects().length > 0).map(node => node.getAttribute("aria-label")))) reached.add(label);
          const next = await page.$('[aria-label="Next permissions"]');
          if (!next || await next.evaluate(node => !node.getClientRects().length || node.disabled)) break;
          await press('[aria-label="Next permissions"]');
        }
      }
      assert.equal(reached.size, expected, "Every saved permission remains reachable");
      assert(await page.$eval(dialog, node => node.scrollWidth <= node.clientWidth + 1), "Settings fit narrow viewports");
      if (artifacts) await page.screenshot({ path: path.join(artifacts, "personas-" + width + "x" + height + ".png") });
    }
    await page.setViewport({ width: 1600, height: 1000 });
    await press("#persona-permissions-tab-governance"); await page.keyboard.press("End");
    assert(await page.$eval("#persona-permissions-tab-popups", node => node === document.activeElement && node.getAttribute("aria-selected") === "true"));
    await page.keyboard.press("Home");
    assert(await page.$eval("#persona-permissions-tab-governance", node => node === document.activeElement && node.getAttribute("aria-selected") === "true"));
  }
  await page.select(selector, "");
  await close();
  assert.equal(page.url(), url, "Selection and closing preserve route, scope and snapshot");
  const after = await page.evaluate(async () => (await (await fetch("/api/settings/personas")).json()).settings);
  assert.deepEqual(after, saved, "Viewing and selecting must not alter saved permissions");
  console.log("Read-only Personas passed: saved values, selection/reload, all permissions reachable, keyboard, narrow layouts and focus return.");
  return saved;
}
