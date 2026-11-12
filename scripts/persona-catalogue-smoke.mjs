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
  const select = '.workspace-header .persona-selector select';
  const open = async () => page.waitForSelector(select + ':not([disabled])');
  try {
    await page.reload({ waitUntil: "networkidle0" }); await open();
    assert.deepEqual(await page.$$eval(select + " option", nodes => nodes.slice(1).map(node => [node.value, node.textContent])), settings.personas.map(persona => [persona.id, persona.label]));
    await page.select(select, "source-defined");
    assert.equal(await page.$eval("[data-active-persona]", node => node.textContent), settings.personas[0].label);
    assert.equal(await page.$(".workspace-group-toggle"), null, "An empty persona still hides navigation");
    settings = { ...original, personas: [] };
    await page.reload({ waitUntil: "networkidle0" }); await open();
    assert.equal(await page.$$eval(select + " option", nodes => nodes.length), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("tsaat.active-persona")), null);
    assert.equal(await page.$eval(select, node => node.value), "");
    fail = true;
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector(".persona-selector .persona-action:not([disabled])");
    assert.equal(await page.$eval(".persona-selector .persona-action", node => node.textContent), "Retry loading personas");
    assert.equal(await page.$(".persona-selector [role=alert]"), null, "Persona load failures keep the header recovery button without an error paragraph.");
    assert.equal(await page.$eval(".workspace-header", node => node.textContent.includes("Persona settings are unavailable. Retry to load the saved visibility.")), false);
    assert.equal(await page.$eval('.workspace-navigation p[role="status"]', node => node.textContent), "Retry loading personas button in the header.");
    fail = false; settings = original;
    await page.focus(".persona-selector .persona-action"); await page.keyboard.press("Enter");
    await page.waitForSelector(".persona-selector .persona-action", { hidden: true });
    await page.waitForSelector(select + ":not([disabled])");
    assert.equal(await page.$$eval(select + " option", nodes => nodes.length), original.personas.length + 1);
    assert.deepEqual(mutations, []);
    console.log("Read-only persona catalogue passed: source names/order, restricted/empty catalogues, deleted selection and load/retry recovery.");
  } finally {
    page.off("request", intercept); await page.setRequestInterception(false);
    await page.evaluate(value => { if (value === null) localStorage.removeItem("tsaat.active-persona"); else localStorage.setItem("tsaat.active-persona", value); }, previous);
    await page.goto(url, { waitUntil: "networkidle0" });
  }
}
