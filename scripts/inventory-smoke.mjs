import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { initializeJsonStore, repositoryRoot } from './setup-json-store.mjs';
import { checkEndpointInsights } from './endpoint-insights-smoke.mjs';
import { checkVulnerabilityInsights } from './vulnerability-insights-smoke.mjs';
import { checkInstalledSoftwareInsights } from './installed-software-insights-smoke.mjs';
import { checkSoftwareInsightsPdf } from './software-insights-pdf-smoke.mjs';
import { checkInventoryInsightsReports } from './inventory-insights-report-smoke.mjs';
import { checkTopologyExplorer } from './topology-explorer-smoke.mjs';
import { checkSettingsRetirement } from './settings-retirement-smoke.mjs';
import { checkHeaderLayout } from './header-layout-smoke.mjs';
import { checkWorkspaceScopeNotice } from './workspace-scope-notice-smoke.mjs';
import { checkPersonas } from './personas-smoke.mjs';
import { checkPersonaCatalogue } from './persona-catalogue-smoke.mjs';

/** Same compiled feature checks and selected history for both providers. All mutable stores are isolated. */
export async function checkInventoryRuntime(provider) {
  assert(['json','sql'].includes(provider));
  // Optional focused reruns leave the common routes/API/download/restart checks
  // enabled. Release/CI callers omit this variable and exercise every feature.
  const features = ['endpoint-insights','vulnerability-insights','software-insights','pdfs','topology','settings'];
  const selected = new Set(process.env.TSAAT_SMOKE_FEATURES?.split(',').filter(Boolean) ?? features);
  assert(selected.size && [...selected].every(name => features.includes(name)), 'Unknown or empty TSAAT_SMOKE_FEATURES selection.');
  const database = process.env.TSAAT_EVIDENCE_PARITY_DATABASE;
  if (provider === 'sql') assert(/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/.test(database ?? ''), 'Select an explicitly disposable TSAAT_EvidenceParity_* database.');
  const build = provider === 'json' ? '.next-nosql' : '.next-sql';
  assert(fs.existsSync(path.join(repositoryRoot,build,'BUILD_ID')), 'Build the selected provider first.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'tsaat-inventory-smoke-'));
  const artifacts = process.env.TSAAT_TEST_ARTIFACT_DIR;
  const env = { ...process.env, TSAAT_DATA_PROVIDER:provider, TSAAT_APP_DATABASE:database,
    TSAAT_SQL_TRUSTED_CONNECTION:'true', TSAAT_JSON_DATA_DIR:path.join(directory,'store') };
  if (provider === 'json') { env.SQLCMD_PATH=path.join(directory,'sql-must-not-run.exe'); await initializeJsonStore({target:env.TSAAT_JSON_DATA_DIR}); }
  else {
    fs.copyFileSync(path.join(repositoryRoot,'DB_config'),path.join(directory,'DB_config'));
    fs.mkdirSync(path.join(directory,'scripts'));
    fs.copyFileSync(path.join(repositoryRoot,'scripts/invoke-dpapi.ps1'),path.join(directory,'scripts/invoke-dpapi.ps1'));
  }
  const date=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'data/current.json'),'utf8')).snapshotDate;
  const historicalDate=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'data/snapshots/week-01.json'),'utf8')).snapshotDate;
  let server,browser,output='';
  async function start(){
    server=fork(path.join(repositoryRoot,'scripts/nosql-smoke-server.mjs'),[],{cwd:directory,env,execArgv:[],silent:true,windowsHide:true});
    server.stdout.on('data',bytes=>{output+=bytes;});server.stderr.on('data',bytes=>{output+=bytes;});
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Compiled server start timed out: '+output.slice(-2000))),30000);
      server.once('message',message=>{clearTimeout(timer);resolve('http://localhost:'+message.port);});
      server.once('exit',code=>{clearTimeout(timer);reject(new Error('Compiled app exited: '+code));});
    });
  }
  async function stop(){if(server&&server.exitCode===null)await new Promise(resolve=>{
    const timer=setTimeout(()=>server.kill(),5000);server.once('exit',()=>{clearTimeout(timer);resolve();});server.send('stop');
  });}
  try {
    let base=await start();
    const executablePath=process.env.TSAAT_TEST_BROWSER||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
    assert(executablePath,'Set TSAAT_TEST_BROWSER.');
    browser=await puppeteer.launch({executablePath,headless:true});
    const page=await browser.newPage(),errors=[],authRequests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/\/api\/auth\//.test(request.url()))authRequests.push(request.url());});
    await page.setViewport({width:1600,height:1000});
    async function navigate(route,scope='network=net-1',selected=date){
      const response=await page.goto(base+route+(route.includes('?')?'&':'?')+scope+'&dataDate='+selected,{waitUntil:'networkidle0',timeout:120000});
      assert.equal(response.status(),200,route);await page.waitForSelector('dialog.loading-modal[open]',{hidden:true});
      assert(!await page.$('[data-nextjs-dialog-overlay]'),route);assert.deepEqual(errors,[],route);
    }
    const explorerViews=['endpoints','installed-software','security-vulnerabilities','shadow-it','topology','installed-software-insights'];
    const routes=['/governance/installed-software-insights','/governance/end-point-insights','/governance/security-vulnerability-insights',...explorerViews.map(view=>'/discovery-coverage?discoveryView='+view)];
    for(const route of routes)for(const [scope,selected]of [['network=net-1',date],['system=sys-1',historicalDate],['network=net-1&securityDomain=NONE',date]])await navigate(route,scope,selected);
    for(const route of ['/findings','/measures','/report','/cyber-cop','/network-risk-profile','/ict-system-risk-profile','/governance/trends','/governance/insights','/governance/discovery-insights','/discovery-coverage?discoveryView=patch-management']){
      await navigate(route);assert((await page.$eval('main',node=>node.textContent)).includes('retired'),route);
    }
    for(const route of ['/api/findings/export','/api/measures/settings','/api/report/summary','/api/discovery-coverage/overview-report','/api/settings/database'])assert.equal((await fetch(base+route)).status,410,route);
    const settingsBefore=await(await fetch(base+'/api/settings/personas')).json();
    assert.equal((await fetch(base+'/api/settings/personas',{method:'PUT',body:'not-json'})).status,405);
    for(const method of ['GET','PUT'])assert.equal((await fetch(base+'/api/discovery-tools/settings',{method})).status,410);
    await navigate('/discovery-coverage?discoveryView=endpoints');
    const cmdb='[data-cmdb-asset-id]';await page.waitForSelector(cmdb);await page.focus(cmdb);await page.keyboard.press('Enter');
    await page.waitForSelector('dialog.cmdb-scope-panel[open]');await page.keyboard.press('Escape');await page.waitForSelector('dialog.cmdb-scope-panel[open]',{hidden:true});
    assert(await page.$eval(cmdb,node=>node===document.activeElement),'CMDB focus returns to its trigger');
    const downloads=path.join(directory,'workbooks');fs.mkdirSync(downloads);
    const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    for(const view of explorerViews.slice(0,4)){
      await navigate('/discovery-coverage?discoveryView='+view);
      const previous=new Set(fs.readdirSync(downloads));
      const button=await page.$('button.endpoint-export');assert(button,view+' export');await button.click();
      const deadline=Date.now()+60000;let file;
      while(Date.now()<deadline){file=fs.readdirSync(downloads).find(name=>name.endsWith('.xlsx')&&!previous.has(name));if(file)break;await new Promise(resolve=>setTimeout(resolve,200));}
      assert(file,view+' browser workbook download');const bytes=fs.readFileSync(path.join(downloads,file));assert.equal(bytes.readUInt32LE(0),0x04034b50);
    }
    await client.detach();
    if(selected.has('endpoint-insights')) await checkEndpointInsights(page,{date,historicalDate,artifacts});
    if(selected.has('vulnerability-insights')) await checkVulnerabilityInsights(page,{date,historicalDate,artifacts});
    await navigate('/discovery-coverage?discoveryView=installed-software-insights');
    if(selected.has('software-insights')) await checkInstalledSoftwareInsights(page,{date,historicalDate,artifacts});
    if(selected.has('pdfs')) {
      await checkSoftwareInsightsPdf(page,{date,historicalDate,directory:path.join(directory,'software-pdfs'),artifacts});
      await checkInventoryInsightsReports(page,{date,historicalDate,directory:path.join(directory,'inventory-pdfs'),artifacts});
    }
    if(selected.has('topology')) await checkTopologyExplorer(page,{date,historicalDate,artifacts,directory,provider});
    await navigate('/discovery-coverage?discoveryView=endpoints');
    if(selected.has('settings')) {
      await checkSettingsRetirement(page,{date,historicalDate,artifacts});await checkPersonas(page,{artifacts});await checkPersonaCatalogue(page);
      await checkHeaderLayout(page,{date,historicalDate,artifacts});
      await checkWorkspaceScopeNotice(page,{date,historicalDate,artifacts});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(authRequests,[],'No authentication polling');
    await browser.close();browser=undefined;await stop();base=await start();
    assert.deepEqual(await(await fetch(base+'/api/settings/personas')).json(),settingsBefore);
    assert.equal((await fetch(base+'/api/discovery-tools/settings')).status,410);
    assert(!fs.existsSync(path.join(directory,'logindetails')));
    if(provider==='json')assert(!fs.existsSync(path.join(directory,'DB_config')),'No-SQL must not create SQL configuration');
    console.log(`Compiled ${provider} smoke passed: nine retained views, current/historical/empty scopes, retired routes/APIs, four Excel downloads, CMDB keyboard focus, restart persistence; feature checks: ${[...selected].join(', ')}.`);
  } catch(error){console.error(output.slice(-3000));throw error;}
  finally{
    await browser?.close();await stop();
    assert(path.dirname(directory)===os.tmpdir()&&path.basename(directory).startsWith('tsaat-inventory-smoke-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
