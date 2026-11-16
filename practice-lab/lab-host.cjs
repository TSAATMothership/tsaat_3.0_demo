'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawn}=require('node:child_process');
const ROOT=__dirname;
const APP=path.join(ROOT,'application');
const NODE_HOST='127.0.0.1', PORT=43871;
const ID='tsaat-nosql-practice-1';
const GUIDE='/__practice/TSAAT-User-Guide.html';
const ORIGIN='http://'+NODE_HOST+':'+PORT;
const ENTRY='/discovery-coverage?discoveryView=endpoints&network=net-1';
function browser(){spawn('rundll32.exe',['url.dll,FileProtocolHandler',ORIGIN+GUIDE+'#practice'],{stdio:'ignore',windowsHide:true,detached:true}).on('error',()=>console.log(ORIGIN+GUIDE+'#practice')).unref();}
async function createPracticeHost(){
  process.env.NODE_ENV='production';process.env.NEXT_TELEMETRY_DISABLED='1';
  process.env.TSAAT_DATA_PROVIDER='json';process.env.TSAAT_JSON_DATA_DIR=path.join(ROOT,'sample-data');
  process.chdir(APP);
  const store=JSON.parse(fs.readFileSync(path.join(process.env.TSAAT_JSON_DATA_DIR,'store.json'),'utf8'));
  if(store.format!=='tsaat-json-store'||store.sampleDataProfile!=='tsaat-aligned-evidence-v1'||!store.snapshots.length)throw new Error('The bundled training data is incomplete. Extract the complete ZIP again.');
  const requireApp=createRequire(path.join(APP,'package.json'));
  const app=requireApp('next')({dev:false,dir:APP,hostname:NODE_HOST,port:PORT});
  await app.prepare();
  const next=app.getRequestHandler();
  const staticFiles=new Map([[GUIDE,['TSAAT-User-Guide.html','text/html; charset=utf-8']],['/__practice/TSAAT-Guide-Text.xlsx',['TSAAT-Guide-Text.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']]]);
  const probe='<script>parent.postMessage({type:'+JSON.stringify(ID)+'},"*");</script>';
  function respond(req,res,code,body,type){res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:body);}
  async function handle(req,res){
    if(req.headers.host!==NODE_HOST+':'+PORT){respond(req,res,400,'Invalid host','text/plain');return;}
    const route=new URL(req.url,ORIGIN).pathname;
    if(!route.startsWith('/__practice/'))return next(req,res);
    if(!['GET','HEAD'].includes(req.method)){respond(req,res,405,'Method unavailable','text/plain');return;}
    const entry=staticFiles.get(route);
    if(entry){respond(req,res,200,await fs.promises.readFile(path.join(ROOT,entry[0])),entry[1]);return;}
    if(route==='/__practice/status'){respond(req,res,200,JSON.stringify({application:ID,provider:'json',snapshots:store.snapshots.length}), 'application/json');return;}
    if(route==='/__practice/ready'){respond(req,res,200,'<!doctype html><meta charset="utf-8">'+probe,'text/html; charset=utf-8');return;}
    respond(req,res,404,'Unavailable','text/plain');
  }
  return {handle,close:()=>app.close()};
}
async function main(){
  const noBrowser=process.argv.includes('--no-open');
  let host;
  const server=http.createServer((req,res)=>{
    if(!host){res.writeHead(503,{'Retry-After':'2'});res.end('Starting TSAAT');return;}
    host.handle(req,res).catch(error=>{console.error(error.message);if(!res.headersSent)res.statusCode=500;res.end();});
  });
  try{await new Promise((ok,no)=>{server.once('error',no);server.listen(PORT,NODE_HOST,ok);});}
  catch(error){
    if(error.code==='EADDRINUSE'){
      try{
        const response=await fetch(ORIGIN+'/__practice/status',{signal:AbortSignal.timeout(2500)});
        if((await response.json()).application===ID){if(!noBrowser)browser();return;}
      }catch{}
      throw new Error('Port 43871 is already in use. If another practice launcher is starting, wait for it to open the guide. Otherwise close the application using that port and try again.');
    }throw error;
  }
  console.log('Opening the TSAAT practice lab with the bundled NoSQL sample data…');
  try{host=await createPracticeHost();}catch(e){server.close();throw e;}
  console.log(ORIGIN+GUIDE+'#practice'+'\nKeep this window open while practising. Press Ctrl+C to stop.');
  if(!noBrowser)browser();
  function stop(){server.closeAllConnections();server.close();host.close().finally(()=>process.exit(0));}
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
module.exports={createPracticeHost,PORT,ID,GUIDE,ENTRY};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});

