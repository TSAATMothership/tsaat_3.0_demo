import assert from 'node:assert/strict';

/** Observe committed and pre-paint positions, rather than checking only the settled popup. */
export async function checkFilterPopupOpening(page, openPopup) {
  const probe = await page.evaluateHandle(() => {
    const samples = [];
    let frame;
    const sample = phase => {
      const popup = document.querySelector('.endpoint-filter-popup');
      if (!popup) return;
      const rect = popup.getBoundingClientRect(), style = getComputedStyle(popup);
      if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return;
      samples.push({ phase, label: popup.getAttribute('aria-label'), left: rect.left, top: rect.top });
    };
    const observer = new MutationObserver(() => sample('commit'));
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    const tick = () => { sample('frame'); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return { stop: () => { observer.disconnect(); cancelAnimationFrame(frame); return samples; } };
  });
  let samples;
  try {
    await openPopup();
    await page.waitForSelector('.endpoint-filter-popup', { visible: true });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  } finally {
    samples = await probe.evaluate(probe => probe.stop());
    await probe.dispose();
  }
  assert(samples.some(row => row.phase === 'frame'), 'The probe must observe a visible popup frame');
  assert.deepEqual(samples.filter(row => row.left <= 1 && row.top <= 1), [], 'A visible filter must never flash at the viewport origin');
}
