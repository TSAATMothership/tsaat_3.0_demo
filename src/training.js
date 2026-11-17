const phrase=k=>tx('lab.'+k);
function launchPanel(){
  return `<section class="launch-panel"><div class="launch-copy">${eyebrow(phrase('runtime'))}<h2>${phrase('title')}</h2><p>${phrase('catch')}</p><details><summary>${phrase('setup')}</summary><p>${phrase('instructions')}</p></details></div>
  <form id="lab-launch"><button class="button primary" type="submit" aria-describedby="launch-help">${phrase('open')}${icon('ne',15)}</button><p id="launch-help">${phrase('needName')}</p><div id="launch-status" role="status"></div></form></section>`;
}
function practiceEntry(windowToken){
  if(!/^[a-f0-9]{32}$/.test(windowToken))throw Error('Invalid practice launch');
  const html=new TextDecoder().decode(base64ToBytes(byId('practice-app').textContent.trim()));
  const opening='<script id="practice-launch" type="application/json">',closing='</scr'+'ipt>';
  const slot=opening+'null'+closing;
  if(!html.includes(slot))throw Error('Practice app needs a launch gate');
  const payload=JSON.stringify({windowToken});
  return URL.createObjectURL(new Blob([html.replace(slot,()=>opening+payload+closing)],{type:'text/html;charset=utf-8'}));
}
document.addEventListener('submit',event=>{
  if(event.target.id!=='lab-launch')return;event.preventDefault();
  const popup=window.open('about:blank','_blank','popup,width=1360,height=900,resizable=yes,scrollbars=yes');
  const status=byId('launch-status');status.replaceChildren();
  if(!popup){status.textContent=msg('lab.blocked');return;}
  let url;
  try{
    const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
    popup.opener=null;popup.name='tsaat-practice:'+token;
    url=practiceEntry(token);popup.location.replace(url);
  }catch{if(url)URL.revokeObjectURL(url);popup.close();status.textContent=msg('lab.offline');}
});
