import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

/** Exercise the compiled executive briefing against a disposable provider store. */
export async function checkGovernanceTrends(page, { date, historicalDate, directory, artifacts, snapshotDates: suppliedDates } = {}) {
  const initial = page.url(), base = new URL(initial).origin;
  const through = new Date(`${date}T00:00:00Z`);
  const previousMonthEnd = new Date(Date.UTC(through.getUTCFullYear(), through.getUTCMonth(), 0));
  const monthFrom = new Date(Date.UTC(previousMonthEnd.getUTCFullYear(), previousMonthEnd.getUTCMonth(), Math.min(through.getUTCDate(), previousMonthEnd.getUTCDate()))).toISOString().slice(0, 10);
  const weekFrom = new Date(through.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const snapshotDates = suppliedDates ?? await page.evaluate(async () => (await (await fetch('/api/settings/storage')).json()).snapshots.map(snapshot => snapshot.date));
  const expectedDates = from => [...new Set(snapshotDates.filter(day => day >= from && day <= date))].sort();
  const go = async params => {
    await page.goto(`${base}/governance/trends?${params}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".governance-trends");
    await page.waitForSelector("dialog.loading-modal[open]", { hidden: true });
  };
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  await page.waitForSelector(".governance-trends");
  assert.equal(await page.$eval(".governance-trends", node => node.dataset.trendsSnapshot), date);
  assert.equal(await page.$eval('[aria-label="Trend history"]', node => node.value), "month");
  assert.deepEqual(await page.$$eval('[aria-label="Trend history"] option', nodes => nodes.map(node => node.textContent)), ["1 week", "1 month"]);
  assert.equal(await page.$eval('.governance-trends', node => node.dataset.trendsFrom), monthFrom);
  assert.equal(await page.$$(".executive-scorecard").then(nodes => nodes.length), 3);
  const scoped = new URL(initial).searchParams;
  for (const href of await page.$$eval('.governance-trends a[href^="/"]', nodes => nodes.map(node => node.href))) {
    const target = new URL(href);
    for (const key of ["network", "system", "securityDomain"]) if (scoped.has(key)) assert.equal(target.searchParams.get(key), scoped.get(key));
    assert.equal(target.searchParams.get("dataDate"), date);
  }
  assert(await page.$eval(".workspace-content", node => node.scrollWidth <= node.clientWidth), "Desktop briefing has no horizontal overflow");
  await page.$eval(".workspace-content", node => { node.scrollTop = 0; });
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "trends-desktop.png") });
  await page.focus('.executive-scorecard[href="#trend-lifecycle"]'); await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#trend-lifecycle");
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "trends-lifecycle.png") });
  await page.focus('[aria-label="Inspect life cycle snapshot"]'); await page.keyboard.press("Home"); await page.keyboard.press("Enter");
  assert.equal(await page.$eval('[aria-label="Inspect life cycle snapshot"]', node => node.value), "0");
  await page.focus(".executive-methodology summary"); await page.keyboard.press("Enter");
  assert.equal(await page.$eval(".executive-methodology", node => node.open), true);
  const evidenceRows = await page.$$eval(".executive-methodology tbody tr", rows => rows.map(row => [...row.cells].map(cell => cell.textContent)));
  assert.deepEqual(evidenceRows.map(row => row[0]), expectedDates(monthFrom));
  const monthChart = await page.$eval('#trend-compliance .executive-chart-line', node => node.getAttribute('d'));
  const checkCsv = async (history, rows, from) => {
    if (!directory) return;
    const session = await page.createCDPSession();
    try {
      await session.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
      await page.focus(".executive-methodology button"); await page.keyboard.press("Enter");
      const filename = path.join(directory, `cyber-terrain-trends-${history}-${date}.csv`);
      const deadline = Date.now() + 15000;
      while (!fs.existsSync(filename) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      assert(fs.existsSync(filename), "Evidence CSV downloads");
      const csv = Papa.parse(fs.readFileSync(filename, "utf8"), { header: true, skipEmptyLines: true });
      assert.equal(csv.errors.length, 0); assert.equal(csv.data.length, rows.length);
      for (const [index, row] of csv.data.entries()) {
        assert.equal(row.Snapshot, rows[index][0]); assert.equal(row["Scoped CIs"], rows[index][1]);
        assert.equal(row["SPI compliance (%)"] === "N/A" ? "N/A" : Number(row["SPI compliance (%)"]).toFixed(1) + "%", rows[index][2]);
        assert.equal(row["Unknown checks"], rows[index][3]);
        assert.equal(row["Servers with issues"] + " / " + row.Servers, rows[index][4]);
        assert.equal(row["Servers with lifecycle evidence gaps"], rows[index][5]);
        assert.equal(row["Discovery coverage (%)"] === "N/A" ? "N/A" : Number(row["Discovery coverage (%)"]).toFixed(1) + "%", rows[index][6]);
        assert.equal(row["Network IDs"], scoped.get("network") ?? "");
        assert.equal(row["History period"], history === "week" ? "1 week" : "1 month");
        assert.equal(row["Period start"], from); assert.equal(row["Requested through"], date);
        assert(row.Snapshot >= from && row.Snapshot <= date);
      }
    } finally { await session.detach(); }
  };
  await checkCsv("month", evidenceRows, monthFrom);
  await page.select('[aria-label="Trend history"]', "week");
  await page.waitForFunction(() => new URL(location.href).searchParams.get("trendHistory") === "week" && document.querySelector(".governance-trends")?.dataset.trendsHistory === "week");
  await page.waitForSelector("dialog.loading-modal[open]", { hidden: true });
  assert.equal(new URL(page.url()).searchParams.get("dataDate"), date);
  assert.equal(await page.$eval('.governance-trends', node => node.dataset.trendsFrom), weekFrom);
  assert.equal(await page.$$eval('#trend-compliance .executive-chart-point', nodes => nodes.length), expectedDates(weekFrom).length);
  assert.notEqual(await page.$eval('#trend-compliance .executive-chart-line', node => node.getAttribute('d')), monthChart, "Chart observations update with the selected period");
  for (const key of ['network', 'system', 'securityDomain']) assert.equal(new URL(page.url()).searchParams.get(key), scoped.get(key));
  await page.focus('.executive-methodology summary'); await page.keyboard.press('Enter');
  const weekRows = await page.$$eval('.executive-methodology tbody tr', rows => rows.map(row => [...row.cells].map(cell => cell.textContent)));
  assert.deepEqual(weekRows.map(row => row[0]), expectedDates(weekFrom));
  await checkCsv("week", weekRows, weekFrom);
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('[aria-label="Trend history"]', node => node.value), 'week');
  assert.equal(await page.$$eval('#trend-compliance .executive-chart-point', nodes => nodes.length), expectedDates(weekFrom).length);
  for (const viewport of [{ width: 1366, height: 768, name: "laptop" }, { width: 390, height: 844, name: "phone" }]) {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    if (viewport.width === 390 && await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
    await page.waitForFunction(() => document.querySelector(".workspace-content").scrollWidth <= document.querySelector(".workspace-content").clientWidth);
    await page.$eval(".workspace-content", node => { node.scrollTop = 0; });
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `trends-${viewport.name}.png`) });
    await page.$eval("#trend-discovery", node => node.scrollIntoView());
    assert(await page.$eval('[aria-label="Inspect discovery snapshot"]', node => node.getBoundingClientRect().width > 50));
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `trends-${viewport.name}-discovery.png`) });
  }
  await page.setViewport({ width: 1600, height: 1000 });
  if (await page.$('[aria-label="Show sidebar"]')) await page.click('[aria-label="Show sidebar"]');
  await page.select('[aria-label="Trend history"]', 'month');
  await page.waitForFunction(() => document.querySelector('.governance-trends')?.dataset.trendsHistory === 'month');
  await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  assert.equal(await page.$eval('#trend-compliance .executive-chart-line', node => node.getAttribute('d')), monthChart, 'Returning to month restores its observations');
  await go(`network=net-1&securityDomain=NONE&dataDate=${date}`);
  assert.deepEqual(await page.$$eval(".executive-value", nodes => nodes.map(node => node.textContent)), ["N/A", "N/A", "N/A"]);
  assert.equal(await page.$$(".executive-detail-grid .executive-chart-point").then(nodes => nodes.length), 0, "Empty denominators do not produce zero chart points");
  assert.match(await page.$eval(".executive-notice", node => node.textContent), /No inventory matches/);
  await go(`system=sys-1&dataDate=${historicalDate}`);
  assert.match(await page.$eval(".executive-context", node => node.textContent), /One snapshot/);
  assert.equal(await page.$eval(".governance-trends", node => node.dataset.trendsSnapshot), historicalDate);
  assert.deepEqual(await page.$$eval(".executive-scorecard .executive-movement", nodes => nodes.map(node => node.textContent.trim())), ["No comparison", "No comparison", "No comparison"]);
  await go("network=net-1&dataDate=1900-01-01");
  assert.match(await page.$eval(".executive-empty", node => node.textContent), /No snapshots in this history period/);
  await page.goto(initial, { waitUntil: "networkidle0" });
  await page.waitForSelector(".governance-trends");
  // Check new evidence destinations under an actual configured persona, restoring all shared settings.
  const original = await page.evaluate(async () => (await fetch("/api/settings/personas")).json());
  const previousPersona = await page.evaluate(() => localStorage.getItem("tsaat.active-persona"));
  try {
    const restricted = structuredClone(original);
    const settings = restricted.settings ?? restricted;
    settings.personas.find(persona => persona.id === "analyst").pages = ["governance-trends"];
    const status = await page.evaluate(async body => (await fetch("/api/settings/personas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, settings);
    assert.equal(status, 200);
    await page.evaluate(() => localStorage.setItem("tsaat.active-persona", "analyst"));
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.querySelectorAll('.governance-trends a[data-persona-disabled="true"]').length === 6);
    assert(await page.$$eval('.governance-trends a[data-persona-disabled="true"]', nodes => nodes.every(node => !node.hasAttribute("href") && node.tabIndex === -1)));
  } finally {
    await page.evaluate(async ({ original, previousPersona }) => {
      const response = await fetch("/api/settings/personas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(original.settings ?? original) });
      if (!response.ok) throw new Error("Could not restore persona settings");
      if (previousPersona === null) localStorage.removeItem("tsaat.active-persona"); else localStorage.setItem("tsaat.active-persona", previousPersona);
    }, { original, previousPersona });
    await page.goto(initial, { waitUntil: "networkidle0" });
    await page.waitForSelector(".governance-trends");
  }
}
