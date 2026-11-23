'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const url=pathToFileURL(path.resolve(__dirname,'../guide/TSAAT-User-Guide.html')).href;
const output=path.resolve(__dirname,'../build/test-results');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference',offline:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('.ov-rail').waitFor();
  const tabs=page.getByRole('tablist',{name:'TSAAT introduction'}),intro=page.locator('.ov-introduction');
  assert.deepEqual(await tabs.getByRole('tab').allTextContents(),['TSAAT Overview','Where did it come from?']);
  assert.equal(await page.getByRole('tabpanel').count(),1);
  assert.equal(await page.locator('#ov-what').isVisible(),true);assert.equal(await page.locator('#ov-origins').isVisible(),false);
  assert.equal(await intro.locator('#ov-terrain,#ov-investigate,#ov-reporting,#ov-benefits').count(),0,'Tabs must contain only the introduction and history');
  await tabs.getByRole('tab').first().focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#ov-origins').isVisible(),true);assert.equal(await page.locator('#ov-what').isVisible(),false);
  assert.equal(await tabs.getByRole('tab').last().evaluate(node=>node===document.activeElement),true);
  await page.locator('[data-ov-timeline="3"]').click();
  await tabs.getByRole('tab').first().click();await tabs.getByRole('tab').last().click();
  assert.equal(await page.locator('[data-ov-timeline="3"]').getAttribute('aria-pressed'),'true','Switching tabs must retain the selected milestone');
  await tabs.getByRole('tab').last().focus();await page.keyboard.press('Home');
  assert.equal(await tabs.getByRole('tab').first().getAttribute('aria-selected'),'true');
  await page.keyboard.press('End');assert.equal(await tabs.getByRole('tab').last().getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowRight');assert.equal(await tabs.getByRole('tab').first().getAttribute('aria-selected'),'true');
  assert.equal(await tabs.locator('[tabindex="0"]').count(),1);
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('#ov-origins').isVisible(),true);assert.equal(await page.locator('#ov-what').isVisible(),true);await page.emulateMedia({media:'screen'});
  const jump=async id=>{
   if(await page.locator('#ov-chapter-select').isVisible())await page.locator('#ov-chapter-select').selectOption(id);
   else await page.locator(`.ov-rail [data-ov-jump="${id}"]`).click();
  };
  const assertChapter=async id=>{
   await page.waitForFunction(id=>{
    const root=document.querySelector('.overview-page'),section=document.querySelector('#ov-'+id),rail=document.querySelector('.ov-rail').getBoundingClientRect(),top=(section.closest('.ov-introduction')||section).getBoundingClientRect().top;
    return root.dataset.activeChapter===id&&Math.abs(top-rail.bottom)<=1;
   },id,{timeout:3000});
   assert.equal(await page.locator('#ov-chapter-select').inputValue(),id);
   assert.equal(await page.locator('.ov-rail [aria-current="step"]').getAttribute('data-ov-jump'),id);
   const headerGap=await page.evaluate(()=>document.querySelector('.ov-rail').getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom);
   assert.equal(headerGap,18,'Chapter header moved away from its Introduction/Origins position: '+id);
  };
  // A second click must use the chosen chapter, not a chapter crossed en route.
  await jump('benefits');await assertChapter('benefits');
  await jump('terrain');await page.waitForTimeout(100);await page.locator('[data-ov-next]').click();await assertChapter('investigate');
  await page.locator('[data-ov-prev]').click();await page.locator('[data-ov-prev]').click();await assertChapter('origins');
  for(const [width,motion] of [[1440,'no-preference'],[1101,'no-preference'],[390,'no-preference'],[320,'reduce']]){
   await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:motion});
   await jump('what');await assertChapter('what');
   for(const id of ['origins','what']){
    const tabTop=await tabs.evaluate(node=>node.getBoundingClientRect().top);
    await page.locator(`[data-ov-intro-tab="${id}"]`).click();
    assert.equal(await tabs.evaluate(node=>node.getBoundingClientRect().top),tabTop,'Changing introduction tabs shifted the tab bar');
    assert.equal(await page.locator('.overview-page').getAttribute('data-active-chapter'),id);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Introduction tabs overflow at '+width);
   }
   if(width===1440||width===390)for(const id of ['what','origins']){await jump(id);await intro.screenshot({path:path.join(output,`overview-intro-${id}-${width}.png`)});}
   for(const id of ['benefits','origins','terrain','investigate','reporting','what']){
    await page.mouse.move(width-30,700);await page.mouse.wheel(0,350);await page.waitForTimeout(120);
    await jump(id);await assertChapter(id);
   }
   // Scrolling after selecting a chapter must remain under the reader's control.
   await jump('benefits');await assertChapter('benefits');
   const selectedY=await page.evaluate(()=>scrollY);
   await page.mouse.move(width-30,700);await page.mouse.wheel(0,-700);
   await page.waitForFunction(y=>scrollY<y-400,selectedY);
   const manualY=await page.evaluate(()=>scrollY);await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>scrollY),manualY,'Chapter navigation pulled the page back after a manual scroll');
   await jump('origins');await assertChapter('origins');
   if(width<=1100){
    // A focused chooser must follow wheel scrolling, so an old selection can be chosen again.
    await page.locator('#ov-chapter-select').focus();await page.mouse.move(width-3,700);await page.mouse.wheel(0,1000);
    await page.waitForFunction(()=>document.querySelector('.overview-page').dataset.activeChapter==='terrain');
    assert.equal(await page.locator('#ov-chapter-select').inputValue(),'terrain','Focused chapter chooser kept a stale value');
    await jump('origins');await assertChapter('origins');
   }
  }
  // The highlighted chapter follows the dominant visible frame, before its top reaches the header.
  await page.setViewportSize({width:1440,height:900});await jump('terrain');
  for(const [frameId,chapter] of [['investigate','investigate'],['vulnerabilities','investigate'],['shadow','investigate'],['services','investigate'],['reporting','reporting'],['benefits','benefits']]){
   await page.locator(`[data-ov-frame="${frameId}"]`).evaluate(node=>scrollTo({top:scrollY+node.getBoundingClientRect().top-300,behavior:'instant'}));
   await page.waitForFunction(chapter=>document.querySelector('.overview-page').dataset.activeChapter===chapter,chapter);
   assert.equal(await page.locator('.ov-rail [aria-current="step"]').getAttribute('data-ov-jump'),chapter);
  }
  // The final chapter must align and select correctly even when the viewport is much taller than 870px.
  for(const [width,height] of [[1920,1200],[2560,1440]]){
   await page.setViewportSize({width,height});
   for(const id of ['what','origins','terrain','investigate','reporting','benefits']){await jump(id);await assertChapter(id);}
  }
  await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'no-preference'});
  await jump('terrain');await page.locator('[data-ov-layer="4"]').click();
  await page.locator('#sidebar a[href="#overview"]').click();
  assert.equal(await page.evaluate(()=>scrollY),0,'Selecting the current Overview route should return to its beginning');
  assert.equal(await page.locator('[data-ov-layer="4"]').getAttribute('aria-pressed'),'true','Returning to the overview reset diagram choices');
  assert.equal(await page.locator('.ov-process button,.ov-process a,.ov-process [tabindex],.ov-process [data-ov-jump]').count(),0,'Process cards must not act as navigation controls');
  for(const card of await page.locator('.ov-process-step').all()){
   await card.scrollIntoViewIfNeeded();await page.mouse.move(10,10);
   const background=await card.evaluate(node=>getComputedStyle(node).backgroundColor);
   await card.hover();assert.notEqual(await card.evaluate(node=>getComputedStyle(node).backgroundColor),background,'Process card did not highlight on hover');
   const position=await page.evaluate(()=>scrollY),route=page.url();
   await card.click();assert.equal(await page.evaluate(()=>scrollY),position,'Process card click navigated the page');assert.equal(page.url(),route);
   await page.mouse.move(10,10);assert.equal(await card.evaluate(node=>getComputedStyle(node).backgroundColor),background,'Process card highlight did not clear');
  }
  await page.locator('#sidebar a[href="#feature-guide"]').click();await page.locator('.feature-guide').waitFor();
  await page.locator('#sidebar a[href="#overview"]').click();await page.locator('.overview-page').waitFor();
  await jump('reporting');await assertChapter('reporting');
  await page.locator('#sidebar a[href="#overview"]').click();
  assert.equal(await page.evaluate(()=>scrollY),0,'Repeated Overview link failed when its hash was already selected');
  assert.deepEqual(errors,[]);
  console.log('PASS: accessible introduction/history tabs; keyboard navigation and retained milestones; stable desktop/mobile tab layout; chapter buttons after wheel scrolling; highlight follows the dominant visible section; final-section alignment on tall displays; rapid next/previous clicks; manual scroll remains in control; focused mobile chooser follows the page; repeated Overview navigation preserves selections; reduced motion and print.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
