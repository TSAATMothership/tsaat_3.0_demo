import assert from "node:assert/strict";

/** Browser GET fixtures exercise source-defined/empty/error states without writing either provider. */
export async function checkPersonaCatalogue(page) {
  const url = page.url(), api = new URL("/api/settings/personas", url).href;
  const original = await page.evaluate(async api => (await (await fetch(api)).json()).settings, api);
  const previous = await page.evaluate(() => localStorage.getItem("tsaat.active-persona"));
  let settings = { ...original, personas: [{ id: "source-defined", label: "Reviewer's café $(literal)", sections: [], pages: [], popups: [] }, ...original.personas.toReversed()] }, fail = false;
  const mutations = [];
  await page.setRequestInterception(true);
  const intercept = request => {
    if (request.url() !== api) return void request.continue();
    if (request.method() !== "GET") { mutations.push(request.method()); return void request.abort(); }
    void request.respond({ status: fail ? 503 : 200, contentType: "application/json",
      body: JSON.stringify(fail ? { error: "Fixture unavailable. Retry." } : { settings }) });
  };
  page.on("request", intercept);
  const open = async () => {
    await page.click(".workspace-header-menu summary"); await page.click(".workspace-header-menu nav button");
    await page.waitForSelector("dialog.settings-popup[open]");
  };
  const close = async () => { await page.keyboard.press("Escape"); await page.waitForSelector("dialog.settings-popup[open]", { hidden: true }); };
  const select = "#settings-panel-personas .persona-selector select";
  try {
    await page.reload({ waitUntil: "networkidle0" }); await open();
    assert.deepEqual(await page.$$eval(select + " option", nodes => nodes.slice(1).map(node => [node.value, node.textContent])), settings.personas.map(persona => [persona.id, persona.label]));
    await page.select(select, "source-defined");
    assert.equal(await page.$$eval(".persona-card input:checked", nodes => nodes.length), 0);
    await close();
    assert.equal(await page.$eval("[data-active-persona]", node => node.textContent), settings.personas[0].label);
    assert.equal(await page.$(".workspace-group-toggle"), null, "An empty persona still hides navigation");
    settings = { ...original, personas: [] };
    await page.reload({ waitUntil: "networkidle0" }); await open();
    assert.equal(await page.$$eval(select + " option", nodes => nodes.length), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("tsaat.active-persona")), null);
    assert(await page.$(".persona-empty")); await close();
    fail = true;
    await page.reload({ waitUntil: "networkidle0" }); await open();
    await page.waitForSelector("#settings-panel-personas [role=alert]");
    fail = false; settings = original;
    await page.$$eval("#settings-panel-personas button", nodes => nodes.find(node => node.textContent === "Retry loading personas").click());
    await page.waitForSelector(select + ":not([disabled])");
    assert.equal(await page.$$eval(select + " option", nodes => nodes.length), original.personas.length + 1);
    await close(); assert.deepEqual(mutations, []);
    console.log("Read-only persona catalogue passed: source names/order, restricted/empty catalogues, deleted selection and load/retry recovery.");
  } finally {
    page.off("request", intercept); await page.setRequestInterception(false);
    await page.evaluate(value => { if (value === null) localStorage.removeItem("tsaat.active-persona"); else localStorage.setItem("tsaat.active-persona", value); }, previous);
    await page.goto(url, { waitUntil: "networkidle0" });
  }
}
