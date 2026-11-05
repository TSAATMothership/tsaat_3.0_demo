import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Settings, real persistence, sidebar visibility and keyboard recovery in the compiled app. */
export async function checkPersonas(page, { artifacts } = {}) {
  const selector = "#settings-panel-personas .persona-selector select";
  const dialog = "dialog.settings-popup[open]";
  const panel = "#settings-panel-personas";
  const press = async control => { await page.focus(control); await page.keyboard.press("Enter"); };
  const groups = () => page.$$eval(".workspace-group-toggle span", nodes => nodes.map(node => node.textContent));
  const open = async (waitForSettings = true) => {
    await press(".workspace-header-menu summary"); await press(".workspace-header-menu nav button");
    await page.waitForSelector(dialog);
    await page.focus("#settings-tab-database-settings"); await page.keyboard.press("ArrowRight");
    await page.waitForSelector("#settings-tab-personas[aria-selected=true]");
    assert.equal(await page.$eval("#settings-tab-personas", node => node === document.activeElement), true);
    if (waitForSettings) await page.waitForSelector(panel + " .personas-save-bar");
    assert.equal(await page.$("#workspace-navigation select"), null, "Persona selection is only available in Settings");
    assert.equal(await page.$(".workspace-header select"), null, "The header persona is read-only");
  };
  const close = async () => {
    await page.keyboard.press("Escape"); await page.waitForSelector(dialog, { hidden: true });
    await page.waitForFunction(() => document.activeElement === document.querySelector(".workspace-header-menu summary"));
  };
  const personas = [["analyst", "Analyst"], ["life-cycle-management", "Life Cycle Management"], ["configuration-management", "Configuration Management"], ["dsoc-analyst", "DSOC Analyst"], ["business-reporting", "Business Reporting"]];
  const choose = async value => {
    await page.select(selector, value);
    const label = personas.find(([id]) => id === value)?.[1];
    await page.waitForFunction(label => document.querySelector("[data-active-persona]")?.textContent === label, {}, label ?? "All sections (no persona)");
    assert.deepEqual(await page.$$eval(panel + " .persona-card > legend", nodes => nodes.map(node => node.textContent)), label ? [label] : [], "Only the selected persona is configured");
  };
  const selectPersona = async value => { await open(); await choose(value); await close(); };
  const check = (persona, section) => `${panel} input[aria-label="${persona}: ${section}"]`;
  const showPermissionView = async id => {
    const compact = await page.$eval(".persona-permission-picker", node => node.getClientRects().length > 0);
    if (compact) await page.select(".persona-permission-picker select", id);
    else await press(`#persona-permissions-tab-${id}`);
  };
  const revealPermission = async (persona, label) => {
    const viewLabel = label.startsWith("Popup / ") ? "Popups" : label.split(" / ")[0];
    const viewId = await page.$$eval(".persona-permission-picker option", (nodes, label) => nodes.find(node => node.textContent === label).value, viewLabel);
    await showPermissionView(viewId);
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await page.$eval(check(persona, label), node => node.getClientRects().length > 0)) return;
      await press('[aria-label="Next permissions"]');
    }
    throw new Error(`Permission is not reachable: ${label}`);
  };
  const togglePermission = async (persona, label) => {
    await revealPermission(persona, label);
    await page.focus(check(persona, label)); await page.keyboard.press("Space");
  };
  const assertNoVerticalScroll = async () => {
    const overflow = await page.$$eval(`${dialog}, ${dialog} .settings-popup-body, ${panel} .personas-settings`, nodes => nodes.filter(node => node.scrollHeight > node.clientHeight + 1).map(node => ({ className: node.className, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight })));
    if (overflow.length && artifacts) {
      fs.mkdirSync(artifacts, { recursive: true });
      await page.screenshot({ path: path.join(artifacts, "personas-layout-overflow.png") });
    }
    assert.deepEqual(overflow, [], `Personas fits without vertical scrolling at ${page.viewport().width}×${page.viewport().height}`);
    assert(await page.$eval('[data-save-personas]', node => {
      const bounds = node.getBoundingClientRect(), modal = node.closest("dialog").getBoundingClientRect();
      return bounds.top >= modal.top && bounds.bottom <= modal.bottom;
    }), "Save remains visible without scrolling");
  };
  const url = page.url();
  const originalScope = new URL(url).search;
  await open();
  assert.equal(await page.$(panel + " .persona-card"), null, "No persona starts with an explanation instead of all editors");
  assert(await page.$(panel + " .persona-empty"));
  assert(await page.$eval(".workspace-persona", node => node.nextElementSibling.querySelector('button[aria-controls="security-domain-options"]') !== null), "Persona is immediately before Security Domain");
  await choose("analyst");
  assert.equal(await page.$$eval(panel + " input[type=checkbox]", nodes => nodes.length), 39);
  assert.equal(await page.$('input[aria-label="Analyst: Governance / Overview"]'), null);
  assert(await page.$('input[aria-label="Analyst: Discovery / Overview"]'), "Discovery Overview remains configurable");
  // Space toggles a labelled checkbox; discard returns to the saved state.
  await togglePermission("Analyst", "Governance");
  assert.equal(await page.$eval(check("Analyst", "Governance"), node => node.checked), false);
  await choose("life-cycle-management");
  assert.equal(await page.$eval(check("Life Cycle Management", "Governance"), node => node.checked), true, "Editing one persona does not edit another");
  await choose("");
  await choose("analyst");
  assert.equal(await page.$eval(check("Analyst", "Governance"), node => node.checked), false, "Switching personas and no-persona retains drafts");
  await page.$$eval(panel + " button", nodes => nodes.find(node => node.textContent === "Discard changes").click());
  assert.equal(await page.$eval(check("Analyst", "Governance"), node => node.checked), true);
  for (const [id] of personas) {
    await choose(id);
    await press("[data-persona-hide-all]");
  }
  for (const [persona, section] of [["Analyst", "Discovery"], ["Analyst", "Briefs & Reports"], ["Life Cycle Management", "Findings"], ["Configuration Management", "Governance"], ["Business Reporting", "Briefs & Reports"]]) {
    await choose(personas.find(([, label]) => label === persona)[0]);
    await togglePermission(persona, section);
  }
  await choose("analyst");
  // Switching Settings tabs retains the unsaved draft.
  await press("#settings-tab-database-settings"); await press("#settings-tab-personas");
  assert.equal(await page.$eval(check("Analyst", "Governance"), node => node.checked), false);
  let failSave = true;
  await page.setRequestInterception(true);
  const saveFailure = request => {
    if (failSave && request.url().endsWith("/api/settings/personas") && request.method() === "PUT") {
      failSave = false;
      void request.respond({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Simulated save failure. Retry." }) });
    } else void request.continue();
  };
  page.on("request", saveFailure);
  try {
    await press("[data-save-personas]");
    await page.waitForFunction(() => document.querySelector("#settings-panel-personas [role=alert]")?.textContent.includes("Simulated"));
    assert.equal(await page.$eval(check("Analyst", "Governance"), node => node.checked), false);
    await assertNoVerticalScroll();
    assert((await groups()).includes("Governance"), "Failed saves do not change the sidebar");
    await press("[data-save-personas]");
    await page.waitForFunction(() => document.querySelector("#settings-panel-personas")?.textContent.includes("Personas saved"));
  } finally { page.off("request", saveFailure); await page.setRequestInterception(false); }
  assert.deepEqual(await groups(), ["Discovery"]);
  assert.equal(await page.$eval(".workspace-direct-links a", node => node.textContent), "Briefs & Reports");
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  for (const [width, height, name] of [[1600, 1000, "desktop"], [1366, 768, "laptop"], [1024, 768, "tablet"], [900, 700, "small-window"], [800, 600, "short-window"], [390, 844, "narrow"], [390, 667, "short-phone"]]) {
    await page.setViewport({ width, height });
    const reached = new Set();
    for (const view of await page.$$eval(".persona-permission-picker option", nodes => nodes.map(node => node.value))) {
      await showPermissionView(view);
      for (let index = 0; index < 4; index++) {
        await assertNoVerticalScroll();
        for (const label of await page.$$eval(panel + " input[type=checkbox]", nodes => nodes.filter(node => node.getClientRects().length > 0).map(node => node.getAttribute("aria-label")))) reached.add(label);
        const next = await page.$('[aria-label="Next permissions"]');
        if (!next || await next.evaluate(node => !node.getClientRects().length || node.disabled)) break;
        await press('[aria-label="Next permissions"]');
      }
    }
    assert.equal(reached.size, 39, "Every section, page and popup remains reachable without scrolling");
    await showPermissionView("discovery");
    assert(await page.$eval(panel, node => node.scrollWidth <= node.clientWidth + 1), "Persona settings fit the viewport width");
    assert(await page.$eval(dialog, node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }));
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `personas-${name}.png`) });
  }
  await togglePermission("Analyst", "Discovery / Shadow IT Explorer");
  await showPermissionView("popups");
  await revealPermission("Analyst", "Discovery / Shadow IT Explorer");
  assert.equal(await page.$eval(check("Analyst", "Discovery / Shadow IT Explorer"), node => node.checked), false, "Paging and view changes retain edits");
  await page.$$eval(panel + " button", nodes => nodes.find(node => node.textContent === "Discard changes").click());
  assert.equal(await page.$eval(check("Analyst", "Discovery / Shadow IT Explorer"), node => node.checked), true);
  await page.setViewport({ width: 1600, height: 1000 });
  await press("#persona-permissions-tab-governance"); await page.keyboard.press("End");
  assert(await page.$eval("#persona-permissions-tab-popups", node => node === document.activeElement && node.getAttribute("aria-selected") === "true"));
  await page.keyboard.press("Home");
  assert(await page.$eval("#persona-permissions-tab-governance", node => node === document.activeElement && node.getAttribute("aria-selected") === "true"));
  await close();
  assert.equal(page.url(), url, "Saving and closing preserve the active view, domain, scope and snapshot");
  await selectPersona("life-cycle-management"); assert.deepEqual(await groups(), ["Findings"]);
  assert.equal(await page.$(".workspace-direct-links"), null);
  await selectPersona("configuration-management"); assert.deepEqual(await groups(), ["Governance"]);
  await page.setViewport({ width: 390, height: 844 });
  assert(await page.$eval(".workspace-header", node => node.scrollWidth <= node.clientWidth + 1), "Header fits narrow screens");
  assert(await page.$eval(".workspace-persona", node => node.getBoundingClientRect().right <= node.nextElementSibling.getBoundingClientRect().left), "Persona sits to the left of Security Domain on narrow screens");
  assert(await page.$eval("[data-active-persona]", node => node.scrollWidth <= node.clientWidth + 1 && node.getBoundingClientRect().right <= innerWidth), "The full persona name fits beside Security Domain");
  // The neighbouring scope popovers still fit and keyboard Escape returns focus.
  for (const id of ["security-domain-options", "managed-network-options", "ict-system-options"]) {
    await press(`[aria-controls="${id}"]`);
    assert(await page.$eval(`#${id}`, node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), `${id} fits with the persona label`);
    await page.keyboard.press("Escape");
    assert(await page.$eval(`[aria-controls="${id}"]`, node => node === document.activeElement));
  }
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "personas-header-narrow.png") });
  await page.setViewport({ width: 1600, height: 1000 });
  assert(await page.$eval(".workspace-persona", node => node.getBoundingClientRect().right <= node.nextElementSibling.getBoundingClientRect().left), "Persona sits to the left of Security Domain on desktop");
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "personas-header-desktop.png") });
  await selectPersona("dsoc-analyst");
  assert.deepEqual(await groups(), []);
  assert.equal(await page.$("#workspace-navigation a"), null);
  assert((await page.$eval("#workspace-navigation", node => node.textContent)).includes("No sections are enabled"));
  // Even with nothing visible, Menu / Settings stays available and can be reopened.
  await open(); assert.equal(await page.$eval(check("DSOC Analyst", "Discovery"), node => node.checked), false); await close();
  await selectPersona("business-reporting");
  assert.deepEqual(await groups(), []);
  assert.equal(await page.$eval(".workspace-direct-links a", node => node.textContent), "Briefs & Reports");
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval("[data-active-persona]", node => node.textContent), "Business Reporting");
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "personas-business-reporting-header.png") });
  await open();
  assert.equal(await page.$eval(selector, node => node.value), "business-reporting");
  assert.equal(await page.$eval(check("Business Reporting", "Briefs & Reports"), node => node.checked), true);
  assert.equal(await page.$eval(check("Business Reporting", "Discovery"), node => node.checked), false);
  assert.equal(await page.$eval(check("Business Reporting", "Popup / CMDB details"), node => node.checked), false);
  if (artifacts) {
    await page.$eval(panel, node => { node.parentElement.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, "personas-business-reporting-settings.png") });
  }
  await close();
  await selectPersona("analyst");
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval("[data-active-persona]", node => node.textContent), "Analyst", "Header restores the browser selection");
  await open();
  assert.equal(await page.$eval(selector, node => node.value), "analyst");
  await close();
  assert.deepEqual(await groups(), ["Discovery"]);
  assert.equal(new URL(page.url()).search, originalScope);
  // Fresh load error is explicit; retry recovers the persisted selection instead of resetting it.
  let failLoad = true;
  await page.setRequestInterception(true);
  const loadFailure = request => {
    if (failLoad && request.url().endsWith("/api/settings/personas") && request.method() === "GET") {
      failLoad = false; void request.respond({ status: 500, contentType: "application/json", body: "{}" });
    } else void request.continue();
  };
  page.on("request", loadFailure);
  try {
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.querySelector("#workspace-navigation")?.textContent.includes("personas are unavailable"));
    await open(false);
    await press(panel + " button");
    await page.waitForFunction(() => document.querySelectorAll(".workspace-group-toggle").length === 1);
    assert.deepEqual(await groups(), ["Discovery"]);
    await close();
  } finally { page.off("request", loadFailure); await page.setRequestInterception(false); }
  // Page and popup switches are independent. A partly selected section is announced as mixed.
  await open();
  await togglePermission("Analyst", "Discovery / End Point Explorer");
  await togglePermission("Analyst", "Popup / CMDB details");
  assert.equal(await page.$eval(check("Analyst", "Discovery"), node => node.indeterminate), true);
  await press("[data-save-personas]");
  await page.waitForFunction(() => document.querySelector("#settings-panel-personas")?.textContent.includes("Personas saved"));
  await close();
  assert.equal(await page.$('#workspace-navigation a[href*="discoveryView=endpoints"]'), null);
  assert(await page.$('#workspace-navigation a[href*="discoveryView=overview"]'));
  const origin = new URL(url).origin;
  const scope = new URLSearchParams(originalScope);
  // These drill-through fixtures need populated sample rows; the original scoped URL is restored below.
  scope.set("network", "net-1"); scope.delete("system"); scope.set("securityDomain", "PROTECTED,SECRET,UNKNOWN");
  const visit = async (pathname, extra = {}) => {
    const query = new URLSearchParams(scope); for (const [key, value] of Object.entries(extra)) query.set(key, value);
    await page.goto(`${origin}${pathname}?${query}`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => !document.querySelector("#workspace-navigation")?.textContent.includes("Loading personas"));
  };
  await visit("/discovery-coverage", { discoveryView: "overview" });
  const disabledLink = '.discovery-overview a[data-persona-disabled="true"]';
  await page.waitForSelector(disabledLink);
  assert(await page.$eval(disabledLink, node => node.getAttribute("aria-disabled") === "true" && !node.hasAttribute("href") && node.tabIndex === -1));
  const overviewUrl = page.url();
  await page.$eval(disabledLink, node => node.click());
  assert.equal(page.url(), overviewUrl);
  assert(await page.$('.discovery-overview a[href*="discoveryView=installed-software"]'), "Other Discovery pages still work");
  // Existing direct URLs still load; their new-tab drill-throughs follow the destination permission.
  await visit("/network-risk-profile");
  await press("#network-risk-tab-explorer");
  await page.waitForSelector('.network-risk-name + td + td a');
  assert(await page.$eval('.network-risk-name + td + td a', node => !node.hasAttribute("href") && node.getAttribute("aria-disabled") === "true"));
  await visit("/discovery-coverage", { discoveryView: "endpoints" });
  const cmdb = '[data-cmdb-asset-id]';
  await page.waitForSelector(cmdb + ':not([disabled])');
  await page.click(cmdb);
  await page.waitForSelector('dialog[aria-labelledby="cmdb-drill-through-title"][open]');
  await page.keyboard.press("Escape");
  await page.waitForSelector('dialog[aria-labelledby="cmdb-drill-through-title"][open]', { hidden: true });
  await open();
  await togglePermission("Analyst", "Popup / CMDB details");
  await togglePermission("Analyst", "Popup / Service impact graph");
  await press("[data-save-personas]");
  await page.waitForFunction(() => document.querySelector("#settings-panel-personas")?.textContent.includes("Personas saved"));
  await close();
  assert(await page.$eval(cmdb, node => node.disabled));
  await visit("/cyber-cop", { copView: "impact" });
  assert(await page.$eval('[data-persona-popup="impact-details"]', node => node.disabled));
  await page.click('[data-explore-service-impact]');
  await page.waitForSelector('dialog.service-impact-graph-popup[open]');
  assert.equal(await page.$eval('[data-impact-toggle-controls]', node => node.getAttribute("aria-expanded")), "false");
  await page.keyboard.press("Escape");
  await page.waitForSelector('dialog.service-impact-graph-popup[open]', { hidden: true });
  await open();
  await togglePermission("Analyst", "Popup / Service impact graph");
  await press("[data-save-personas]");
  await page.waitForFunction(() => document.querySelector("#settings-panel-personas")?.textContent.includes("Personas saved"));
  await close();
  assert(await page.$eval('[data-explore-service-impact]', node => node.disabled));
  await page.$eval('[data-explore-service-impact]', node => node.click());
  assert.equal(await page.$('dialog.service-impact-graph-popup[open]'), null);
  await selectPersona("");
  await page.goto(url, { waitUntil: "networkidle0" });
  assert.deepEqual(await groups(), ["Governance", "Cyber Security", "Discovery", "Observed Measures", "Findings"]);
  const saved = await page.evaluate(async () => (await (await fetch("/api/settings/personas")).json()).settings);
  console.log("Personas browser checks passed: all five personas including Business Reporting, one persona editor, draft retention across selections, read-only header selection, section/page selection, disabled drill-throughs, independent popup controls, keyboard editing, save/retry, empty sidebar recovery, reload persistence, scope retention and narrow settings/header/popovers.");
  return saved;
}
