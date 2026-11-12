import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const personaSelect = '.workspace-header [aria-label="Active persona"]';
const dateInput = '.workspace-header [aria-label="Data date"]';
const scopes = [
  ["Security Domain", "security-domain-options"],
  ["Managed Network", "managed-network-options"],
  ["ICT System", "ict-system-options"]
];
const widths = [1600, 1366, 1024, 800, 781, 780, 760, 701, 390, 320];

/** Presentation and keyboard checks use read-only HTTP fixtures, never persisted settings. */
export async function checkHeaderLayout(page, { date, historicalDate, artifacts }) {
  const originalUrl = page.url(), origin = new URL(originalUrl).origin, originalViewport = page.viewport();
  const previousPersona = await page.evaluate(() => localStorage.getItem("tsaat.active-persona"));
  const source = await page.evaluate(async selected => {
    const [personaResponse, scopeResponse] = await Promise.all([
      fetch("/api/settings/personas"), fetch(`/api/workspace-options?dataDate=${selected}`)
    ]);
    if (!personaResponse.ok || !scopeResponse.ok) throw new Error("Header fixture source is unavailable.");
    return { settings: (await personaResponse.json()).settings, options: await scopeResponse.json() };
  }, date);
  assert(source.options.networks.length && source.options.systems.length, "Header smoke needs a network and ICT system.");
  const longPersona = "Cyber operations, enterprise resilience and executive mission service oversight";
  assert(longPersona.length <= 80, "Long persona fixture respects the stored catalogue's label limit.");
  const fixturePersona = { ...(source.settings.personas[0] ?? { id: "header-layout-review", sections: [], pages: [], popups: [] }), label: longPersona };
  const settings = { ...source.settings, personas: [fixturePersona, ...source.settings.personas.slice(1)] };
  const options = {
    networks: source.options.networks.map((option, index) => index ? option : { ...option, label: "Enterprise mission services and operational technology management network" }),
    systems: source.options.systems.map((option, index) => index ? option : { ...option, label: "Joint mission service coordination and enterprise information system" })
  };
  const network = options.networks[0].id, system = options.systems[0].id, mutations = [];
  let holdNextPersona = false, heldPersonaRequest;
  const intercept = request => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    if (url.origin !== origin || !["/api/settings/personas", "/api/workspace-options"].includes(url.pathname)) return void request.continue();
    if (request.method() !== "GET") { mutations.push(request.method()); return void request.abort(); }
    if (url.pathname === "/api/settings/personas" && holdNextPersona) {
      holdNextPersona = false; heldPersonaRequest = request;
      return;
    }
    void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname === "/api/settings/personas" ? { settings } : options) });
  };
  const ready = async () => {
    await page.waitForSelector(`${personaSelect}:not([disabled])`);
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    await page.waitForFunction(() => document.querySelectorAll('.workspace-scope-trigger').length === 3);
  };
  const capture = async name => {
    if (!artifacts) return;
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, name) });
  };
  const geometry = async (width, state) => {
    await page.setViewport({ width, height: 900 });
    // Two animation frames allow viewport layout and any open-panel repositioning to settle.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => {
      const rect = node => {
        const value = node.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
      };
      const frames = [document.querySelector(".workspace-persona"), ...document.querySelectorAll(".workspace-scope-trigger"), document.querySelector(".workspace-date")];
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        frames: frames.map(node => {
          const label = node.querySelector(".workspace-field-label");
          const value = node.querySelector('select, input[type="date"]') ?? label.nextElementSibling;
          return { frame: rect(node), label: rect(label), value: rect(value), name: label.textContent.trim(), labelOverflow: label.scrollWidth - label.clientWidth };
        })
      };
    });
    const context = `${state} at ${width}px`;
    assert(result.overflow <= 2, `${context}: the page must not scroll horizontally (${result.overflow}px).`);
    assert.deepEqual(result.frames.map(field => field.name), ["Persona", "Security Domain", "Managed Network", "ICT System", "Date"]);
    for (const field of result.frames) {
      assert(field.frame.height >= 44 && field.frame.width > 0, `${context}: ${field.name} remains usable.`);
      assert(field.frame.left >= -1 && field.frame.right <= width + 1, `${context}: ${field.name} fits the viewport.`);
      assert(field.labelOverflow <= 1, `${context}: ${field.name} label is not clipped.`);
      for (const [kind, box] of [["label", field.label], ["value", field.value]]) {
        assert(box.width > 0 && box.height > 0, `${context}: ${field.name} ${kind} is visible.`);
        assert(box.left >= field.frame.left - 1 && box.right <= field.frame.right + 1 && box.top >= field.frame.top - 1 && box.bottom <= field.frame.bottom + 1,
          `${context}: ${field.name} ${kind} stays inside its field frame.`);
      }
    }
    // The original controls have different heights and wrap naturally. Controls
    // sharing a visual row must have the same vertical centre, not equal frames.
    const rows = [];
    for (const field of result.frames) {
      const row = rows.find(items => items.some(item => Math.min(item.frame.bottom, field.frame.bottom) > Math.max(item.frame.top, field.frame.top)));
      if (row) row.push(field); else rows.push([field]);
    }
    if (width >= 1024) assert.equal(rows.length, 1, `${context}: all controls retain the original single-row arrangement.`);
    for (const row of rows) {
      const centres = row.map(field => (field.frame.top + field.frame.bottom) / 2);
      assert(Math.max(...centres) - Math.min(...centres) <= 1, `${context}: controls are vertically centred (${centres.join(", ")}).`);
      const ordered = row.toSorted((a, b) => a.frame.left - b.frame.left);
      ordered.slice(1).forEach((field, index) => assert(field.frame.left >= ordered[index].frame.right, `${context}: adjacent fields do not overlap.`));
    }
    await capture(`header-layout-${state}-${width}.png`);
  };
  const popupBounds = async (id, label, width) => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = await page.$eval(`#${id}`, node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, overflow: node.scrollWidth - node.clientWidth, viewportHeight: innerHeight };
    });
    assert(bounds.left >= -1 && bounds.right <= width + 1 && bounds.top >= -1 && bounds.bottom <= bounds.viewportHeight + 1,
      `${label} dropdown fits ${width}x${bounds.viewportHeight} viewport: ${JSON.stringify(bounds)}`);
    assert(bounds.overflow <= 1, `${label} dropdown content fits at ${width}px.`);
  };
  const dropdowns = async width => {
    for (const [label, id] of scopes) {
      const trigger = `.workspace-header [aria-label^="${label}:"]`;
      await page.focus(trigger); await page.keyboard.press("Enter");
      await page.waitForSelector(`#${id}`);
      assert(await page.$eval(`#${id} input[type="search"]`, node => node === document.activeElement), `${label} opens with search focused.`);
      await popupBounds(id, label, width);
      if ([320, 390, 1600].includes(width)) await capture(`header-layout-${id}-${width}.png`);
      await page.keyboard.press("Escape"); await page.waitForSelector(`#${id}`, { hidden: true });
      assert(await page.$eval(trigger, node => node === document.activeElement), `${label} restores keyboard focus on Escape.`);
    }
  };
  const compactDropdowns = async initialUrl => {
    const focusedControlIsVisible = async (id, description) => {
      const result = await page.$eval(`#${id}`, popup => {
        const node = document.activeElement, rect = node.getBoundingClientRect(), popupRect = popup.getBoundingClientRect();
        const list = node.closest(".workspace-scope-options"), listRect = list?.getBoundingClientRect();
        const left = Math.max(0, popupRect.left, listRect?.left ?? 0), right = Math.min(innerWidth, popupRect.right, listRect?.right ?? innerWidth);
        const top = Math.max(0, popupRect.top, listRect?.top ?? 0), bottom = Math.min(innerHeight, popupRect.bottom, listRect?.bottom ?? innerHeight);
        const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
        return { contained: popup.contains(node), visible: rect.width > 0 && rect.height > 0 && rect.left >= left - 1 && rect.right <= right + 1 && rect.top >= top - 1 && rect.bottom <= bottom + 1,
          uncovered: hit === node || node.contains(hit), name: node.getAttribute("aria-label") ?? node.outerHTML.slice(0, 160) };
      });
      assert(result.contained && result.visible && result.uncovered, `${description} is reachable and visible: ${JSON.stringify(result)}`);
    };
    for (const [label, id] of scopes) {
      await page.goto(initialUrl, { waitUntil: "networkidle0" }); await ready();
      await page.setViewport({ width: 1600, height: 900 });
      const trigger = `.workspace-header [aria-label^="${label}:"]`;
      await page.focus(trigger); await page.keyboard.press("Enter"); await page.waitForSelector(`#${id}`);
      let changed = false;
      for (const [width, height] of [[390, 600], [320, 568]]) {
        // Resize the already-open dropdown, including its pending Update row on the second resize.
        await page.setViewport({ width, height }); await popupBounds(id, label, width);
        assert.equal(await page.$eval(trigger, node => node.getAttribute("aria-expanded")), "true", `${label} remains open during resize.`);
        await page.focus(`#${id} input[type="search"]`);
        const count = await page.$$eval(`#${id} input[type="checkbox"]`, nodes => nodes.length);
        assert(count > 0, `${label} retains its fixture options in the short viewport.`);
        let reachedLast = false;
        for (let step = 0; step < count + 4; step++) {
          await page.keyboard.press("Tab");
          reachedLast = await page.$eval(`#${id}`, node => document.activeElement === Array.from(node.querySelectorAll('input[type="checkbox"]')).at(-1));
          if (reachedLast) break;
        }
        assert(reachedLast, `${label} last option is reachable with Tab at ${width}x${height}.`);
        await focusedControlIsVisible(id, `${label} last option at ${width}x${height}`);
        const scroll = await page.$eval(`#${id}`, node => [node, node.querySelector(".workspace-scope-options")].map(element => ({ range: element.scrollHeight - element.clientHeight, offset: element.scrollTop })));
        if (scroll[1].range > 1) assert(scroll[1].offset > 0, `${label} option list scrolls to reach its last option.`);
        if (!changed) { await page.keyboard.press("Space"); changed = true; }
        const update = `#${id} [aria-label="Update ${label} filter"]`;
        await page.waitForSelector(update); await page.keyboard.press("Tab");
        assert(await page.$eval(update, node => node === document.activeElement), `${label} Update follows the last option in keyboard order.`);
        await focusedControlIsVisible(id, `${label} Update at ${width}x${height}`);
        await popupBounds(id, label, width);
        assert.equal(page.url(), initialUrl, "Short-viewport selection remains a draft until Update.");
        await capture(`header-layout-short-${id}-${width}x${height}.png`);
      }
      // The same open panel must also reposition back to a wide viewport.
      await page.setViewport({ width: 1600, height: 900 }); await popupBounds(id, label, 1600);
      await page.keyboard.press("Escape"); await page.waitForSelector(`#${id}`, { hidden: true });
      assert(await page.$eval(trigger, node => node === document.activeElement), `${label} restores focus after open-panel resize.`);
    }
    // A navigation discards these unapplied fixtures before the real scope/date checks.
    await page.goto(initialUrl, { waitUntil: "networkidle0" }); await ready();
  };
  const delayedPersonaFailure = async initialUrl => {
    await page.setViewport({ width: 390, height: 900 });
    const trigger = '.workspace-header [aria-label^="ICT System:"]', popup = "ict-system-options";
    const placement = async () => page.$eval(`#${popup}`, node => {
      const panel = node.getBoundingClientRect();
      const control = document.querySelector('.workspace-header [aria-label^="ICT System:"]').getBoundingClientRect();
      return { headerHeight: document.querySelector(".workspace-header").getBoundingClientRect().height,
        triggerTop: control.top, triggerBottom: control.bottom, popupTop: panel.top, popupBottom: panel.bottom,
        gap: Math.min(Math.abs(panel.top - control.bottom), Math.abs(control.top - panel.bottom)) };
    });
    await page.focus(trigger); await page.keyboard.press("Enter"); await page.waitForSelector(`#${popup}`);
    await popupBounds(popup, "ICT System", 390);
    const before = await placement();
    try {
      // Returning to the window refreshes the saved catalogue. Hold that GET until
      // after the scope panel is open, then deliver a realistic temporary failure.
      holdNextPersona = true;
      const incoming = page.waitForRequest(request => request.method() === "GET" && request.url() === `${origin}/api/settings/personas`, { timeout: 10000 });
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      const request = await incoming;
      assert.equal(request, heldPersonaRequest, "Persona refresh is delayed until the dropdown is open.");
      assert.equal(await page.$eval(trigger, node => node.getAttribute("aria-expanded")), "true");
      await request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary catalogue outage. Retry." }) });
      heldPersonaRequest = undefined;
      await page.waitForSelector('.workspace-persona .persona-action:not([disabled])');
      assert.equal(await page.$eval('.workspace-persona .persona-action', node => node.textContent), "Retry loading personas");
      assert.equal(await page.$('.workspace-persona [role="alert"]'), null, "Persona load failures keep the header recovery button without an error paragraph.");
      assert.equal(await page.$eval('.workspace-header', node => node.textContent.includes("Persona settings are unavailable. Retry to load the saved visibility.")), false);
      assert.equal(await page.$eval('.workspace-navigation p[role="status"]', node => node.textContent), "Retry loading personas button in the header.");
      await popupBounds(popup, "ICT System after persona failure", 390);
      const failed = await placement();
      assert(failed.headerHeight > before.headerHeight + 1 && failed.triggerTop > before.triggerTop + 1, "The Persona Retry button expands the mobile header and moves the ICT trigger.");
      assert(Math.abs(failed.popupTop - before.popupTop) > 1 || Math.abs(failed.popupBottom - before.popupBottom) > 1, "The already-open popup moves with the expanded header.");
      assert(before.gap <= 16 && Math.abs(failed.gap - before.gap) <= 1, `The popup retains its trigger gap after reflow: ${JSON.stringify({ before, failed })}`);
      assert.equal(page.url(), initialUrl, "Persona load failure preserves route, scope and date.");
      assert.equal(await page.$eval(personaSelect, node => node.value), fixturePersona.id, "Temporary failure retains the active saved persona.");
      await capture("header-layout-persona-failure-open-popup-390.png");

      const recovered = page.waitForResponse(response => response.url() === `${origin}/api/settings/personas` && response.status() === 200, { timeout: 10000 });
      await page.focus(".workspace-persona .persona-action"); await page.keyboard.press("Enter"); await recovered;
      await page.waitForSelector('.workspace-persona .persona-action', { hidden: true }); await ready();
      assert.equal(page.url(), initialUrl, "Retry preserves route, scope and date.");
      assert.equal(await page.$eval(personaSelect, node => node.value), fixturePersona.id, "Retry retains the selected persona.");
      await page.focus(trigger); await page.keyboard.press("Enter"); await page.waitForSelector(`#${popup}`);
      await popupBounds(popup, "ICT System after persona recovery", 390);
      const after = await placement();
      assert(Math.abs(after.headerHeight - before.headerHeight) <= 1 && Math.abs(after.triggerTop - before.triggerTop) <= 1 && Math.abs(after.gap - before.gap) <= 1,
        "Retry restores the compact header and its anchored popup.");
      await capture("header-layout-persona-recovered-popup-390.png");
      await page.keyboard.press("Escape"); await page.waitForSelector(`#${popup}`, { hidden: true });
      assert(await page.$eval(trigger, node => node === document.activeElement), "The recovered dropdown restores focus on Escape.");
    } finally {
      holdNextPersona = false;
      if (heldPersonaRequest && !heldPersonaRequest.isInterceptResolutionHandled()) {
        await heldPersonaRequest.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ settings }) });
      }
      heldPersonaRequest = undefined;
    }
  };
  await page.setRequestInterception(true); page.on("request", intercept);
  try {
    await page.evaluate(() => localStorage.removeItem("tsaat.active-persona"));
    const query = new URLSearchParams({ discoveryView: "endpoints", network, securityDomain: "PROTECTED,SECRET,UNKNOWN", dataDate: date });
    await page.goto(`${origin}/discovery-coverage?${query}`, { waitUntil: "networkidle0" }); await ready();
    const initialUrl = page.url();
    await page.focus(personaSelect); await page.keyboard.press("Home"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    await page.waitForFunction(id => document.querySelector('.workspace-header [aria-label="Active persona"]').value === id, {}, fixturePersona.id);
    assert.equal(await page.$eval("[data-active-persona]", node => node.textContent), longPersona);
    assert.equal(page.url(), initialUrl, "Keyboard persona selection preserves route, scope and date.");
    for (const width of widths) { await geometry(width, "long-network"); await dropdowns(width); }
    await compactDropdowns(initialUrl);
    await delayedPersonaFailure(initialUrl);

    // A pending ICT-system selection retains the route until Update, then replaces network scope.
    await page.focus('.workspace-header [aria-label^="ICT System:"]'); await page.keyboard.press("Enter");
    const checkbox = '#ict-system-options .workspace-scope-options input[type="checkbox"]';
    await page.waitForSelector(checkbox); await page.focus(checkbox); await page.keyboard.press("Space");
    assert.equal(page.url(), initialUrl, "Scope remains unapplied until Update.");
    await page.focus('[aria-label="Update ICT System filter"]'); await page.keyboard.press("Enter");
    await page.waitForFunction(id => new URL(location.href).searchParams.get("system") === id, {}, system); await ready();
    const applied = new URL(page.url());
    assert.equal(applied.pathname, "/discovery-coverage");
    assert.equal(applied.searchParams.get("network"), null);
    for (const key of ["discoveryView", "securityDomain", "dataDate"]) assert.equal(applied.searchParams.get(key), query.get(key), `Keyboard scope Update preserves ${key}.`);
    for (const width of widths) await geometry(width, "long-system");

    await page.focus(dateInput); await page.keyboard.press("ArrowUp");
    await page.waitForFunction(previous => new URL(location.href).searchParams.get("dataDate") !== previous, {}, date); await ready();
    const keyboardDate = new URL(page.url());
    for (const key of ["discoveryView", "securityDomain", "system"]) assert.equal(keyboardDate.searchParams.get(key), applied.searchParams.get(key), `Keyboard date adjustment preserves ${key}.`);
    assert.equal(await page.$eval(dateInput, node => node.value), keyboardDate.searchParams.get("dataDate"));
    await page.$eval(dateInput, (node, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, value);
      node.dispatchEvent(new Event("input", { bubbles: true }));
    }, historicalDate);
    await page.waitForFunction(selected => new URL(location.href).searchParams.get("dataDate") === selected, {}, historicalDate); await ready();
    for (const key of ["discoveryView", "securityDomain", "system"]) assert.equal(new URL(page.url()).searchParams.get(key), applied.searchParams.get(key), `Historical date selection preserves ${key}.`);
    assert.deepEqual(mutations, [], "Header interactions never write source definitions.");
    console.log(`Header layout passed: ${widths.length} widths, vertically centred original controls, long source values, contained dropdowns, open-panel resizing, short-mobile scrolling/Update access, delayed persona error/retry reflow, Escape focus, keyboard scope/persona/date and historical-date retention.`);
  } finally {
    page.off("request", intercept); await page.setRequestInterception(false);
    await page.evaluate(value => { if (value === null) localStorage.removeItem("tsaat.active-persona"); else localStorage.setItem("tsaat.active-persona", value); }, previousPersona);
    await page.setViewport(originalViewport ?? { width: 1600, height: 1000 });
    await page.goto(originalUrl, { waitUntil: "networkidle0" });
  }
}
