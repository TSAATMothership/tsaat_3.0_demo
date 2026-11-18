const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('url');
const http=require('node:http');
const {chromium}=require('playwright');
const JSZip=require('jszip');
const out=path.resolve(__dirname,'../guide'),url=pathToFileURL(path.join(out,'TSAAT-User-Guide.html')).href;
const roles=['manager','network','system','analyst'],topics=Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname,'../src/structure.json'))).topics),fail=[];
const results=path.join(__dirname,'../build/test-results');
fs.mkdirSync(results,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true,args:['--disable-extensions','--disable-background-networking','--no-first-run','--disable-default-apps','--no-proxy-server']});
 let fixtureServer;
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:940},acceptDownloads:true}),p=await ctx.newPage();
 p.on('pageerror',e=>{fail.push(e.message);console.log('PAGE ERROR',e.message);});
 await p.goto(url+'#feature-guide');await p.getByRole('heading',{name:'TSAAT Feature Guide'}).waitFor({timeout:7000});
 await p.screenshot({path:path.join(results,'desktop.png')});
 const removedNames=['Choose your role','Common tasks','Set your scope','Explore workspace','Scope','Insights','Evidence','Workspace map'];
 for(const route of ['#map', '#feature-guide']){
   await p.goto(url+route);
   await p.getByRole('heading',{name:'TSAAT Feature Guide',exact:true,level:1}).waitFor();
   assert.equal(await p.locator('#sidebar nav a').count(),5);
   assert.equal(await p.locator('#sidebar a[aria-current="page"]').innerText(),'TSAAT Feature Guide');
   assert.equal(await p.locator('.role-card,.hero button:not(#generate-guide-pdf),.hero a:not(.glossary-link),.role-nav,[data-layer]').count(),0);
   assert.equal(await p.locator('.hero #generate-guide-pdf').count(),1);
   for(const label of removedNames)assert.equal(await p.getByText(label,{exact:true}).count(),0,'Unexpected label '+label);
   assert.equal(await p.locator('.map-block.gov .mini-topic').count(),3);
   assert.equal(await p.locator('.map-block.dis .mini-topic').count(),5);
   assert.equal(await p.locator('.map-block.shared a').count(),5);
 }
 await p.locator('.map-block.shared a[href="#topic/scope"]').click();
 await p.getByRole('heading',{name:'Choose what to include',exact:true,level:1}).waitFor();
 await p.locator('.breadcrumb').getByRole('link',{name:'TSAAT Feature Guide'}).click();
 await p.getByRole('heading',{name:'TSAAT Feature Guide',exact:true}).waitFor();
 await p.locator('#sidebar a[href="#roles"]').click();
 await p.getByRole('heading',{name:'Guides by role',exact:true,level:1}).waitFor();
 assert.equal(await p.locator('.role-card').count(),4);
 for(const id of roles){await p.goto(url+'#role/'+id);await p.waitForSelector('.steps li');assert.equal(await p.locator('.steps li').count(),4);}
 for(const [id,t] of topics){await p.goto(url+'#topic/'+id);await p.waitForSelector('.topic-banner h1');assert.equal(await p.locator('.steps li').count(),t.n);assert.equal(await p.locator('a a').count(),0,'Nested link on '+id);}
 await p.locator('[data-example="1"]').click();await p.waitForSelector('.root-node');assert.match(await p.locator('.teaching-graph').textContent(),/Endpoint B/);await p.screenshot({path:path.join(results,'topology-page.png')});
 await p.goto(url+'#topic/govern-end');await p.locator('[data-example="2"]').click();assert.match(await p.locator('#example-note').textContent(),/four required checks gives 75%/);
 // Keyboard glossary navigation opens the intended definition and continues from its summary.
 const coverage=p.locator('a[data-glossary-term="coverage"]');await coverage.focus();await p.keyboard.press('Enter');
 await p.waitForURL(/#reference\/gloss\/coverage$/);
 assert.equal(await p.locator('#ref-coverage').getAttribute('open'),'');
 assert.equal(await p.locator('#ref-coverage > summary').innerText(),'Discovery coverage');
 assert.equal(await p.locator('#ref-coverage > summary').evaluate(el=>el===document.activeElement),true);
 assert.equal(await p.locator('a a').count(),0);
 await p.goto(url+'#map');await p.waitForSelector('.map-block');assert.equal(await p.locator('.map-block .mini-topic').count(),13);
 await p.goto(url+'#practice/arp');await p.locator('#lab-launch').waitFor();assert.equal(await p.locator('[data-answer],.scenario,.scenario-link').count(),0);assert.match(await p.locator('.launch-copy').textContent(),/do not need to install anything, run a server or connect to the internet/);
 await p.goto(url+'#reference/fix/nopath');assert.equal(await p.locator('#ref-nopath').getAttribute('open'),'');
 await p.keyboard.press('/');await p.locator('#query').fill('reserved');assert.ok(await p.locator('.search-result[href="#topic/explore-vuln"]').count()>0);
 await p.locator('#query').fill('zznothingxyz');assert.match(await p.locator('.nothing').textContent(),/No matching/);
 await p.locator('#query').fill('Shadow IT Explorer');await p.keyboard.press('Enter');assert.match(p.url(),/#topic\/shadow/);
 await p.locator('[data-action="workbook"]').click();const book=fs.readFileSync(path.join(out,'TSAAT-Guide-Text.xlsx'));let promise=p.waitForEvent('download');await p.locator('[data-action="download"]').click();assert.deepEqual(fs.readFileSync(await (await promise).path()),book);
 await p.locator('#workbook-picker').setInputFiles({name:'invalid.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});await p.waitForFunction(()=>document.getElementById('book-status').textContent.includes('could not be loaded'));
 // Re-save the cell as an inline string, then verify import and offline persistence.
 const zip=await JSZip.loadAsync(book),file='xl/worksheets/sheet2.xml';
 let xml=await zip.file(file).async('string');
 const target=/<x:c\b[^>]*\bt="str"[^>]*><x:v>TSAAT Feature Guide<\/x:v><\/x:c>/;
 assert.ok(target.test(xml));
 const edited='Evidence &amp; assurance field guide';
 xml=xml.replace(/(<x:c r="C[0-9]+"[^>]*\bt=")str("[^>]*>)<x:v>TSAAT Feature Guide<\/x:v>(<\/x:c>)/g,'$1inlineStr$2<x:is><x:t>'+edited+'</x:t></x:is>$3');
 zip.file(file,xml);let fresh=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 await p.locator('#workbook-picker').setInputFiles({name:'edited.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fresh});await p.waitForFunction(()=>document.getElementById('book-status')?.textContent.includes('edited workbook'));
 promise=p.waitForEvent('download');await p.locator('[data-action="save"]').click();const saved=path.join(results,'edited-qa.html');await (await promise).saveAs(saved);
 await p.goto(pathToFileURL(saved).href+'#feature-guide');await p.getByRole('heading',{name:'Evidence & assurance field guide'}).waitFor();
 await p.locator('#sidebar a[href="#practice"]').click();await p.locator('#lab-launch button').waitFor();
 assert.equal(await p.locator('input[type="email"],#learner-name,#lab-launch input').count(),0);assert.equal(await p.locator('#lab-launch button').isEnabled(),true);
 const labWindow=ctx.waitForEvent('page');await p.locator('#lab-launch button').click();const savedLab=await labWindow;
 await savedLab.getByRole('heading',{name:'End Point Explorer',exact:true}).waitFor();await savedLab.close();
 const mobile=await ctx.newPage({});await mobile.setViewportSize({width:390,height:844});await mobile.goto(url+'#feature-guide');await mobile.locator('.hero').waitFor();await mobile.screenshot({path:path.join(results,'mobile.png'),fullPage:true});
 for(const route of ['overview','roles','map','role/system','topic/topology','topic/govern-soft','practice','reference']){await mobile.goto(url+'#'+route);await mobile.waitForTimeout(25);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow '+route);}
 await mobile.locator('.hamb').click();await mobile.locator('#sidebar a[href="#roles"]').click();await mobile.locator('.role-card[href="#role/manager"]').click();assert.equal(await mobile.locator('body').getAttribute('class')||'','');
 // Stream the complete media-rich guide over loopback without passing a large
 // base64 response through the browser automation transport.
 const web=await ctx.newPage();let mode='valid';
 fixtureServer=http.createServer((request,response)=>{
   if(request.url.endsWith('.xlsx')){response.writeHead(mode==='missing'?404:200,{'Content-Type':'application/octet-stream'});response.end(mode==='valid'?fresh:Buffer.from('bad'));return;}
   if(request.url.split('?')[0]!=='/index.html'){response.writeHead(404);response.end();return;}
   response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(path.join(out,'TSAAT-User-Guide.html')).pipe(response);
 });
 await new Promise((resolve,reject)=>{fixtureServer.once('error',reject);fixtureServer.listen(0,'127.0.0.1',resolve);});
 const fixtureUrl=`http://127.0.0.1:${fixtureServer.address().port}/index.html`;
 for(const test of ['valid','missing','bad']){mode=test;await web.goto(fixtureUrl+'?case='+test+'#feature-guide');await web.waitForSelector('.hero');if(test==='valid')await web.getByRole('heading',{name:'Evidence & assurance field guide'}).waitFor();await web.locator('[data-action=workbook]').click();await web.waitForFunction(s=>document.getElementById('book-status').textContent.includes(s),test==='valid'?'separate workbook stored beside':test==='missing'?'workbook stored inside':'could not be read');}
 assert.deepEqual(fail,[]);console.log('PASS: browser rendered desktop/mobile; four role pathways; thirteen walkthroughs; eight screen links; diagrams, glossary, practice launcher without scenarios, search, XLSX export/import, edited HTML offline reload, HTTP workbook selection/fallback.');
 }finally{await browser.close();if(fixtureServer)await new Promise(resolve=>fixtureServer.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

