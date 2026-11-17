'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright'),JSZip=require('../vendor/jszip/jszip.min.js');
const root=path.resolve(__dirname,'..'),results=path.join(root,'build/test-results');
const guideUrl=pathToFileURL(path.join(root,'guide/TSAAT-User-Guide.html')).href;
fs.mkdirSync(results,{recursive:true});
(async()=>{
 const bundle=fs.readFileSync(path.join(root,'guide/TSAAT-Practice-Lab.html'),'utf8');
 const zip=await JSZip.loadAsync(bundle.match(/id="practice-data"[^>]*>([^<]+)/)[1],{base64:true});
 const manifest=JSON.parse(await zip.file('store.json').async('string'));
 assert.equal(manifest.snapshots.length,8);
 const samples=await Promise.all(manifest.snapshots.map(async item=>JSON.parse(await zip.file(item.file).async('string'))));
 const latest=samples.at(-1),initial='/discovery-coverage?discoveryView=endpoints&network=net-1&dataDate='+latest.snapshotDate;
 const expected=(sample,net='net-1')=>sample.assets.filter(a=>a.networkId===net).length;
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--disable-extensions','--disable-background-networking','--no-first-run']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,offline:true});
  const errors=[],requests=[];
  context.on('page',page=>{
   page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE ERROR',error.message)});
   page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.error('CONSOLE',message.text())}});
   page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  });
  const guide=await context.newPage();await guide.goto(guideUrl+'#practice');await guide.locator('#lab-launch').waitFor();
  assert.equal(await guide.locator('.scenario,[data-answer]').count(),0);
  for(const label of ['Practice scenarios','Practice questions'])assert.equal(await guide.getByText(label,{exact:true}).count(),0);
  const launch=guide.locator('#lab-launch button[type="submit"]');
  assert.equal(await guide.locator('input[type="email"],#learner-name,#lab-launch input').count(),0);
  assert.equal(await launch.isEnabled(),true);
  await guide.screenshot({path:path.join(results,'practice-launch.png')});
  const popup=context.waitForEvent('page');await guide.locator('#lab-launch button').click();const app=await popup;
  async function ready(title='End Point Explorer'){
   const insights={'Installed Software Insights':'#software-briefing-title','End Point Insights':'#endpoint-insights-title','Security Vulnerability Insights':'#vulnerability-insights-title'};
   await (insights[title]?app.locator(insights[title]):app.getByRole('heading',{name:title,exact:true,level:1})).waitFor({timeout:20000});
   await app.locator('#workspace [aria-busy="true"]').waitFor({state:'hidden',timeout:20000});
   await (insights[title]?app.locator(insights[title]):app.getByRole('heading',{name:title,exact:true,level:1})).waitFor();
  }
  async function download(button,suffix){
   const promised=app.waitForEvent('download',{timeout:30000});await button.click();let item;
   try{item=await promised}catch(error){console.error('DOWNLOAD STATE',await app.locator('body').innerText());await app.screenshot({path:path.join(results,'download-failure.png')});throw error}
   assert.ok(item.suggestedFilename().endsWith(suffix));const bytes=fs.readFileSync(await item.path());
   assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,suffix==='.pdf'?5:2).toString(),suffix==='.pdf'?'%PDF-':'PK');
   await item.saveAs(path.join(results,item.suggestedFilename()));return bytes;
  }
  await ready();assert.equal(await app.locator('.practice-learner').innerText(),'Practice session');
  const firstToken=await app.evaluate(()=>window.name);assert.match(firstToken,/^tsaat-practice:[a-f0-9]{32}$/);
  function assertPrivateLaunchUrl(page){assert.doesNotMatch(decodeURIComponent(page.url()),/[?&#](?:learner|email|name)=/i);}
  assertPrivateLaunchUrl(app);
  const liveBlobUrl=app.url();assert.match(liveBlobUrl,/^blob:/);
  assert.equal(await app.evaluate(()=>window.opener),null);
  assert.equal(Number((await app.locator('.endpoint-total strong').innerText()).replaceAll(',','')),expected(latest));
  assert.equal(await app.locator('iframe').count(),0);
  const search=app.getByRole('searchbox',{name:'Search all endpoint fields'});
  await search.fill('10.77.0.105');
  await app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true}).click();
  await app.getByRole('button',{name:'Close CMDB Drill Through'}).waitFor();
  assert.match(await app.getByRole('dialog').innerText(),/srv-0005/);
  await app.keyboard.press('Escape');
  await app.getByRole('button',{name:'Close CMDB Drill Through'}).waitFor({state:'hidden'});
  await app.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Open CMDB Drill Through for Server 5');
  assert.equal(await app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true}).evaluate(el=>el===document.activeElement),true);
  const workbook=await JSZip.loadAsync(await download(app.getByRole('button',{name:'Export Excel',exact:true}),'.xlsx'));
  const sheet=await workbook.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet,/10\.77\.0\.105/);assert.doesNotMatch(sheet,/10\.77\.0\.107/);
  await app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true}).click();
  await app.getByRole('button',{name:'Explore Topology',exact:true}).click();await ready('Topology Explorer');
  assert.equal(await app.getByRole('dialog').count(),0);
  await app.locator('.topology-canvas').waitFor();assert.match(app.url(),/network=net-1/);
  await app.getByRole('button',{name:'Reset practice',exact:true}).click();await ready();
  await search.fill('');await app.screenshot({path:path.join(results,'practice-session.png')});
  // The independent fixture counts must agree with the reused provider for every week.
  for(const sample of samples){
   await app.getByLabel('Data date').fill(sample.snapshotDate);
   await app.waitForFunction(date=>document.querySelector('.endpoint-total small')?.textContent.includes(date),sample.snapshotDate);
   assert.equal(Number((await app.locator('.endpoint-total strong').innerText()).replaceAll(',','')),expected(sample));
  }
  await app.getByRole('button',{name:/^Managed Network/}).click();
  const networkSelect=app.locator('.workspace-scope-popover').filter({has:app.getByRole('checkbox',{name:'Aegis Mesh North',exact:true})});
  await networkSelect.getByRole('checkbox',{name:'Aegis Mesh North',exact:true}).uncheck();
  const nextNetwork=latest.managedNetworks.find(n=>n.id!=='net-1'&&n.id!=='net-unassigned');
  await networkSelect.getByRole('checkbox',{name:nextNetwork.name,exact:true}).check();
  await app.getByRole('button',{name:'Update Managed Network filter'}).click();
  await app.waitForFunction(id=>location.hash.includes('network='+id),nextNetwork.id);await ready();
  assert.equal(Number((await app.locator('.endpoint-total strong').innerText()).replaceAll(',','')),expected(latest,nextNetwork.id));
  await app.getByRole('button',{name:'Reset practice',exact:true}).click();await ready();
  await app.getByRole('button',{name:/^Security Domain:/}).click();
  const domains=app.getByRole('group',{name:'Security Domain options',exact:true});
  const boxes=domains.getByRole('checkbox');
  for(let i=0;i<await boxes.count();i++){const label=await boxes.nth(i).evaluate(el=>el.parentElement.textContent.trim());await boxes.nth(i).setChecked(label==='PROTECTED');}
  await app.getByRole('button',{name:'Update Security Domain filter'}).click();
  await app.waitForFunction(()=>location.hash.includes('securityDomain=PROTECTED'));
  await ready();assert.equal(Number((await app.locator('.endpoint-total strong').innerText()).replaceAll(',','')),latest.assets.filter(a=>a.networkId==='net-1'&&a.securityDomain==='PROTECTED').length);
  await app.getByRole('button',{name:'Reset practice',exact:true}).click();await ready();
  await app.getByRole('button',{name:/^ICT System:/}).click();
  const system=latest.ictSystems.find(s=>latest.assets.some(a=>a.systemContext?.systemId===s.id&&a.networkId&&a.networkId!=='net-unassigned'));
  await app.getByRole('group',{name:'ICT System options',exact:true}).getByRole('checkbox',{name:system.name,exact:true}).check();
  await app.getByRole('button',{name:'Update ICT System filter'}).click();await app.waitForFunction(id=>location.hash.includes('system='+id),system.id);await ready();
  assert.ok(!app.url().includes('network='));assert.equal(Number((await app.locator('.endpoint-total strong').innerText()).replaceAll(',','')),latest.assets.filter(a=>a.systemContext?.systemId===system.id&&a.networkId&&a.networkId!=='net-unassigned').length);
  await app.getByRole('button',{name:'Reset practice',exact:true}).click();await ready();
  await app.getByRole('button',{name:'Discovery',exact:true}).click();
  for(const [label,view] of [['Installed Software Explorer','installed-software'],['Security Vulnerability Explorer','security-vulnerabilities'],['Shadow IT Explorer','shadow-it']]){
   await app.getByRole('link',{name:label,exact:true}).click();await ready(label);
   await download(app.getByRole('button',{name:'Export Excel',exact:true}),'.xlsx');
   assert.match(app.url(),new RegExp('discoveryView='+view));
  }
  await app.getByRole('link',{name:'Topology Explorer',exact:true}).click();await ready('Topology Explorer');
  await app.locator('[data-topology-result]').first().click();await app.locator('.topology-canvas').waitFor();
  await app.getByRole('tab',{name:'Dependencies',exact:true}).click();assert.match(app.url(),/topologyMode=dependencies/);assert.match(app.url(),/network=net-1/);
  await download(app.getByRole('button',{name:'Generate Impact Report',exact:true}),'.pdf');
  await app.screenshot({path:path.join(results,'practice-topology.png')});
  await app.getByRole('button',{name:'Governance',exact:true}).click();
  for(const label of ['Installed Software Insights','End Point Insights','Security Vulnerability Insights']){
   await app.getByRole('link',{name:label,exact:true}).click();await ready(label);
   const images=app.locator('#workspace img');for(let i=0;i<await images.count();i++)assert.ok(await images.nth(i).evaluate(el=>el.complete&&el.naturalWidth>0));
   const pdf=app.getByRole('button',{name:/PDF|Download report|Generate report/i});
   await download(pdf.first(),'.pdf');
   const anchor=app.locator('#workspace a[href^="#"]:not([href^="#/"])').first();
   if(await anchor.count()){const previous=app.url();await anchor.click();assert.equal(app.url(),previous);}
  }
  await app.getByLabel('Active persona').selectOption({label:'Analyst'});
  const secondWindow=context.waitForEvent('page');await guide.locator('#lab-launch button').click();const second=await secondWindow;
  await second.getByRole('heading',{name:'End Point Explorer',exact:true}).waitFor();assert.equal(await second.getByLabel('Active persona').inputValue(),'');
  assert.equal(await second.locator('.practice-learner').innerText(),'Practice session');
  const secondToken=await second.evaluate(()=>window.name);assert.match(secondToken,/^tsaat-practice:[a-f0-9]{32}$/);assert.notEqual(secondToken,firstToken);assertPrivateLaunchUrl(second);
  await app.getByRole('button',{name:'Reset practice',exact:true}).click();await ready();assert.equal(await app.getByLabel('Active persona').inputValue(),'');
  await app.reload();await ready();assert.equal(await app.locator('.practice-learner').innerText(),'Practice session');assert.equal(await app.evaluate(()=>window.name),firstToken);assertPrivateLaunchUrl(app);
  await app.setViewportSize({width:390,height:844});await app.locator('.workspace-layout.sidebar-collapsed').waitFor();
  await app.screenshot({path:path.join(results,'practice-mobile.png'),fullPage:true,animations:'disabled'});
  assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Practice layout overflows mobile viewport');
  await app.getByRole('button',{name:'Show sidebar',exact:true}).click();await app.getByRole('button',{name:'Discovery',exact:true}).click();
  await app.getByRole('link',{name:'Installed Software Explorer',exact:true}).click();await ready('Installed Software Explorer');await app.locator('.workspace-layout.sidebar-collapsed').waitFor();
  // A blocked popup offers status only; retrying the launch button remains the only entry.
  assert.equal(await launch.isEnabled(),true);
  const pagesBeforeBlocked=context.pages().length;
  await guide.evaluate(()=>{window.__testNativeOpen=window.open;window.open=()=>null;});await launch.click();
  await guide.waitForFunction(()=>document.getElementById('launch-status')?.textContent.trim());
  assert.match(await guide.locator('#launch-status').innerText(),/blocked|pop.?up/i);
  assert.equal(await guide.locator('#launch-status a').count(),0);assert.equal(context.pages().length,pagesBeforeBlocked);
  await guide.evaluate(()=>{window.open=window.__testNativeOpen;delete window.__testNativeOpen;});
  const retryWindow=context.waitForEvent('page');await launch.click();const third=await retryWindow;await third.getByRole('heading',{name:'End Point Explorer',exact:true}).waitFor();
  assert.equal(await third.locator('.practice-learner').innerText(),'Practice session');assertPrivateLaunchUrl(third);
  // A copied URL or standalone file must not bypass the guide's launch-button gate.
  async function denied(page){await page.getByRole('heading',{name:'Open the lab from the user guide',exact:true}).waitFor();assert.equal(await page.locator('#workspace').count(),0);}
  const copiedBlob=await context.newPage();await copiedBlob.goto(liveBlobUrl);await denied(copiedBlob);
  const copied=path.join(results,'isolated-practice.html');fs.writeFileSync(copied,bundle);const direct=await context.newPage();await direct.goto(pathToFileURL(copied).href);
  await denied(direct);await direct.reload();await denied(direct);
  await direct.goto(pathToFileURL(copied).href+'#/?learner=x@defence.gov.au');await denied(direct);
  assert.deepEqual(requests,[],'Practice attempted network requests');assert.deepEqual(errors,[],'Browser errors');
  console.log('PASS: immediately enabled button-only launch without a name/email field; private per-window tokens; copied URL and standalone entry denied; popup retry; eight snapshots/screens; network/system/domain scope; CMDB keyboard/focus and topology handoff; filtered Excel and four PDF report types; session isolation/reset; reload; mobile navigation; no network requests.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
