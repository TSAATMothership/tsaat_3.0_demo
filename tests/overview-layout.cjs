'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const url=pathToFileURL(path.resolve(__dirname,'../guide/TSAAT-User-Guide.html')).href;
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({offline:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('[data-ov-frame]').first().waitFor();
  const frames=page.locator('[data-ov-frame]');
  assert.equal(await frames.count(),8,'Each visible topic needs its own section frame');
  const assertFrames=async width=>{
   for(const frame of await frames.evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.ovFrame,height:node.getBoundingClientRect().height,width:node.clientWidth,scrollWidth:node.scrollWidth})))){
    assert.equal(frame.height,870,frame.id+' height at '+width);
    assert.ok(frame.scrollWidth<=frame.width,frame.id+' overflows horizontally at '+width);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const labels=await page.locator('.ov-kicker').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{
    const owner=node.closest('[role=tabpanel],[data-ov-frame]'),label=node.getBoundingClientRect(),section=owner.getBoundingClientRect();
    return {id:owner.id||owner.dataset.ovFrame,x:label.left-section.left,y:label.top-section.top+owner.scrollTop};
   }));
   for(const label of labels){assert.ok(Math.abs(label.y-22)<1,label.id+' label is not at the section top at '+width);assert.ok(Math.abs(label.x-(width<=900?8:10))<1,label.id+' label is not aligned left at '+width);}
  };
  for(const width of [1920,1440,1366,1024,768,390,320]){
   await page.setViewportSize({width,height:1080});
   for(const id of ['what','origins']){
    await page.locator(`[data-ov-intro-tab="${id}"]`).evaluate(node=>node.click());await assertFrames(width);
    if(width>=1366)assert.equal(await page.locator('#ov-'+id).evaluate(node=>node.scrollHeight-node.clientHeight),0,id+' should fit without scrolling on desktop');
   }
   if(width>=1366)assert.ok(await frames.evaluateAll(nodes=>nodes.every(node=>node.scrollHeight<=node.clientHeight)), 'Default desktop content exceeds its frame at '+width);
   for(const graphic of await page.locator('[data-ov-frame] .ov-topology-scroll').evaluateAll(nodes=>nodes.map(node=>{const svg=node.querySelector('svg').getBoundingClientRect();return {width:svg.width,height:svg.height,availableWidth:node.clientWidth,availableHeight:node.clientHeight};})))assert.ok(graphic.width<=graphic.availableWidth+1&&graphic.height<=graphic.availableHeight+1,'A topology was cropped at '+width);
  }
  // Every interactive state retains the same external height, including expanded report rules.
  for(const selector of ['[data-ov-timeline]','[data-ov-layer]','[data-ov-risk]','[data-ov-risk-device]','[data-ov-shadow-scenario]','[data-ov-shadow]','[data-ov-service]','[data-ov-report]','[data-ov-report-step]','[data-ov-benefit]']){
   for(const control of await page.locator(selector).all()){await control.evaluate(node=>node.click());await assertFrames(320);}
  }
  await page.locator('.ov-report-notes').evaluate(node=>node.open=true);await assertFrames(320);
  // Overflow is keyboard-scrollable; the final content is reachable rather than clipped.
  for(const selector of ['#ov-origins','#ov-terrain','[data-ov-frame="investigate"]','#ov-vulnerabilities','#ov-shadow','#ov-services','#ov-reporting','#ov-benefits']){
   const frame=page.locator(selector);await frame.focus();await page.keyboard.press('End');
   await page.waitForFunction(selector=>{const node=document.querySelector(selector);return node.scrollTop>=node.scrollHeight-node.clientHeight-2;},selector);
   assert.equal(await frame.evaluate(node=>getComputedStyle(node).overflowY),'auto');
   assert.equal(await frame.evaluate(node=>{const last=node.lastElementChild;return last.getBoundingClientRect().bottom<=node.getBoundingClientRect().bottom+1;}),true,'End content is clipped in '+selector);
  }
  // Returning to a chapter starts at its beginning, even after an inner scroll.
  await page.locator('#ov-chapter-select').selectOption('what');await page.locator('#ov-chapter-select').selectOption('terrain');
  assert.equal(await page.locator('#ov-terrain').evaluate(node=>node.scrollTop),0);
  await page.locator('#ov-chapter-select').selectOption('origins');assert.equal(await page.locator('#ov-origins').evaluate(node=>node.scrollTop),0);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#ov-what').isVisible(),true);assert.equal(await page.locator('#ov-origins').isVisible(),true);
  assert.ok(await frames.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).overflowY==='visible')),'Printed content must flow without clipping');
  assert.deepEqual(errors,[]);
  console.log('PASS: exactly 870 pixels per section at seven viewport widths; desktop content fits; diagrams fit; all selection states retain height; keyboard scrolling reaches narrow-screen content; navigation resets inner scrolling; print remains complete.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
