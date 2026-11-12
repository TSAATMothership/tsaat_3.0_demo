import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const notice = ".workspace-content .workspace-scope-notice";
const loading = "dialog.loading-modal[open]";
const personaSelect = '.workspace-header [aria-label="Active persona"]';
const scopeTrigger = label => `.workspace-header [aria-label^="${label}:"]`;

/** Shared presentation/navigation checks; source data and definitions are never written. */
export async function checkWorkspaceScopeNotice(page, { date, historicalDate, artifacts }) {
  const originalUrl = page.url(), origin = new URL(originalUrl).origin, originalViewport = page.viewport();
  const previousPersona = await page.evaluate(() => localStorage.getItem("tsaat.active-persona"));
  const mutations = [];
  const recordRequest = request => {
    if (new URL(request.url()).origin === origin && new URL(request.url()).pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
  };
  page.on("request", recordRequest);
  // Attribute records catch even an overlay that opens and closes within one frame.
  const installWatch = () => {
    window.__scopeNoticeObserver?.disconnect();
    window.__scopeNoticeWatch = { opens: 0 };
    window.__scopeNoticeObserver = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "attributes" && record.attributeName === "open" && record.target.matches?.("dialog.loading-modal")) window.__scopeNoticeWatch.opens++;
        if (record.type === "childList") for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && (node.matches("dialog.loading-modal[open]") || node.querySelector("dialog.loading-modal[open]"))) window.__scopeNoticeWatch.opens++;
        }
      }
    });
    window.__scopeNoticeObserver.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"], attributeOldValue: true });
  };
  const watchScript = await page.evaluateOnNewDocument(installWatch);
  await page.evaluate(installWatch);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const resetWatch = async () => { await settle(); await page.evaluate(() => { window.__scopeNoticeWatch.opens = 0; }); };
  const noAnimation = async context => {
    await settle();
    assert.equal(await page.$(loading), null, `${context}: no loading animation remains open.`);
    assert.equal(await page.evaluate(() => window.__scopeNoticeWatch.opens), 0, `${context}: no loading animation flashes during the interaction.`);
  };
  const ready = async () => {
    await page.waitForSelector(`${personaSelect}:not([disabled])`);
    await page.waitForSelector(loading, { hidden: true });
  };
  const expectNotice = async context => {
    await page.waitForSelector(notice, { visible: true });
    assert.match(await page.$eval(notice, node => node.textContent), /Select a network or ICT system/i, context);
    assert.equal(await page.$('.workspace-content table, .workspace-content [data-cmdb-asset-id], .workspace-content button.endpoint-export'), null, `${context}: no data results are shown without scope.`);
    await noAnimation(context);
  };
  const capture = async name => {
    if (!artifacts) return;
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, name) });
  };
  const openGroups = async () => {
    const hiddenSidebar = await page.$('[aria-label="Show sidebar"]');
    if (hiddenSidebar) await hiddenSidebar.click();
    for (const button of await page.$$('.workspace-group-toggle[aria-expanded="false"]')) await button.click();
  };
  const noticeButton = async text => {
    const buttons = await page.$$(notice + " button");
    for (const button of buttons) if ((await button.evaluate(node => node.textContent)).trim() === text) return button;
    assert.fail(`Missing scope guidance button: ${text}`);
  };
  const setDate = async selected => {
    await page.$eval('[aria-label="Data date"]', (node, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, value);
      node.dispatchEvent(new Event("input", { bubbles: true }));
    }, selected);
    await page.waitForFunction(value => new URL(location.href).searchParams.get("dataDate") === value, {}, selected);
  };
  const gotoEmpty = async route => {
    await page.goto(origin + route, { waitUntil: "networkidle0" }); await ready();
    await expectNotice(`Direct bookmark ${route}`);
  };
  let heldRequest, intercept;
  try {
    await page.evaluate(() => localStorage.removeItem("tsaat.active-persona"));
    await page.setViewport({ width: 1600, height: 1000 });
    const shared = new URLSearchParams({ dataDate: historicalDate, securityDomain: "UNKNOWN" });
    await page.goto(`${origin}/?${shared}`, { waitUntil: "networkidle0" }); await ready(); await openGroups();
    const destinations = await page.$$eval('.workspace-nav-link', nodes => nodes.map(node => ({ href: node.getAttribute("href"), label: node.textContent.trim() })));
    assert.equal(destinations.length, 8, "All eight retained sidebar destinations are available with All sections.");
    const visited = [];
    for (const [index, item] of destinations.entries()) {
      await resetWatch();
      const link = await page.$(`.workspace-nav-link[href=${JSON.stringify(item.href)}]`);
      assert(link, item.label); await link.focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(label => document.querySelector('.workspace-nav-link[aria-current="page"]')?.textContent.trim() === label, {}, item.label);
      await expectNotice(item.label);
      const current = new URL(page.url());
      for (const key of ["dataDate", "securityDomain"]) assert.equal(current.searchParams.get(key), shared.get(key), `${item.label} retains ${key}.`);
      assert(!current.searchParams.get("network") && !current.searchParams.get("system"));
      visited.push(page.url());
      if (!index) await capture("workspace-scope-notice-desktop.png");
    }
    await resetWatch(); await page.goBack();
    await page.waitForFunction(expected => location.href === expected, {}, visited.at(-2)); await expectNotice("Back without scope");
    await resetWatch(); await page.goForward();
    await page.waitForFunction(expected => location.href === expected, {}, visited.at(-1)); await expectNotice("Forward without scope");

    await gotoEmpty(`/discovery-coverage?discoveryView=installed-software-insights&${shared}`);
    await gotoEmpty(`/discovery-coverage?discoveryView=endpoints&network=&system=%20%2C%20&${shared}`);
    await resetWatch(); await setDate(date); await expectNotice("Changing snapshot without scope");
    assert.equal(new URL(page.url()).searchParams.get("securityDomain"), "UNKNOWN");

    // Domain edits alone do not turn an empty network/system scope into a data load.
    await resetWatch(); await page.focus(scopeTrigger("Security Domain")); await page.keyboard.press("Enter");
    await page.waitForSelector('#security-domain-options input[type="checkbox"]');
    const domainChoices = await page.$$('#security-domain-options input[type="checkbox"]');
    for (const choice of domainChoices) if (!(await choice.evaluate(node => node.checked))) await choice.click();
    await page.focus('[aria-label="Update Security Domain filter"]'); await page.keyboard.press("Enter");
    await page.waitForSelector('#security-domain-options', { hidden: true }); await expectNotice("Domain-only Update without scope");
    const unscoped = new URL(page.url());
    assert.equal(unscoped.searchParams.get("dataDate"), date);

    for (const [text, label, id] of [["Select managed networks", "Managed Network", "managed-network-options"], ["Select ICT systems", "ICT System", "ict-system-options"]]) {
      await resetWatch(); const action = await noticeButton(text); await action.focus(); await page.keyboard.press("Enter");
      await page.waitForSelector(`#${id}`);
      assert(await page.$eval(`#${id} input[type="search"]`, node => node === document.activeElement), `${text} opens the header search with keyboard focus.`);
      await noAnimation(text); await page.keyboard.press("Escape"); await page.waitForSelector(`#${id}`, { hidden: true });
      assert(await page.$eval(scopeTrigger(label), node => node === document.activeElement), `${text} retains normal Escape focus return.`);
    }
    let previousUnscopedUrl;
    for (const width of [390, 320]) {
      await page.setViewport({ width, height: 900 });
      for (const [view, context] of [["topology", "another page"], ["topology", "the same active page"], ["endpoints", "End Point Explorer"]]) {
        await openGroups(); await resetWatch();
        const mobileLink = await page.$(`.workspace-nav-link[href*="discoveryView=${view}"]`); assert(mobileLink);
        await mobileLink.focus(); await page.keyboard.press("Enter");
        await page.waitForFunction(selected => new URL(location.href).searchParams.get("discoveryView") === selected, {}, view);
        await page.waitForFunction(() => document.querySelector('.workspace-layout')?.classList.contains("sidebar-collapsed") && document.activeElement?.id === "workspace-scope-title");
        await expectNotice(`Mobile keyboard selection of ${context} at ${width}px`);
        if (view === "topology") previousUnscopedUrl = page.url();
      }
      await page.evaluate(async () => { await Promise.all(document.querySelector('.workspace-sidebar').getAnimations().map(animation => animation.finished.catch(() => {}))); });
      await settle();
      const bounds = await page.$eval(notice, node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, pageOverflow: document.documentElement.scrollWidth - innerWidth, overflow: node.scrollWidth - node.clientWidth };
      });
      assert(bounds.left >= 0 && bounds.right <= width + 1 && bounds.pageOverflow <= 1 && bounds.overflow <= 1, `Scope notice fits ${width}px: ${JSON.stringify(bounds)}`);
      await capture(`workspace-scope-notice-${width}.png`);
    }
    await page.setViewport({ width: 1600, height: 1000 }); await openGroups();
    const beforeApply = page.url();
    const networkAction = await noticeButton("Select managed networks"); await networkAction.focus(); await page.keyboard.press("Enter");
    await page.waitForSelector('#managed-network-options input[type="checkbox"]');
    await resetWatch(); await page.focus('#managed-network-options input[type="checkbox"]'); await page.keyboard.press("Space");
    assert.equal(page.url(), beforeApply, "A draft selection does not navigate or load data.");
    await expectNotice("Pending network selection");
    await page.focus('[aria-label="Update Managed Network filter"]'); await page.keyboard.press("Enter");
    await page.waitForFunction(() => Boolean(new URL(location.href).searchParams.get("network")));
    await page.waitForSelector('.endpoint-explorer'); await page.waitForSelector(loading, { hidden: true });
    assert.equal(await page.$(notice), null, "Applying network scope replaces the guidance with data.");
    const applied = new URL(page.url());
    for (const key of ["dataDate", "securityDomain"]) assert.equal(applied.searchParams.get(key), unscoped.searchParams.get(key));

    // Hold a fresh scoped route request to prove real loading still has feedback.
    await openGroups(); await page.setRequestInterception(true);
    let receiveRequest, interceptedScopedNavigation = false;
    const incoming = new Promise(resolve => { receiveRequest = resolve; });
    intercept = request => {
      if (request.isInterceptResolutionHandled()) return;
      const url = new URL(request.url());
      if (!interceptedScopedNavigation && url.origin === origin && url.pathname === "/governance/end-point-insights" && url.searchParams.get("network") === applied.searchParams.get("network") && request.headers().rsc === "1") {
        interceptedScopedNavigation = true; heldRequest = request; receiveRequest(); return;
      }
      void request.continue();
    };
    page.on("request", intercept);
    const target = await page.$('.workspace-nav-link[href^="/governance/end-point-insights?"]'); assert(target);
    await target.focus(); await page.keyboard.press("Enter");
    let timer;
    try { await Promise.race([incoming, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Scoped navigation did not request a fresh RSC response.")), 10000); })]); }
    finally { clearTimeout(timer); }
    await page.waitForSelector(loading, { visible: true });
    // Scope Update replaced the last mobile End Point entry, leaving unscoped
    // Topology immediately behind it. Back must dismiss the pending overlay
    // even though the scoped destination's response has not arrived.
    assert(previousUnscopedUrl, "The prior unscoped history entry is known.");
    await page.goBack();
    await page.waitForFunction(expected => location.href === expected, {}, previousUnscopedUrl);
    await page.waitForSelector(notice, { visible: true });
    await page.waitForSelector(loading, { hidden: true });
    await resetWatch(); await expectNotice("Back to unscoped page during pending scoped navigation");
    const delayed = heldRequest; heldRequest = undefined;
    if (!delayed.isInterceptResolutionHandled()) {
      try { await delayed.continue(); }
      catch (error) { if (!delayed.failure()) throw error; }
    }
    page.off("request", intercept); intercept = undefined; await page.setRequestInterception(false);
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 10000 });
    assert.equal(page.url(), previousUnscopedUrl, "A late scoped response must not replace the unscoped Back destination.");
    await noAnimation("Settled unscoped Back destination");

    // Continue the normal scoped route as a separate successful navigation.
    await page.goto(applied.href, { waitUntil: "networkidle0" }); await ready(); await openGroups();
    const completedTarget = await page.$('.workspace-nav-link[href^="/governance/end-point-insights?"]'); assert(completedTarget);
    await completedTarget.focus(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.pathname === "/governance/end-point-insights");
    await page.waitForSelector(loading, { hidden: true });
    assert.equal(await page.$(notice), null, "Scoped page navigation still presents data.");

    await page.focus(scopeTrigger("Managed Network")); await page.keyboard.press("Enter");
    await page.waitForSelector('#managed-network-options .workspace-scope-none');
    await page.click('#managed-network-options .workspace-scope-none');
    assert.equal(await page.$(notice), null, "Clearing a draft leaves the applied page visible until Update.");
    await resetWatch(); await page.focus('[aria-label="Update Managed Network filter"]'); await page.keyboard.press("Enter");
    await page.waitForFunction(() => !new URL(location.href).searchParams.get("network")); await expectNotice("Clearing the last network");

    const systemAction = await noticeButton("Select ICT systems"); await systemAction.focus(); await page.keyboard.press("Enter");
    await page.waitForSelector('#ict-system-options input[type="checkbox"]');
    await page.focus('#ict-system-options input[type="checkbox"]'); await page.keyboard.press("Space");
    await page.focus('[aria-label="Update ICT System filter"]'); await page.keyboard.press("Enter");
    await page.waitForFunction(() => Boolean(new URL(location.href).searchParams.get("system")));
    await page.waitForSelector(loading, { hidden: true }); await page.waitForSelector(notice, { hidden: true });
    assert.equal(new URL(page.url()).searchParams.get("network"), null);
    assert.equal(new URL(page.url()).searchParams.get("dataDate"), date);
    assert.deepEqual(mutations, [], "Scope guidance never mutates provider data.");
    console.log("Workspace scope notice passed: all sidebar pages, empty/direct/history scopes, no loading flash without scope, date/domain retention, keyboard guidance/draft/Update, real scoped loading, Back during pending navigation, mobile sidebar dismissal/title focus and layouts.");
  } finally {
    if (heldRequest && !heldRequest.isInterceptResolutionHandled()) await heldRequest.continue();
    if (intercept) { page.off("request", intercept); await page.setRequestInterception(false); }
    page.off("request", recordRequest);
    await page.removeScriptToEvaluateOnNewDocument(watchScript.identifier);
    await page.evaluate(value => {
      window.__scopeNoticeObserver?.disconnect(); delete window.__scopeNoticeObserver; delete window.__scopeNoticeWatch;
      if (value === null) localStorage.removeItem("tsaat.active-persona"); else localStorage.setItem("tsaat.active-persona", value);
    }, previousPersona);
    await page.setViewport(originalViewport ?? { width: 1600, height: 1000 });
    await page.goto(originalUrl, { waitUntil: "networkidle0" });
  }
}
