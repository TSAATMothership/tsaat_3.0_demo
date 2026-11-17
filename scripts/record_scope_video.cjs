'use strict';
// Record the real bundled app. Only caption / pointer overlays are added;
// every screen, selection, result and navigation comes from the practice lab.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/scope-recording');
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&fs.existsSync(path.join(root,'build/browsers/ffmpeg-1011')))
  process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'build/browsers');
const {chromium}=require('playwright');
const size={width:1440,height:810},seconds=13;
const scenes=[
  {title:'Open a page first',captions:[
    'Expand Discovery and choose End Point Explorer.',
    'Choose Select managed networks to open the selection control.']},
  {title:'Choose networks or ICT systems',captions:[
    'Search by name or ID, then tick the networks you need.',
    'Choose Update. An ICT system selection would replace these networks.']},
  {title:'Set Security Domain',captions:[
    'Open Security Domain. Keep PROTECTED; untick SECRET and UNKNOWN.',
    'Choose Update. Keep at least one domain and a network or ICT system.']},
  {title:'Check which snapshot was loaded',captions:[
    'Set Date to 4 November 2026, then check Snapshot on the page.',
    'Snapshot is 31 October: the most recent saved data on or before the chosen date.']},
  {title:'Keep the same selection as you work',captions:[
    'Open Installed Software Explorer. Your selections carry across.',
    'Before sharing a result, check networks or systems, domains and the loaded snapshot.']},
];
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
      await app.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
      await app.locator('#workspace [aria-busy="true"]').waitFor({state:'hidden'});
      await app.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
    }
    await ready();
    // Prepare an unselected view through the same controls a learner uses.
    await app.getByRole('button',{name:/^Managed Network/}).click();
    await app.getByRole('checkbox',{name:'Aegis Mesh North',exact:true}).uncheck();
    await app.getByRole('button',{name:'Update Managed Network filter'}).click();
    await app.getByRole('button',{name:'Select managed networks',exact:true}).waitFor();
    await app.evaluate(()=>document.fonts.ready);

    await app.addStyleTag({content:`
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
      document.body.append(caption,pointer,focus,click);
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
      const box=await locator.boundingBox();assert.ok(box,'Target is visible');
      await focus(locator);await app.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:20});
    }
    async function click(locator){await point(locator);await app.waitForTimeout(220);await locator.click();}
    async function record(index,actions){
      await focus(null);await caption(index);
      await app.screencast.start({path:path.join(out,`step-${index+1}.webm`),size,quality:100});
      const start=performance.now();
      const at=async(time,action)=>{const wait=time*1000-(performance.now()-start);if(wait>0)await app.waitForTimeout(wait);if(action)await action();};
      await actions(at);
      assert.ok(performance.now()-start<seconds*1000,`Step ${index+1} exceeded its ${seconds}s chapter`);
      await at(seconds);await app.screencast.stop();
      await app.screenshot({path:path.join(out,`step-${index+1}-review.png`)});
      console.log(`Recorded actual practice lab step ${index+1}/5`);
    }
    await record(0,async at=>{
      await at(1,()=>click(app.getByRole('button',{name:'Discovery',exact:true})));
      await at(3,()=>click(app.getByRole('link',{name:'End Point Explorer',exact:true})));
      await at(6.5,()=>caption(0,1));
      await at(8,()=>click(app.getByRole('button',{name:'Select managed networks',exact:true})));
      await at(10,()=>focus(app.locator('.workspace-scope-popover')));
    });
    await record(1,async at=>{
      const search=app.getByRole('searchbox',{name:'Search Managed Network',exact:true});
      await at(.7,async()=>{await click(search);await search.pressSequentially('Aegis',{delay:130});});
      await at(2.5,()=>click(app.getByRole('checkbox',{name:'Aegis Mesh North',exact:true})));
      await at(4,async()=>{await click(search);await search.fill('');});
      await at(5.4,()=>click(app.getByRole('checkbox',{name:'Citadel Fusion Central',exact:true})));
      await at(6.5,()=>caption(1,1));
      await at(8,()=>click(app.getByRole('button',{name:'Update Managed Network filter',exact:true})));
      await ready();
      await app.waitForFunction(()=>new URL(location.hash.slice(1),'https://practice.invalid').searchParams.get('network')==='net-1,net-5');
      await at(10,()=>focus(app.getByRole('button',{name:/^Managed Network/})));
    });
    await record(2,async at=>{
      await at(.7,()=>click(app.getByRole('button',{name:/^Security Domain:/})));
      const domains=app.getByRole('group',{name:'Security Domain options',exact:true});
      await at(3,()=>click(domains.getByRole('checkbox',{name:'SECRET',exact:true})));
      await at(4.8,()=>click(domains.getByRole('checkbox',{name:'UNKNOWN',exact:true})));
      await at(6.5,()=>caption(2,1));
      await at(8,()=>click(app.getByRole('button',{name:'Update Security Domain filter',exact:true})));
      await app.waitForFunction(()=>location.hash.includes('securityDomain=PROTECTED'));await ready();
      await at(10,()=>focus(app.getByRole('button',{name:/^Security Domain:/})));
    });
    await record(3,async at=>{
      const date=app.getByLabel('Data date');
      await at(1,()=>point(date));
      await at(3,async()=>{await date.fill('2026-11-04');await date.press('Tab');});
      await app.waitForFunction(()=>document.querySelector('.endpoint-total small')?.textContent.includes('2026-10-31'));await ready();
      await at(6.5,()=>caption(3,1));
      await at(7,()=>point(app.locator('.endpoint-total')));
    });
    await record(4,async at=>{
      await at(1,()=>click(app.getByRole('link',{name:'Installed Software Explorer',exact:true})));
      await ready('Installed Software Explorer');
      const selections=new URL(new URL(app.url()).hash.slice(1),'https://practice.invalid').searchParams;
      assert.equal(selections.get('network'),'net-1,net-5');assert.equal(selections.get('securityDomain'),'PROTECTED');assert.equal(selections.get('dataDate'),'2026-11-04');
      await at(3.5,()=>point(app.getByRole('button',{name:/^Managed Network/})));
      await at(5,()=>point(app.getByRole('button',{name:/^Security Domain:/})));
      await at(6.5,()=>caption(4,1));
      await at(8,()=>point(app.locator('.endpoint-total')));
    });
    assert.deepEqual(errors,[],'App errors during recording');assert.deepEqual(requests,[],'Recording must remain offline');
    const bundle=fs.readFileSync(path.join(root,'guide/TSAAT-Practice-Lab.html'));
    const evidence={source:'guide/TSAAT-Practice-Lab.html',sha256:createHash('sha256').update(bundle).digest('hex'),viewport:size,secondsPerStep:seconds,scenes,selection:{networks:['Aegis Mesh North','Citadel Fusion Central'],securityDomain:'PROTECTED',requestedDate:'2026-11-04',loadedSnapshot:'2026-10-31'},networkRequests:requests.length,pageErrors:errors.length};
    fs.writeFileSync(path.join(out,'recording.json'),JSON.stringify(evidence,null,2)+'\n');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
