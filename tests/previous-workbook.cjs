const path=require('path'),fs=require('fs'),os=require('os'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
const {chromium}=require('playwright'),JSZip=require('jszip');
(async()=>{const out=path.join(__dirname,'../guide'),zip=await JSZip.loadAsync(fs.readFileSync(path.join(out,'TSAAT-Guide-Text.xlsx')));
const sheet='xl/worksheets/sheet2.xml',table='xl/tables/table1.xml',src=await zip.file(sheet).async('string');
const rows=[...src.matchAll(/<x:row\b.*?<\/x:row>/gs)].map(x=>x[0]),isAddition=r=>r.includes('<x:v>lab.')||r.includes('<x:v>graphic.'),legacy=rows.filter(r=>!isAddition(r));
const txt=src.replace(/<x:row\b.*?<\/x:row>/gs,r=>isAddition(r)?'':r).replaceAll('A1:D'+rows.length,'A1:D'+legacy.length).replaceAll('TSAAT Feature Guide','My edited feature guide');
zip.file(sheet,txt);zip.file(table,(await zip.file(table).async('string')).replaceAll('A1:D'+rows.length,'A1:D'+legacy.length));
const bytes=await zip.generateAsync({type:'nodebuffer'});
const b=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});try{
 const p=await b.newPage();await p.goto(pathToFileURL(path.join(out,'TSAAT-User-Guide.html')).href);await p.locator('[data-action=workbook]').click();await p.locator('#workbook-picker').setInputFiles({name:'Prior guide.xlsx',mimeType:'application/octet-stream',buffer:bytes});await p.waitForFunction(()=>document.getElementById('book-status')?.textContent.includes('edited workbook'));
 const wait=p.waitForEvent('download');await p.locator('[data-action=download]').click();const z=await JSZip.loadAsync(fs.readFileSync(await (await wait).path()));
 const restored=await z.file(sheet).async('string'),last=Math.max(...[...restored.matchAll(/<[^>]*row\b[^>]*\br="(\d+)"/g)].map(match=>Number(match[1])));
 assert.ok((await z.file(table).async('string')).includes('A1:D'+last));assert.ok(restored.includes('lab.needName'));assert.ok(restored.includes('graphic.hint'));
 await p.locator('[data-action=close]').click();await p.getByRole('heading',{name:'My edited feature guide'}).waitFor();
 await p.locator('#sidebar a[href="#practice"]').click();await p.locator('#learner-name').waitFor();assert.equal(await p.getByText('TSAAT UI 3',{exact:true}).count(),0);
 console.log('PASS: prior workbook customisations preserved; new launch text appended to editable Excel table.');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

