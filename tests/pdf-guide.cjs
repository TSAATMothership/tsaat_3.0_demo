'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright'),JSZip=require('jszip'),{PDFDocument}=require('pdf-lib');
const root=path.resolve(__dirname,'..'),guide=path.join(root,'guide'),results=path.join(root,'build/test-results');
const output=path.join(root,'output/pdf'),url=pathToFileURL(path.join(guide,'TSAAT-User-Guide.html')).href;
fs.mkdirSync(results,{recursive:true});fs.mkdirSync(output,{recursive:true});
const normal=text=>text.normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\u2192/g,'>').replace(/\u2264/g,' <= ').replace(/\u2265/g,' >= ').replace(/\u2260/g,' != ').replace(/\s+/g,' ').trim().toLowerCase();
const relevant=key=>/^t\.[^.]+\.(?:title|short|interpret|output|[sb]\d+)$/.test(key)||/^r\./.test(key)||/^(?:gloss|fix|keys)\.[^.]+\.(?:title|body)$/.test(key)||key==='lab.instructions';

async function workbook(page,changes={}){
 const zip=await JSZip.loadAsync(fs.readFileSync(path.join(guide,'TSAAT-Guide-Text.xlsx'))),file='xl/worksheets/sheet2.xml';
 const shared=zip.file('xl/sharedStrings.xml');
 const result=await page.evaluate(({xml,shared,changes})=>{
  const parse=text=>new DOMParser().parseFromString(text,'application/xml'),all=(node,tag)=>[...node.getElementsByTagNameNS('*',tag)];
  const strings=shared?all(parse(shared),'si').map(item=>all(item,'t').map(t=>t.textContent).join('')):[];
  const doc=parse(xml),ns=doc.documentElement.namespaceURI,values={};
  const value=cell=>cell?.getAttribute('t')==='s'?strings[Number(all(cell,'v')[0]?.textContent)]:cell?.getAttribute('t')==='inlineStr'?all(cell,'t').map(t=>t.textContent).join(''):cell?all(cell,'v')[0]?.textContent||'':'';
  for(const row of all(doc,'row')){
   const cells=all(row,'c'),key=value(cells.find(cell=>/^A\d+$/.test(cell.getAttribute('r')))),text=cells.find(cell=>/^C\d+$/.test(cell.getAttribute('r')));
   if(!key||key==='Key')continue;
   if(Object.hasOwn(changes,key)){
    text.setAttribute('t','inlineStr');text.replaceChildren();
    const inline=doc.createElementNS(ns,'x:is'),run=doc.createElementNS(ns,'x:t');run.textContent=changes[key];inline.append(run);text.append(inline);
   }
   values[key]=value(text);
  }
  return {values,xml:new XMLSerializer().serializeToString(doc)};
 },{xml:await zip.file(file).async('string'),shared:shared?await shared.async('string'):null,changes});
 for(const [key,value] of Object.entries(changes))assert.equal(result.values[key],value,'Fixture did not update '+key);
 zip.file(file,result.xml);return {values:result.values,bytes:await zip.generateAsync({type:'nodebuffer'})};
}

(async()=>{
 const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
 async function inspect(bytes,expected){
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>20000,'PDF is unexpectedly small');
  const parsed=await PDFDocument.load(bytes);assert.ok(parsed.getPageCount()>=10,'The complete guide should contain many sections');
  assert.ok(parsed.getPageCount()<200,'Unexpected runaway pagination');
  for(const [index,page] of parsed.getPages().entries()){
   const {width,height}=page.getSize();assert.ok(width>=500&&height>=700,'Unexpected page size at '+(index+1));
  }
  const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,disableFontFace:true,isEvalSupported:false,verbosity:0});
  const document=await task.promise,pages=[],leftColumn=[],rightColumn=[];let graphics=false;
  try{
   assert.equal(document.numPages,parsed.getPageCount());
   for(let number=1;number<=document.numPages;number++){
    const page=await document.getPage(number),content=await page.getTextContent(),height=page.view[3]-page.view[1];
    const words=content.items.filter(item=>typeof item.str==='string'),continued=words.some(item=>/^continued$/i.test(item.str));
    if(number===1){
     const coverText=normal(words.map(item=>item.str).join(' '));
     assert.ok(words.some(item=>item.str==='TSAAT User Guide'&&Math.abs(item.transform[0])<15),'Missing title-case cover label');
     assert.doesNotMatch(coverText,/\bfield guide\b/);
     if(normal(expected['ui.map'])!=='tsaat user guide')assert.ok(!coverText.includes(normal(expected['ui.map'])),'The HTML feature title should not appear as a cover caption');
    }
    // Ignore running headers/folios and continuation headings so a paragraph can
    // be compared across page boundaries without treating page furniture as prose.
    const body=words.filter(item=>item.transform[5]>40&&item.transform[5]<height-42&&(!continued||item.transform[5]<height-120));
    const text=body.map(item=>item.str).join(' '),middle=(page.view[2]+page.view[0])/2;
    leftColumn.push(body.filter(item=>item.transform[4]<middle).map(item=>item.str).join(' '));
    rightColumn.push(body.filter(item=>item.transform[4]>=middle).map(item=>item.str).join(' '));
    assert.ok(text.trim().length>15,'Page '+number+' has no readable text');pages.push(text);
    if(!graphics){const ops=await page.getOperatorList();graphics=ops.fnArray.some(op=>[pdfjs.OPS.constructPath,pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject].includes(op));}
   }
  }finally{await document.destroy();}
  assert.equal(graphics,true,'Expected drawings or artwork in the guide');
  const text=normal(pages.join(' ')),streams=[text,normal(leftColumn.join(' ')),normal(rightColumn.join(' '))];
  for(const [key,value] of Object.entries(expected).filter(([key])=>relevant(key))){
   const prose=key==='lab.instructions'?value.replace(/\bthis guide\b/gi,'the interactive HTML guide'):value;
   assert.ok(streams.some(stream=>stream.includes(normal(prose))),'PDF omits or changes workbook text: '+key);
  }
  assert.doesNotMatch(text,/\bestate\b/);assert.doesNotMatch(text,/__(?:pdf|book|title)[a-z_]*__/);
  return {pages:pages.length,text:pages.join('\n\n')};
 }
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true,acceptDownloads:true}),errors=[],requests=[];
  await context.addInitScript(()=>{window.__pdfPrintCalls=0;window.print=()=>{window.__pdfPrintCalls++;throw Error('PDF export opened a print dialog');};});
  context.on('page',page=>{page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});});
  const page=await context.newPage();await page.goto(url+'#feature-guide');await page.locator('#generate-guide-pdf').waitFor();
  assert.equal(await page.locator('#generate-guide-pdf').innerText(),'Generate PDF User Guide');
  const original=await workbook(page);
  async function generate(expected,target){
   const before=context.pages().length,downloaded=page.waitForEvent('download',{timeout:120000});
   await page.locator('#generate-guide-pdf').click();const download=await downloaded;
   assert.equal(download.suggestedFilename(),'TSAAT-User-Guide.pdf');assert.equal(await download.failure(),null);
   const bytes=fs.readFileSync(await download.path()),result=await inspect(bytes,expected);
   await download.saveAs(target);assert.equal(context.pages().length,before,'PDF export opened another tab');
   assert.equal(await page.evaluate(()=>window.__pdfPrintCalls),0);
   await page.waitForFunction(()=>!document.getElementById('generate-guide-pdf')?.disabled);
   return result;
  }
  const first=await generate(original.values,path.join(output,'TSAAT-User-Guide.pdf'));
  fs.writeFileSync(path.join(results,'pdf-guide-extracted.txt'),first.text);
  await page.screenshot({path:path.join(results,'pdf-guide-desktop.png'),animations:'disabled'});
  // A route change and a narrow viewport must not change the exported document.
  await page.goto(url+'#topic/topology');await page.locator('.topic-banner').waitFor();
  await page.goto(url+'#feature-guide');await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'PDF button causes mobile overflow');
  const second=await generate(original.values,path.join(results,'pdf-guide-repeat.pdf'));assert.equal(second.pages,first.pages);
  await page.screenshot({path:path.join(results,'pdf-guide-mobile.png'),fullPage:true,animations:'disabled'});
  // Imported wording must reach the PDF, including content beyond the cover.
  await page.setViewportSize({width:1440,height:1000});
  const customTitle='Edited operations handbook';
  // A long workbook entry must continue onto another page rather than be clipped.
  const customDefinition='This custom glossary definition belongs to the edited workbook. Keep a threshold \u2264 5 visible in the PDF. '+
   Array.from({length:45},(_,index)=>'Review item '+(index+1)+': keep this complete explanation when the text flows onto another page.').join(' ')+' End of the custom glossary definition.';
  const customKeyboard=original.values['keys.graph.body']+' '+Array.from({length:45},(_,index)=>'Keyboard note '+(index+1)+': retain this instruction when a longer explanation continues on another page.').join(' ')+' End of the extended keyboard instructions.';
  async function load(fixture,name){
   await page.locator('[data-action="workbook"]').click();
   await page.locator('#workbook-picker').setInputFiles({name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fixture.bytes});
   await page.waitForFunction(()=>document.getElementById('book-status')?.textContent.includes('edited workbook'));
   await page.locator('[data-action="close"]').click();
  }
  const unsupported=await workbook(page,{'gloss.terrain.body':'An unsupported character: \u{1F30F}.'});
  await load(unsupported,'Unsupported PDF text.xlsx');
  let failedDownloads=0;const recordDownload=()=>failedDownloads++;page.on('download',recordDownload);
  await page.locator('#generate-guide-pdf').click();
  await page.waitForFunction(()=>document.getElementById('pdf-status')?.textContent.includes('cannot display'));
  assert.equal(failedDownloads,0,'Unsupported text produced a malformed download');
  assert.equal(await page.locator('#generate-guide-pdf').isEnabled(),true);page.off('download',recordDownload);
  const edited=await workbook(page,{'ui.map':customTitle,'ui.browserTitle':customTitle,'gloss.terrain.body':customDefinition,'keys.graph.body':customKeyboard});
  await load(edited,'Edited PDF guide.xlsx');await page.getByRole('heading',{name:customTitle,exact:true,level:1}).waitFor();
  const editedPdf=await generate(edited.values,path.join(results,'pdf-guide-edited.pdf'));assert.match(editedPdf.text,/threshold\s*<=\s*5/);
  await page.locator('[data-action="workbook"]').click();
  const savedDownload=page.waitForEvent('download');await page.locator('[data-action="save"]').click();
  const saved=path.join(results,'pdf-edited-offline-guide.html');await (await savedDownload).saveAs(saved);
  await page.goto(pathToFileURL(saved).href+'#feature-guide');await page.getByRole('heading',{name:customTitle,exact:true,level:1}).waitFor();
  await generate(edited.values,path.join(results,'pdf-guide-saved-offline.pdf'));
  assert.deepEqual(requests,[],'PDF export requested the network');assert.deepEqual(errors,[],'Browser errors during PDF export');
  console.log('PASS: offline direct PDF download; '+first.pages+' readable pages; complete topic/role/glossary/troubleshooting/keyboard wording; graphics; repeat and mobile export after route changes; long edited glossary/keyboard continuations and <= conversion; unsupported character recovery; saved standalone HTML; no print dialog, extra tabs, network requests or browser errors.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
