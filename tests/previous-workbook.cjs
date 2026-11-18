'use strict';
const path=require('path'),fs=require('fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
const {chromium}=require('playwright'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),out=path.join(root,'guide');
const structure=JSON.parse(fs.readFileSync(path.join(root,'src/structure.json'),'utf8'));
const required=JSON.parse(fs.readFileSync(path.join(root,'src/text-keys.json'),'utf8'));
const additions=new Set(structure.glossExtensions.flatMap(id=>['gloss.'+id+'.title','gloss.'+id+'.body']));
const sheet='xl/worksheets/sheet2.xml',table='xl/tables/table1.xml';
async function workbookRows(page,bytes){
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file(sheet).async('string');
 const shared=zip.file('xl/sharedStrings.xml');
 const rows=await page.evaluate(({xml,shared})=>{
   const parse=text=>new DOMParser().parseFromString(text,'application/xml');
   const all=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
   const strings=shared?all(parse(shared),'si').map(si=>all(si,'t').map(t=>t.textContent).join('')):[];
   return all(parse(xml),'row').slice(1).map(row=>{
     const cells={};for(const cell of all(row,'c')){
       const col=cell.getAttribute('r').replace(/\d/g,''),type=cell.getAttribute('t'),value=all(cell,'v')[0]?.textContent||'';
       cells[col]=type==='s'?strings[Number(value)]:type==='inlineStr'?all(cell,'t').map(t=>t.textContent).join(''):value;
     }
     return [cells.A,cells.C];
   }).filter(([key])=>key);
 },{xml,shared:shared?await shared.async('string'):null});
 return {zip,xml,rows:new Map(rows)};
}
async function verifyMigration(page,bytes,name,current){
 const before=await workbookRows(page,bytes),missing=required.filter(key=>!before.rows.has(key));
 assert.ok(missing.length>0,'Fixture must need migration');
 await page.goto(pathToFileURL(path.join(out,'TSAAT-User-Guide.html')).href+'#feature-guide');
 await page.locator('[data-action=workbook]').click();
 await page.locator('#workbook-picker').setInputFiles({name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 await page.waitForFunction(()=>document.getElementById('book-status')?.textContent.includes('edited workbook'));
 const wait=page.waitForEvent('download');await page.locator('[data-action=download]').click();
 const restored=await workbookRows(page,fs.readFileSync(await (await wait).path()));
 for(const [key,value] of before.rows)assert.equal(restored.rows.get(key),value,'Existing wording changed: '+key);
 for(const key of missing)assert.equal(restored.rows.get(key),current.get(key),'Missing default: '+key);
 const last=Math.max(...[...restored.xml.matchAll(/<[^>]*row\b[^>]*\br="(\d+)"/g)].map(match=>Number(match[1])));
 assert.match(await restored.zip.file(table).async('string'),new RegExp('ref="A1:D'+last+'"'));
 await page.locator('[data-action=close]').click();
 await page.getByRole('heading',{name:before.rows.get('ui.map'),exact:true,level:1}).waitFor();
 await page.locator('#sidebar a[href="#practice"]').click();await page.locator('#lab-launch button').waitFor();
 assert.equal(await page.locator('input[type="email"],#learner-name,#lab-launch input').count(),0);assert.equal(await page.locator('#lab-launch button').isEnabled(),true);
 await page.locator('#sidebar a[href="#reference"]').click();
 await page.locator('#ref-terrain summary').click();await page.locator('#ref-terrain[open]').waitFor();
 assert.equal(await page.locator('#ref-terrain p').textContent(),current.get('gloss.terrain.body'));
 return {before:before.rows,restored:restored.rows,missing};
}
(async()=>{
 const currentBytes=fs.readFileSync(path.join(out,'TSAAT-Guide-Text.xlsx'));
 const zip=await JSZip.loadAsync(currentBytes),src=await zip.file(sheet).async('string');
 const rows=[...src.matchAll(/<x:row\b.*?<\/x:row>/gs)].map(match=>match[0]);
 const legacy=rows.filter(row=>{const key=row.match(/<x:v>([^<]*)<\/x:v>/)?.[1];return !key?.startsWith('lab.')&&!additions.has(key);});
 assert.ok(legacy.length<rows.length-additions.size,'Fixture removes launch rows and glossary extensions');
 const renumbered=legacy.map((row,index)=>row.replace(/\br="([A-D]?)(\d+)"/g,(_,col)=>'r="'+col+(index+1)+'"'));
 const edited=src.replace(/(<x:sheetData>).*?(<\/x:sheetData>)/s,(_,start,end)=>start+renumbered.join('')+end)
   .replaceAll('A1:D'+rows.length,'A1:D'+legacy.length).replaceAll('TSAAT Feature Guide','My edited feature guide');
 zip.file(sheet,edited);zip.file(table,(await zip.file(table).async('string')).replaceAll('A1:D'+rows.length,'A1:D'+legacy.length));
 const legacyBytes=await zip.generateAsync({type:'nodebuffer'});
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 try{
   const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   const current=(await workbookRows(page,currentBytes)).rows;
   const legacyResult=await verifyMigration(page,legacyBytes,'Prior guide.xlsx',current);
   assert.ok(legacyResult.missing.some(key=>key.startsWith('lab.')));
   assert.ok([...additions].every(key=>legacyResult.missing.includes(key)));
   assert.equal(legacyResult.restored.get('ui.map'),'My edited feature guide');
   // The real pre-edit workbook already has launch text; only new glossary defaults may be added.
   const previousPath=path.join(root,'build/plain-english-before.xlsx');
   if(fs.existsSync(previousPath)){
     const actual=await verifyMigration(page,fs.readFileSync(previousPath),'Before plain English.xlsx',current);
     assert.ok([...actual.before.keys()].some(key=>key.startsWith('lab.')));
     assert.ok(actual.missing.every(key=>additions.has(key)));
   }
   assert.deepEqual(errors,[]);
   console.log('PASS: older workbooks retain every existing text cell; missing launch/glossary defaults are added to the editable Excel table.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

