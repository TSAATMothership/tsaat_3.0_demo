let learnerDraft='',practiceUrl='';
const phrase=k=>tx('lab.'+k);
function launchPanel(){
  return `<section class="launch-panel"><div class="launch-copy">${eyebrow(phrase('runtime'))}<h2>${phrase('title')}</h2><p>${phrase('catch')}</p><details><summary>${phrase('setup')}</summary><p>${phrase('instructions')}</p></details></div>
  <form id="lab-launch"><label for="learner-name">${phrase('name')}</label><input id="learner-name" name="learner" required maxlength="64" autocomplete="off" value="${safe(learnerDraft)}" aria-describedby="launch-status"><button class="button primary" type="submit">${phrase('open')}${icon('ne',15)}</button><div id="launch-status" role="status"></div></form></section>`;
}
function practiceEntry(name){
  if(!practiceUrl){
    const bytes=base64ToBytes(byId('practice-app').textContent.trim());
    practiceUrl=URL.createObjectURL(new Blob([bytes],{type:'text/html;charset=utf-8'}));
  }
  return practiceUrl+'#/?learner='+encodeURIComponent(name);
}
document.addEventListener('submit',event=>{
  if(event.target.id!=='lab-launch')return;event.preventDefault();
  const input=byId('learner-name'),name=input.value.trim();
  if(!name||name.length>64||/[\u0000-\u001f\u007f]/.test(name)){input.setCustomValidity(msg('lab.needName'));input.reportValidity();return;}
  learnerDraft=name;
  const url=practiceEntry(name);
  const popup=window.open('about:blank','_blank','popup,width=1360,height=900,resizable=yes,scrollbars=yes');
  const status=byId('launch-status');status.replaceChildren();
  if(popup){popup.opener=null;popup.location.replace(url);}
  else {const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='inline-link';link.textContent=msg('lab.fallback');status.append(document.createTextNode(msg('lab.blocked')+' '),link);}
});
document.addEventListener('input',event=>{if(event.target.id==='learner-name'){learnerDraft=event.target.value;event.target.setCustomValidity('');}});
