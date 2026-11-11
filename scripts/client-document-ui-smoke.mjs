import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

/** Header edits must never silently retarget a saved report, including an entity-specific URL. */
export async function checkSavedDocumentSelection(page, { base, date }) {
  const previous = new Date(date + 'T00:00:00Z'); previous.setUTCDate(previous.getUTCDate() - 7);
  const sources = [
    `/api/tasking-report?kind=spi&id=10&network=net-1&dataDate=${date}&results=non-compliant`,
    `/api/systems/sys-1/remediation-report?system=sys-1&securityDomain=PROTECTED&dataDate=${date}`
  ];
  for (const source of sources) {
    await page.goto(base + source, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-document-source]');
    assert.equal(await page.$eval('[data-document-source]', node => node.disabled), false);
    const changed = new URL(page.url());
    if (changed.searchParams.has('network')) changed.searchParams.set('network', 'net-2');
    else changed.searchParams.set('system', 'sys-2');
    changed.searchParams.set('securityDomain', 'SECRET');
    changed.searchParams.set('dataDate', previous.toISOString().slice(0, 10));
    await page.goto(changed.href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-document-selection-warning]');
    assert.equal(await page.$eval('[data-document-source]', node => node.disabled), true, 'Changed header selection blocks the saved export');
    assert.equal(await page.$eval('[data-document-source]', node => node.dataset.documentSource), source, 'Kind, entity and report filters stay unchanged');
    assert.equal(await page.$eval('[data-restore-document-selection]', node => node.getAttribute('href')), source);
    await page.focus('[data-restore-document-selection]');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
    await page.waitForSelector('[data-document-source]');
    assert.equal(new URL(page.url()).searchParams.get('source'), source);
    assert.equal(await page.$('[data-document-selection-warning]'), null);
    assert.equal(await page.$eval('[data-document-source]', node => node.disabled), false, 'Keyboard restore enables the original saved report');
  }
  return { changedHeaderBlocked: true, exactSourceRestored: true, dynamicEntityPreserved: true };
}

/** Exercise real browser downloads and cancellation at both network and worker stages. */
export async function checkClientDocumentInteraction(page, { base, date, directory }) {
  fs.mkdirSync(directory, { recursive: true });
  const savedSelection = await checkSavedDocumentSelection(page, { base, date });
  const source = '/api/governance/insights/report?network=net-1&dataDate=' + date;
  const button = '[data-document-source]';
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  await page.setViewport({ width: 390, height: 844 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(base + source, { waitUntil: 'networkidle0' });
  let mode = 'delay', requests = 0;
  const pending = new Set();
  const intercept = async request => {
    if (!request.url().includes('/api/governance/insights/report')) return request.continue();
    requests++;
    if (mode === 'delay') { pending.add(request); return; }
    if (mode === 'error') return request.respond({ status: 503, contentType: 'application/json', body: '{"error":"Temporary failure"}' });
    if (mode === 'long-name') {
      const job = await (await fetch(request.url(), { headers: { Accept: 'application/json' } })).json();
      job.filename = 'Configured report ' + 'x'.repeat(250) + '.pdf';
      return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(job) });
    }
    return request.continue();
  };
  await page.setRequestInterception(true); page.on('request', intercept);
  try {
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForSelector('.document-generation-dialog[open] [role="progressbar"]');
    const layout = await page.$eval('.document-generation-dialog', node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        focused: node.contains(document.activeElement), text: node.innerText,
        determinate: node.querySelector('[role="progressbar"]').hasAttribute('aria-valuenow'),
        animation: getComputedStyle(node.querySelector('.is-indeterminate')).animationName };
    });
    assert(layout.left >= 0 && layout.right <= 390 && layout.top >= 0 && layout.bottom <= 844, 'Progress fits the narrow viewport');
    assert(layout.focused, 'Native dialog keeps keyboard focus');
    assert.match(layout.text, /Generating Document/);
    assert.equal(layout.determinate, false, 'Unknown-duration work never invents a percentage');
    assert.equal(layout.animation, 'none', 'Reduced motion preference is respected');
    await page.screenshot({ path: path.join(directory, 'generating-document-narrow.png') });
    await page.$eval(button, node => { node.click(); node.click(); });
    assert.equal(requests, 1, 'Busy controls suppress duplicate generation');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.document-generation-dialog[open]'));
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-document-source]'));
    for (const request of pending) await request.abort().catch(() => {}); pending.clear();
    assert.equal(fs.readdirSync(directory).filter(file => /\.(pdf|crdownload)$/.test(file)).length, 0, 'Loading cancellation never downloads partial bytes');

    // Delay posting into a real Worker so Escape deterministically exercises termination.
    mode = 'normal';
    await page.evaluate(() => {
      window.__originalDocumentWorker = window.Worker; window.__documentTerminations = 0; window.__documentWorkers = 0;
      window.Worker = class extends window.__originalDocumentWorker {
        constructor(...args) { super(...args); window.__documentWorkers++; }
        postMessage(...args) { this.delayedMessage = setTimeout(() => super.postMessage(...args), 10000); }
        terminate() { clearTimeout(this.delayedMessage); window.__documentTerminations++; super.terminate(); }
      };
    });
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__documentWorkers === 1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.document-generation-dialog[open]'));
    assert(await page.evaluate(() => window.__documentTerminations >= 1), 'Cancellation terminates the native worker');
    assert.equal(fs.readdirSync(directory).filter(file => /\.(pdf|crdownload)$/.test(file)).length, 0);
    await page.evaluate(() => { window.Worker = window.__originalDocumentWorker; });

    mode = 'error';
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForSelector('.document-generation-dialog[open] [role="alert"]');
    assert.match(await page.$eval('.document-generation-dialog', node => node.innerText), /Try again/);
    mode = 'normal';
    // A worker startup failure must leave the same actionable retry path.
    await page.evaluate(() => { window.Worker = class { constructor() { throw new Error('Controlled worker startup failure'); } }; });
    await page.click('.document-generation-actions button:first-child');
    await page.waitForFunction(() => document.querySelector('.document-generation-dialog [role="alert"]')?.textContent.includes('Controlled worker'));
    await page.evaluate(() => { window.Worker = window.__originalDocumentWorker; });
    await page.click('.document-generation-actions button:first-child');
    await page.waitForFunction(() => !document.querySelector('.document-generation-dialog[open]'), { timeout: 90000 });
    const filename = path.join(directory, 'cyber-terrain-insights-' + date + '.pdf');
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(filename) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(filename), 'Retry generates a complete downloadable PDF');
    assert((await PDFDocument.load(fs.readFileSync(filename))).getPageCount() >= 7);
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-document-source]'));

    mode = 'long-name';
    await page.evaluate(() => {
      window.__originalDocumentCreateUrl = URL.createObjectURL;
      window.__originalDocumentAnchorClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = function(blob) {
        window.__longDocumentType = blob.type;
        blob.arrayBuffer().then(bytes => { window.__longDocumentBytes = Array.from(new Uint8Array(bytes)); });
        return window.__originalDocumentCreateUrl.call(URL, blob);
      };
      HTMLAnchorElement.prototype.click = function() {
        if (this.download) window.__longDocumentFilename = this.download;
        return window.__originalDocumentAnchorClick.call(this);
      };
    });
    await page.focus(button); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__longDocumentFilename && window.__longDocumentBytes?.length && !document.querySelector('.document-generation-dialog[open]'), { timeout: 90000 });
    const long = await page.evaluate(() => ({ filename: window.__longDocumentFilename, type: window.__longDocumentType, bytes: window.__longDocumentBytes }));
    assert.equal(long.filename.length, 220); assert(long.filename.endsWith('.pdf')); assert.equal(long.type, 'application/pdf');
    const longPdf = await PDFDocument.load(Uint8Array.from(long.bytes));
    assert(longPdf.getPageCount() >= 7, 'Long configured names retain readable PDF bytes and MIME');
    fs.writeFileSync(path.join(directory, 'long-filename-evidence.json'), JSON.stringify({ filename: long.filename, type: long.type, pages: longPdf.getPageCount() }, null, 2));
    return { networkCancel: true, workerCancel: true, networkRetry: true, workerRetry: true, narrowLayout: true, reducedMotion: true, keyboardFocus: true, longPdfFilename: true, ...savedSelection };
  } finally {
    for (const request of pending) await request.abort().catch(() => {});
    page.off('request', intercept); await page.setRequestInterception(false);
    await page.evaluate(() => {
      if (window.__originalDocumentWorker) window.Worker = window.__originalDocumentWorker;
      if (window.__originalDocumentCreateUrl) URL.createObjectURL = window.__originalDocumentCreateUrl;
      if (window.__originalDocumentAnchorClick) HTMLAnchorElement.prototype.click = window.__originalDocumentAnchorClick;
    });
    await page.emulateMediaFeatures([]); await page.setViewport({ width: 1600, height: 1000 });
    await client.detach();
  }
}
