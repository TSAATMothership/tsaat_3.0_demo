'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'guide/TSAAT-User-Guide.html')).href;
const topics=JSON.parse(fs.readFileSync(path.join(root,'src/structure.json'))).topics;
const output=path.join(root,'build/test-results');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},offline:true,reducedMotion:'reduce',acceptDownloads:true}),p=await ctx.newPage(),errors=[],requests=[];
  p.on('pageerror',error=>errors.push(error.message));p.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url())});
  await p.goto(url);await p.locator('.dynamic-graphic').waitFor();
  assert.equal(await p.locator('#main img').count(),0);
  assert.equal(await p.locator('.brand img').count(),1);
  assert.equal(await p.locator('.dg-controls button').count(),4);
  await p.screenshot({path:path.join(output,'graphics-overview.png'),animations:'disabled'});
  for(const [id,topic] of Object.entries(topics)){
   await p.goto(url+'#topic/'+id);await p.locator('.dynamic-graphic').waitFor();
   const figure=p.locator('.dynamic-graphic');assert.equal(await figure.getAttribute('data-graphic-kind'),topic.art);
   assert.equal(await figure.getAttribute('data-graphic-context'),id);assert.equal(await p.locator('.topic-art,#main img').count(),0);
   const buttons=figure.locator('.dg-controls button');const initial=await figure.getAttribute('data-graphic-selected');
   const selection=await figure.locator('.dg-controls button[aria-pressed="false"]').first().getAttribute('data-graphic-select');
   const control=figure.locator('.dg-controls button[data-graphic-select="'+selection+'"]');
   const before=await figure.locator('.dg-map').innerHTML();await control.focus();await p.keyboard.press('Space');
   assert.equal(await figure.getAttribute('data-graphic-selected'),selection);assert.notEqual(selection,initial);
   assert.equal(await control.getAttribute('aria-pressed'),'true');assert.equal(await control.evaluate(el=>el===document.activeElement),true);
   assert.equal(await figure.locator('.dg-controls [aria-pressed="true"]').count(),1);
   assert.equal(await figure.locator('.dg-node.is-selected').getAttribute('data-graphic-node'),selection);
   assert.notEqual(await figure.locator('.dg-map').innerHTML(),before);
   assert.ok(await figure.locator('.dg-edge.is-connected').count()>0);
   const summary=await figure.locator('.dg-connection-summary').innerText();assert.ok(summary.includes((await control.innerText()).trim()));
   const connected=await figure.locator('.dg-edge.is-connected').evaluateAll(edges=>edges.flatMap(edge=>edge.dataset.graphicEdge.split(':')));
   for(const related of new Set(connected))assert.ok(summary.includes((await figure.locator('.dg-controls button[data-graphic-select="'+related+'"]').innerText()).trim()));
   assert.ok((await figure.locator('.dg-detail-copy').innerText()).length>25);
   assert.equal(await figure.locator('.dg-detail').getAttribute('aria-live'),'polite');
   assert.equal(await control.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   if(['govern-soft','govern-end','govern-vuln','topology'].includes(id))await p.screenshot({path:path.join(output,'graphics-'+topic.art+'.png'),animations:'disabled'});
  }
  // Diagram hotspots and their keyboard equivalents select the same node.
  await p.locator('[data-graphic-node="endpoints"]').click();
  assert.equal(await p.locator('.dynamic-graphic').getAttribute('data-graphic-selected'),'endpoints');
  const href=await p.locator('.dg-detail-link').getAttribute('href');await p.locator('.dg-detail-link').click();assert.ok(p.url().endsWith(href));
  for(const width of [390,320]){
   await p.setViewportSize({width,height:844});
   for(const route of ['feature-guide','topic/explore-end','topic/explore-soft','topic/explore-vuln','topic/topology']){
    await p.goto(url+'#'+route);await p.locator('.dynamic-graphic').waitFor();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow: '+width+' '+route);
    for(const button of await p.locator('.dg-controls button').all()){const bounds=await button.boundingBox();assert.ok(bounds.height>=40&&bounds.width>=90);}
    if(width===390)await p.locator('.dynamic-graphic').screenshot({path:path.join(output,'graphics-mobile-'+await p.locator('.dynamic-graphic').getAttribute('data-graphic-kind')+'.png'),animations:'disabled'});
   }
   if(width===390)await p.screenshot({path:path.join(output,'graphics-mobile.png'),fullPage:true,animations:'disabled'});
  }
  // A workbook from the browser-lab release has lab.* but no graphic.* rows.
  const zip=await JSZip.loadAsync(fs.readFileSync(path.join(root,'guide/TSAAT-Guide-Text.xlsx'))),sheet='xl/worksheets/sheet2.xml',table='xl/tables/table1.xml';
  const xml=await zip.file(sheet).async('string'),rows=[...xml.matchAll(/<x:row\b.*?<\/x:row>/gs)].map(match=>match[0]),kept=rows.filter(row=>!row.includes('<x:v>graphic.'));
  zip.file(sheet,xml.replace(/<x:row\b.*?<\/x:row>/gs,row=>row.includes('<x:v>graphic.')?'':row).replaceAll('A1:D'+rows.length,'A1:D'+kept.length).replaceAll('End Point Explorer','My endpoint view'));
  zip.file(table,(await zip.file(table).async('string')).replaceAll('A1:D'+rows.length,'A1:D'+kept.length));
  await p.setViewportSize({width:1440,height:1000});await p.goto(url+'#topic/explore-end');await p.locator('[data-action="workbook"]').click();
  await p.locator('#workbook-picker').setInputFiles({name:'previous-guide.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await p.waitForFunction(()=>document.getElementById('book-status')?.textContent.includes('edited workbook'));
  let downloaded=p.waitForEvent('download');await p.locator('[data-action="save"]').click();const saved=path.join(output,'dynamic-edited-guide.html');await (await downloaded).saveAs(saved);
  await p.goto(pathToFileURL(saved).href+'#topic/explore-end');await p.locator('.dg-detail-title').waitFor();
  assert.equal(await p.locator('.dg-detail-title').innerText(),'My endpoint view');
  await p.locator('.dg-controls button').last().click();assert.equal(await p.locator('.dg-controls button').last().getAttribute('aria-pressed'),'true');
  const app=fs.readFileSync(path.join(root,'guide/TSAAT-Practice-Lab.html')),savedHtml=fs.readFileSync(saved,'utf8');
  assert.deepEqual(Buffer.from(savedHtml.match(/id="practice-app"[^>]*>([^<]+)/)[1],'base64'),app);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'practice-lab/source-manifest.json')));
  assert.equal(crypto.createHash('sha256').update(app).digest('hex'),manifest.htmlSha256);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  console.log('PASS: four dynamic graphic families across overview and thirteen topics; keyboard and SVG selection; meaningful connected paths; mobile layout; reduced motion; older workbook migration; edited offline guide; practice bundle preserved.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
