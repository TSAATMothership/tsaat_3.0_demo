import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Runs against either compiled provider; fixtures are owned by the calling smoke. */
export async function checkInstalledSoftwareInsights(page, { date, historicalDate, artifacts } = {}) {
  const base = new URL(page.url()).origin;
  await page.setViewport({ width: 1600, height: 1000 });
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const visit = async (scope = "network=net-1", snapshot = date) => {
    const destination = "/governance/installed-software-insights?";
    await page.goto(`${base}${destination}${scope}&dataDate=${snapshot}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".software-insights");
    await page.waitForSelector("dialog.loading-modal[open]", { hidden: true });
  };
  const links = () => page.$$eval('.software-insights a[data-software-count]', nodes => nodes.map(node => ({ href: node.href, count: Number(node.dataset.softwareCount) })));
  for (const scope of [{ query: "network=net-1&securityDomain=UNKNOWN", snapshot: date }, { query: "system=sys-1", snapshot: historicalDate ?? date }]) {
    await page.goto(`${base}/discovery-coverage?discoveryView=installed-software-insights&${scope.query}&dataDate=${scope.snapshot}`, { waitUntil: "networkidle0" });
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    assert((await page.$eval('main', node => node.textContent)).includes('This feature has been retired'));
    assert.equal(await page.$('.software-insights'), null);
    assert.equal(await page.$('.workspace-navigation a[href*="discoveryView=installed-software-insights"]'), null);
    const returnLink = await page.$eval('main a[href*="discoveryView=endpoints"]', node => node.href);
    for (const [key, value] of new URLSearchParams(scope.query)) assert.equal(new URL(returnLink).searchParams.get(key), value);
    assert.equal(new URL(returnLink).searchParams.get('dataDate'), scope.snapshot);
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `software-dashboard-retired-${scope.snapshot}.png`) });
    await page.focus('main a[href*="discoveryView=endpoints"]');
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.keyboard.press("Enter")]);
    assert.equal(new URL(page.url()).searchParams.get('discoveryView'), 'endpoints');
    const navigation = await page.$$eval('.workspace-navigation a', nodes => nodes.map(node => ({ label: node.textContent.trim(), href: node.href })));
    const index = navigation.findIndex(item => item.label === 'Installed Software Insights');
    assert.equal(index, 0); assert.equal(navigation[index + 1].label, 'End Point Insights');
    const governanceToggle = '.workspace-group-toggle[aria-controls="workspace-group-0"]';
    assert.equal(await page.$eval(governanceToggle, node => node.getAttribute('aria-expanded')), 'false');
    await page.focus(governanceToggle); await page.keyboard.press('Enter');
    await page.waitForSelector('#workspace-group-0', { visible: true });
    await page.focus('.workspace-navigation a[href^="/governance/installed-software-insights"]');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
    await page.waitForSelector('.software-insights-briefing');
    await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
    assert.equal(new URL(page.url()).pathname, '/governance/installed-software-insights');
    assert.equal(await page.$eval('.workspace-navigation [aria-current=page]', node => node.textContent.trim()), 'Installed Software Insights');
    assert.equal(await page.$$eval('.software-insights h1', nodes => nodes.length), 1);
    assert.equal(await page.$eval('#software-briefing-title', node => node.tagName), 'H1');
    assert.equal(await page.$('.software-insights.is-story > .software-insights-hero'), null);
    const total = await page.$eval('.software-insights', node => Number(node.dataset.softwareTotal));
    assert(total > 0, 'Selected sample has installed software');
    assert(await page.$('[data-insights-report]'), 'Governance PDF remains available');
    assert.equal(await page.$('.software-insights [role=tablist]'), null);
    for (const [key, value] of new URLSearchParams(scope.query)) assert.equal(new URL(page.url()).searchParams.get(key), value);
    assert.equal(new URL(page.url()).searchParams.get('dataDate'), scope.snapshot);
    assert.equal(await page.$$eval('.software-briefing-chapter', nodes => nodes.length), 4);
    assert.equal(await page.$$eval('.software-insights-briefing .insight-metric', nodes => nodes.length), 4);
    assert.equal(await page.$$eval('.software-briefing-actions .insight-decision', nodes => nodes.length), 6);
    assert(await page.$eval('.software-insights-briefing .insight-hero-art img', node => node.complete && node.naturalWidth > 0), 'Local illustration loads');
    const storyLinks = await links();
    for (const link of storyLinks) {
      const query = new URL(link.href).searchParams;
      for (const [key, value] of new URLSearchParams(scope.query)) assert.equal(query.get(key), value);
      assert.equal(query.get("dataDate"), scope.snapshot); assert.equal(query.get("discoveryView"), "installed-software");
    }
    await page.focus('.software-insights a[data-software-count]');
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.keyboard.press("Enter")]);
    assert.equal(await page.$eval('.endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(",", ""))), storyLinks[0].count);
    const targets = storyLinks.filter(link => {
      const filters = JSON.parse(new URL(link.href).searchParams.get("discoveryFilters") || "{}");
      return filters.recency?.length || filters.columns?.softwareVersion;
    });
    for (const link of targets) {
      await page.goto(link.href, { waitUntil: "networkidle0" });
      assert.equal(await page.$eval('.endpoint-toolbar h2 span', node => Number(node.textContent.replaceAll(",", ""))), link.count, "Evidence count matches Explorer");
    }
  }
  await page.setViewport({ width: 1600, height: 1000 });
  await visit();
  assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth), 'No desktop overflow');
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
  {
    await visit();
    if (await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
    await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width <= 45 && document.querySelector('.workspace-content').clientWidth > 250);
    await page.$eval('.workspace-content', node => { node.scrollTop = 0; });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert(await page.$eval('.workspace-content', node => node.scrollWidth <= node.clientWidth), 'No narrow overflow');
    assert(await page.$$eval('.software-card, .software-briefing-chapter', nodes => nodes.every(node => node.getBoundingClientRect().right <= innerWidth)));
    if (artifacts) await page.screenshot({ path: path.join(artifacts, "software-insights-story-narrow.png") });
    await page.$eval('#software-briefing-evidence', node => node.scrollIntoView());
    if (artifacts) await page.screenshot({ path: path.join(artifacts, "software-insights-story-detail-narrow.png") });
  }
  await page.setViewport({ width: 1600, height: 1000 });
  if (sidebarWasOpen) await page.click('.sidebar-toggle');
  for (const scope of ['network=missing-network', 'network=net-1&securityDomain=NONE']) {
    await visit(scope); assert(await page.$('.software-empty')); assert.equal(await page.$('[data-insights-report]'), null);
  }
  await page.goto(base + '/discovery-coverage?discoveryView=installed-software-insights', { waitUntil: 'networkidle0' });
  assert.equal(await page.$('.software-insights'), null, 'Retired dashboard has no inventory');
  assert((await page.$eval('main', node => node.textContent)).includes('This feature has been retired'), 'Unscoped bookmark is retired');
  await page.goto(base + '/governance/installed-software-insights', { waitUntil: 'networkidle0' });
  assert.equal(await page.$('.software-insights'), null, 'No Governance inventory before header scope');
  await visit();
  console.log('Installed Software Insights browser checks passed: retired dashboard bookmarks, Governance briefing, chapter anchors, Explorer count reconciliation, keyboard sidebar/links, historical system/domain scope, empty states and 390px layout.');
}
