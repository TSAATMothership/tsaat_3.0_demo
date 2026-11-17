function refPage(group,id){
  const known={gloss:'terms',fix:'issues',keys:'shortcuts'};group=known[group]?group:'gloss';
  const tabs=Object.entries(known).map(([g,k])=>link('reference/'+g,ui(k),'seg'+(g===group?' on':''),g===group?'aria-current="page"':'')).join('');
  const records=model[group].map(item=>{const k=group+'.'+item+'.';return `<details class="reference-item" id="ref-${item}" ${id===item?'open':''}><summary><span>${tx(k+'title')}</span>${icon('down',16)}</summary><p>${tx(k+'body')}</p></details>`;}).join('');
  return crumb(ui('reference'))+heading(ui('guide'),ui('reference'),ui('referenceIntro'))+`<nav class="segments" aria-label="${ui('reference')}">${tabs}</nav><section class="ref-list">${records}</section>`;
}
function practice(){
  return crumb(ui('practice'))+heading(ui('guide'),ui('practice'),ui('labIntro'))+launchPanel();
}
function routeView(focus=false){
  disposeScopeVideo();
  resetArtworkEffects();
  resetStepEffects();
  const [name='feature-guide',id,item]=path();let page,nav=name;
  if(name==='session'){page=practice();nav='practice';}
  else if(name==='topic'&&model.topics[id]){page=topicPage(id);nav='feature-guide';}
  else if(name==='role'&&model.roles[id]){page=rolePage(id);nav='roles';}
  else if(name==='roles')page=rolesPage();
  else if(name==='reference')page=refPage(id,item);
  else if(name==='practice')page=practice(id);
  else{page=featureGuidePage();nav='feature-guide';}
  byId('main').innerHTML=page;
  setupScopeVideo();
  linkGlossaryTerms(byId('main'));
  for(const n of document.querySelectorAll('[data-nav]')){
    if(n.dataset.nav===nav)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');
  }
  document.title=byId('main').querySelector('h1').textContent+' · '+u('brand');
  if(focus){window.scrollTo(0,0);byId('main').focus({preventScroll:true});if(name==='reference'&&item){const definition=byId('ref-'+item);definition?.scrollIntoView({block:'start'});definition?.querySelector('summary')?.focus({preventScroll:true});}}
  lastRoute=location.hash;
}
function setupSearch(){
  searchItems=[];
  function enter(pre,route,category,iconId){
    const parts=[...copy].filter(([k])=>k.startsWith(pre+'.')&&k!==pre+'.title').map(([,v])=>v.text);
    const title=msg(pre+'.title');
    searchItems.push({title,category,icon:iconId,route,parts});
  }
  for(const [id,t] of Object.entries(model.topics))enter('t.'+id,'topic/'+id,u(t.group),t.icon);
  for(const [id,r] of Object.entries(model.roles))enter('r.'+id,'role/'+id,u('roleGroup'),r.icon);
  searchItems.push({title:u('practice'),category:u('guide'),icon:'lab',route:'practice',parts:[msg('lab.catch')]});
  for(const [g,label] of [['gloss','terms'],['fix','issues'],['keys','shortcuts']])for(const id of model[g])enter(g+'.'+id,'reference/'+g+'/'+id,u(label),'book');
}
function results(query){
  const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const ranked=searchItems.map(item=>{
    const title=item.title.toLocaleLowerCase(),category=item.category.toLocaleLowerCase(),all=[title,category,...item.parts].join(' ').toLocaleLowerCase();
    const score=terms.every(t=>all.includes(t))?terms.reduce((sum,t)=>sum+(title.includes(t)?8:0)+(category.includes(t)?2:0)+1,0):-1;
    const snippet=item.parts.find(p=>terms.length&&terms.some(t=>p.toLocaleLowerCase().includes(t)))||item.parts[0]||'';
    return {item,score,snippet};
  }).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score);
  byId('search-results').innerHTML=ranked.length?ranked.map(({item,snippet})=>link(item.route,icon(item.icon,18)+`<span><small>${safe(item.category)}</small><strong>${safe(item.title)}</strong><p>${safe(snippet)}</p></span>${icon('chev',15)}`,'search-result','data-result')).join(''):`<p class="nothing">${ui('searchzero')}</p>`;
}
function dialogHeader(title){return `<div class="dialog-head"><h2 id="dialog-heading">${title}</h2><button data-action="close" class="icon-only" aria-label="${ui('close')}">${icon('close')}</button></div>`;}
function modal(kind){
  const d=byId('dialog');opener=document.activeElement;
  if(window.matchMedia('(max-width: 900px)').matches&&(kind==='workbook'||opener?.closest('#sidebar')))opener=document.querySelector('.hamb');
  setMenu(false);
  d.className=kind==='search'?'search-dialog':'book-dialog';
  d.setAttribute('aria-labelledby','dialog-heading');
  if(kind==='search'){
    d.innerHTML=dialogHeader(ui('search'))+`<label class="search-field">${icon('search',20)}<input id="query" type="search" autocomplete="off" placeholder="${ui('searchhint')}" aria-label="${ui('search')}"></label><div class="search-results" id="search-results" aria-label="${ui('results')}"></div>`;
    results('');d.showModal();byId('query').focus();
  }else{
    const [p,id]=path();
    const key=p==='topic'&&model.topics[id]?'t.'+id+'.title':p==='role'&&model.roles[id]?'r.'+id+'.title':p==='practice'?'lab.title':p==='reference'?'ui.reference':p==='roles'?'ui.roles':'ui.map';
    const actions=[['download','download'],['upload','upload'],['save','download']];
    const rows=actions.map(([a,ico],i)=>`<div class="wb-row"><span class="number">${pad(i+1)}</span><div><h3>${ui('wb'+(i+1))}</h3><p>${ui('wb'+(i+1)+'d')}</p>${a==='save'?'<p>Keep the saved HTML file and the walkthrough MP4 files together in the same folder so the videos can play.</p>':''}<button class="button secondary" data-action="${a}">${icon(ico,15)}${ui(a)}</button></div></div>`).join('');
    d.innerHTML=dialogHeader(ui('workbook'))+`<p class="dialog-lead">${ui('workbookIntro')}</p><div class="keyline"><span>${ui('referenceKey')}</span><code>${safe(key)}</code></div>${rows}<input type="file" id="workbook-picker" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden><div id="book-status" class="book-status" role="status">${icon('workbook',16)}<span>${ui(sourceMode)}</span></div>`;
    d.showModal();
  }
}
function closeDialog(){const d=byId('dialog');if(d?.open)d.close();if(opener?.isConnected)opener.focus({preventScroll:true});}
function setMenu(open){document.body.classList.toggle('menu-open',open);const b=document.querySelector('.hamb');if(b){b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',u(open?'menuClose':'menu'));}if(open)document.querySelector('#sidebar a')?.focus();}
function applyContent(map,data,mode){copy=map;book=data;sourceMode=mode;shell();setupSearch();routeView();}
function download(blob,name){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function saveGuide(){
  const doc=document.documentElement.cloneNode(true);
  doc.querySelector('#workbook').textContent=book;doc.querySelector('#app').replaceChildren();
  const loading=doc.querySelector('#boot');loading.textContent=u('wait');loading.removeAttribute('hidden');
  doc.querySelector('noscript').textContent=u('dataWarning');doc.querySelector('title').textContent=u('browserTitle');doc.querySelector('body').className='';
  download(new Blob(['<!doctype html>\n'+doc.outerHTML],{type:'text/html;charset=utf-8'}),'TSAAT-User-Guide.html');
}
function state(text){const s=byId('book-status');if(s)s.textContent=text;}
async function importFile(input){
  const file=input.files[0];if(!file||workbookBusy)return;workbookBusy=true;state(u('reading'));
  try{const bytes=new Uint8Array(await file.arrayBuffer());const parsed=await readBook(bytes);const encoded=bytesToBase64(parsed.updatedBytes||bytes);closeDialog();applyContent(parsed,encoded,'imported');const trigger=document.querySelector('[data-action=workbook]');trigger.focus();modal('workbook');byId('dialog').querySelector('[data-action=save]').focus();}
  catch{state(u('failed'));input.value='';}
  finally{workbookBusy=false;}
}
document.addEventListener('click',e=>{
  const el=e.target.closest('a,button,dialog');if(!el)return;
  if(el.matches('.skip')){e.preventDefault();byId('main').focus();return;}
  if(el.tagName==='DIALOG'){if(e.target!==el)return;const r=el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();return;}
  if(el.hasAttribute('data-result')){closeDialog();if(el.hash===location.hash)routeView(true);}
  if(el.tagName==='A'&&el.hash&&!el.dataset.action)setMenu(false);
  if(el.dataset.example!==undefined){exampleChoice=Number(el.dataset.example);el.closest('.example-panel').outerHTML=workedExample(path()[1]);linkGlossaryTerms(byId('main'));document.querySelector('[data-example="'+exampleChoice+'"]').focus({preventScroll:true});return;}
  switch(el.dataset.action){
    case 'menu':setMenu(!document.body.classList.contains('menu-open'));break;
    case 'search':modal('search');break;
    case 'workbook':e.preventDefault();modal('workbook');break;
    case 'close':closeDialog();break;
    case 'download':download(new Blob([base64ToBytes(book)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'TSAAT-Guide-Text.xlsx');break;
    case 'upload':byId('workbook-picker').click();break;
    case 'save':saveGuide();break;
  }
});
document.addEventListener('input',e=>{if(e.target.id==='query')results(e.target.value);});
document.addEventListener('change',e=>{if(e.target.id==='workbook-picker')importFile(e.target);});
document.addEventListener('cancel',e=>{if(e.target.id==='dialog'){e.preventDefault();closeDialog();}},true);
document.addEventListener('keydown',e=>{
  const editing=e.target.matches('input,textarea,[contenteditable=true]');
  if(e.key==='/'&&!document.body.classList.contains('in-session')&&!editing&&!e.ctrlKey&&!e.metaKey&&!byId('dialog').open){e.preventDefault();modal('search');}
  if(e.key==='Escape'&&document.body.classList.contains('menu-open')){setMenu(false);document.querySelector('.hamb')?.focus();}
  if(document.body.classList.contains('menu-open')&&e.key==='Tab'){
    const elems=[document.querySelector('.hamb'),...document.querySelectorAll('#sidebar a')];
    if(e.shiftKey&&document.activeElement===elems[0]){e.preventDefault();elems.at(-1).focus();}
    if(!e.shiftKey&&document.activeElement===elems.at(-1)){e.preventDefault();elems[0].focus();}
  }
  if(e.key==='Enter'&&e.target.id==='query'){const first=byId('search-results').querySelector('a');if(first){e.preventDefault();first.click();}}
});
window.addEventListener('hashchange',()=>{if(lastRoute!==location.hash){exampleChoice=0;setMenu(false);routeView(true);}});
window.matchMedia('(min-width: 901px)').addEventListener('change',e=>{if(e.matches&&copy.size)setMenu(false);});
async function start(){
  const embedded=await readBook(base64ToBytes(defaults));originalGuideText=embedded;applyContent(embedded,defaults,'embed');byId('boot').hidden=true;
  if(['http:','https:'].includes(location.protocol)){
    try{
      const url=new URL('TSAAT-Guide-Text.xlsx',location.href);
      const res=await fetch(url,{cache:'no-store'});if(res.status===404)return;if(!res.ok)throw Error('Workbook unavailable');
      const bytes=new Uint8Array(await res.arrayBuffer());const parsed=await readBook(bytes);
      if(sourceMode==='embed'){
        const b64=bytesToBase64(parsed.updatedBytes||bytes);
        if(b64===defaults){sourceMode='linked';const status=byId('book-status');if(status)status.textContent=u('linked');}
        else {const d=byId('dialog');const kind=d.open?(d.className==='book-dialog'?'workbook':'search'):null;const q=byId('query')?.value||'';if(kind)closeDialog();applyContent(parsed,b64,'linked');if(kind){modal(kind);if(kind==='search'){byId('query').value=q;results(q);}}}
      }
    }catch{if(sourceMode==='embed'){sourceMode='badlinked';const status=byId('book-status');if(status)status.textContent=u('badlinked');}}
  }
}
start().catch(()=>{byId('boot').textContent=document.querySelector('noscript').textContent;});
})();
