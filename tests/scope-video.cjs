'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'guide/TSAAT-User-Guide.html')).href;
const out=path.join(root,'build/test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const capture=JSON.parse(fs.readFileSync(path.join(root,'assets/scope-walkthrough.json'),'utf8'));
  const digest=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  assert.equal(capture.sha256,digest(capture.source),'Recording must use the current practice app');
  assert.equal(capture.videoSha256,digest('guide/scope-walkthrough.mp4'),'Recording provenance must match the companion video');
  assert.ok(!fs.readFileSync(path.join(root,'guide/TSAAT-User-Guide.html'),'utf8').includes('data:video/mp4;base64,'),'The HTML must not embed video files');
  assert.equal(capture.networkRequests,0);assert.equal(capture.pageErrors,0);
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    await context.route(/^https?:/,route=>route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url+'#topic/scope');
    const video=page.locator('#scope-video-player');await video.waitFor();
    assert.equal(await video.getAttribute('src'),'scope-walkthrough.mp4');
    assert.equal(await video.evaluate(v=>v.paused&&!v.autoplay&&v.preload==='none'),true);
    assert.equal(await page.locator('[data-video-step]').count(),5);
    // Seeking works even before the first play request has loaded metadata.
    await page.locator('[data-video-step="3"]').click();
    await page.waitForFunction(()=>Math.abs(document.querySelector('video').currentTime-39)<0.1);
    assert.equal(await video.evaluate(v=>Math.round(v.duration)),65);
    assert.equal(await video.evaluate(v=>v.videoWidth),1440);
    assert.equal(await video.evaluate(v=>v.paused),true);
    await video.evaluate(v=>v.play());
    await page.waitForFunction(()=>document.querySelector('video').currentTime>39.2);
    await video.evaluate(v=>v.pause());
    // Caption cues load locally; all five chapters have instruction text.
    await video.evaluate(v=>{v.textTracks[0].mode='hidden';});
    await page.waitForFunction(()=>document.querySelector('video').textTracks[0].cues?.length===10);
    for(let i=0;i<5;i++){
      await page.locator(`[data-video-step="${i}"]`).click();
      await page.waitForFunction(time=>Math.abs(document.querySelector('video').currentTime-time)<0.1,i*13);
      assert.equal(await page.locator(`[data-video-step="${i}"]`).getAttribute('aria-current'),'step');
    }
    await page.locator('.scope-video-transcript summary').click();
    assert.match(await page.locator('.scope-video-transcript').innerText(),/earliest one/);
    await page.locator('.scope-video-transcript summary').click();
    await page.locator('[data-video-step="0"]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('video').currentTime<0.1);
    await page.locator('.scope-video').screenshot({path:path.join(out,'scope-video-desktop.png')});
    const old=await video.elementHandle();
    await page.locator('.breadcrumb').getByRole('link',{name:'TSAAT Feature Guide',exact:true}).click();
    await page.locator('.hero').waitFor();
    assert.equal(await old.evaluate(v=>v.paused&&!v.hasAttribute('src')),true);
    assert.equal(await page.locator('video').count(),0);
    await page.locator('.group-cards a[href="#topic/scope"]').click();await video.waitFor();
    await page.locator('[data-action="workbook"]').click();
    const downloaded=page.waitForEvent('download');await page.locator('[data-action="save"]').click();
    const savedFolder=fs.mkdtempSync(path.join(out,'video-copy-'));
    const saved=path.join(savedFolder,'TSAAT-User-Guide.html');await (await downloaded).saveAs(saved);
    await page.goto(pathToFileURL(saved).href+'#topic/scope');await video.waitFor();
    // An HTML-only copy explains the missing companion; moving both files restores playback.
    await page.locator('[data-video-step="4"]').click();
    await page.locator('.scope-video-error:not([hidden])').waitFor();
    assert.match(await page.locator('.scope-video-error').innerText(),/scope-walkthrough\.mp4.*same folder/);
    for(const topic of ['scope','topology'])fs.copyFileSync(path.join(root,`guide/${topic}-walkthrough.mp4`),path.join(savedFolder,`${topic}-walkthrough.mp4`));
    await page.reload();await video.waitFor();
    assert.equal(await video.getAttribute('src'),'scope-walkthrough.mp4');
    await page.locator('[data-video-step="4"]').click();
    await page.waitForFunction(()=>document.querySelector('video').currentTime===52);
    await video.evaluate(v=>v.play());await page.waitForFunction(()=>document.querySelector('video').currentTime>52.2);await video.evaluate(v=>v.pause());
    // Relative paths also work for another topic after moving the guide and videos.
    await page.evaluate(()=>{location.hash='#topic/topology';});
    await page.locator('[data-video-step="5"]').click();
    await page.waitForFunction(()=>document.querySelector('video').currentTime===65);
    assert.equal(await video.evaluate(v=>Math.round(v.duration)),78);
    await video.evaluate(v=>v.play());await page.waitForFunction(()=>document.querySelector('video').currentTime>65.2);await video.evaluate(v=>v.pause());
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      await page.goto(url+'#topic/scope');await video.waitFor();
      assert.equal(await video.evaluate(v=>v.paused),true);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
    }
    await page.locator('.scope-video').screenshot({path:path.join(out,'scope-video-mobile.png')});
    await page.emulateMedia({media:'print'});assert.equal(await page.locator('.scope-video').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: offline video decoding/playback, initial seeking, all chapters, captions, keyboard, route cleanup, saved HTML playback, mobile/reduced motion and print.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
