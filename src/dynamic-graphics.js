// Conceptual illustrations share the guide's editable wording. They never imply
// estate counts: selecting a node explains the evidence represented by the path.
const graphicFamilies={
  terrain:{
    nodes:[
      {id:'network',label:'example.network',icon:'network',x:260,y:43,topic:'scope'},
      {id:'endpoints',label:'graphic.endpoints',icon:'device',x:260,y:126,topic:'explore-end'},
      {id:'software',label:'graphic.software',icon:'layers',x:96,y:210,topic:'explore-soft'},
      {id:'vulnerabilities',label:'graphic.vulnerabilities',icon:'shield',x:424,y:210,topic:'explore-vuln'}
    ],
    edges:[['network','endpoints','M260 69V101'],['endpoints','software','M237 139C184 139 96 149 96 185'],['endpoints','vulnerabilities','M283 139C336 139 424 149 424 185']],
    initial:'network'
  },
  endpoint:{
    nodes:[
      {id:'endpoint',label:'graphic.endpoints',icon:'device',x:260,y:126,topic:'explore-end'},
      {id:'identity',label:'graphic.identity',icon:'table',x:96,y:43,topic:'cmdb'},
      {id:'discovery',label:'graphic.discovery',icon:'scan',x:424,y:43,topic:'govern-end'},
      {id:'cmdb',label:'gloss.cmdb.title',icon:'layers',x:260,y:210,topic:'cmdb',gloss:'cmdb'}
    ],
    edges:[['endpoint','identity','M236 114C185 114 96 105 96 69'],['endpoint','discovery','M284 114C335 114 424 105 424 69'],['endpoint','cmdb','M260 152V185']],
    initial:'endpoint'
  },
  software:{
    nodes:[
      {id:'product',label:'graphic.product',icon:'layers',x:87,y:123,topic:'govern-soft'},
      {id:'version',label:'graphic.version',icon:'table',x:260,y:43,topic:'govern-soft'},
      {id:'installation',label:'gloss.install.title',icon:'download',x:260,y:210,topic:'explore-soft',gloss:'install'},
      {id:'endpoint',label:'graphic.endpoints',icon:'device',x:433,y:123,topic:'explore-soft'}
    ],
    edges:[['product','version','M111 112C154 112 204 43 235 43'],['product','installation','M111 135C154 135 204 210 235 210'],['version','installation','M260 69V185'],['installation','endpoint','M285 210C333 210 374 135 409 135']],
    initial:'installation'
  },
  vulnerability:{
    nodes:[
      {id:'observation',label:'gloss.observation.title',icon:'shield',x:260,y:53,topic:'govern-vuln',gloss:'observation'},
      {id:'cve',label:'gloss.cve.title',icon:'scan',x:87,y:196,topic:'explore-vuln',gloss:'cve'},
      {id:'software',label:'graphic.software',icon:'layers',x:260,y:196,topic:'explore-soft'},
      {id:'endpoint',label:'graphic.endpoints',icon:'device',x:433,y:196,topic:'explore-vuln'}
    ],
    edges:[['observation','cve','M237 65C171 65 87 121 87 171'],['observation','software','M260 79V171'],['observation','endpoint','M283 65C349 65 433 121 433 171']],
    initial:'observation'
  }
};
let graphicSequence=0,graphicsBound=false;

function graphicNodeLabel(node){return msg(node.label);}
function graphicDefault(family,context){
  const selected={scope:'network',navigate:'network',topology:'network',tables:'endpoint',cmdb:'cmdb',shadow:'discovery','govern-end':'discovery','explore-end':'endpoint','govern-soft':'version','explore-soft':'installation',exports:'product','govern-vuln':'observation','explore-vuln':'cve'}[context];
  return family.nodes.some(node=>node.id===selected)?selected:family.initial;
}
function graphicDetail(node,context,initial,family){
  const topic=initial&&model.topics[context]?context:node.topic;
  const body=node.gloss&&!initial?msg('gloss.'+node.gloss+'.body'):msg('t.'+topic+(initial?'.short':'.interpret'));
  const connected=family.edges.filter(([from,to])=>from===node.id||to===node.id).map(([from,to])=>family.nodes.find(item=>item.id===(from===node.id?to:from)));
  const summary=`${graphicNodeLabel(node)} ${msg('graphic.connected')} ${connected.map(graphicNodeLabel).join(', ')}.`;
  return `<p class="dg-connection-summary">${safe(summary)}</p><div class="dg-detail-heading">${icon(node.icon,17)}<strong class="dg-detail-title">${tx('t.'+topic+'.title')}</strong></div><p class="dg-detail-copy">${safe(body)}</p>${link('topic/'+topic,tx('graphic.open')+icon('arrow',13),'dg-detail-link')}`;
}
function graphicLabelLines(label){
  const words=label.split(' '),lines=[''];
  for(const word of words){const last=lines.length-1;if(lines[last]&&(lines[last]+' '+word).length>20)lines.push(word);else lines[last]+=(lines[last]?' ':'')+word;}
  return lines;
}
function graphicNode(node,selected){
  const labels=graphicLabelLines(graphicNodeLabel(node));
  return `<g class="dg-node${node.id===selected?' is-selected':''}" data-graphic-node="${node.id}" data-graphic-select="${node.id}" transform="translate(${node.x} ${node.y})"><g class="dg-node-body"><circle class="dg-node-halo" r="33"/><rect class="dg-node-frame" x="-25" y="-25" width="50" height="50" rx="13"/><g class="dg-node-glyph" transform="translate(-12 -12)" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${glyph[node.icon]}</g><circle class="dg-node-light" cx="20" cy="-20" r="3.5"/></g><text class="dg-node-name" text-anchor="middle" y="${labels.length>1?39:43}">${labels.map((line,index)=>`<tspan x="0" dy="${index?'1.15em':0}">${safe(line)}</tspan>`).join('')}</text></g>`;
}
function graphicBackdrop(kind,id){
  const contours=kind==='terrain'?'<path d="M34 194 260 101 486 194 260 277Z"/><path d="M64 194 260 114 456 194 260 264Z"/><path d="M96 194 260 127 424 194 260 250Z"/><path d="M128 194 260 140 392 194 260 237Z"/>':kind==='endpoint'?'<circle cx="260" cy="126" r="96"/><circle cx="260" cy="126" r="116"/><path d="M121 126H399M260 0V252"/>':kind==='software'?'<path d="M41 126 260 23 479 126 260 229Z"/><path d="M72 126 260 38 448 126 260 214Z"/><path d="M103 126 260 53 417 126 260 199Z"/>':'<circle cx="260" cy="125" r="98"/><path d="M145 125H375M260 11V239"/><circle cx="260" cy="125" r="119" stroke-dasharray="3 8"/>';
  return `<defs><pattern id="${id}-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#527c8b" opacity=".38"/></pattern><radialGradient id="${id}-glow"><stop stop-color="#277776" stop-opacity=".22"/><stop offset="1" stop-color="#277776" stop-opacity="0"/></radialGradient></defs><rect width="520" height="280" fill="url(#${id}-grid)"/><ellipse cx="260" cy="140" rx="245" ry="132" fill="url(#${id}-glow)"/><g class="dg-contours" fill="none">${contours}</g>`;
}
function dynamicGraphic(kind,contextId=''){
  const family=graphicFamilies[kind]||graphicFamilies.terrain,selected=graphicDefault(family,contextId),node=family.nodes.find(item=>item.id===selected),id='guide-graphic-'+(++graphicSequence);
  const paths=family.edges.map(([from,to,d])=>`<path class="dg-edge${from===selected||to===selected?' is-connected':''}" data-graphic-edge="${from}:${to}" d="${d}"/>`).join('');
  const buttons=family.nodes.map(item=>`<button type="button" data-graphic-select="${item.id}" aria-pressed="${item.id===selected}" aria-controls="${id}-detail">${icon(item.icon,15)}<span>${tx(item.label)}</span></button>`).join('');
  return `<figure class="dynamic-graphic dg-${safe(kind)}" data-graphic-kind="${safe(kind)}" data-graphic-context="${safe(contextId)}" data-graphic-selected="${selected}" aria-labelledby="${id}-caption"><figcaption id="${id}-caption"><span class="dg-caption-label">${tx('graphic.label')}</span><span class="dg-concept">${tx('graphic.concept')}</span></figcaption><svg class="dg-map" viewBox="0 0 520 280" aria-hidden="true" focusable="false">${graphicBackdrop(kind,id)}<g class="dg-edges" fill="none">${paths}</g>${family.nodes.map(item=>graphicNode(item,selected)).join('')}</svg><p class="dg-hint">${tx('graphic.hint')}</p><div class="dg-controls" role="group" aria-label="${tx('graphic.label')}">${buttons}</div><div class="dg-detail" id="${id}-detail" aria-live="polite" aria-atomic="true">${graphicDetail(node,contextId,true,family)}</div></figure>`;
}
function selectGraphic(figure,selected){
  const family=graphicFamilies[figure.dataset.graphicKind]||graphicFamilies.terrain,node=family.nodes.find(item=>item.id===selected);
  if(!node)return;
  figure.dataset.graphicSelected=selected;
  for(const button of figure.querySelectorAll('.dg-controls button'))button.setAttribute('aria-pressed',String(button.dataset.graphicSelect===selected));
  for(const item of figure.querySelectorAll('[data-graphic-node]'))item.classList.toggle('is-selected',item.dataset.graphicNode===selected);
  for(const edge of figure.querySelectorAll('[data-graphic-edge]'))edge.classList.toggle('is-connected',edge.dataset.graphicEdge.split(':').includes(selected));
  figure.querySelector('.dg-detail').innerHTML=graphicDetail(node,figure.dataset.graphicContext,false,family);
}
function bindDynamicGraphics(root=document){
  // Delegation survives route and workbook rerenders; there are no per-page
  // observers or timers to leak when the reader moves around the guide.
  if(graphicsBound)return;
  graphicsBound=true;
  document.addEventListener('click',event=>{
    const control=event.target.closest('[data-graphic-select]'),figure=control?.closest('.dynamic-graphic');
    if(figure)selectGraphic(figure,control.dataset.graphicSelect);
  });
}
