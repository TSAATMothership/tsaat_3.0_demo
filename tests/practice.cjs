'use strict';
const assert=require('node:assert/strict');
const path=require('node:path'), http=require('node:http'),{Duplex}=require('node:stream'),fs=require('node:fs'),os=require('node:os');
const runtime=process.env.TEST_LAB_ROOT||path.join(__dirname,'../build/test-lab');
const {createPracticeHost,PORT,GUIDE,ENTRY}=require(path.join(runtime,'lab-host.cjs'));
const {chromium}=require('playwright');
const origin='http://127.0.0.1:'+PORT;
function call(server,route,headers={},method='GET',body=Buffer.alloc(0)){
 return new Promise((resolve,reject)=>{
  const chunks=[];
  const socket=new Duplex({read(){},write(c,enc,done){chunks.push(Buffer.from(c));done();}});
  socket.on('error',reject);
  socket.on('finish',()=>{
   try{
    const wire=Buffer.concat(chunks),sep=wire.indexOf('\r\n\r\n');assert.ok(sep>=0,'No response for '+route);
    const lines=wire.subarray(0,sep).toString().split('\r\n'),status=Number(lines.shift().split(' ')[1]),headers={};
    for(const line of lines){const at=line.indexOf(':');headers[line.slice(0,at).toLowerCase()]=line.slice(at+1).trim();}
    let data=wire.subarray(sep+4);
    if(headers['transfer-encoding']==='chunked'){const decoded=[];let i=0;while(i<data.length){const end=data.indexOf('\r\n',i),len=parseInt(data.subarray(i,end).toString(),16);if(!len)break;decoded.push(data.subarray(end+2,end+2+len));i=end+2+len+2;}data=Buffer.concat(decoded);}
    for(const h of ['transfer-encoding','connection','content-length','keep-alive'])delete headers[h];
    resolve({status,headers,body:data});
   }catch(e){reject(e);}
  });
  server.emit('connection',socket);
  const raw=Object.entries({...headers,host:'127.0.0.1:'+PORT,connection:'close','accept-encoding':'identity','content-length':String(body.length)}).map(([k,v])=>k+': '+v).join('\r\n');
  socket.push(Buffer.concat([Buffer.from(method+' '+route+' HTTP/1.1\r\n'+raw+'\r\n\r\n'),body]));
 });
}
const results=path.join(__dirname,'../build/test-results');
fs.mkdirSync(results,{recursive:true});
(async()=>{
 const app=await createPracticeHost();const server=http.createServer((req,res)=>app.handle(req,res).catch(e=>{console.error(e);res.statusCode=500;res.end(e.message);}));
 let browser;
 try{
  const status=await call(server,'/__practice/status');assert.equal(JSON.parse(status.body).snapshots,8);
  for(const route of [ENTRY,'/api/settings/personas','/governance/end-point-insights?network=net-1','/discovery-coverage?discoveryView=topology&network=net-1&dataDate=2026-09-19']){
   const r=await call(server,route);console.log('runtime',route,r.status,r.body.length);assert.equal(r.status,200);assert.ok(r.body.length>500);
   if(route===ENTRY){assert.match(r.body.toString(),/Server 1/);assert.match(r.body.toString(),/2026-11-07/);}
  }
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',args:['--no-proxy-server','--disable-background-networking']});
  const ctx=await browser.newContext({viewport:{width:1390,height:900}});const faults=[];
  ctx.on('page',p=>p.on('pageerror',e=>{faults.push(e.message);console.log('PAGE ERROR',e.message);}));
  let ready=true;
  await ctx.route(origin+'/**',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.pathname==='/__practice/ready'&&!ready){await route.abort();return;}
   const result=await call(server,u.pathname+u.search,req.headers(),req.method(),req.postDataBuffer()||Buffer.alloc(0));
   if(result.status>=400)console.warn('HTTP',result.status,u.pathname);
   await route.fulfill(result).catch(()=>{});
  });
  const guide=await ctx.newPage();await guide.goto(origin+GUIDE+'#practice');await guide.locator('#learner-name').waitFor();
  assert.equal(await guide.getByText('TSAAT UI 3',{exact:true}).count(),0);
  await guide.locator('#learner-name').fill('   ');await guide.locator('#lab-launch button').click();assert.equal(await guide.locator('#learner-name').evaluate(e=>e.validity.valid),false);
  await guide.locator('#learner-name').fill('Avery & Kim');await guide.screenshot({path:path.join(results,'practice-launch.png')});
  let next=ctx.waitForEvent('page');await guide.locator('#lab-launch button').click();let learner=await next;
  await learner.locator('.learner-badge b').waitFor();assert.equal(await learner.locator('.learner-badge b').innerText(),'Avery & Kim');assert.match(learner.url(),/#session$/);
  const iframe=learner.frameLocator('#training-app');await iframe.getByRole('heading',{name:'End Point Explorer',exact:true}).waitFor({timeout:25000});
  await iframe.locator('.endpoint-table tbody tr').first().waitFor({timeout:14000});
  const search=iframe.getByRole('searchbox',{name:'Search all endpoint fields'});await search.fill('10.77.0.105');await iframe.getByText('Server 5',{exact:true}).first().click();await iframe.getByText('CMDB Drill Through',{exact:true}).first().waitFor();
  await learner.screenshot({path:path.join(results,'practice-session.png')});
  await learner.reload();await learner.locator('#training-app').waitFor();assert.equal(await learner.locator('.learner-badge b').innerText(),'Avery & Kim');
  await learner.locator('[data-action=end-session]').click();await learner.locator('#lab-launch').waitFor();
  ready=false;await guide.locator('#learner-name').fill('Morgan');next=ctx.waitForEvent('page');await guide.locator('#lab-launch button').click();let second=await next;
  await second.locator('#runtime-help:visible').waitFor({timeout:10000});ready=true;await second.locator('[data-action=lab-retry]').click();await second.frameLocator('#training-app').locator('.endpoint-table tbody tr').first().waitFor();
  assert.deepEqual(faults,[]);console.log('PASS: actual compiled NoSQL app, latest and historical requests, sample endpoints, browser popup, session name, live search and CMDB drill-through, reload, end, runtime recovery.');
 }finally{if(browser)await browser.close();await app.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});

