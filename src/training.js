const LAB_ORIGIN='http://127.0.0.1:43871';
const LAB_GUIDE=LAB_ORIGIN+'/__practice/TSAAT-User-Guide.html#practice';
const LAB_ENTRY=LAB_ORIGIN+'/discovery-coverage?discoveryView=endpoints&network=net-1';
let learnerDraft='',probeTimer, waitingFrame=null;
const phrase=k=>tx('lab.'+k);
function launchPanel(){
  return `<section class="launch-panel"><div class="launch-copy">${eyebrow(phrase('runtime'))}<h2>${phrase('title')}</h2><p>${phrase('catch')}</p><details><summary>${phrase('setup')}</summary><p>${phrase('instructions')}</p></details></div>
  <form id="lab-launch"><label for="learner-name">${phrase('name')}</label><input id="learner-name" name="learner" required maxlength="64" autocomplete="off" value="${safe(learnerDraft)}" aria-describedby="launch-status"><button class="button primary" type="submit">${phrase('open')}${icon('ne',15)}</button><div id="launch-status" role="status"></div></form></section>`;
}
function sessionName(raw){
  let name='';
  try{name=(raw?decodeURIComponent(raw):sessionStorage.getItem('tsaat.lab.displayName')||'').trim();}catch{return '';}
  if(!name||name.length>64||/[\u0000-\u001f\u007f]/.test(name))return '';
  if(raw){try{sessionStorage.setItem('tsaat.lab.displayName',name);history.replaceState(null,'','#session');}catch{}}
  return name;
}
function workspace(name){
  return `<div class="training-shell"><header class="training-bar">${coverImage('logo')}<div><h1>${phrase('session')}</h1><small>${phrase('sample')}</small></div><span class="learner-badge">${icon('roles',16)}<span>${phrase('person')} · <b>${safe(name)}</b></span></span><button data-action="end-session" class="button secondary">${phrase('end')}</button></header>
  <div id="session-area"><div class="runtime-message"><p id="runtime-status" role="status">${phrase('connecting')}</p><div id="runtime-help" hidden><p>${phrase('instructions')}</p><button data-action="lab-retry" class="button primary">${phrase('retry')}</button><a class="button secondary" rel="noreferrer" href="${LAB_GUIDE}">${phrase('direct')}</a></div></div></div></div>`;
}
function clearProbe(){clearTimeout(probeTimer);waitingFrame?.remove();waitingFrame=null;}
function probeRuntime(){
  clearProbe();const area=byId('session-area');if(!area)return;
  byId('runtime-status').textContent=msg('lab.connecting');byId('runtime-help').hidden=true;
  const frame=document.createElement('iframe');frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.referrerPolicy='no-referrer';frame.src=LAB_ORIGIN+'/__practice/ready';waitingFrame=frame;area.append(frame);
  probeTimer=setTimeout(()=>{clearProbe();if(!byId('runtime-status'))return;byId('runtime-status').textContent=msg('lab.offline');byId('runtime-help').hidden=false;},5500);
}
window.addEventListener('message',event=>{
  if(event.origin!==LAB_ORIGIN||!waitingFrame||event.source!==waitingFrame.contentWindow||event.data?.type!=='tsaat-nosql-practice-1')return;
  clearProbe();const area=byId('session-area');if(!area)return;
  const app=document.createElement('iframe');app.id='training-app';app.title=msg('lab.frame');app.referrerPolicy='no-referrer';app.allowFullscreen=true;app.src=LAB_ENTRY;area.replaceChildren(app);
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='lab-launch')return;event.preventDefault();
  const input=byId('learner-name'),name=input.value.trim();
  if(!name||name.length>64||/[\u0000-\u001f\u007f]/.test(name)){input.setCustomValidity(msg('lab.needName'));input.reportValidity();return;}
  learnerDraft=name;
  const url=new URL(location.href);url.hash='session/'+encodeURIComponent(name);
  const popup=window.open('about:blank','_blank','popup,width=1360,height=900,resizable=yes,scrollbars=yes');
  const status=byId('launch-status');status.replaceChildren();
  if(popup){popup.opener=null;popup.location.replace(url.href);}
  else {const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.className='inline-link';link.textContent=msg('lab.fallback');status.append(document.createTextNode(msg('lab.blocked')+' '),link);}
});
document.addEventListener('input',event=>{if(event.target.id==='learner-name'){learnerDraft=event.target.value;event.target.setCustomValidity('');}});

