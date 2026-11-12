import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFRawStream } from 'pdf-lib';

/** Real compiled worker downloads, plus controlled worker failure/cancellation at the browser boundary. */
export async function checkTopologyImpactReport(page, { date, historicalDate, directory, artifacts, provider }) {
  assert(directory && date, 'Impact report checks require an isolated download directory and explicit date.');
  const base = new URL(page.url()).origin, button = '[data-topology-impact-report]';
  const client = await page.createCDPSession();
  const downloads = path.join(directory, 'topology-impact'); fs.mkdirSync(downloads, { recursive: true });
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const visit = async (query, snapshot = date) => {
    await page.goto(`${base}/discovery-coverage?discoveryView=topology&${query}&dataDate=${snapshot}`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForSelector('.topology-explorer'); await page.waitForSelector('dialog.loading-modal[open]', { hidden: true });
  };
  const instrument = async () => page.evaluate(() => {
    window.__topologyJobs = []; window.__topologyWorkerMode = 'normal';
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, ...args) {
        if (message.job?.kind === 'pdf-topology-impact') {
          window.__topologyJobs.push(structuredClone(message.job));
          if (window.__topologyWorkerMode === 'hold') return;
          if (window.__topologyWorkerMode === 'fail') {
            queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: { type: 'error', id: message.id, message: 'Controlled temporary failure' } })));
            return;
          }
        }
        super.postMessage(message, ...args);
      }
    };
  });
  const capture = () => page.$$eval('[data-topology-node]', nodes => nodes.map(node => ({ id: node.dataset.topologyNode,
    starting: node.classList.contains('is-root'), position: node.getAttribute('transform').match(/-?[\d.]+(?:e[+-]?\d+)?/gi).map(Number) })));
  const complete = async (snapshot, filename) => {
    await page.waitForFunction(() => !document.querySelector('[data-topology-impact-report]').disabled && !document.querySelector('.document-generation-dialog[open]'), { timeout: 120000 });
    const file = path.join(downloads, `topology-impact-${snapshot}.pdf`), deadline = Date.now() + 60000;
    while ((!fs.existsSync(file) || fs.readdirSync(downloads).some(name => name.endsWith('.crdownload'))) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(file), 'Impact PDF downloads');
    const doc = await PDFDocument.load(fs.readFileSync(file)), labels = [];
    assert.equal(doc.getTitle(), 'Topology Impact Report'); assert(doc.getSubject().includes(snapshot)); assert(doc.getPageCount() >= 9);
    for (const [, stream] of doc.context.enumerateIndirectObjects()) if (stream instanceof PDFRawStream) {
      try { labels.push(...Array.from(inflateSync(stream.contents).toString('latin1').matchAll(/<([0-9A-F]+)> Tj/g), match => Buffer.from(match[1], 'hex').toString('latin1'))); } catch { /* Non-text image streams. */ }
    }
    const text = labels.join(' '), job = await page.evaluate(() => window.__topologyJobs.at(-1));
    assert(text.includes(`${job.data.graph.nodes.length} distinct CIs`));
    for (const label of ['Executive impact brief', 'Composition of this view', 'Model and service context', 'Service impact narrative', 'Cyber analyst review', 'Complete relationship register', 'Endpoint evidence register']) assert(text.includes(label), label);
    const joinedText = text.replace(/\s+/g, ''); // Long source IDs wrap across table lines without losing characters.
    for (const node of job.data.graph.nodes) assert(joinedText.includes(node.sourceId.replace(/\s+/g, '')), `Complete register includes ${node.sourceId}`);
    if (job.data.graph.mode === 'dependencies') assert(job.data.graph.edges.every(edge => edge.kind !== 'observation'), 'Dependencies PDF excludes ARP and communication');
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-topology-impact-report]'));
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); fs.copyFileSync(file, path.join(artifacts, `${provider}-${filename}.pdf`)); }
    return job;
  };
  const assertCapture = (job, graph) => {
    assert.deepEqual(job.data.graph.nodes.map(node => node.id).sort(), graph.map(node => node.id).sort());
    assert.deepEqual(job.data.graph.rootIds.slice().sort(), graph.filter(node => node.starting).map(node => node.id).sort());
    for (const point of job.data.positions) {
      const actual = graph.find(node => node.id === point.id).position;
      assert(Math.abs(point.x - actual[0]) < 0.001 && Math.abs(point.y - actual[1]) < 0.001, 'Export captures displayed node positions');
    }
  };
  try {
    await page.setViewport({ width: 1600, height: 1000 });
    await visit('network=net-1&topologyMode=dependencies');
    const count = Number((await page.$eval('.topology-results header span', node => node.textContent)).replace(/[^\d]/g, ''));
    assert(count > 50); assert.equal(await page.$$eval('[data-topology-result]', nodes => nodes.length), 50);
    await page.focus('[data-topology-show-all]'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.topology-explorer').dataset.topologySelection === 'all');
    assert.equal(new URL(page.url()).searchParams.get('topologyAll'), '1');
    assert.equal(await page.$$eval('[data-topology-node].is-root', nodes => nodes.length), count, 'Includes matches beyond the visible results page');
    await instrument();
    await page.evaluate(() => { window.__topologyWorkerMode = 'hold'; });
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__topologyJobs.length === 1);
    assert(await page.$eval(button, node => node.disabled));
    await page.$eval(button, node => { node.click(); node.click(); });
    assert.equal(await page.evaluate(() => window.__topologyJobs.length), 1, 'Busy clicks do not duplicate generation');
    await page.keyboard.press('Escape'); await page.waitForSelector('.document-generation-dialog[open]', { hidden: true });
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-topology-impact-report]'));
    assert.equal(fs.readdirSync(downloads).length, 0, 'Cancelled report produces no download');
    await page.evaluate(() => { window.__topologyWorkerMode = 'fail'; });
    const graph = await capture();
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForSelector('.document-generation-dialog[open] [role=alert]');
    assert(await page.$eval('.document-generation-dialog', node => node.contains(document.activeElement)));
    await page.evaluate(() => { window.__topologyWorkerMode = 'normal'; });
    await page.focus('.document-generation-actions button:first-child'); await page.keyboard.press('Enter');
    const allJob = await complete(date, 'impact-all-results'); assertCapture(allJob, graph);
    const jobs = await page.evaluate(() => window.__topologyJobs); assert.equal(jobs.length, 3); assert.deepEqual(jobs[1], jobs[2], 'Retry uses the frozen evidence and timestamp');
    await page.click('[data-topology-result]');
    await page.waitForFunction(() => document.querySelector('.topology-explorer').dataset.topologySelection === 'single');
    assert.equal(new URL(page.url()).searchParams.get('topologyAll'), null);
    await visit('system=sys-1&topologyAll=1&topologyMode=dependencies', historicalDate);
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('[data-topology-show-all]', node => node.getAttribute('aria-pressed')), 'true');
    await page.setViewport({ width: 390, height: 844 });
    if (await page.$('[aria-label="Hide sidebar"]')) await page.click('[aria-label="Hide sidebar"]');
    await page.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width < 50);
    await new Promise(resolve => setTimeout(resolve, 800));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await instrument();
    const compact = await capture(); await page.focus(button); await page.keyboard.press('Enter');
    const compactJob = await complete(historicalDate, 'impact-historical-phone'); assertCapture(compactJob, compact);
    assert.equal(compactJob.data.snapshotDate, historicalDate); assert(compactJob.data.scope.systems[0].includes('sys-1'));
    if (artifacts) { await page.$eval('.topology-main', node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(artifacts, `${provider}-impact-phone.png`) }); }
    // Filtering all-results follows the current match set; clearing restores it.
    await visit('network=net-1&topologyAll=1&topologyMode=dependencies&topology_name=NoSuchCiReportSmoke');
    assert(await page.$eval(button, node => node.disabled)); assert(await page.$eval('[data-topology-show-all]', node => node.disabled));
    await page.focus('[aria-label="Clear CI name or ID bookmark search"]'); await page.keyboard.press('Enter'); await page.waitForSelector('.topology-canvas');
    assert.equal(await page.$eval('[data-topology-show-all]', node => node.getAttribute('aria-pressed')), 'true');
    await page.setViewport({ width: 1600, height: 1000 });
    await visit('system=sys-1&topologyCi=system:sys-1&topologyMode=dependencies');
    await instrument();
    await page.click('[data-topology-fullscreen]'); await page.waitForSelector('dialog.topology-fullscreen[open]');
    await page.select('[aria-label="Topology layout"]', 'circular'); await new Promise(resolve => setTimeout(resolve, 800));
    const radial = await capture();
    fs.unlinkSync(path.join(downloads, `topology-impact-${date}.pdf`));
    await page.focus(button); await page.keyboard.press('Enter');
    const modalJob = await complete(date, 'impact-system'); assertCapture(modalJob, radial); assert.equal(modalJob.data.layout, 'circular');
    assert(await page.$eval('dialog.topology-fullscreen', node => node.open && node.matches(':modal')), 'Report modal returns to the full-screen graph');
    await page.keyboard.press('Escape'); await page.waitForSelector('dialog.topology-fullscreen[open]', { hidden: true });
    await page.focus('[role=tab][id$="-dependencies"]'); await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('.topology-explorer').dataset.topologyMode === 'business-impact');
    await new Promise(resolve => setTimeout(resolve, 800));
    fs.unlinkSync(path.join(downloads, `topology-impact-${date}.pdf`));
    const businessGraph = await capture(); await page.focus(button); await page.keyboard.press('Enter');
    const businessJob = await complete(date, 'impact-business'); assertCapture(businessJob, businessGraph);
    assert.equal(businessJob.data.graph.mode, 'business-impact'); assert.equal(businessJob.data.graph.nodes.filter(node => node.kind === 'asset').length, 0, 'Business Impact report retains the model-level view');
    console.log(`Topology all-results and PDF checks passed (${provider}): pagination, frozen retry, cancel, keyboard focus, historical compact positions, empty filters and full-screen radial export.`);
  } finally {
    await page.setViewport({ width: 1600, height: 1000 }); await client.detach();
  }
}
