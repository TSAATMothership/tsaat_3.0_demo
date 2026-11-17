'use strict';
// Record the real bundled app. Only caption / pointer overlays are added;
// every screen, selection, result and navigation comes from the practice lab.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const preflight=process.argv.includes('--check');
const stepsArg=process.argv.find(arg=>arg.startsWith('--steps='));
const selectedSteps=stepsArg?new Set(stepsArg.slice(8).split(',').map(Number)):null;
const root=path.resolve(__dirname,'..'),topic=process.argv[2],out=path.join(root,`build/${topic}-recording`);
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&fs.existsSync(path.join(root,'build/browsers/ffmpeg-1011')))
  process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'build/browsers');
const {chromium}=require('playwright');
const size={width:1440,height:810},seconds=13;
const workflow=require(`./walkthroughs/${topic}.cjs`),scenes=workflow.scenes;
const titles=JSON.parse(fs.readFileSync(path.join(out,'titles.json'),'utf8'));
assert.equal(scenes.length,titles.length,'One chapter for every guide step');
scenes.forEach((scene,i)=>scene.title=titles[i]);
if(selectedSteps){
  const previous=JSON.parse(fs.readFileSync(path.join(out,'recording.json'),'utf8'));
  assert.deepEqual(previous.scenes,scenes,'Partial refresh requires unchanged chapter wording');
  assert.equal(previous.sha256,createHash('sha256').update(fs.readFileSync(path.join(root,previous.source))).digest('hex'));
  for(const step of selectedSteps)assert.ok(Number.isInteger(step)&&step>=1&&step<=scenes.length,'Invalid chapter');
  for(let i=1;i<=scenes.length;i++)assert.ok(fs.existsSync(path.join(out,`step-${i}.webm`)),'Missing original chapter');
}
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:size,offline:true,locale:'en-AU',timezoneId:'Australia/Sydney'});
    const errors=[],requests=[];
    context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});});
    const guide=await context.newPage();
    await guide.goto(pathToFileURL(path.join(root,'guide/TSAAT-User-Guide.html')).href+'#practice');
    const popup=context.waitForEvent('page');await guide.locator('#lab-launch button').click();const app=await popup;
    await app.setViewportSize(size);
    async function ready(title='End Point Explorer'){
      const briefing={'End Point Insights':'#endpoint-insights-title','Installed Software Insights':'#software-briefing-title','Security Vulnerability Insights':'#vulnerability-insights-title'};
      const heading=briefing[title]?app.locator(briefing[title]):app.getByRole('heading',{name:title,exact:true,level:1});
      await heading.waitFor();
      await app.locator('#workspace [aria-busy="true"]').waitFor({state:'hidden'});
      await heading.waitFor();
    }
    await ready();
    await app.evaluate(()=>document.fonts.ready);
    await app.addStyleTag({content:`
      #recording-overlay{position:fixed;inset:0;width:100vw;height:100vh;margin:0;padding:0;border:0;background:transparent;pointer-events:none;overflow:visible}
      #recording-overlay::backdrop{background:transparent;pointer-events:none}
      #recording-caption{position:fixed;z-index:2147483645;left:18px;right:18px;bottom:16px;padding:16px 22px;display:flex;align-items:center;gap:20px;pointer-events:none;background:#0a1926f5;border:1px solid #42717a;border-radius:12px;box-shadow:0 8px 40px #0008;color:#ecf3f6;font-family:'Segoe UI',sans-serif}
      #recording-number{font-size:43px;line-height:1;font-weight:650;color:#79e2d2;min-width:55px}
      #recording-title{font-size:25px;font-weight:600;line-height:1.2;margin-bottom:7px}
      #recording-instruction{font-size:19px;line-height:1.4;color:#c4d7df}
      #recording-caption small{margin-left:auto;align-self:flex-start;white-space:nowrap;font-size:11px;letter-spacing:.08em;color:#79e2d2}
      #recording-pointer{position:fixed;z-index:2147483647;pointer-events:none;width:28px;height:36px;left:700px;top:620px;filter:drop-shadow(0 2px 2px #000a)}
      #recording-focus{position:fixed;z-index:2147483644;pointer-events:none;display:none;border:2px solid #79e2d2;border-radius:8px;box-shadow:0 0 0 4px #79e2d229;transition:all .22s ease}
      #recording-click{position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #79e2d2;border-radius:50%;width:34px;height:34px;opacity:0}
    `});
    await app.evaluate(()=>{
      const caption=document.createElement('div');caption.id='recording-caption';caption.setAttribute('aria-hidden','true');
      caption.innerHTML='<span id="recording-number"></span><div><div id="recording-title"></div><div id="recording-instruction"></div></div><small>ACTUAL PRACTICE LAB · SAMPLE DATA</small>';
      const pointer=document.createElement('div');pointer.id='recording-pointer';pointer.setAttribute('aria-hidden','true');
      pointer.innerHTML='<svg viewBox="0 0 28 36"><path d="M2 1L3 29l7-8 7 13 6-3-7-13 11-1Z" fill="#fff" stroke="#0a1521" stroke-width="2"/></svg>';
      const focus=document.createElement('div');focus.id='recording-focus';
      const click=document.createElement('div');click.id='recording-click';
      const overlay=document.createElement('div');overlay.id='recording-overlay';overlay.setAttribute('popover','manual');overlay.setAttribute('aria-hidden','true');
      overlay.append(caption,pointer,focus,click);document.body.append(overlay);overlay.showPopover();
      // Native dialogs occupy the browser's top layer above ordinary z-index.
      // Raise the recording overlay after a dialog opens without changing the app.
      let activeDialog=null;
      new MutationObserver(()=>{
        const dialog=document.querySelector('dialog[open]');
        if(dialog!==activeDialog){activeDialog=dialog;overlay.hidePopover();overlay.showPopover();}
      }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
      document.addEventListener('mousemove',event=>{pointer.style.left=event.clientX+'px';pointer.style.top=event.clientY+'px';});
      document.addEventListener('mousedown',event=>{click.style.left=(event.clientX-17)+'px';click.style.top=(event.clientY-17)+'px';click.animate([{opacity:1,transform:'scale(.6)'},{opacity:0,transform:'scale(2)'}],{duration:650});});
    });
    async function caption(index,half=0){
      await app.evaluate(({index,title,instruction})=>{
        document.querySelector('#recording-number').textContent=String(index+1).padStart(2,'0');
        document.querySelector('#recording-title').textContent=title;
        document.querySelector('#recording-instruction').textContent=instruction;
      },{index,title:scenes[index].title,instruction:scenes[index].captions[half]});
    }
    async function focus(locator){
      const box=locator?await locator.boundingBox():null;
      await app.evaluate(box=>{const el=document.querySelector('#recording-focus');if(!box){el.style.display='none';return;}Object.assign(el.style,{display:'block',left:(box.x-4)+'px',top:(box.y-4)+'px',width:(box.width+8)+'px',height:(box.height+8)+'px'});},box);
    }
    async function point(locator){
      await locator.scrollIntoViewIfNeeded();
      let box=await locator.boundingBox();assert.ok(box,'Target is visible');
      if(box.y+box.height>650){await locator.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));box=await locator.boundingBox();}
      await focus(locator);await app.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:20});
    }
    async function click(locator){await point(locator);await app.waitForTimeout(220);await locator.click();await focus(null);}
    async function record(index,actions){
      await focus(null);await caption(index);
      if(preflight||(selectedSteps&&!selectedSteps.has(index+1))){
        await actions(async(_time,action)=>{if(action)await action();});
        console.log(`Verified practice lab step ${index+1}/${scenes.length}`);
        return;
      }
      await app.screencast.start({path:path.join(out,`step-${index+1}.webm`),size,quality:100});
      const start=performance.now();
      const at=async(time,action)=>{const wait=time*1000-(performance.now()-start);if(wait>0)await app.waitForTimeout(wait);if(action)await action();};
      await actions(at);
      assert.ok(performance.now()-start<seconds*1000,`Step ${index+1} exceeded its ${seconds}s chapter`);
      await at(seconds);await app.screencast.stop();
      await app.screenshot({path:path.join(out,`step-${index+1}-review.png`)});
      console.log(`Recorded actual practice lab step ${index+1}/${scenes.length}`);
    }
    async function open(title,group='Discovery'){
      const link=app.getByRole('link',{name:title,exact:true});
      if(!await link.isVisible())await click(app.getByRole('button',{name:group,exact:true}));
      await click(link);await ready(title);
    }
    async function download(button){
      const pending=app.waitForEvent('download');await click(button);const file=await pending;
      assert.equal(await file.failure(),null);await file.saveAs(path.join(out,file.suggestedFilename()));
      return file.suggestedFilename();
    }
    try{
      await workflow.run({app,context,ready,open,record,caption,focus,point,click,download,assert,out});
    }catch(error){
      await app.screenshot({path:path.join(out,'failure.png')});
      fs.writeFileSync(path.join(out,'failure.txt'),await app.locator('body').ariaSnapshot());
      throw error;
    }
    assert.deepEqual(errors,[],'App errors during recording');assert.deepEqual(requests,[],'Recording must remain offline');
    const bundle=fs.readFileSync(path.join(root,'guide/TSAAT-Practice-Lab.html'));
    const evidence={source:'guide/TSAAT-Practice-Lab.html',sha256:createHash('sha256').update(bundle).digest('hex'),viewport:size,secondsPerStep:seconds,scenes,topic,networkRequests:requests.length,pageErrors:errors.length};
    if(!preflight)fs.writeFileSync(path.join(out,'recording.json'),JSON.stringify(evidence,null,2)+'\n');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
