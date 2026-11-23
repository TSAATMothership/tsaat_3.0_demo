'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),guide=path.join(root,'guide');
const url=pathToFileURL(path.join(guide,'TSAAT-User-Guide.html')).href;
const content=JSON.parse(fs.readFileSync(path.join(root,'src/overview-content.json'),'utf8'));
const films=JSON.parse(fs.readFileSync(path.join(root,'assets/overview-videos.json'),'utf8'));
const output=path.join(root,'build/test-results');fs.mkdirSync(output,{recursive:true});
const ids=['what','origins','terrain','investigate','reporting','benefits'];
const filmIds=['what','origins','terrain','vulnerabilities','shadow','services','reporting','benefits'];
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference',offline:true,acceptDownloads:true});
  const errors=[],requests=[];
  context.on('page',page=>{
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  });
  const page=await context.newPage();
  const ready=()=>page.getByRole('heading',{level:1,name:'TSAAT Overview',exact:true}).waitFor();
  await page.goto(url);await ready();
  assert.match(await page.title(),/^TSAAT Overview/);
  assert.equal(await page.locator('#sidebar nav a').count(),5);
  assert.equal(await page.locator('#sidebar nav a').first().getAttribute('href'),'#overview');
  assert.equal(await page.locator('#sidebar a[aria-current="page"]').innerText(),'TSAAT Overview');
  assert.deepEqual(await page.locator('[data-ov-section]').evaluateAll(sections=>sections.map(section=>section.dataset.ovSection)),ids);
  assert.equal(await page.locator('#ov-understand,[data-ov-jump="understand"],[data-overview-video="understand"]').count(),0,'Removed chapter or video remains available');
  assert.equal(await page.locator('#ov-benefits .ov-kicker>span').innerText(),'06','Benefits must follow Reporting as chapter six');
  assert.deepEqual(Object.keys(films).sort(),[...filmIds].sort(),'Video manifest must contain only active chapters');
  assert.equal(await page.locator('video[src]').count(),0,'Films must not preload before a request');
  for(const id of filmIds){
   await page.locator(`#ov-${id}`).waitFor();
   assert.ok(await page.locator(`[data-overview-video="${id}"]`).count()>0,'Missing film button: '+id);
  }
  assert.equal(await page.locator('#ov-systems').count(),0,'Removed systems chapter is still present');
  assert.deepEqual(await page.locator('#ov-investigate [data-ov-subsection]').evaluateAll(nodes=>nodes.map(node=>node.dataset.ovSubsection)),['vulnerabilities','shadow','services']);
  assert.equal(await page.locator('#ov-investigate > .ov-investigate-intro h2').innerText(),'Investigate an issue or finding');
  for(const id of ['vulnerabilities','shadow','services'])assert.equal(await page.locator(`#ov-${id} .ov-copy > h3`).count(),1);
  assert.equal(await page.locator('#ov-what .ov-lead').innerText(),'Turn observations into context.');
  assert.match(await page.locator('.ov-hero-visual').innerText(),/Business services/);
  assert.match(await page.locator('.ov-hero-visual').innerText(),/Mission services/);
  assert.match(await page.locator('.ov-hero-visual').innerText(),/Context aware/);
  assert.doesNotMatch(await page.locator('.overview-page').innerText(),/Watch film|Mission systems|Connected context/);
  assert.deepEqual(await page.locator('.ov-start-here button > span').allTextContents(),['Understand the Cyber Terrain','Investigate an issue or finding','Turn insights into a report']);
  assert.equal(await page.locator('.ov-vulnerabilities .ov-copy').evaluate(el=>getComputedStyle(el).position),'static');
  await page.locator('.ov-start-here [data-ov-jump="investigate"]').click();
  await page.waitForFunction(()=>document.querySelector('.overview-page').dataset.activeChapter==='investigate');
  // The investigation introduction is a connected story with selectable evidence.
  const investigation=page.locator('.ov-investigation-story');
  assert.equal(await page.locator('.ov-investigate-topics').count(),0,'The three topic cards were not replaced');
  assert.equal(await investigation.locator('[data-ov-investigation-stage]').count(),3);
  const investigationLayout=()=>investigation.evaluate(host=>Object.fromEntries(['.ov-investigation-visual','.ov-investigation-transport','.ov-investigation-caption'].map(selector=>{const box=host.querySelector(selector).getBoundingClientRect();return [selector,{top:Math.round(box.top-host.getBoundingClientRect().top),width:Math.round(box.width),height:Math.round(box.height)}];})));
  const investigationFrame=()=>investigation.locator('svg.ov-investigation-diagram').evaluate(svg=>svg.outerHTML);
  const investigationElapsed=async()=>Number(await investigation.getAttribute('data-investigation-elapsed'));
  await investigation.locator('.ov-investigation-visual').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await investigation.locator('[data-ov-investigation-replay]').click();
  await page.waitForFunction(()=>document.querySelector('.ov-investigation-story').dataset.investigationPlayback==='playing');
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-story-signal]')].some(node=>node.getAttribute('opacity')==='1'));
  assert.equal(await investigation.evaluate(host=>[...host.querySelectorAll('[data-story-route]')].every(path=>{
   const dot=host.querySelector('[data-story-signal="'+path.dataset.storyRoute+'"]'),progress=1-Number(path.getAttribute('stroke-dashoffset')),point=path.getPointAtLength(path.getTotalLength()*progress);
   return Math.abs(point.x-Number(dot.getAttribute('cx')))<.02&&Math.abs(point.y-Number(dot.getAttribute('cy')))<.02;
  })),true,'Story signals must follow their drawn paths');
  await investigation.locator('[data-ov-investigation-play]').click();
  const pausedStory=await investigationFrame();await page.waitForTimeout(200);assert.equal(await investigationFrame(),pausedStory,'Paused story kept moving');
  const investigationBounds=await investigationLayout();
  for(const [index,topic] of ['vulnerabilities','shadow','services'].entries()){
   const object=investigation.locator(`[data-ov-investigation-stage="${index}"]`);await object.focus();await page.keyboard.press(index===1?'Space':'Enter');
   assert.equal(await investigation.getAttribute('data-investigation-step'),String(index));
   assert.equal(await object.getAttribute('aria-pressed'),'true');
   assert.deepEqual(await investigationLayout(),investigationBounds,'Selecting story evidence shifted the diagram or controls');
   const moment=investigation.locator('.ov-investigation-moment.is-active');
   assert.equal(await moment.locator('[data-ov-jump]').getAttribute('data-ov-jump'),topic);
   await investigation.screenshot({path:path.join(output,`overview-investigation-moment-${index+1}.png`)});
   await moment.locator('[data-ov-jump]').click();
   assert.equal(await page.locator(`#ov-title-${topic}`).evaluate(el=>el===document.activeElement),true,'Story link did not open its detailed example');
  }
  await investigation.locator('[data-ov-investigation-next]').click();
  assert.equal(await investigation.getAttribute('data-investigation-step'),'3');
  assert.equal(await investigation.locator('[data-ov-investigation-stage]').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='1')),true,'Final moment must connect all three leads');
  await investigation.locator('[data-ov-investigation-replay]').click();
  assert.ok(await investigationElapsed()<500);
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(150);
  const offscreenStoryTime=await investigationElapsed();await page.waitForTimeout(200);assert.equal(await investigationElapsed(),offscreenStoryTime,'Offscreen story kept playing');
  await investigation.locator('.ov-investigation-visual').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.ov-investigation-story').dataset.investigationPlayback==='playing');
  await page.locator('[data-ov-expand="terrain"]').evaluate(node=>node.click());
  const blockedStoryTime=await investigationElapsed();await page.waitForTimeout(200);assert.equal(await investigationElapsed(),blockedStoryTime,'Story kept playing behind the diagram dialog');
  await page.locator('[data-ov-close-diagram]').click();
  await investigation.locator('.ov-investigation-visual').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.ov-investigation-story').dataset.investigationStep==='3',null,{timeout:16000});
  await page.waitForFunction(()=>document.querySelector('.ov-investigation-story').dataset.investigationStep==='0',null,{timeout:5000});
  assert.equal(await investigation.getAttribute('data-investigation-playback'),'playing','Story must loop after its conclusion');
  assert.equal(await investigation.locator('[data-ov-investigation-status]').innerText(),'Looping');
  assert.equal(await investigation.locator('.ov-investigation-caption').getAttribute('aria-live'),'off','Automatic loops must not repeatedly announce captions');
  const loopedStoryTime=await investigationElapsed();await page.waitForTimeout(200);assert.ok(await investigationElapsed()>loopedStoryTime,'New story cycle did not advance');
  await investigation.locator('[data-ov-investigation-play]').click();
  const stoppedStoryTime=await investigationElapsed();
  assert.equal(await investigation.locator('.ov-investigation-caption').getAttribute('aria-live'),'polite');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(150);
  await investigation.locator('.ov-investigation-visual').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForTimeout(200);
  assert.equal(await investigation.getAttribute('data-investigation-playback'),'paused','Returning to the story must preserve an explicit pause');
  assert.equal(await investigationElapsed(),stoppedStoryTime,'Paused story restarted after returning to view');
  await page.locator('.ov-rail [data-ov-jump="what"]').click();
  await page.waitForFunction(()=>document.querySelector('.overview-page').dataset.activeChapter==='what');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:path.join(output,'overview-desktop.png')});
  // The overview is a distinct default route; existing guide routes retain their destination.
  await page.locator('#sidebar a[href="#feature-guide"]').click();
  await page.getByRole('heading',{level:1,name:'TSAAT Feature Guide',exact:true}).waitFor();
  assert.equal(await page.locator('.overview-page').count(),0);
  await page.locator('#sidebar a[href="#overview"]').click();await ready();
  await page.goBack();await page.locator('.feature-guide').waitFor();
  await page.goBack();await ready();
  await page.locator('#sidebar a[href="#feature-guide"]').click();await page.locator('.feature-guide').waitFor();
  await page.locator('.brand').click();await ready();
  // Keyboard selection exposes every supplied timeline milestone, including the planned release.
  assert.equal(await page.locator('button[data-ov-timeline]').count(),content.timeline.length);
  for(let index=0;index<content.timeline.length;index++){
   const button=page.locator(`[data-ov-timeline="${index}"]`);
   await button.focus();await page.keyboard.press('Enter');
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   assert.ok((await page.locator('#ov-timeline-detail').innerText()).includes(content.timeline[index].body),'Timeline body missing: '+index);
  }
  assert.match(await page.locator('#ov-timeline-detail').innerText(),/planned.*January 2027/i);
  await page.locator('#ov-origins').screenshot({path:path.join(output,'overview-timeline.png')});
  // Every interactive explanation changes the selected state and its text, not just its colour.
  for(const [name,detail] of [['layer','layer'],['risk','risk'],['service','service'],['benefit','benefit']]){
   const buttons=page.locator(`button[data-ov-${name}]`),panel=page.locator(`#ov-${detail}-detail`);
   assert.ok(await buttons.count()>1,'Not enough options for '+name);
   await buttons.first().click();const before=await panel.innerText();
   await buttons.last().focus();await page.keyboard.press('Enter');
   assert.equal(await buttons.last().getAttribute('aria-pressed'),'true');
   assert.notEqual(await panel.innerText(),before,'Selection did not explain '+name);
  }
  // Layer controls must highlight the actual topology, including a full-picture reset.
  const workbench=page.locator('.ov-terrain-workbench');
  const layoutState=()=>workbench.evaluate(host=>({
   boxes:[host.querySelector('.ov-explore-panel'),host.querySelector('.ov-diagram'),...host.querySelectorAll('[data-ov-layer]')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}),
   scrollY:window.scrollY
  }));
  for(const [width,height] of [[1440,1000],[1366,768],[1024,768],[768,844],[390,844],[320,844]]){
   await page.setViewportSize({width,height});
   await workbench.evaluate(host=>{const rail=document.querySelector('.ov-rail').getBoundingClientRect();scrollTo({top:scrollY+host.getBoundingClientRect().top-rail.bottom-12,behavior:'instant'});});
   const before=await layoutState();
   for(let layer=0;layer<content.layers.length;layer++){
    await page.locator(`[data-ov-layer="${layer}"]`).click();
    const after=await layoutState();
    assert.deepEqual(after,before,'Layer selection moved controls or diagram at '+width);
   }
   const visible=await workbench.evaluate(host=>{
    const panel=host.querySelector('.ov-explore-panel').getBoundingClientRect(),svg=host.querySelector('.ov-diagram').getBoundingClientRect(),rail=document.querySelector('.ov-rail').getBoundingClientRect();
    return {top:Math.min(panel.top,svg.top),bottom:Math.max(panel.bottom,svg.bottom),rail:rail.bottom,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.ok(visible.top>=visible.rail-1&&visible.bottom<=visible.height,'Controls and entire topology must be visible together at '+width+': '+JSON.stringify(visible));
   assert.equal(visible.overflow,false);
   await page.locator('[data-ov-layer="0"]').click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.ov-terrain-visual .ov-topology-part')].every(part=>Number(getComputedStyle(part).opacity)===1));
   if(width===1366||width===390)await workbench.screenshot({path:path.join(output,`overview-terrain-workbench-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:1000});
  const topology=page.locator('.ov-terrain-visual');
  assert.equal(await topology.locator('.ov-topology-ci').count(),18);
  assert.equal(await topology.locator('.ov-topology-software').count(),6);
  assert.equal(await topology.locator('.ov-topology-network').count(),3);
  assert.equal(await topology.locator('.ov-topology-service').count(),4,'Terrain must have two mission and two business services');
  assert.equal(await topology.locator('[data-service-id="ict"]').count(),0);
  assert.doesNotMatch(await page.locator('#ov-terrain').textContent(),/\bICT service\b/i);
  const deviceIds=Array.from({length:18},(_,i)=>'D'+(i+1)).sort();
  const missionLinks=['mission-a:B','mission-a:C','mission-b:C'];
  const businessLinks=['business-a:A','business-b:A','business-b:B'];
  const expectedLayers={
   1:{devices:deviceIds,systems:[],networks:[],services:[],links:[]},
   2:{devices:deviceIds,systems:[],networks:['A','B','C'],services:[],links:[]},
   3:{devices:deviceIds,systems:['A','B','C'],networks:[],services:['business-a','business-b','mission-a','mission-b'],links:[...businessLinks,...missionLinks]},
   4:{devices:['D3','D4','D5','D6','D11','D12','D13','D14','D15','D16','D17','D18'].sort(),systems:['B','C'],networks:[],services:['mission-a','mission-b'],links:missionLinks},
   5:{devices:['D1','D2','D3','D4','D7','D8','D9','D10','D11','D12','D13','D14'].sort(),systems:['A','B'],networks:[],services:['business-a','business-b'],links:businessLinks}
  };
  for(let layer=1;layer<=5;layer++){
   await page.locator(`[data-ov-layer="${layer}"]`).click();
   await page.waitForFunction(layer=>[...document.querySelectorAll('.ov-terrain-visual .ov-topology-part')].every(part=>Math.abs(Number(getComputedStyle(part).opacity)-(part.dataset.layerPart.split(' ').includes(String(layer))?1:.16))<.02),layer);
   const highlighted=await topology.evaluate(host=>{
    const visible=(selector,key)=>[...host.querySelectorAll(selector)].filter(node=>Number(getComputedStyle(node.closest('.ov-topology-part')).opacity)>.98).map(key).sort();
    return {devices:visible('.ov-topology-ci',node=>node.dataset.device),systems:visible('.ov-topology-system',node=>node.dataset.systemId),networks:visible('.ov-topology-network',node=>node.dataset.network),services:visible('.ov-topology-service',node=>node.dataset.serviceId),links:visible('.ov-topology-dependency',node=>node.dataset.from+':'+node.dataset.to)};
   });
   assert.deepEqual(highlighted,expectedLayers[layer],'Incorrect connected entities highlighted for layer '+layer);
   if(layer>=2)await workbench.screenshot({path:path.join(output,`overview-terrain-layer-${layer}.png`)});
  }
  await page.locator('[data-ov-layer="0"]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.ov-terrain-visual .ov-topology-part')].every(part=>Number(getComputedStyle(part).opacity)===1));
  await page.locator('#ov-terrain').screenshot({path:path.join(output,'overview-terrain.png')});
  // A finding is traced on the same terrain, without marking its services as compromised.
  const riskGraphic=page.locator('#ov-risk-graphic'),riskWorkbench=page.locator('.ov-risk-workbench');
  const deviceLayout=host=>[...host.querySelectorAll('.ov-topology-ci')].map(node=>({id:node.dataset.device,system:node.dataset.systemId,transform:node.getAttribute('transform')}));
  assert.deepEqual(await riskGraphic.evaluate(deviceLayout),await topology.evaluate(deviceLayout),'Finding view must use the same device positions and systems as Cyber Terrain');
  assert.equal(await riskGraphic.locator('.ov-diagram').getAttribute('viewBox'),'0 0 1200 580');
  assert.equal(await riskGraphic.locator('.ov-topology-network').count(),3);
  assert.equal(await riskGraphic.locator('.ov-topology-service').count(),4);
  const expectedRisk={D1:{system:'A',services:['business-a','business-b']},D3:{system:'B',services:['business-b','mission-a']},D5:{system:'C',services:['mission-a','mission-b']}};
  const riskLayout=()=>riskWorkbench.evaluate(host=>[host,host.querySelector('.ov-explore-panel'),host.querySelector('.ov-diagram'),...host.querySelectorAll('button[data-ov-risk],button[data-ov-risk-device]')].map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};}));
  for(const [id,expected] of Object.entries(expectedRisk)){
   await page.locator(`[data-ov-risk-device="${id}"]`).click();
   const layout=await riskLayout();
   assert.equal(await riskGraphic.locator('.ov-risk-finding-badge').count(),1);
   assert.equal(await riskGraphic.locator('.ov-risk-finding-badge').evaluate(node=>node.closest('.ov-topology-ci').dataset.device),id);
   assert.equal(await riskGraphic.locator('.ov-risk-membership').getAttribute('data-device'),id);
   assert.equal(await riskGraphic.locator('.ov-risk-membership').getAttribute('data-system-id'),expected.system);
   for(let step=0;step<3;step++){
    await page.locator(`[data-ov-risk="${step}"]`).click();
    assert.deepEqual(await riskLayout(),layout,'Finding controls or topology shifted on selection');
   }
   await page.waitForFunction(()=>[...document.querySelectorAll('#ov-risk-graphic [data-risk-role="context"][data-related="true"]')].every(node=>Number(getComputedStyle(node).opacity)===1));
   const active=await riskGraphic.evaluate(host=>{
    const ids=(selector,attribute)=>[...host.querySelectorAll(selector)].filter(node=>Number(getComputedStyle(node.closest('.ov-topology-part')).opacity)>.98).map(node=>node.getAttribute(attribute)).sort();
    return {devices:ids('.ov-topology-ci','data-device'),systems:ids('.ov-topology-system','data-system-id'),services:ids('.ov-topology-service','data-service-id'),links:[...host.querySelectorAll('.ov-topology-dependency')].filter(node=>Number(getComputedStyle(node.closest('.ov-topology-part')).opacity)>.98).map(node=>node.dataset.from+':'+node.dataset.to).sort()};
   });
   assert.deepEqual(active,{devices:[id],systems:[expected.system],services:expected.services,links:expected.services.map(service=>service+':'+expected.system)},'Finding trace includes unrelated entities');
   assert.match(await page.locator('#ov-risk-trace').innerText(),new RegExp('F-01.*'+id+'.*ICT System '+expected.system));
  }
  await page.locator('[data-ov-risk-device="D3"]').click();
  await riskWorkbench.screenshot({path:path.join(output,'overview-vulnerability-topology.png')});
  await page.locator('#ov-vulnerabilities').screenshot({path:path.join(output,'overview-vulnerabilities.png')});
  await page.locator('#ov-reporting').screenshot({path:path.join(output,'overview-reporting.png')});
  const shadow=page.locator('button[data-ov-shadow]'),shadowText=await page.locator('#ov-shadow-detail').innerText();
  const initialShadow=await shadow.getAttribute('aria-pressed');await shadow.click();
  assert.notEqual(await shadow.getAttribute('aria-pressed'),initialShadow);
  assert.notEqual(await page.locator('#ov-shadow-detail').innerText(),shadowText);
  const shadowWorkbench=page.locator('.ov-shadow-workbench'),shadowGraphic=page.locator('#ov-shadow-graphic');
  const shadowLayout=()=>shadowWorkbench.evaluate(host=>[host,host.querySelector('.ov-explore-panel'),host.querySelector('.ov-diagram'),...host.querySelectorAll('button[data-ov-shadow-scenario],button[data-ov-shadow]')].map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};}));
  const shadowBounds=await shadowLayout();
  const shadowCases=[{source:'D3',type:'Server',address:'192.0.2.87',kind:'unmatched'},{source:'ND1',type:'Router',address:'198.51.100.64',kind:'unmatched'},{source:null,address:'192.0.2.47',kind:'unclassified'}];
  for(const [index,expected] of shadowCases.entries()){
   const selector=page.locator(`[data-ov-shadow-scenario="${index}"]`);await selector.focus();await page.keyboard.press('Enter');
   assert.equal(await selector.getAttribute('aria-pressed'),'true');
   assert.equal(await shadow.getAttribute('aria-pressed'),'false','Changing scenario must reset its reveal');
   assert.equal(await shadowGraphic.locator('.ov-unmatched').getAttribute('data-unknown-address'),expected.address);
   assert.equal(await shadowGraphic.locator('.ov-unmatched').getAttribute('data-unknown-kind'),expected.kind);
   assert.equal(await shadowGraphic.locator('.ov-unmatched [data-device-type]').count(),0,'Unknown address was assigned a device type');
   if(expected.source){
    const source=shadowGraphic.locator('[data-observer="true"]');assert.equal(await source.count(),1);
    assert.equal(await source.getAttribute('data-device'),expected.source);assert.equal(await source.getAttribute('data-device-type'),expected.type);
    assert.match(await shadowGraphic.innerText(),/Observed communication/);
   }else{
    assert.equal(await shadowGraphic.locator('[data-observer="true"]').count(),0,'A scan must not masquerade as endpoint communication');
    assert.deepEqual(await shadowGraphic.locator('.ov-shadow-known-device').evaluateAll(nodes=>nodes.map(node=>node.dataset.deviceType).sort()),['Computer','Printer','Router','Server']);
    assert.match(await shadowGraphic.innerText(),/CMDB discovery/);assert.match(await shadowGraphic.innerText(),/192\.0\.2\.1 - 192\.0\.2\.254/);
    assert.match(await shadowGraphic.innerText(),/Discovery result/);assert.doesNotMatch(await shadowGraphic.innerText(),/Observed communication/);
   }
   assert.deepEqual(await shadowLayout(),shadowBounds,'Scenario selection shifted the controls or diagram');
   await shadow.click();
   await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#ov-shadow-graphic .ov-unmatched')).opacity)===1);
   assert.match(await page.locator('#ov-shadow-detail').innerText(),new RegExp(expected.address.replaceAll('.','\\.')));
   assert.deepEqual(await shadowLayout(),shadowBounds,'Revealing an address shifted the layout');
   await shadowWorkbench.screenshot({path:path.join(output,`overview-shadow-scenario-${index+1}.png`)});
  }
  // Service review follows the common terrain without implying a confirmed outage.
  const impactWorkbench=page.locator('.ov-service-workbench'),impactGraphic=page.locator('#ov-service-graphic');
  assert.deepEqual(await impactGraphic.evaluate(deviceLayout),await topology.evaluate(deviceLayout),'Service Impacts must preserve the common terrain positions');
  assert.equal(await impactGraphic.locator('.ov-topology-service').count(),4);
  assert.doesNotMatch(await page.locator('#ov-services').innerText(),/ICT service/);
  const impactLayout=()=>impactWorkbench.evaluate(host=>[host,host.querySelector('.ov-explore-panel'),host.querySelector('.ov-diagram'),host.querySelector('.ov-impact-outcomes'),...host.querySelectorAll('[data-ov-service]')].map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};}));
  const impactBounds=await impactLayout();
  const expectedImpact=[
   {devices:['D1'],systems:['A'],networks:[],services:['business-a','business-b'],links:['business-a:A','business-b:A']},
   {devices:['D5'],systems:['C'],networks:[],services:['mission-a','mission-b'],links:['mission-a:C','mission-b:C']},
   {devices:['D3','D7'],systems:['A','B'],networks:[],services:['business-a','business-b','mission-a'],links:['business-a:A','business-b:A','business-b:B','mission-a:B']}
  ];
  for(const [index,expected] of expectedImpact.entries()){
   await page.locator(`[data-ov-service="${index}"]`).click();
   await page.waitForFunction(()=>[...document.querySelectorAll('#ov-service-graphic [data-impact-role][data-related="true"]')].every(node=>Number(getComputedStyle(node).opacity)===1));
   const active=await impactGraphic.evaluate(host=>{
    const ids=(selector,key)=>[...host.querySelectorAll(selector)].filter(node=>Number(getComputedStyle(node.closest('.ov-topology-part')).opacity)>.98).map(key).sort();
    return {devices:ids('.ov-topology-ci',node=>node.dataset.device),systems:ids('.ov-topology-system',node=>node.dataset.systemId),networks:ids('.ov-topology-network',node=>node.dataset.network),services:ids('.ov-topology-service',node=>node.dataset.serviceId),links:ids('.ov-topology-dependency',node=>node.dataset.from+':'+node.dataset.to)};
   });
   assert.deepEqual(active,expected,'Service impact highlights do not follow the selected issue');
   assert.deepEqual(await page.locator('#ov-service-review [data-related="true"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.reviewService).sort()),expected.services);
   assert.equal(await page.locator('[data-ov-service-summary]').innerText(),expected.services.length+' services to review');
   assert.equal(await impactGraphic.locator('.ov-impact-issue').count(),index===2?0:1,'Device issue marker must stay on the originating device');
   assert.equal(await impactGraphic.locator('.ov-topology-service .ov-impact-issue').count(),0,'A dependent service was incorrectly marked as failed');
   if(index===2){
    assert.equal((await page.locator('[data-ov-service="2"]').innerText()).trim(),'Device link');
    assert.equal(await impactGraphic.locator('.ov-impact-link-issue').count(),1);
    assert.equal(await impactGraphic.locator('.ov-flow-line[data-device-link="D7-D3"]').count(),0,'Traffic animation crosses the unavailable device link');
    const broken=impactGraphic.locator('.ov-impact-unavailable');assert.equal(await broken.count(),1);
    assert.equal(await broken.getAttribute('data-device-link'),'D7-D3');
    assert.equal(await broken.getAttribute('data-from'),'D7');assert.equal(await broken.getAttribute('data-to'),'D3');
    assert.match(await broken.getAttribute('d'),/H386M424/,'Unavailable link needs a visible gap');
    assert.deepEqual(await broken.evaluate(node=>{
     const start=node.getPointAtLength(0),end=node.getPointAtLength(node.getTotalLength());
     return {start:[start.x,start.y],end:[end.x,end.y]};
    }),{start:[351,380],end:[459,380]},'Yellow line must join the facing edges of D7 and D3');
    assert.equal(await broken.evaluate(node=>getComputedStyle(node).animationName),'none');
    assert.equal(await impactGraphic.locator('.ov-flow-line[data-network-link="A-B"]').count(),1,'The network-to-network connection should remain a normal blue link');
    assert.equal(await impactGraphic.locator('.ov-flow-line[data-network-link="B-C"]').count(),1);
   }else assert.equal(await impactGraphic.locator('.ov-impact-unavailable').count(),0);
   assert.deepEqual(await impactLayout(),impactBounds,'Service scenario selection shifted the controls or diagram');
   await impactWorkbench.screenshot({path:path.join(output,`overview-services-scenario-${index+1}.png`)});
  }
  // Reporting distinguishes row filters from header scope and dependency evidence.
  const reportPanel=page.locator('#ov-report-detail'),reportNotes=page.locator('.ov-report-notes');
  assert.equal(await reportNotes.evaluate(node=>node.open),false,'Report rules should stay compact until requested');
  await reportNotes.locator('summary').click();
  assert.equal(await reportPanel.isVisible(),true,'Report rules must remain available');
  const selectReport=async(selector)=>{
   const button=page.locator(selector);await button.focus();await page.keyboard.press('Enter');
   assert.equal(await button.getAttribute('aria-pressed'),'true','Reporting control did not select: '+selector);
  };
  const reportRows=async(expected,devices)=>{
   assert.equal(Number(await reportPanel.locator('[data-report-count]').first().getAttribute('data-report-count')),expected,'Incorrect illustrative reporting count');
   assert.deepEqual(await page.locator('#ov-report-graphic .ov-report-record[data-device]').evaluateAll(rows=>rows.map(row=>row.dataset.device).sort()),devices,'Incorrect illustrative reporting records');
  };
  assert.equal(await page.locator('[data-ov-report="0"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-ov-report-scope="all"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-ov-report-focus="all"]').getAttribute('aria-pressed'),'true');
  await reportRows(6,['D1','D2','D3','D4','D5','D6']);
  await selectReport('[data-ov-report-scope="C"]');await reportRows(2,['D5','D6']);
  await selectReport('[data-ov-report-scope="all"]');await reportRows(6,['D1','D2','D3','D4','D5','D6']);
  await selectReport('[data-ov-report-focus="D5"]');await reportRows(1,['D5']);
  await selectReport('[data-ov-report-scope="C"]');await reportRows(1,['D5']);
  await selectReport('[data-ov-report="1"]');await reportRows(2,['D5','D6']);
  assert.equal(await page.locator('.ov-report-workbench').getAttribute('data-report'),'1');
  assert.match(await reportPanel.innerText(),/Explorer/i,'Briefing must explain the Explorer filter distinction');
  await selectReport('[data-ov-report-scope="all"]');await reportRows(6,['D1','D2','D3','D4','D5','D6']);
  await selectReport('[data-ov-report-focus="all"]');await reportRows(6,['D1','D2','D3','D4','D5','D6']);
  await selectReport('[data-ov-report-focus="D5"]');await reportRows(6,['D1','D2','D3','D4','D5','D6']);
  await selectReport('[data-ov-report="2"]');
  assert.equal(await page.locator('.ov-report-workbench').getAttribute('data-report'),'2');
  assert.match(await reportPanel.innerText(),/trac/i,'Impact report must describe traced relationships');
  assert.match(await reportPanel.innerText(),/evidence/i,'Impact report must retain supporting evidence');
  await selectReport('[data-ov-report-scope="C"]');
  await selectReport('[data-ov-report="0"]');await reportRows(1,['D5']);
  await reportNotes.locator('summary').click();
  // Each scenario animates once, supports inspection, and pauses outside the visible page.
  const reportHost=page.locator('.ov-report-workbench'),reportVisual=page.locator('.ov-report-visual');
  const reportElapsed=async()=>Number(await reportHost.getAttribute('data-report-elapsed'));
  const reportFrame=async()=>reportVisual.locator('.ov-diagram').evaluate(svg=>svg.outerHTML);
  await reportVisual.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.ov-report-workbench').dataset.reportPlayback==='playing');
  await page.waitForFunction(()=>[...document.querySelectorAll('.ov-report-transfer')].some(node=>node.getAttribute('opacity')==='1'));
  const moving=await reportFrame();await page.waitForTimeout(150);assert.notEqual(await reportFrame(),moving,'Report records did not move');
  await page.locator('[data-ov-report-play]').focus();await page.keyboard.press('Enter');
  assert.equal(await reportHost.getAttribute('data-report-playback'),'paused');
  const pausedFrame=await reportFrame(),pausedTime=await reportElapsed();await page.waitForTimeout(250);
  assert.equal(await reportFrame(),pausedFrame,'Local pause did not freeze the animation');assert.equal(await reportElapsed(),pausedTime);
  await page.locator('[data-ov-report-replay]').focus();await page.keyboard.press('Enter');
  assert.ok(await reportElapsed()<500,'Replay did not restart the sequence');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(150);
  const offscreenTime=await reportElapsed();await page.waitForTimeout(250);assert.equal(await reportElapsed(),offscreenTime,'Offscreen report kept playing');
  await reportVisual.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.ov-report-workbench').dataset.reportPlayback==='playing');
  await page.locator('[data-ov-expand="reporting"]').click();
  const modalTime=await reportElapsed();await page.waitForTimeout(200);assert.equal(await reportElapsed(),modalTime,'Report kept playing behind its expanded frame');
  await page.locator('[data-ov-close-diagram]').click();
  await page.waitForFunction(()=>document.querySelector('.ov-report-workbench').dataset.reportPlayback==='playing');
  await page.waitForFunction(()=>document.querySelector('.ov-report-workbench').dataset.reportPlayback==='complete',null,{timeout:15000});
  const completedFrame=await reportFrame();await page.waitForTimeout(250);assert.equal(await reportFrame(),completedFrame,'The completed scenario should hold its output');
  assert.equal(await reportElapsed(),10000,'Autoplay must reach the final frame');
  const reportLayout=()=>reportHost.evaluate(host=>Object.fromEntries(['.ov-report-player','.ov-report-visual','.ov-report-playback','#ov-report-caption','#ov-report-detail'].map(selector=>{const el=host.querySelector(selector),box=el.getBoundingClientRect();return [selector,{top:Math.round(box.top-host.getBoundingClientRect().top),width:Math.round(box.width),height:Math.round(box.height)}];})));
  const reportBounds=await reportLayout();
  for(let scenario=0;scenario<3;scenario++){
   await selectReport(`[data-ov-report="${scenario}"]`);
   for(let step=0;step<4;step++){
    await selectReport(`[data-ov-report-step="${step}"]`);
    assert.equal(await reportVisual.getAttribute('data-report-step'),String(step));
    assert.equal(await page.locator('#ov-report-caption .is-active').count(),1);
    assert.deepEqual(await reportLayout(),reportBounds,'Reporting scenario or step shifted the layout');
   }
   assert.equal(await reportHost.getAttribute('data-report-playback'),'complete');
   assert.equal(await reportVisual.locator('[data-report-reveal]').evaluateAll(nodes=>nodes.every(node=>node.getAttribute('opacity')==='1')),true,'Completed output has hidden records');
   await reportVisual.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
   await reportHost.screenshot({path:path.join(output,`overview-reporting-scenario-${scenario+1}.png`)});
  }
  assert.deepEqual(await reportVisual.locator('.ov-report-traced-service').evaluateAll(nodes=>nodes.map(node=>node.dataset.serviceId).sort()),['mission-a','mission-b']);
  await selectReport('[data-ov-report-scope="all"]');await selectReport('[data-ov-report-focus="all"]');
  await selectReport('[data-ov-report-step="1"]');
  assert.deepEqual(await reportVisual.locator('.ov-report-traced-service').evaluateAll(nodes=>nodes.map(node=>node.dataset.serviceId).sort()),['business-a','business-b','mission-a','mission-b']);
  assert.equal(await reportVisual.locator('.ov-report-trace-edge').evaluateAll(nodes=>nodes.every(node=>node.getAttribute('stroke-dashoffset')==='0')),true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('.ov-report-visual').dataset.reportStep==='3');
  assert.equal(await page.locator('[data-ov-report-play]').isDisabled(),true);
  const reducedFrame=await reportFrame();await page.waitForTimeout(200);assert.equal(await reportFrame(),reducedFrame);
  await selectReport('[data-ov-report="1"]');assert.equal(await reportVisual.getAttribute('data-report-step'),'3');
  await selectReport('[data-ov-report-step="1"]');assert.equal(await reportVisual.getAttribute('data-report-step'),'1','Reduced motion must still allow manual steps');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await selectReport('[data-ov-report-scope="C"]');await selectReport('[data-ov-report-focus="D5"]');await selectReport('[data-ov-report="0"]');
  await selectReport('[data-ov-report-step="3"]');
  const assertDiagramFits=async(label)=>{
   await page.waitForFunction(()=>{const canvas=document.querySelector('#ov-diagram-canvas'),css=getComputedStyle(canvas),svg=canvas.querySelector('.ov-diagram').getBoundingClientRect();return svg.width<=canvas.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)+1&&svg.height<=canvas.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)+1;});
   const fit=await page.locator('#ov-diagram-canvas').evaluate(canvas=>{
    const css=getComputedStyle(canvas),svg=canvas.querySelector('.ov-diagram').getBoundingClientRect(),dialog=document.querySelector('#overview-diagram-dialog').getBoundingClientRect();
    return {width:svg.width,height:svg.height,availableWidth:canvas.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight),availableHeight:canvas.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom),scrollWidth:canvas.scrollWidth,clientWidth:canvas.clientWidth,scrollHeight:canvas.scrollHeight,clientHeight:canvas.clientHeight,dialogTop:dialog.top,dialogBottom:dialog.bottom,viewportHeight:innerHeight};
   });
   assert.ok(fit.width<=fit.availableWidth+1&&fit.height<=fit.availableHeight+1,'Diagram must fit both dimensions: '+label+' '+JSON.stringify(fit));
   assert.ok(fit.scrollWidth<=fit.clientWidth&&fit.scrollHeight<=fit.clientHeight,'Fit must not require scrolling: '+label);
   assert.ok(fit.dialogTop>=0&&fit.dialogBottom<=fit.viewportHeight,'Dialog exceeds viewport: '+label);
  };
  // Enlarging a diagram preserves the chosen explanation and remaps all SVG references.
  const diagramIds=['terrain','vulnerabilities','shadow','services','reporting'];
  const diagramState=element=>({
   text:element.textContent.replace(/\s+/g,' ').trim(),
   groups:[...element.querySelectorAll('.ov-topology-part,.ov-terrain-plane,.ov-system-zones,.ov-shared-network,.ov-system-service,.ov-risk-step,.ov-risk-system,.ov-impact-system,.ov-impact-service,.ov-report-system,.ov-unmatched')].map(group=>({
    classes:group.getAttribute('class'),data:{...group.dataset},opacity:getComputedStyle(group).opacity
   }))
  });
  const uniqueIds=async()=>assert.deepEqual(await page.locator('[id]').evaluateAll(nodes=>{const seen=new Set();return nodes.map(node=>node.id).filter(id=>seen.has(id)||!seen.add(id));}),[],'Diagram expansion introduced duplicate IDs');
  await page.locator('[data-ov-risk-device="D5"]').click();
  for(const id of diagramIds){
   const source=page.locator(`#ov-${id} .ov-diagram`).first(),trigger=page.locator(`[data-ov-expand="${id}"]`);
   await trigger.scrollIntoViewIfNeeded();await page.waitForTimeout(450);
   const state=await source.evaluate(diagramState);await trigger.click();
   const dialog=page.locator('#overview-diagram-dialog'),expanded=page.locator('#ov-diagram-canvas .ov-diagram');
   await dialog.waitFor();assert.equal(await dialog.evaluate(el=>el.open),true);
   await assertDiagramFits('default '+id);
   if(id==='vulnerabilities'){await page.setViewportSize({width:1024,height:600});await assertDiagramFits('short viewport '+id);await page.setViewportSize({width:1440,height:1000});await assertDiagramFits('resized '+id);}
   assert.deepEqual(await expanded.evaluate(diagramState),state,'Expanded diagram lost the selected state: '+id);
   await uniqueIds();
   assert.deepEqual(await expanded.evaluate(svg=>{
    const bad=[];
    for(const el of [svg,...svg.querySelectorAll('*')]){
     if(el.id&&!el.id.startsWith('ov-zoom-'))bad.push(el.id);
     for(const attribute of el.attributes){
      const matches=[...attribute.value.matchAll(/url\(["']?#([^\s)"']+)["']?\)/g)].map(match=>match[1]);
      if(['href','xlink:href'].includes(attribute.name)&&attribute.value.startsWith('#'))matches.push(attribute.value.slice(1));
      for(const ref of matches)if(!ref.startsWith('ov-zoom-')||!document.getElementById(ref))bad.push(ref);
     }
    }
    return bad;
   }),[],'Expanded SVG has unresolved or unremapped references: '+id);
   assert.equal(await source.locator('.ov-flow-line').evaluateAll(paths=>paths.every(path=>getComputedStyle(path).animationPlayState==='paused')),true,'Background diagram kept animating');
   if(id==='terrain'){
    await page.keyboard.press('/');assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false,'Search opened over the expanded diagram');
    const before=parseFloat(await page.locator('#ov-diagram-scale').innerText());
    await page.locator('[data-ov-zoom="in"]').click();const zoomed=parseFloat(await page.locator('#ov-diagram-scale').innerText());
    assert.ok(zoomed>before,'Zoom in did not increase diagram scale');
    await page.locator('[data-ov-zoom="out"]').click();assert.ok(parseFloat(await page.locator('#ov-diagram-scale').innerText())<zoomed,'Zoom out did not decrease diagram scale');
    await page.locator('[data-ov-zoom="fit"]').click();
    await assertDiagramFits('fit after zoom '+id);
   }
   await page.keyboard.press('Escape');assert.equal(await dialog.evaluate(el=>el.open),false);
   assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Diagram popup did not restore focus: '+id);
  }
  // Chapter selection scrolls the infographic without creating a different route.
  const route=page.url();await page.locator('[data-ov-jump="benefits"]').first().click();
  await page.waitForFunction(()=>Number(document.querySelector('.overview-page').style.getPropertyValue('--ov-progress'))>.8);
  assert.equal(page.url(),route);
  await page.locator('[data-ov-jump="benefits"][aria-current="step"]').waitFor();
  await page.locator('[data-ov-jump="what"]').first().click();
  const motion=page.locator('[data-ov-motion]');
  assert.equal(await page.locator('.overview-page').getAttribute('data-motion'),'active');
  // Hover links repeated device identities without moving the diagram or its labels.
  const terrain=page.locator('#ov-terrain .ov-visual'),art=terrain.locator('.ov-diagram');
  const devices=terrain.locator('.ov-terrain-device[data-device="D1"]');
  assert.ok(await devices.count()>=1,'Terrain must contain device D1');
  await devices.first().scrollIntoViewIfNeeded();
  const transform=await art.evaluate(el=>getComputedStyle(el).transform);
  assert.ok((await devices.first().locator('title').textContent()).includes('D1'),'Device hover needs a native title');
  await devices.first().hover();
  assert.equal(await terrain.locator('.ov-terrain-device[data-device="D1"].ov-entity-highlight').count(),await devices.count(),'Hover did not highlight every repeated device');
  assert.equal(await terrain.locator('.ov-terrain-device.ov-entity-highlight:not([data-device="D1"])').count(),0,'Hover highlighted an unrelated device');
  assert.equal(await art.evaluate(el=>getComputedStyle(el).transform),transform,'Hover moved the diagram');
  await page.locator('#ov-terrain .ov-kicker').hover();
  assert.equal(await terrain.locator('.ov-entity-highlight').count(),0,'Device highlight remained after pointer exit');
  await motion.click();assert.equal(await motion.getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.overview-page').getAttribute('data-motion'),'paused');
  await devices.first().hover();
  assert.equal(await terrain.locator('.ov-terrain-device[data-device="D1"].ov-entity-highlight').count(),await devices.count(),'Paused motion disabled useful device feedback');
  assert.equal(await art.evaluate(el=>getComputedStyle(el).transform),transform,'Paused diagram moved during hover');
  await page.locator('#ov-terrain .ov-kicker').hover();
  await motion.click();assert.equal(await page.locator('.overview-page').getAttribute('data-motion'),'active');
  // Each companion film decodes offline, supplies captions and pauses when its popup closes.
  for(const id of filmIds){
   const trigger=page.locator(`[data-overview-video="${id}"]`).first();
   assert.ok((await trigger.getAttribute('aria-label')||'').includes(content.sections.find(section=>section.id===id).title),'Film button needs a chapter-specific accessible name: '+id);
   await trigger.click();
   const dialog=page.locator('#overview-video-dialog'),video=page.locator('#overview-film');
   await dialog.waitFor();assert.equal(await dialog.evaluate(el=>el.open),true);
   if(id==='what'){
    await page.keyboard.press('/');
    assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false,'Search shortcut opened a second modal');
    assert.equal(await dialog.evaluate(el=>el.open),true);
   }
   assert.equal(await video.getAttribute('src'),`overview-${id}.mp4`);
   assert.equal(await video.evaluate(el=>el.controls),true);
   await video.evaluate(el=>el.load());
   await page.waitForFunction(()=>document.getElementById('overview-film')?.readyState>=1);
   const metadata=await video.evaluate(el=>({duration:el.duration,width:el.videoWidth,height:el.videoHeight,tracks:el.textTracks.length}));
   assert.ok(metadata.duration>=12&&metadata.duration<=60,'Unexpected short film length: '+id);
   assert.equal(metadata.width,1280);assert.equal(metadata.height,720);assert.equal(metadata.tracks,1);
   await video.evaluate(el=>{el.textTracks[0].mode='hidden';});
   await page.waitForFunction(()=>document.getElementById('overview-film')?.textTracks[0]?.cues?.length>1);
   await page.locator('.ov-film-transcript summary').click();
   const transcript=await page.locator('.ov-film-transcript').innerText();
   for(const scene of films[id].scenes){assert.ok(transcript.includes(scene.headline));assert.ok(transcript.includes(scene.body));}
   await page.locator('.ov-film-transcript summary').click();
   await video.evaluate(el=>el.play());await page.waitForFunction(()=>document.getElementById('overview-film')?.currentTime>.15);
   if(id==='terrain')await dialog.screenshot({path:path.join(output,'overview-film-popup.png')});
   const old=await video.elementHandle();await page.keyboard.press('Escape');
   assert.equal(await dialog.evaluate(el=>el.open),false);
   assert.equal(await old.evaluate(el=>el.paused&&!el.hasAttribute('src')),true);
   assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  }
  // Reduced motion and narrow screens preserve readable content and all interaction controls.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('.overview-page').dataset.motion==='paused');
  assert.equal(await investigation.getAttribute('data-investigation-step'),'3');
  assert.equal(await investigation.locator('[data-ov-investigation-play]').isDisabled(),true);
  for(const width of [1024,768,390,320]){
   await page.setViewportSize({width,height:844});
   const mobileInvestigationBounds=await investigationLayout();
   for(let step=0;step<3;step++){
    const object=investigation.locator(`[data-ov-investigation-stage="${step}"]`);await object.focus();await page.keyboard.press('Enter');
    assert.equal(await investigation.getAttribute('data-investigation-step'),String(step));
    assert.deepEqual(await investigationLayout(),mobileInvestigationBounds,'Story shifted at width '+width);
   }
   await investigation.locator('[data-ov-investigation-next]').click();
   const responsiveReportBounds=await reportLayout();
   for(let scenario=0;scenario<3;scenario++){
    await selectReport(`[data-ov-report="${scenario}"]`);
    for(let step=0;step<4;step++){
     await selectReport(`[data-ov-report-step="${step}"]`);
     assert.deepEqual(await reportLayout(),responsiveReportBounds,'Report animation moved its controls at width '+width);
     assert.equal(await reportVisual.locator('.ov-diagram').getAttribute('data-report-compact'),String(width<=760));
    }
   }
   await selectReport('[data-ov-report="0"]');
   const riskBounds=await riskLayout();
   for(const selector of ['[data-ov-risk="0"]','[data-ov-risk="1"]','[data-ov-risk="2"]','[data-ov-risk-device="D1"]','[data-ov-risk-device="D3"]']){
    await page.locator(selector).click();
    assert.deepEqual(await riskLayout(),riskBounds,'Finding controls shifted at width '+width);
   }
   const mobileShadowBounds=await shadowLayout();
   for(const selector of ['[data-ov-shadow-scenario="0"]','[data-ov-shadow-scenario="1"]','[data-ov-shadow-scenario="2"]','[data-ov-shadow]']){
    await page.locator(selector).click();
    assert.deepEqual(await shadowLayout(),mobileShadowBounds,'Shadow IT controls shifted at width '+width);
   }
   const mobileImpactBounds=await impactLayout();
   for(let index=0;index<3;index++){
    await page.locator(`[data-ov-service="${index}"]`).click();
    assert.deepEqual(await impactLayout(),mobileImpactBounds,'Service impact controls shifted at width '+width);
   }
   await page.evaluate(()=>scrollTo(0,0));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overview overflow at '+width);
   assert.equal(await page.locator('[data-ov-section]').count(),ids.length);
   for(const id of ids)assert.equal(await page.locator(`.ov-section[data-ov-section="${id}"] h2`).first().isVisible(),true);
   const chapter=page.locator('#ov-chapter-select');
   assert.equal(await chapter.isVisible(),true,'Named chapter selector is missing at '+width);
   assert.deepEqual(await chapter.locator('option').evaluateAll(options=>options.map(option=>option.value)),ids);
   assert.ok((await chapter.locator('option').allTextContents()).every(text=>/[A-Za-z]/.test(text)),'Mobile chapter options must contain names');
   if(width===390){
    await page.screenshot({path:path.join(output,'overview-mobile.png')});
    await page.locator('#ov-terrain').screenshot({path:path.join(output,'overview-terrain-mobile.png')});
    await investigation.screenshot({path:path.join(output,'overview-investigation-mobile.png')});
    await riskWorkbench.screenshot({path:path.join(output,'overview-vulnerabilities-mobile.png')});
    await shadowWorkbench.screenshot({path:path.join(output,'overview-shadow-mobile.png')});
    await impactWorkbench.screenshot({path:path.join(output,'overview-services-mobile.png')});
    await page.locator('#ov-reporting').screenshot({path:path.join(output,'overview-reporting-mobile.png')});
    const waitChapter=async id=>{
     await page.locator(`.ov-rail [data-ov-jump="${id}"][aria-current="step"]`).waitFor({state:'attached'});
     assert.equal(await chapter.inputValue(),id);
     assert.equal(await page.locator(`#ov-${id}`).evaluate(section=>section.querySelector('h1,h2')===document.activeElement),true,'Chapter jump did not focus its heading');
    };
    await chapter.selectOption('what');await waitChapter('what');
    assert.equal(await page.locator('[data-ov-prev]').isDisabled(),true);
    await chapter.focus();await page.keyboard.press('ArrowDown');await waitChapter('origins');
    await page.locator('[data-ov-prev]').click();await waitChapter('what');
    await page.locator('[data-ov-next]').click();await waitChapter('origins');
    await chapter.selectOption('benefits');await waitChapter('benefits');
    assert.equal(await page.locator('[data-ov-next]').isDisabled(),true);
    await page.locator('[data-ov-prev]').click();await waitChapter('reporting');
    const expand=page.locator('[data-ov-expand="terrain"]');await expand.click();
    const diagramDialog=page.locator('#overview-diagram-dialog');
    await page.locator('[data-ov-zoom="in"]').click();await page.locator('[data-ov-zoom="in"]').click();
    const pan=await page.locator('#ov-diagram-canvas').evaluateHandle(canvas=>{
     for(let el=canvas;el;el=el.parentElement)if(el.scrollWidth>el.clientWidth&&/auto|scroll/.test(getComputedStyle(el).overflowX))return el;
     return null;
    });
    assert.equal(await pan.evaluate(el=>!!el),true,'Enlarged mobile diagram must have a horizontal pan area');
    assert.equal(await pan.evaluate(el=>{el.scrollLeft=40;return el.scrollLeft>0;}),true,'Mobile diagram cannot pan horizontally');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Diagram zoom overflowed the mobile document');
    await page.locator('[data-ov-zoom="fit"]').click();
    assert.ok(await page.locator('#ov-diagram-canvas').evaluate(canvas=>canvas.scrollWidth<=canvas.clientWidth),'Fit to view left the mobile diagram wider than its viewport');
    const popupBounds=await diagramDialog.boundingBox();assert.ok(popupBounds.x>1&&popupBounds.y>1,'Need exposed backdrop to test dismissal');
    await page.mouse.click(1,1);assert.equal(await diagramDialog.evaluate(el=>el.open),false,'Backdrop did not close the diagram');
    assert.equal(await expand.evaluate(el=>el===document.activeElement),true,'Backdrop dismissal did not restore focus');
    await page.locator('[data-overview-video="services"]').first().click();
    assert.ok(await page.locator('#overview-video-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'Mobile film dialog overflow');
    await page.locator('[data-ov-close-video]').click();
   }
   if(width===390||width===320){
    const fitExpand=page.locator('[data-ov-expand="terrain"]');await fitExpand.click();
    await assertDiagramFits('mobile default '+width);
    await page.locator('[data-ov-zoom="fit"]').click();
    const fitted=await page.locator('#ov-diagram-canvas').evaluate(canvas=>({
     svg:canvas.querySelector('.ov-diagram').getBoundingClientRect().width,
     available:canvas.clientWidth-parseFloat(getComputedStyle(canvas).paddingLeft)-parseFloat(getComputedStyle(canvas).paddingRight),
     client:canvas.clientWidth,scroll:canvas.scrollWidth
    }));
    assert.ok(Math.abs(fitted.svg-fitted.available)<=2,'Diagram Fit did not use the mobile canvas width at '+width);
    assert.ok(fitted.scroll<=fitted.client,'Diagram Fit left horizontal overflow at '+width);
    await page.locator('[data-ov-zoom="in"]').click();
    assert.ok(await page.locator('#ov-diagram-canvas').evaluate(canvas=>canvas.scrollWidth>canvas.clientWidth),'Enlarged diagram should support mobile panning');
    await page.keyboard.press('Escape');assert.equal(await fitExpand.evaluate(el=>el===document.activeElement),true);
   }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Saving keeps the overview and its relative films portable in the established distribution format.
  await page.locator('[data-action="workbook"]').click();
  const downloaded=page.waitForEvent('download');await page.locator('[data-action="save"]').click();
  const savedFolder=fs.mkdtempSync(path.join(output,'overview-copy-')),saved=path.join(savedFolder,'TSAAT-User-Guide.html');
  await (await downloaded).saveAs(saved);
  await page.goto(pathToFileURL(saved).href);await ready();
  assert.equal(await page.locator('[data-ov-section]').count(),ids.length);
  await page.locator('[data-overview-video="what"]').first().click();
  await page.waitForFunction(()=>document.querySelector('.ov-film-status').textContent.includes('could not be opened'));
  assert.match(await page.locator('.ov-film-status').innerText(),/overview-what\.mp4.*same folder.*transcript/i);
  await page.locator('.ov-film-transcript summary').click();
  assert.ok((await page.locator('.ov-film-transcript').innerText()).includes(films.what.scenes[0].body),'Transcript must remain available without a companion MP4');
  await page.keyboard.press('Escape');
  for(const id of filmIds)fs.copyFileSync(path.join(guide,`overview-${id}.mp4`),path.join(savedFolder,`overview-${id}.mp4`));
  await page.reload();await ready();
  await page.locator('[data-overview-video="reporting"]').first().click();
  await page.locator('#overview-film').evaluate(el=>el.play());
  await page.waitForFunction(()=>document.getElementById('overview-film')?.currentTime>.15);
  await page.keyboard.press('Escape');
  // Expanded diagrams also release cloned content when the guide route changes.
  await page.locator('[data-ov-expand="reporting"]').click();
  const oldDiagram=await page.locator('#overview-diagram-dialog').elementHandle();
  await page.evaluate(()=>{location.hash='#feature-guide';});await page.locator('.feature-guide').waitFor();
  assert.equal(await oldDiagram.evaluate(el=>!el.open),true,'Route change left a detached diagram dialog open');
  assert.equal(await page.locator('#overview-diagram-dialog').count(),0);
  await page.locator('#sidebar a[href="#overview"]').click();await ready();await uniqueIds();
  // A navigation event while playing must also release the old video and module state.
  for(let pass=0;pass<3;pass++){
   await page.locator('[data-overview-video="what"]').first().click();
   const old=await page.locator('#overview-film').elementHandle();
   await page.locator('#overview-film').evaluate(el=>el.play());
   await page.evaluate(()=>{location.hash='#feature-guide';});await page.locator('.feature-guide').waitFor();
   assert.equal(await old.evaluate(el=>el.paused&&!el.hasAttribute('src')),true);
   assert.equal(await page.locator('#overview-video-dialog').count(),0);
   await page.locator('#sidebar a[href="#overview"]').click();await ready();
  }
  assert.deepEqual(requests,[],'Overview requested an external network resource');
  assert.deepEqual(errors,[],'Overview caused browser errors');
  console.log('PASS: default Overview; five-item navigation/history; six chapters and three investigation subsections; connected investigation story with keyboard selection, path-following signals, playback and reduced motion; reporting scope/search/output semantics; supplied timeline and planned release; keyboard/mouse selections; scroll progress, named mobile chapters and previous/next controls; stable layer controls with the entire compact topology visible; diagrams fitted on opening and resizing; five selected-state diagram popups with zoom, mobile pan and focus restoration; pause and reduced motion; eight offline MP4s with captions, native controls and popup focus restoration; responsive layout; saved guide portability; missing-film recovery and transcripts; route/video cleanup.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
