// One recorded device connects three investigation leads; no causal conclusion is implied.
const ovInvestigationStepMs=3200,ovInvestigationDuration=ovInvestigationStepMs*4;
function ovInvestigationArt(compact=false) {
 const p=compact?{finding:[100,80],device:[100,230],system:[315,230],mission:[265,80],business:[425,80],unknown:[355,365]}:{finding:[140,70],device:[140,220],system:[520,115],mission:[820,60],business:[820,190],unknown:[490,245]};
 const [fx,fy]=p.finding,[dx,dy]=p.device,[sx,sy]=p.system,[mx,my]=p.mission,[bx,by]=p.business,[ux,uy]=p.unknown;
 const routes=[
  {id:'finding',step:0,order:0,color:'#8edcff',d:`M${fx} ${fy+26}V${dy-38}`},
  {id:'unknown',step:1,order:0,color:'#8edcff',d:compact?`M${dx+28} ${dy+25}C210 310 235 365 ${ux-33} ${uy}`:`M${dx+38} ${dy}C300 220 315 245 ${ux-33} ${uy}`},
  {id:'membership',step:2,order:0,color:'#70e3a1',d:compact?`M${dx+38} ${dy}H${sx-70}`:`M${dx+38} ${dy-12}C315 208 315 115 ${sx-75} ${sy}`},
  {id:'mission',step:2,order:1,color:'#c7b7ff',d:compact?`M${sx} ${sy-31}V154H${mx}V${my+32}`:`M${sx+75} ${sy}C660 115 660 60 ${mx-100} ${my}`},
  {id:'business',step:2,order:1,color:'#efb8dc',d:compact?`M${sx} ${sy-31}V154H${bx}V${by+32}`:`M${sx+75} ${sy}C660 115 660 190 ${bx-100} ${by}`}
 ];
 const linework=routes.map(route=>`<path d="${route.d}" fill="none" stroke="${route.color}" stroke-opacity=".18" stroke-width="2.5"/><path data-story-route="${route.id}" data-story-phase="${route.step}" data-story-order="${route.order}" d="${route.d}" fill="none" stroke="${route.color}" stroke-width="2.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`).join('');
 const focus=(x,y,w,h)=>`<rect class="ov-story-focus" x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="none" stroke="#d3fff1" stroke-width="2.5"/>`;
 const service=(x,y,label,color)=>`<g transform="translate(${x} ${y})"><rect x="${compact?-68:-100}" y="-32" width="${compact?136:200}" height="64" rx="10" fill="#282d48" stroke="${color}" stroke-width="2"/><text y="-4" fill="${color}" text-anchor="middle" font-size="22">${label}</text><text y="23" fill="#e8e2f3" text-anchor="middle" font-size="22">service ${label==='Mission'?'A':'B'}</text></g>`;
 return `<svg class="ov-diagram ov-investigation-diagram" viewBox="0 0 ${compact?'520 470':'1000 345'}" role="group" aria-label="Follow D3: a software finding, communication with an unmatched address, and dependencies through ICT System B to Mission service A and Business service B.">
  ${linework}
  <g class="ov-story-device" transform="translate(${dx} ${dy})"><circle r="37" fill="#302b27" stroke="#f6aa63" stroke-width="2"/><g fill="none" stroke="#f6aa63" stroke-width="1.9" transform="scale(1.3)">${ovTopologyGlyph('Server')}</g><text y="61" fill="#f6c493" font-size="27" text-anchor="middle">D3</text><text y="87" fill="#b1cbd5" font-size="20" text-anchor="middle">Known device</text></g>
  <g class="ov-story-object" data-story-entity="finding" data-ov-investigation-stage="0" role="button" tabindex="0" aria-controls="ov-investigation-caption" aria-label="Follow the software finding on D3" aria-pressed="true" transform="translate(${fx} ${fy})">
   <rect x="-88" y="-58" width="176" height="124" rx="12" fill="transparent"/>${focus(-88,-58,176,124)}<rect x="-36" y="-26" width="72" height="52" rx="8" fill="#173e51" stroke="#8edcff" stroke-width="2"/><text y="9" text-anchor="middle" fill="#c6efff" font-size="28">SW</text><circle cx="43" cy="-27" r="21" fill="#4a3527" stroke="#ffd08a" stroke-width="2"/><text x="43" y="-19" fill="#ffe0a0" font-size="26" text-anchor="middle">!</text><text y="57" fill="#ffe0a0" font-size="22" text-anchor="middle">Finding F-01</text>
  </g>
  <g class="ov-story-object" data-story-entity="unknown" data-ov-investigation-stage="1" role="button" tabindex="0" aria-controls="ov-investigation-caption" aria-label="Investigate unmatched address 192.0.2.87 observed by D3" aria-pressed="false" transform="translate(${ux} ${uy})">
   <rect x="-118" y="-47" width="236" height="143" rx="12" fill="transparent"/>${focus(-118,-47,236,143)}<circle r="33" fill="#29333a" stroke="#ffe0a0" stroke-width="2" stroke-dasharray="5 5"/><text y="13" fill="#ffe0a0" text-anchor="middle" font-size="40">?</text><text y="60" fill="#ffe0a0" text-anchor="middle" font-size="23">192.0.2.87</text><text y="84" fill="#b5ccd6" text-anchor="middle" font-size="20">Unmatched address</text>
  </g>
  <g class="ov-story-object" data-story-entity="services" data-ov-investigation-stage="2" role="button" tabindex="0" aria-controls="ov-investigation-caption" aria-label="Trace D3 through ICT System B to Mission service A and Business service B" aria-pressed="false">
   ${service(mx,my,'Mission','#c7b7ff')}${service(bx,by,'Business','#efb8dc')}
   <g transform="translate(${sx} ${sy})">${focus(-85,-43,170,115)}<rect x="-75" y="-31" width="150" height="62" rx="10" fill="#163b30" stroke="#70e3a1" stroke-width="2"/><text y="8" fill="#b5f0cc" font-size="25" text-anchor="middle">System B</text><text y="60" fill="#a6cbbf" font-size="19" text-anchor="middle">ICT system</text></g>
  </g>
  ${routes.map(route=>`<circle data-story-signal="${route.id}" r="5" fill="${route.color}" opacity="0"/>`).join('')}
 </svg>`;
}
function ovInvestigationStory() {
 const steps=ovSection('investigate').story;
 return `<div class="ov-investigation-story" data-investigation-step="0" data-investigation-playback="waiting"><div class="ov-investigation-story-heading"><h3>Follow D3. Select an object.</h3><span data-ov-investigation-status>Plays when in view</span></div><div class="ov-investigation-visual">${ovInvestigationArt()}</div><div class="ov-investigation-transport" role="group" aria-label="Investigation story playback"><button type="button" data-ov-investigation-play aria-label="Pause investigation story">Pause</button><button type="button" data-ov-investigation-replay>Replay</button><div class="ov-investigation-stepper"><button type="button" data-ov-investigation-prev aria-label="Previous story moment" disabled>${icon('chev',16)}</button><span data-ov-investigation-position>1 / 4</span><button type="button" data-ov-investigation-next aria-label="Next story moment">${icon('chev',16)}</button></div></div><div class="ov-investigation-progress" role="progressbar" aria-label="Investigation story progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div id="ov-investigation-caption" class="ov-investigation-caption" aria-live="polite" aria-atomic="true">${steps.map((step,i)=>`<div data-investigation-caption="${i}" class="ov-investigation-moment${i===0?' is-active':''}" aria-hidden="${i!==0}"><strong>${ovEscape(step.title)}</strong><p>${ovEscape(step.body)}</p><button type="button" class="ov-investigation-action" data-ov-jump="${step.topic}" aria-controls="ov-${step.topic}">${ovEscape(step.action)}${icon('arrow',16)}</button></div>`).join('')}</div></div>`;
}
function ovSetupInvestigationStory(root,{signal,reduced,prefersReduced,isBlocked}) {
 const host=root.querySelector('.ov-investigation-story'),visual=host.querySelector('.ov-investigation-visual');
 const state={elapsed:0,frame:0,lastTime:0,intent:true,manual:false,visible:false,compact:null,routes:[],observer:null,step:0};
 const clamp=value=>Math.max(0,Math.min(1,value));
 const paint=()=>{
  const step=Math.min(3,Math.floor(state.elapsed/ovInvestigationStepMs)),phase=state.manual||state.elapsed>=ovInvestigationDuration?1:(state.elapsed%ovInvestigationStepMs)/ovInvestigationStepMs;
  host.querySelector('.ov-investigation-caption').setAttribute('aria-live',state.intent?'off':'polite');
  state.step=step;host.dataset.investigationStep=String(step);host.dataset.investigationElapsed=String(Math.round(state.elapsed));
  for(const {path,dot,length,at,order} of state.routes){
   const progress=step>at?1:step===at?clamp((phase-.08-order*.18)/.65):0;
   path.setAttribute('stroke-dashoffset',String(1-progress));
   const point=path.getPointAtLength(length*progress);dot.setAttribute('cx',point.x.toFixed(2));dot.setAttribute('cy',point.y.toFixed(2));dot.setAttribute('opacity',step===at&&progress>0&&progress<1&&!state.manual?'1':'0');
  }
  host.querySelectorAll('[data-ov-investigation-stage]').forEach(node=>node.setAttribute('aria-pressed',String(Number(node.dataset.ovInvestigationStage)===step)));
  host.querySelectorAll('[data-investigation-caption]').forEach(node=>{const active=Number(node.dataset.investigationCaption)===step;if(node.classList.contains('is-active')!==active){node.classList.toggle('is-active',active);node.setAttribute('aria-hidden',String(!active));}});
  host.querySelector('[data-ov-investigation-position]').textContent=(step+1)+' / 4';
  host.querySelector('[data-ov-investigation-prev]').disabled=step===0;host.querySelector('[data-ov-investigation-next]').disabled=step===3;
  const progress=host.querySelector('.ov-investigation-progress'),percent=Math.round(state.elapsed/ovInvestigationDuration*100);progress.setAttribute('aria-valuenow',String(percent));progress.firstElementChild.style.width=percent+'%';
 };
 const canPlay=()=>state.intent&&!reduced()&&!isBlocked()&&state.visible;
 const tick=now=>{
  state.frame=0;if(!canPlay()){sync();return;}
  if(state.lastTime)state.elapsed=(state.elapsed+Math.min(100,now-state.lastTime))%ovInvestigationDuration;
  state.lastTime=now;paint();sync();
 };
 const sync=()=>{
  const playing=canPlay(),done=state.elapsed>=ovInvestigationDuration;
  if(playing&&!state.frame)state.frame=requestAnimationFrame(tick);
  if(!playing){cancelAnimationFrame(state.frame);state.frame=0;state.lastTime=0;}
  host.dataset.investigationPlayback=reduced()?'motion-paused':playing?'playing':state.intent?'waiting':'paused';
  const status=host.querySelector('[data-ov-investigation-status]'),label=prefersReduced()?'Reduced motion':reduced()?'Motion paused':playing?'Looping':state.intent?'Plays when in view':'Paused';
  if(status.textContent!==label)status.textContent=label;
  const button=host.querySelector('[data-ov-investigation-play]'),action=state.intent&&!done?'Pause':'Play';button.textContent=action;button.setAttribute('aria-label',action+' investigation story');button.disabled=reduced();host.querySelector('[data-ov-investigation-replay]').disabled=reduced();
 };
 const resize=()=>{
  const compact=innerWidth<=760;if(compact===state.compact)return;
  const focused=document.activeElement?.closest('[data-ov-investigation-stage]'),focusStage=focused&&visual.contains(focused)?focused.dataset.ovInvestigationStage:null;
  state.compact=compact;visual.innerHTML=ovInvestigationArt(compact);
  state.routes=[...visual.querySelectorAll('[data-story-route]')].map(path=>({path,dot:visual.querySelector('[data-story-signal="'+path.dataset.storyRoute+'"]'),length:path.getTotalLength(),at:Number(path.dataset.storyPhase),order:Number(path.dataset.storyOrder)}));
  paint();if(focusStage!==null)visual.querySelector('[data-ov-investigation-stage="'+focusStage+'"]').focus({preventScroll:true});
 };
 const select=step=>{state.elapsed=step===3?ovInvestigationDuration:step*ovInvestigationStepMs;state.intent=false;state.manual=true;paint();sync();};
 const restart=()=>{state.elapsed=reduced()?ovInvestigationDuration:0;state.intent=!reduced();state.manual=reduced();state.lastTime=0;paint();sync();};
 const motionChanged=()=>{if(prefersReduced()){state.elapsed=ovInvestigationDuration;state.intent=false;state.manual=true;paint();}sync();};
 host.addEventListener('click',event=>{
  const item=event.target.closest('[data-ov-investigation-stage],button');if(!item)return;
  if(item.hasAttribute('data-ov-investigation-stage'))select(Number(item.dataset.ovInvestigationStage));
  else if(item.hasAttribute('data-ov-investigation-prev'))select(Math.max(0,state.step-1));
  else if(item.hasAttribute('data-ov-investigation-next'))select(Math.min(3,state.step+1));
  else if(item.hasAttribute('data-ov-investigation-replay'))restart();
  else if(item.hasAttribute('data-ov-investigation-play')){if(state.elapsed>=ovInvestigationDuration)restart();else{state.intent=!state.intent;state.manual=false;state.lastTime=0;paint();sync();}}
 },{signal});
 host.addEventListener('keydown',event=>{const object=event.target.closest('[data-ov-investigation-stage]');if(object&&(event.key==='Enter'||event.key===' ')){event.preventDefault();select(Number(object.dataset.ovInvestigationStage));}},{signal});
 resize();restart();
 if('IntersectionObserver' in window){state.observer=new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.2;sync();},{threshold:[0,.2]});state.observer.observe(visual);}else{state.visible=true;sync();}
 return {sync,resize,motionChanged,dispose:()=>{cancelAnimationFrame(state.frame);state.observer?.disconnect();}};
}
