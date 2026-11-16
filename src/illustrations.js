let exampleChoice=0;
function workedExample(id){
  const isGraph=id==='topology';
  if(!isGraph&&!model.examples.includes(id))return '';
  const k=isGraph?'example.':'ex.'+id+'.',idx=exampleChoice;
  const body=isGraph?graphExample(idx):`<div class="ex-metrics">${[0,1,2].map(i=>`<button data-example="${i}" aria-pressed="${idx===i}" aria-controls="example-note"><strong>${tx(k+'n'+i)}</strong><span>${tx(k+'a'+i)}</span></button>`).join('')}</div>`;
  return `<section class="example-panel" aria-label="${tx('example.label')}">${eyebrow(tx('example.label'))}<h2>${tx(k+(isGraph?'topTitle':'title'))}</h2><p>${tx(k+(isGraph?'topDesc':'desc'))}</p>${body}<div class="ex-note" id="example-note" aria-live="polite">${icon('info',16)}<span>${tx(isGraph?'example.'+(idx?'lower':'higher'):k+'b'+idx)}</span></div></section>`;
}
function graphExample(idx){
  const node=(key,ic,cls='')=>`<div class="graph-node ${cls}">${icon(ic,19)}<span>${tx('example.'+key)}</span></div>`;
  return `<div class="graph-switch" role="group" aria-label="${tx('example.topTitle')}">${['impact','dependencies'].map((v,i)=>`<button data-example="${i}" aria-pressed="${idx===i}" aria-controls="example-note">${tx('example.'+v)}</button>`).join('')}</div>
  <div class="teaching-graph"><div class="graph-row">${node('service','briefcase')}${node('network','network')}</div>
  <div class="branch-row"><span>${tx('example.depends')} ↓</span><span>${tx('example.hosts')} ↓</span></div>
  <div class="graph-row centre">${node('system','layers','root-node')}</div>
  ${idx?`<div class="branch-row lower"><span>${tx('example.contains')} ↓</span><span>${tx('example.contains')} ↓</span></div><div class="graph-row">${node('a','device')}${node('b','device')}</div>`:''}</div>`;
}

