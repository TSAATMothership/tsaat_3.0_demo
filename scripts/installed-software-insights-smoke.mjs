import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Runs against either compiled provider; fixtures are owned by the calling smoke. */
export async function checkInstalledSoftwareInsights(page, { date, historicalDate, artifacts } = {}) {
  const base = new URL(page.url()).origin;
  await page.setViewport({ width: 1600, height: 1000 });
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const visit = async (scope = "network=net-1", snapshot = date, briefing = false) => {
    const destination = briefing ? "/governance/installed-software-insights?" : "/discovery-coverage?discoveryView=installed-software-insights&";
    await page.goto(`${base}${destination}${scope}&dataDate=${snapshot}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".software-insights");
    await page.waitForSelector("dialog.loading-modal[open]", { hidden: true });
  };
  const links = () => page.$$eval('.software-insights a[data-software-count]', nodes => nodes.map(node => ({ href: node.href, count: Number(node.dataset.softwareCount) })));
  for (const scope of [{ query: "network=net-1&securityDomain=UNKNOWN", snapshot: date }, { query: "system=sys-1", snapshot: historicalDate ?? date }]) {
    await visit(scope.query, scope.snapshot);
    assert.equal(await page.$eval('.software-insights', node => node.dataset.softwareSnapshot), scope.snapshot);
    assert.equal(await page.$('.software-insights [role=tablist]'), null);
    assert.equal(await page.$('[data-insights-report]'), null);
    assert.equal(await page.$('.workspace-navigation a[href*="discoveryView=installed-software-insights"]'), null, "Dashboard stays available by bookmark without a sidebar link");
    assert.equal(await page.$eval('.software-insights h1', node => node.textContent), "Installed Software Dashboard");
    const total = await page.$eval('.software-insights', node => Number(node.dataset.softwareTotal));
    assert(total > 0, "Selected sample has installed software");
    assert.equal(await page.$$eval('.software-metric', nodes => nodes.length), 4);
    const dashboardLinks = await links();
    const explorer = await page.$eval('.software-insights-hero a', node => node.href);
    // All bar links are keyboard accessible; the first product is exercised using Enter below.
    await page.focus('.software-bars a');
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.keyboard.press("Enter")]);
    assert.equal(await page.$eval('.endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(",", ""))), dashboardLinks[0].count);
    await visit(scope.query, scope.snapshot);
    const navigation = await page.$$eval('.workspace-navigation a', nodes => nodes.map(node => ({ label: node.textContent.trim(), href: node.href })));
    const index = navigation.findIndex(item => item.label === 'Installed Software Insights');
    assert(index > 0); assert.equal(navigation[index - 1].label, 'Cyber Terrain Insights');
    await page.focus('.workspace-navigation a[href^="/governance/installed-software-insights"]');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
    await page.waitForSelector('.software-insights-briefing');
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    assert.equal(new URL(page.url()).pathname, '/governance/installed-software-insights');
    assert.equal(await page.$eval('.workspace-navigation [aria-current=page]', node => node.textContent.trim()), 'Installed Software Insights');
    assert.equal(await page.$$eval('.software-insights h1', nodes => nodes.length), 1);
    assert.equal(await page.$eval('#software-briefing-title', node => node.tagName), 'H1');
    assert.equal(await page.$('.software-insights.is-story > .software-insights-hero'), null);
    assert.equal(await page.$eval('.software-insights', node => Number(node.dataset.softwareTotal)), total);
    assert.equal(await page.$('.software-insights [role=tablist]'), null);
    for (const [key, value] of new URLSearchParams(scope.query)) assert.equal(new URL(page.url()).searchParams.get(key), value);
    assert.equal(new URL(page.url()).searchParams.get('dataDate'), scope.snapshot);
    assert.equal(await page.$$eval('.software-briefing-chapter', nodes => nodes.length), 4);
    assert.equal(await page.$$eval('.software-insights-briefing .insight-metric', nodes => nodes.length), 4);
    assert.equal(await page.$$eval('.software-briefing-actions .insight-decision', nodes => nodes.length), 6);
    assert(await page.$eval('.software-insights-briefing .insight-hero-art img', node => node.complete && node.naturalWidth > 0), 'Local illustration loads');
    const storyLinks = await links();
    for (const link of [...dashboardLinks, ...storyLinks]) {
      const query = new URL(link.href).searchParams;
      for (const [key, value] of new URLSearchParams(scope.query)) assert.equal(query.get(key), value);
      assert.equal(query.get("dataDate"), scope.snapshot); assert.equal(query.get("discoveryView"), "installed-software");
    }
    const targets = [{ href: explorer, count: total }, ...storyLinks.filter(link => {
      const filters = JSON.parse(new URL(link.href).searchParams.get("discoveryFilters") || "{}");
      return filters.recency?.length || filters.columns?.softwareVersion;
    })];
    for (const link of targets) {
      await page.goto(link.href, { waitUntil: "networkidle0" });
      assert.equal(await page.$eval('.endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(",", ""))), link.count, "Evidence count matches Explorer");
    }
  }
  // All summary charts and their links fit the desktop workspace without hiding data.
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1600, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewport(viewport);
    await visit();
    const geometry = await page.evaluate(() => {
      const workspace = document.querySelector('.workspace-content'), bounds = workspace.getBoundingClientRect();
      const cards = [...document.querySelectorAll('.software-dashboard-grid .software-card')];
      return {
        height: workspace.clientHeight, scrollHeight: workspace.scrollHeight,
        cards: cards.length,
        visible: [...cards, ...document.querySelectorAll('.software-metric, .software-insights-footer, .software-dashboard-grid a')].every(node => {
          const box = node.getBoundingClientRect();
          return box.top >= bounds.top && box.bottom <= bounds.bottom + 1 && box.right <= bounds.right;
        }),
        unclipped: cards.every(node => node.scrollHeight <= node.clientHeight + 1),
        footerClear: document.querySelector('.software-insights-footer').getBoundingClientRect().top >= Math.max(...cards.map(node => node.getBoundingClientRect().bottom))
      };
    });
    assert.equal(geometry.cards, 6);
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `software-dashboard-${viewport.width}x${viewport.height}.png`) });
    assert(geometry.scrollHeight <= geometry.height + 1 && geometry.visible && geometry.unclipped && geometry.footerClear, `Dashboard fits ${viewport.width}x${viewport.height}: ${JSON.stringify(geometry)}`);
  }
  await page.setViewport({ width: 1600, height: 1000 });
  await visit();
  assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth), 'No desktop overflow');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "software-insights-dashboard.png") });
  await visit('network=net-1', date, true);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "software-insights-story.png") });
  await page.focus('.software-insights-briefing .insight-chapters a[href="#software-briefing-evidence"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#software-briefing-evidence' && document.querySelector('#software-briefing-evidence').getBoundingClientRect().top < innerHeight);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "software-insights-actions.png") });
  await page.$eval('.software-briefing-actions', node => node.scrollIntoView());
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "software-insights-action-cards.png") });
  await page.focus('.software-insights-briefing .insight-footer a[href="#software-briefing-top"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#software-briefing-top' && document.querySelector('#software-briefing-top').getBoundingClientRect().top < innerHeight);
  await page.focus('.software-insights-footer summary'); await page.keyboard.press('Enter');
  assert(await page.$eval('.software-insights-footer details', node => node.open));
  await page.setViewport({ width: 390, height: 844 });
  const sidebarWasOpen = await page.$eval('.sidebar-toggle', node => node.getAttribute('aria-expanded') === 'true');
  if (sidebarWasOpen) await page.click('.sidebar-toggle');
  await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 56);
  for (const tab of ['dashboard', 'story']) {
    await visit('network=net-1', date, tab === 'story');
    if (await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
    await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 45 && document.querySelector('.workspace-content').clientWidth > 250);
    await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth), 'No narrow overflow');
    assert(await page.$$eval('.software-card, .software-briefing-chapter', nodes => nodes.every(node => node.getBoundingClientRect().right <= innerWidth)));
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `software-insights-${tab}-narrow.png`) });
    await page.$eval(tab === 'dashboard' ? '.software-version-coverage' : '#software-briefing-evidence', node => node.scrollIntoView());
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `software-insights-${tab}-detail-narrow.png`) });
  }
  await page.setViewport({ width: 1600, height: 1000 });
  if (sidebarWasOpen) await page.click('.sidebar-toggle');
  for (const scope of ['network=missing-network', 'network=net-1&securityDomain=NONE']) {
    await visit(scope); assert(await page.$('.software-empty')); assert.equal(await page.$('.software-metrics'), null);
    await visit(scope, date, true); assert(await page.$('.software-empty')); assert.equal(await page.$('[data-insights-report]'), null);
  }
  await page.goto(base + '/discovery-coverage?discoveryView=installed-software-insights', { waitUntil: 'networkidle0' });
  assert.equal(await page.$('.software-insights'), null, 'No page inventory before header scope');
  await page.goto(base + '/governance/installed-software-insights', { waitUntil: 'networkidle0' });
  assert.equal(await page.$('.software-insights'), null, 'No Governance inventory before header scope');
  await visit();
  console.log('Installed Software Insights browser checks passed: dashboard fits 1280x720 through 1920x1080, briefing, chapter anchors, Explorer count reconciliation, keyboard sidebar/links, historical system/domain scope, empty states and 390px layout.');
}
