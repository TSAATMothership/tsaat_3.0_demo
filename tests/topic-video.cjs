'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'guide/TSAAT-User-Guide.html')).href;
const out=path.join(root,'build/test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const topic=process.argv[2]||'navigate';
  const capture=JSON.parse(fs.readFileSync(path.join(root,`assets/${topic}-walkthrough.json`),'utf8'));
  const digest=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  assert.equal(capture.sha256,digest(capture.source),'Recording must use the current practice app');
  assert.equal(capture.videoSha256,digest(`assets/${topic}-walkthrough.mp4`),'Recording provenance must match the video');
  assert.equal(capture.networkRequests,0);assert.equal(capture.pageErrors,0);
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    await context.route(/^https?:/,route=>route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url+'#topic/'+topic);
    const video=page.locator('#scope-video-player');await video.waitFor();
    assert.equal(await video.evaluate(v=>v.paused&&!v.autoplay&&v.preload==='none'),true);
    assert.equal(await page.locator('[data-video-step]').count(),capture.scenes.length);
    // Seeking works even before the first play request has loaded metadata.
    await page.locator('[data-video-step="3"]').click();
    await page.waitForFunction(()=>Math.abs(document.querySelector('video').currentTime-39)<0.1);
    assert.equal(await video.evaluate(v=>Math.round(v.duration)),capture.durationSeconds);
    assert.equal(await video.evaluate(v=>v.videoWidth),1440);
    assert.equal(await video.evaluate(v=>v.paused),true);
    await video.evaluate(v=>v.play());
    await page.waitForFunction(()=>document.querySelector('video').currentTime>39.2);
    await video.evaluate(v=>v.pause());
    // Every guide step has a chapter and two locally loaded caption cues.
    assert.equal(capture.scenes.length,require('../src/structure.json').topics[topic].n);
    await video.evaluate(v=>{v.textTracks[0].mode='hidden';});
    await page.waitForFunction(count=>document.querySelector('video').textTracks[0].cues?.length===count,capture.scenes.length*2);
    for(let i=0;i<capture.scenes.length;i++){
      await page.locator(`[data-video-step="${i}"]`).click();
      await page.waitForFunction(time=>Math.abs(document.querySelector('video').currentTime-time)<0.1,i*13);
      assert.equal(await page.locator(`[data-video-step="${i}"]`).getAttribute('aria-current'),'step');
    }
    await page.locator('.scope-video-transcript summary').click();
    assert.equal(await page.locator('.scope-video-transcript li').count(),capture.scenes.length);
    await page.locator('.scope-video-transcript summary').click();
    await page.locator('[data-video-step="0"]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('video').currentTime<0.1);
    await page.locator('.scope-video').screenshot({path:path.join(out,`${topic}-video-desktop.png`)});
    const old=await video.elementHandle();
    await page.locator('.breadcrumb').getByRole('link',{name:'TSAAT Feature Guide',exact:true}).click();
    await page.locator('.hero').waitFor();
    assert.equal(await old.evaluate(v=>v.paused&&!v.hasAttribute('src')),true);
    assert.equal(await page.locator('video').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      await page.goto(url+'#topic/'+topic);await video.waitFor();
      assert.equal(await video.evaluate(v=>v.paused),true);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
    }
    await page.locator('.scope-video').screenshot({path:path.join(out,`${topic}-video-mobile.png`)});
    await page.emulateMedia({media:'print'});assert.equal(await page.locator('.scope-video').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${topic}: actual-app provenance, offline playback, every chapter, captions, keyboard, route cleanup, mobile and print.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
