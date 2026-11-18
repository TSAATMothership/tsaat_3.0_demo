'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),guide=path.join(root,'guide');
const url=pathToFileURL(path.join(guide,'TSAAT-User-Guide.html')).href;
const content=JSON.parse(fs.readFileSync(path.join(root,'src/overview-content.json'),'utf8'));
const films=JSON.parse(fs.readFileSync(path.join(root,'assets/overview-videos.json'),'utf8'));
const output=path.join(root,'build/test-results');fs.mkdirSync(output,{recursive:true});
const ids=['what','origins','terrain','understand','systems','vulnerabilities','shadow','services','reporting','benefits'];
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
  assert.deepEqual(await page.locator('.ov-section').evaluateAll(sections=>sections.map(section=>section.dataset.ovSection)),ids);
  assert.equal(await page.locator('video[src]').count(),0,'Films must not preload before a request');
  for(const id of ids){
   await page.locator(`.ov-section[data-ov-section="${id}"]`).waitFor();
   assert.ok(await page.locator(`[data-overview-video="${id}"]`).count()>0,'Missing film button: '+id);
  }
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
  for(const [name,detail] of [['layer','layer'],['flow','flow'],['system','system'],['risk','risk'],['service','service'],['benefit','benefit']]){
   const buttons=page.locator(`button[data-ov-${name}]`),panel=page.locator(`#ov-${detail}-detail`);
   assert.ok(await buttons.count()>1,'Not enough options for '+name);
   await buttons.first().click();const before=await panel.innerText();
   await buttons.last().focus();await page.keyboard.press('Enter');
   assert.equal(await buttons.last().getAttribute('aria-pressed'),'true');
   assert.notEqual(await panel.innerText(),before,'Selection did not explain '+name);
  }
  const shadow=page.locator('button[data-ov-shadow]'),shadowText=await page.locator('#ov-shadow-detail').innerText();
  const initialShadow=await shadow.getAttribute('aria-pressed');await shadow.click();
  assert.notEqual(await shadow.getAttribute('aria-pressed'),initialShadow);
  assert.notEqual(await page.locator('#ov-shadow-detail').innerText(),shadowText);
  // Reporting distinguishes Explorer row filters from header-scoped briefings and traced impact evidence.
  const reportPanel=page.locator('#ov-report-detail');
  const selectReport=async(selector)=>{
   const button=page.locator(selector);await button.focus();await page.keyboard.press('Enter');
   assert.equal(await button.getAttribute('aria-pressed'),'true','Reporting control did not select: '+selector);
  };
  const reportRows=async(expected,devices)=>{
   assert.equal(Number(await reportPanel.locator('[data-report-count]').first().getAttribute('data-report-count')),expected,'Incorrect illustrative reporting count');
   assert.deepEqual(await page.locator('#ov-report-graphic .ov-report-record[data-device]').evaluateAll(rows=>rows.map(row=>row.dataset.device).sort()),devices,'Incorrect illustrative reporting records');
  };
  assert.equal(await page.locator('[data-ov-report="0"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-ov-report-scope="C"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-ov-report-focus="D5"]').getAttribute('aria-pressed'),'true');
  await reportRows(1,['D5']);
  await selectReport('[data-ov-report-focus="all"]');await reportRows(2,['D5','D6']);
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
  // Enlarging a diagram preserves the chosen explanation and remaps all SVG references.
  const diagramIds=['terrain','systems','vulnerabilities','shadow','services','reporting'];
  const diagramState=element=>({
   text:element.textContent.replace(/\s+/g,' ').trim(),
   groups:[...element.querySelectorAll('.ov-terrain-plane,.ov-system-zones,.ov-shared-network,.ov-system-service,.ov-risk-step,.ov-risk-system,.ov-impact-system,.ov-impact-service,.ov-report-system,.ov-unmatched')].map(group=>({
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
  assert.ok(await devices.count()>1,'Need repeated D1 instances to explain shared identity');
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
  for(const id of ids){
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
  for(const width of [1024,768,390,320]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>scrollTo(0,0));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overview overflow at '+width);
   assert.equal(await page.locator('.ov-section').count(),ids.length);
   for(const id of ids)assert.equal(await page.locator(`.ov-section[data-ov-section="${id}"] h2`).first().isVisible(),true);
   const chapter=page.locator('#ov-chapter-select');
   assert.equal(await chapter.isVisible(),true,'Named chapter selector is missing at '+width);
   assert.deepEqual(await chapter.locator('option').evaluateAll(options=>options.map(option=>option.value)),ids);
   assert.ok((await chapter.locator('option').allTextContents()).every(text=>/[A-Za-z]/.test(text)),'Mobile chapter options must contain names');
   if(width===390){
    await page.screenshot({path:path.join(output,'overview-mobile.png')});
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
  assert.equal(await page.locator('.ov-section').count(),ids.length);
  await page.locator('[data-overview-video="what"]').first().click();
  await page.waitForFunction(()=>document.querySelector('.ov-film-status').textContent.includes('could not be opened'));
  assert.match(await page.locator('.ov-film-status').innerText(),/overview-what\.mp4.*same folder.*transcript/i);
  await page.locator('.ov-film-transcript summary').click();
  assert.ok((await page.locator('.ov-film-transcript').innerText()).includes(films.what.scenes[0].body),'Transcript must remain available without a companion MP4');
  await page.keyboard.press('Escape');
  for(const id of ids)fs.copyFileSync(path.join(guide,`overview-${id}.mp4`),path.join(savedFolder,`overview-${id}.mp4`));
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
  console.log('PASS: default Overview; five-item navigation/history; ten story sections; reporting scope/search/output semantics; supplied timeline and planned release; keyboard/mouse selections; scroll progress, named mobile chapters and previous/next controls; six selected-state diagram popups with zoom, mobile pan and focus restoration; pause and reduced motion; ten offline MP4s with captions, native controls and popup focus restoration; responsive layout; saved guide portability; missing-film recovery and transcripts; route/video cleanup.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
