// A self-contained, offline introduction to the connected cyber terrain.
let overviewRuntime = null;
let overviewMotionPaused = false;
const ovEscape = value => safe(value == null ? '' : String(value));
const ovSection = id => overviewContent.sections.find(section => section.id === id) || {id,title:id};
const ovText = value => typeof value === 'object' && value !== null ? (value.body || value.text || value.description || '') : value || '';
const ovParagraphs = value => (Array.isArray(value) ? value : value ? [value] : []).map(part => `<p>${ovEscape(ovText(part))}</p>`).join('');
const ovDetail = item => `<strong>${ovEscape(item.title || item.label || '')}</strong>${ovParagraphs(item.body || item.description || '')}`;
const ovOptions = items => (items || []).map(item => ({...item,label:item.label || item.title,title:item.title || item.label,body:item.body || item.description}));
function ovSvg(inner,label,viewBox='0 0 720 500') {return `<svg class="ov-diagram" viewBox="${viewBox}" role="img" aria-label="${ovEscape(label)}" focusable="false">${inner}</svg>`;}
// A small, consistent vocabulary: devices, installed software, systems and services.
const ovNetworkLinks=[['D1','D3'],['D3','D5'],['D1','D2'],['D3','D4'],['D5','D6'],['D4','D6']];
function ovNetworkPoints(y) {return ['D1','D2','D3','D4','D5','D6'].map((id,index)=>({id,x:170+Math.floor(index/2)*250,y:y+(index%2)*100,software:index%2===0}));}
function ovNetworkPaths(points) {
 return ovNetworkLinks.map(([a,b])=>{const from=points.find(point=>point.id===a),to=points.find(point=>point.id===b);return `<path class="ov-flow-line ov-terrain-communication" data-from="${a}" data-to="${b}" d="M${from.x} ${from.y}L${to.x} ${to.y}" fill="none" stroke="#8edcff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="5 12"/>`;}).join('');
}
function ovHeroArt() {
 const blue='#8edcff',green='#70e3a1',violet='#c7b7ff',pink='#efb8dc',red='#ff958b',amber='#ffe0a0';
 const cube=(x,y,tone)=>`<g transform="translate(${x} ${y})" stroke="${tone}" stroke-width="1.8" stroke-linejoin="round"><path d="M0-34 32-17V18L0 35-32 18V-17Z" fill="#183238"/><path d="M0-34 32-17 0 0-32-17Z" fill="#2a4852"/><path d="M0 0V35M0 0 32-17M0 0-32-17" fill="none"/></g>`;
 const route=(path,tone=blue)=>`<g class="ov-concept-route" fill="none"><path d="${path}" stroke="#507986" stroke-width="1.4" stroke-opacity=".7"/><path class="ov-flow-line" d="${path}" stroke="${tone}" stroke-width="2" stroke-dasharray="4 12"/></g>`;
 return ovSvg(`<defs><radialGradient id="ov-concept-glow"><stop stop-color="#56c4b7" stop-opacity=".16"/><stop offset="1" stop-color="#56c4b7" stop-opacity="0"/></radialGradient></defs>
 <ellipse cx="380" cy="285" rx="315" ry="252" fill="url(#ov-concept-glow)"/>
 <g fill="none" stroke="#507986" stroke-width="1.4" stroke-opacity=".7"><path d="M225 95Q270 60 318 88M390 94Q490 53 583 106M618 159Q688 190 631 269M623 322Q673 377 610 431M575 472Q488 518 385 466M319 466Q194 517 140 435M123 384Q63 287 139 198"/></g>
 ${route('M173 329Q263 319 318 295')}${route('M443 290H591',pink)}${route('M428 317Q494 355 579 432',green)}${route('M165 146Q209 190 326 253',amber)}
 ${route('M430 256Q504 184 582 138',violet)}${route('M392 232Q426 185 399 133')}${route('M355 346V435')}
 <g class="ov-concept-node"><title>Example vulnerability identifiers provide context for software findings.</title><text x="142" y="58" text-anchor="middle" fill="${red}" font-size="20">CVE findings</text><rect x="52" y="74" width="180" height="61" rx="10" fill="#2b242c" stroke="${red}" stroke-width="1.3"/><text x="142" y="100" text-anchor="middle" fill="#ffcbc4" font-size="16" font-family="Consolas,monospace">CVE-2021-44228</text><text x="142" y="122" text-anchor="middle" fill="#c29b9c" font-size="14" font-family="Consolas,monospace">CVE-2022-3602</text></g>
 <g class="ov-concept-node"><title>Installed software adds context to a device.</title><rect x="318" y="60" width="79" height="61" rx="12" fill="#16384b" stroke="${blue}" stroke-width="1.8"/><path d="M330 72h55" stroke="${blue}" stroke-opacity=".5"/><text x="357" y="103" fill="${blue}" text-anchor="middle" font-size="26" font-family="Consolas,monospace">&lt;/&gt;</text><text x="357" y="153" fill="#bdeaff" text-anchor="middle" font-size="21">Software</text></g>
 <g class="ov-concept-node"><title>Mission services connect the terrain to its operational purpose.</title>${cube(609,125,violet)}<path d="M599 108h20m-10-10v20" stroke="${violet}" stroke-width="2"/><text x="609" y="189" text-anchor="middle" fill="#d3c6f8" font-size="22">Mission services</text></g>
 <g class="ov-concept-node"><title>Business services depend on the systems and assets in the cyber terrain.</title><rect x="592" y="255" width="65" height="58" rx="10" fill="#352d40" stroke="${pink}" stroke-width="1.8"/><path d="M608 273v-7h33v7M602 275h45v27h-45ZM602 284h45M620 281v8h9v-8" stroke="${pink}" stroke-width="1.7" fill="none"/><text x="622" y="346" text-anchor="middle" fill="${pink}" font-size="22">Business services</text></g>
 <g class="ov-concept-node"><title>ICT systems put components and relationships in context.</title>${cube(605,446,green)}<text x="605" y="511" text-anchor="middle" fill="#a6e8c1" font-size="22">ICT systems</text></g>
 <g class="ov-concept-node"><title>Networks connect communicating devices.</title><circle cx="355" cy="464" r="31" fill="#11313f" stroke="${blue}" stroke-width="1.5"/><g fill="none" stroke="${blue}" stroke-width="1.5"><path d="M355 447 339 475H371ZM355 447V469M339 475 355 469 371 475"/></g><g fill="${blue}"><circle cx="355" cy="447" r="4"/><circle cx="339" cy="475" r="4"/><circle cx="371" cy="475" r="4"/><circle cx="355" cy="469" r="3"/></g><text x="355" y="523" text-anchor="middle" fill="#bdeaff" font-size="22">Networks</text></g>
 <g class="ov-concept-node"><title>Devices, with and without installed software.</title>${ovTerrainDevice(127,298,'D1',true,1.05,false)}${ovTerrainDevice(176,340,'D2',false,.62,false)}<text x="138" y="378" text-anchor="middle" fill="#f6ba85" font-size="22">Devices</text></g>
 <g class="ov-concept-node"><title>Unknown observations are leads for investigation.</title><circle cx="131" cy="454" r="22" fill="#282d2d" stroke="${amber}" stroke-width="1.4" stroke-dasharray="3 4"/><text x="131" y="462" text-anchor="middle" fill="${amber}" font-size="26">?</text><text x="131" y="500" text-anchor="middle" fill="#c9bb9c" font-size="18">Unknowns</text></g>
 <g class="ov-concept-core"><circle cx="380" cy="285" r="64" fill="#102f37" stroke="#74cbbd" stroke-width="1.6"/><circle cx="380" cy="285" r="57" fill="none" stroke="#74cbbd" stroke-opacity=".16"/><text x="380" y="284" text-anchor="middle" fill="#d4f2e9" font-size="29" font-weight="600" letter-spacing="1">TSAAT</text><text x="380" y="306" text-anchor="middle" fill="#a5d1c9" font-size="14">Context aware</text></g>`, 'A context aware view of the cyber terrain: devices, installed software, example CVE findings, networks, ICT systems, mission services, business services and unknown observations. Illustrative observations, not live data.', '0 0 760 560');
}

function ovEvidenceArt(index=0) {
 const title=['GOVERNANCE / SEE THE PATTERN','DISCOVERY / FOLLOW THE RECORD','SCOPE + SNAPSHOT / SET THE CONTEXT'][index];
 let art,description;
 if(index===0){
  art=`<g transform="translate(0 -290)">${ovTerrainSystem(125,'A',['D1','D2'],true)}${ovTerrainSystem(360,'B',['D3','D4'],true)}${ovTerrainSystem(595,'C',['D5','D6'],true)}</g><g fill="#c7d8de" font-size="21" text-anchor="middle"><text x="125" y="295">2 devices</text><text x="360" y="295">2 devices</text><text x="595" y="295">2 devices</text></g><text x="360" y="337" text-anchor="middle" fill="#9db4bf" font-size="19">Illustrative inventory grouped by ICT system</text>`;
  description='Governance example: a summary groups six devices into three ICT systems, with two devices in each system.';
 }else if(index===1){
  art=`<rect x="32" y="89" width="170" height="191" rx="14" fill="#302b24" stroke="#f6aa63"/>${ovTerrainDevice(115,198,'D3',true,1.2)}<g fill="none" stroke="#b1cbd4" stroke-width="2" marker-end="url(#ov-evidence-arrow)"><path d="M210 190H270"/><path d="M450 190H508"/></g><g transform="translate(0 -240)">${ovTerrainSystem(360,'B',['D3','D4'],true)}</g><g transform="translate(0 63)">${ovTerrainService(610,'mission-a','Mission service','A')}</g><text x="360" y="337" text-anchor="middle" fill="#9db4bf" font-size="19">A device record leads to system and service context</text>`;
  description='Discovery example: inspect device D3 and its software, then follow its membership in System B and the relationship to Mission service A. Mission service A is also supported by System C, outside this selected path.';
 }else{
  art=`<rect x="30" y="75" width="240" height="245" rx="14" fill="#153229" stroke="#70e3a1"/><text x="150" y="110" fill="#b2f8ca" text-anchor="middle" font-size="21">Selected: System C</text><g transform="translate(-20 -240)">${ovTerrainSystem(170,'C',['D5','D6'],true)}</g><path d="M280 197H330" fill="none" stroke="#b1cbd4" stroke-width="2" marker-end="url(#ov-evidence-arrow)"/><rect x="345" y="95" width="340" height="205" rx="14" fill="#132e3e" stroke="#7eacbf"/><text x="372" y="134" fill="#a5e3ff" font-size="22">Loaded snapshot</text><path d="M370 153H660" stroke="#375567"/><text x="372" y="191" fill="#e0ebef" font-size="23">D5 + D6</text><text x="372" y="229" fill="#abc4ce" font-size="21">Records at a saved point</text><text x="372" y="258" fill="#abc4ce" font-size="21">in time</text><text x="360" y="348" text-anchor="middle" fill="#9db4bf" font-size="19">Keep the same scope and snapshot as you investigate</text>`;
  description='Scope and snapshot example: System C selects devices D5 and D6. The loaded snapshot determines the saved point in time represented by the records.';
 }
 return ovSvg(`<defs><marker id="ov-evidence-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" fill="#b1cbd4"/></marker></defs><text x="30" y="35" fill="#b1cbd4" font-family="Consolas,monospace" font-size="19">${title}</text>${art}`,description,'0 0 720 370');
}
function ovTerrainDevice(x,y,id,software=false,scale=1,label=true,extra='') {
 const orange='#f6aa63',blue='#8edcff';
 return `<g class="ov-terrain-device ${extra}" data-device="${id}" data-software="${software}" transform="translate(${x} ${y}) scale(${scale})"><title>Device ${id}; System ${id==='D1'||id==='D2'?'A':id==='D3'||id==='D4'?'B':'C'}${software?'; installed software shown':'; no software shown'}</title><g stroke="${orange}" stroke-width="1.8" stroke-linejoin="round"><path d="M0-56 28-42V-14L0 0-28-14V-42Z" fill="#30291f"/><path d="M0-56 28-42 0-28-28-42Z" fill="#704523"/><path d="M0-28V0M0-28 28-42M0-28-28-42" fill="none"/><path d="M-20-31-8-25M-20-24-8-18" opacity=".7"/><circle cx="19" cy="-22" r="2" fill="${orange}" stroke="none"/></g>${software?`<g class="ov-terrain-software"><path d="M19-31 29-49" fill="none" stroke="${blue}" stroke-width="2"/><rect x="12" y="-67" width="39" height="31" rx="5" fill="#153b50" stroke="${blue}" stroke-width="2"/><path d="M18-59h27" stroke="${blue}" stroke-width="1.5"/><text x="31.5" y="-43" fill="#d4f3ff" text-anchor="middle" font-size="14" font-family="Consolas,monospace">SW</text></g>`:''}${label?`<text x="0" y="29" fill="#e5bb91" font-size="23" font-family="Consolas,monospace" text-anchor="middle">${id}</text>`:''}</g>`;
}
function ovTerrainSystem(x,name,ids,showSoftware=false) {
 const green='#70e3a1';
 return `<g class="ov-terrain-system" data-system-id="${name}"><g stroke="${green}" stroke-width="2" stroke-linejoin="round"><path d="M${x} 360l70 35v63l-70 35-70-35v-63Z" fill="#123b2e"/><path d="M${x} 360l70 35-70 35-70-35Z" fill="#246544"/><path d="M${x} 430v63m0-63 70-35m-70 35-70-35" fill="none"/><path d="M${x-54} 428l38 19m-38-7 38 19" opacity=".3"/></g>${ovTerrainDevice(x-25,402,ids[0],showSoftware,.46,false,'ov-terrain-component')}${ovTerrainDevice(x+23,425,ids[1],false,.46,false,'ov-terrain-component')}<text x="${x}" y="520" text-anchor="middle" fill="${green}" font-size="26" font-weight="600">System ${name}</text><text x="${x}" y="548" text-anchor="middle" fill="#dfb78d" font-size="21" font-family="Consolas,monospace">${ids.join(' + ')}</text></g>`;
}
function ovTerrainService(x,id,label,second='') {
 const violet='#c7b7ff';
 return `<g class="ov-terrain-service" data-service-id="${id}"><rect x="${x-94}" y="96" width="188" height="66" rx="14" fill="#282d48" stroke="${violet}" stroke-width="2"/><text x="${x}" y="${second?123:137}" fill="#e4dcff" font-size="${second?22:24}" text-anchor="middle" font-weight="500">${label}${second?`<tspan x="${x}" dy="27" font-size="25">${second}</tspan>`:''}</text></g>`;
}
function ovTerrainArt() {
 const tones={asset:'#f6aa63',network:'#8edcff',system:'#70e3a1',mission:'#c7b7ff',business:'#efb8dc'};
 const clusters=[
  {system:'A',network:'Operations network',x:210,ids:['D1','D2','D7','D8','D9','D10']},
  {system:'B',network:'Enterprise network',x:600,ids:['D3','D4','D11','D12','D13','D14']},
  {system:'C',network:'Support network',x:990,ids:['D5','D6','D15','D16','D17','D18']}
 ];
 const services=[
  {id:'mission-a',label:'Mission service A',x:150,kind:'mission',layer:4,systems:['B','C']},
  {id:'mission-b',label:'Mission service B',x:450,kind:'mission',layer:4,systems:['C']},
  {id:'business-a',label:'Business service A',x:750,kind:'business',layer:5,systems:['A']},
  {id:'business-b',label:'Business service B',x:1050,kind:'business',layer:5,systems:['A','B']}
 ];
 const systemLayers=system=>['3',...new Set(services.filter(service=>service.systems.includes(system)).map(service=>String(service.layer)))].join(' ');
 const nodes=clusters.flatMap(cluster=>cluster.ids.map((id,index)=>({id,system:cluster.system,x:cluster.x+(index%3-1)*112,y:index<3?380:508,server:index===0||index===2,type:['Server','Workstation','Server','Switch','Storage','Printer'][index]})));
 const part=(layers,body,extra='')=>`<g class="ov-topology-part ${extra}" data-layer-part="${layers}">${body}</g>`;
 const dependency=services.flatMap(service=>service.systems.map(system=>{const target=clusters.find(cluster=>cluster.system===system),curve=service.kind==='mission'?104:120;return part(`3 ${service.layer}`,`<path class="ov-topology-dependency" data-from="${service.id}" data-to="${system}" d="M${service.x} 76C${service.x} ${curve} ${target.x} ${curve} ${target.x} 147" fill="none" stroke="${tones[service.kind]}" stroke-width="2" marker-end="url(#ov-topology-arrow-${service.kind})"/>`);})).join('');
 const membership=clusters.map(cluster=>{
  const members=nodes.filter(node=>node.system===cluster.system),railX=cluster.x-168,rows=[...new Set(members.map(node=>node.y))];
  const trunk=`<path d="M${cluster.x} 197V211H${railX}V${Math.max(...rows)-61}" fill="none" stroke="${tones.system}" stroke-width="1.7"/>`;
  const branches=rows.map(y=>{
   const row=members.filter(node=>node.y===y),railY=y-61;
   return `<path d="M${railX} ${railY}H${Math.max(...row.map(node=>node.x))-20}" fill="none" stroke="${tones.system}" stroke-width="1.5" stroke-opacity=".7"/>${row.map(node=>`<path d="M${node.x-20} ${railY}V${node.y-21}" fill="none" stroke="${tones.system}" stroke-width="1.5" stroke-opacity=".7"/>`).join('')}`;
  }).join('');
  return part(systemLayers(cluster.system),trunk+branches,'ov-topology-membership');
 }).join('');
 const networkLinks=clusters.map(cluster=>part('2',`<path class="ov-flow-line" d="M${cluster.x} 300V315H${cluster.x+112}V479M${cluster.x-112} 315H${cluster.x}M${cluster.x-112} 315V479M${cluster.x} 315V479" fill="none" stroke="${tones.network}" stroke-width="2" stroke-dasharray="5 12"/>${nodes.filter(node=>node.system===cluster.system).map(node=>`<path class="ov-flow-line" d="M${node.x} ${node.y-29}V${node.y<400?315:450}" fill="none" stroke="${tones.network}" stroke-width="2" stroke-dasharray="5 12"/>`).join('')}`)).join('');
 const crossLinks=part('2',`<path class="ov-flow-line" d="M230 280H580M620 280H970" fill="none" stroke="${tones.network}" stroke-width="2.5" stroke-dasharray="6 12"/>`);
 const glyph=type=>type==='Server'?'<rect x="-15" y="-18" width="30" height="35" rx="4"/><path d="M-15-6h30M-15 6h30M-8-12h9M-8 0h9M-8 12h9"/><circle cx="8" cy="-12" r="1" fill="currentColor"/><circle cx="8" cy="0" r="1" fill="currentColor"/>':type==='Workstation'?'<rect x="-19" y="-14" width="38" height="26" rx="3"/><path d="M0 12v6m-10 0h20"/>':type==='Switch'?'<rect x="-20" y="-11" width="40" height="23" rx="4"/><path d="M-13-3h6m4 0h6m4 0h6M-13 5h6m4 0h6m4 0h6"/>':type==='Storage'?'<ellipse cy="-11" rx="18" ry="6"/><path d="M-18-11v24c0 8 36 8 36 0v-24M-18 1c0 8 36 8 36 0"/>':'<path d="M-12-9v-9h24v9M-12 11h-7V-8h38v19h-7M-12 5h24v14h-24Z"/><path d="M10-1h3"/>';
 const deviceNodes=nodes.map(node=>part(`1 2 ${systemLayers(node.system)}`,`<g class="ov-topology-ci ov-terrain-device" data-device="${node.id}" data-software="${node.server}" data-system-id="${node.system}" transform="translate(${node.x} ${node.y})"><title>${node.id}: ${node.type}; ICT System ${node.system}${node.server?'; installed software shown':''}</title><circle class="ov-topology-node-face" r="29" fill="#302b27" stroke="${tones.asset}" stroke-width="1.8"/><g fill="none" color="${tones.asset}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph(node.type)}</g>${node.server?`<g class="ov-topology-software"><path d="M18-20 31-35" fill="none" stroke="${tones.network}" stroke-width="2"/><rect x="19" y="-51" width="38" height="29" rx="5" fill="#173e51" stroke="${tones.network}" stroke-width="1.8"/><path d="M25-44h26" stroke="${tones.network}"/><text x="38" y="-29" text-anchor="middle" fill="#d6f3ff" font-size="14" font-family="Consolas,monospace">SW</text></g>`:''}<text x="0" y="49" fill="#f6cfaa" text-anchor="middle" font-size="20" font-weight="600">${node.id}</text></g>`)).join('');
 const systemNodes=clusters.map(cluster=>part(systemLayers(cluster.system),`<g class="ov-topology-system" data-system-id="${cluster.system}"><rect class="ov-topology-node-face" x="${cluster.x-92}" y="147" width="184" height="50" rx="10" fill="#163b30" stroke="${tones.system}" stroke-width="1.8"/><text x="${cluster.x}" y="179" text-anchor="middle" fill="#b5f0cc" font-size="23" font-weight="600">ICT System ${cluster.system}</text></g>`)).join('');
 const networkNodes=clusters.map(cluster=>part('2',`<g class="ov-topology-network" data-network="${cluster.system}"><circle class="ov-topology-node-face" cx="${cluster.x}" cy="280" r="20" fill="#153746" stroke="${tones.network}" stroke-width="1.8"/><path d="M${cluster.x-11} 287L${cluster.x} 269L${cluster.x+11} 287ZM${cluster.x} 269V287" fill="none" stroke="${tones.network}" stroke-width="1.8"/><text x="${cluster.x}" y="246" fill="#a9e4fc" text-anchor="middle" font-size="21" font-weight="550">${cluster.network}</text></g>`)).join('');
 const serviceNodes=services.map(service=>part(`3 ${service.layer}`,`<g class="ov-topology-service" data-service-id="${service.id}"><rect class="ov-topology-node-face" x="${service.x-105}" y="18" width="210" height="58" rx="10" fill="${service.kind==='business'?'#332b3e':'#282d48'}" stroke="${tones[service.kind]}" stroke-width="1.8"/><text x="${service.x}" y="54" fill="${tones[service.kind]}" font-size="20" text-anchor="middle" font-weight="550">${service.label}</text></g>`)).join('');
 const svg=ovSvg(`<defs>${['mission','business'].map(kind=>`<marker id="ov-topology-arrow-${kind}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z" fill="${tones[kind]}"/></marker>`).join('')}</defs><rect width="1200" height="580" rx="12" fill="#102633"/>
 ${clusters.map(cluster=>`<rect class="ov-topology-network-zone" x="${cluster.x-177}" y="220" width="354" height="344" rx="16" fill="#102d3b" fill-opacity=".8" stroke="#315363" stroke-dasharray="5 7"/>`).join('')}
 ${dependency}${membership}${networkLinks}${crossLinks}${serviceNodes}${systemNodes}${networkNodes}${deviceNodes}`, 'Illustrative topology with 18 device configuration items, three networks, three ICT systems and four services: two mission services and two business services. Operations network contains D1, D2 and D7 to D10 in System A. Enterprise network contains D3, D4 and D11 to D14 in System B. Support network contains D5, D6 and D15 to D18 in System C. Six servers carry blue SW software badges. Business service A depends on System A; Business service B depends on A and B. Mission service A depends on B and C; Mission service B depends on C. Animated blue dashed links show communication. Solid coloured lines show recorded membership or service dependencies. Select a layer to highlight its components or show all.', '0 0 1200 580');
 return `<div class="ov-topology-scroll" role="group" aria-label="Complete example cyber terrain topology. Expand for more detail.">${svg}</div><div class="ov-topology-legend" aria-label="Topology legend"><span><i style="--key:${tones.asset}"></i>Device CI</span><span><i style="--key:${tones.network}"></i>Software / network</span><span><i style="--key:${tones.system}"></i>ICT system</span><span><i style="--key:${tones.mission}"></i>Mission service</span><span><i style="--key:${tones.business}"></i>Business service</span></div><p class="ov-topology-note">Dashed lines: communication. Solid lines: membership and dependencies. 18 example CIs across three networks.</p>`;
}
const ovRiskExamples={
 D1:{system:'A',peer:'D2',services:['ict'],serviceText:'the ICT service'},
 D3:{system:'B',peer:'D4',services:['mission-a'],serviceText:'Mission service A'},
 D5:{system:'C',peer:'D6',services:['mission-a','mission-b'],serviceText:'Mission services A and B'}
};
function ovRiskTrace(id='D3') {
 const item=ovRiskExamples[id];
 return `<strong>${id} &#8594; shared network &#8594; System ${item.system}</strong><p>The finding is on ${id}. Its recorded system membership connects it to ${item.serviceText}. These relationships give the finding service and mission context.</p>`;
}
function ovVulnerabilityArt(id='D3') {
 const example=ovRiskExamples[id],orange='#f6aa63',green='#70e3a1',blue='#8edcff',violet='#c7b7ff',red='#ff958b';
 const points=ovNetworkPoints(470);
 const selected=points.find(point=>point.id===id),systemX={A:170,B:420,C:670}[example.system];
 const badge=(x,y)=>`<g class="ov-risk-finding-badge" transform="translate(${x} ${y})"><circle r="13" fill="#572d2e" stroke="${red}" stroke-width="2"/><text y="7" text-anchor="middle" fill="#ffe4dc" font-size="22" font-weight="600">!</text></g>`;
 const networks=ovNetworkPaths(points);
 const systems=[['A',['D1','D2']],['B',['D3','D4']],['C',['D5','D6']]].map(([name,ids],index)=>`<g class="ov-risk-system" data-related="${name===example.system}"><g transform="translate(0 300)">${ovTerrainSystem(170+index*250,name,ids,true)}${name===example.system?badge(170+index*250-43,371):''}</g></g>`).join('');
 const services=[['ict','ICT service',''],['mission-a','Mission service','A'],['mission-b','Mission service','B']].map(([key,label,second],index)=>`<g class="ov-risk-service" data-related="${example.services.includes(key)}" transform="translate(0 840)">${ovTerrainService(170+index*250,key,label,second)}</g>`).join('');
 const dependencies=[{system:'A',service:'ict',path:'M240 758H275V970H269'},{system:'B',service:'mission-a',path:'M490 758H525V970H519'},{system:'C',service:'mission-a',path:'M740 758H775V880H542V989H519'},{system:'C',service:'mission-b',path:'M775 880V970H769'}].map(link=>`<path class="ov-risk-dependency" data-system-id="${link.system}" data-service-id="${link.service}" data-related="${link.system===example.system}" d="${link.path}" stroke="${violet}" stroke-width="2.8" stroke-linejoin="round" fill="none" marker-end="url(#ov-risk-service-arrow)"/>`).join('');
 return ovSvg(`<defs><marker id="ov-risk-trace-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" fill="${red}"/></marker><marker id="ov-risk-service-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" fill="${violet}"/></marker><filter id="ov-risk-yellow-glow" filterUnits="userSpaceOnUse" x="140" y="550" width="310" height="40"><feGaussianBlur stdDeviation="4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
 <g class="ov-risk-step" data-risk-step="0"><text x="45" y="35" fill="${red}" font-family="Consolas,monospace" font-size="24">01 / FINDING</text><rect x="45" y="60" width="300" height="150" rx="15" fill="#30252b" stroke="${red}" stroke-width="1.8"/>${badge(80,100)}<text x="108" y="108" fill="#ffd3cc" font-size="25" font-weight="600">Finding F-01</text><text x="68" y="151" fill="#e4c9c9" font-size="24">Reported weakness</text><text x="68" y="181" fill="#beaaaa" font-size="22">on installed software</text></g>
 <path class="ov-risk-trace" d="M350 135H470" stroke="${red}" stroke-width="2.8" fill="none" marker-end="url(#ov-risk-trace-arrow)"/><text x="410" y="112" text-anchor="middle" fill="#eac5bd" font-size="21">found on</text>
 <g class="ov-risk-step" data-risk-step="1"><text x="480" y="35" fill="${orange}" font-family="Consolas,monospace" font-size="24">02 / ASSET</text><rect x="480" y="60" width="315" height="150" rx="15" fill="#302b24" stroke="${orange}" stroke-width="1.8"/>${ovTerrainDevice(550,165,id,true,1.12,false,'ov-risk-asset-device')}${badge(523,135)}<text x="622" y="112" fill="#ffd6ae" font-size="27" font-weight="600">Device ${id}</text><text x="622" y="147" fill="#a5e3ff" font-size="23">Software</text><text x="622" y="177" fill="#abc6d0" font-size="22">installed</text></g>
 <path class="ov-risk-trace" d="M638 216V245H420V291" stroke="${red}" stroke-width="2.8" stroke-linejoin="round" fill="none" marker-end="url(#ov-risk-trace-arrow)"/><text x="446" y="279" fill="#c4b7b6" font-size="21">trace relationships</text>
 <g class="ov-risk-step" data-risk-step="2"><rect x="25" y="308" width="790" height="752" rx="20" fill="#112733" fill-opacity=".6" stroke="#3c5b69" stroke-width="1.5"/><text x="45" y="350" fill="#d5e4e9" font-family="Consolas,monospace" font-size="24">03 / CONTEXT</text><text x="45" y="391" fill="${blue}" font-family="Consolas,monospace" font-size="22">SHARED NETWORK</text>
 <rect x="45" y="410" width="750" height="205" rx="16" fill="#102b39" stroke="#365c70" stroke-width="1.5"/>
 <g class="ov-risk-network">${networks}<path class="ov-flow-line ov-terrain-yellow-link" data-link="D2-D4" d="M170 570H420" fill="none" stroke="#ffe36e" stroke-width="3.6" stroke-linejoin="round" stroke-dasharray="7 10" filter="url(#ov-risk-yellow-glow)"/>${points.map(point=>`<g data-related="${point.id===id}" class="ov-risk-network-node">${ovTerrainDevice(point.x,point.y,point.id,['D1','D3','D5'].includes(point.id),.9,true,'ov-terrain-network-device')}${point.id===id?badge(point.x-29,point.y-43):''}</g>`).join('')}</g>
 <path class="ov-risk-membership" data-device="${id}" data-system-id="${example.system}" d="M${selected.x+32} ${selected.y-15}H${systemX+55}V633H${systemX+50}V680" stroke="${orange}" stroke-width="3" stroke-linejoin="round" fill="none" marker-end="url(#ov-risk-trace-arrow)"/><text x="${systemX+36}" y="622" text-anchor="end" fill="#d9bc9e" font-size="20">member of</text>
 <text x="45" y="651" fill="${green}" font-family="Consolas,monospace" font-size="22">ICT SYSTEMS</text>${systems}
 <g class="ov-risk-dependencies">${dependencies}</g><text x="45" y="899" fill="#beaeea" font-size="20">supports</text><text x="45" y="925" fill="${violet}" font-family="Consolas,monospace" font-size="22">SERVICES</text>${services}</g>
 <g font-size="21" fill="#adc4cd"><circle cx="54" cy="1095" r="8" fill="${red}"/><text x="73" y="1102">Finding on device</text><path d="M345 1095h30" stroke="${violet}" stroke-width="2.8"/><text x="389" y="1102">Recorded relationship</text></g>`, `Illustrative finding F-01 is on software installed on device ${id}. The same orange device appears in the shared network, where blue dotted paths show communication and the yellow link connects D2 and D4. ${id} belongs to green System ${example.system}, with ${example.peer}. System ${example.system} supports ${example.serviceText}. The other system and service relationships remain visible for context. The finding is marked only on the device; these links do not establish a service impact.`, '0 0 840 1120');
}
const ovServiceScenarios=[
 {devices:['D1'],systems:['A'],services:['ict'],issue:'device',label:'Device D1 needs attention'},
 {devices:['D5'],systems:['C'],services:['mission-a','mission-b'],issue:'device',label:'Device D5 needs attention'},
 {devices:['D2','D4'],systems:['A','B'],services:['ict','mission-a'],issue:'network',label:'The D2-to-D4 network link is unavailable'}
];
const ovServiceRecords=[
 {id:'ict',label:'ICT service',systems:'System A'},
 {id:'mission-a',label:'Mission service A',systems:'Systems B and C'},
 {id:'mission-b',label:'Mission service B',systems:'System C'}
];
function ovServiceSummary(index=0) {return 'Review '+ovServiceRecords.filter(service=>ovServiceScenarios[index].services.includes(service.id)).map(service=>service.label).join(' + ');}
function ovServiceReading(index=0) {
 const scenario=ovServiceScenarios[index],option=ovSection('services').options[index];
 return `${ovDetail(option)}<div class="ov-impact-review"><h4>Services to review</h4><ul>${ovServiceRecords.filter(service=>scenario.services.includes(service.id)).map(service=>`<li data-review-service="${service.id}"><span aria-hidden="true"></span><div><strong>${service.label}</strong><small>Supported by ${service.systems}</small></div></li>`).join('')}</ul></div><p class="ov-impact-validation">Confirm the dependency, alternative paths and current service state with the service owner.</p>`;
}
function ovServiceImpactArt(index=0) {
 const scenario=ovServiceScenarios[index],orange='#f6aa63',green='#70e3a1',blue='#8edcff',violet='#c7b7ff',red='#ff958b',yellow='#ffe36e';
 const points=ovNetworkPoints(140);
 const badge=(x,y,tone=red)=>`<g class="ov-impact-issue" transform="translate(${x} ${y})"><circle r="14" fill="#3d2b29" stroke="${tone}" stroke-width="2"/><text y="7" text-anchor="middle" fill="${tone}" font-size="22" font-weight="600">!</text></g>`;
 const network=ovNetworkPaths(points);
 const link=scenario.issue==='network'?`<path class="ov-impact-unavailable" data-link="D2-D4" d="M170 240H275M315 240H420" fill="none" stroke="${yellow}" stroke-width="3.6" stroke-linejoin="round" filter="url(#ov-impact-yellow-glow)"/>${badge(295,240,yellow)}`:`<path class="ov-flow-line ov-terrain-yellow-link" data-link="D2-D4" d="M170 240H420" fill="none" stroke="${yellow}" stroke-width="3.6" stroke-linejoin="round" stroke-dasharray="7 10" filter="url(#ov-impact-yellow-glow)"/>`;
 const nodes=points.map(point=>`<g class="ov-impact-node" data-related="${scenario.devices.includes(point.id)}">${scenario.issue==='network'&&scenario.devices.includes(point.id)?`<ellipse cx="${point.x}" cy="${point.y-20}" rx="34" ry="39" fill="none" stroke="${yellow}" stroke-width="1.8"/>`:''}${ovTerrainDevice(point.x,point.y,point.id,['D1','D3','D5'].includes(point.id),.9,true,'ov-terrain-network-device')}${scenario.issue==='device'&&scenario.devices.includes(point.id)?badge(point.x-29,point.y-43):''}</g>`).join('');
 const membership=scenario.devices.map(id=>{const point=points.find(point=>point.id===id),system=id==='D1'||id==='D2'?'A':id==='D3'||id==='D4'?'B':'C',x={A:170,B:420,C:670}[system];return `<path class="ov-impact-membership" data-device="${id}" data-system-id="${system}" d="M${point.x+32} ${point.y-15}H${x+55}V340H${x+50}V420" fill="none" stroke="${orange}" stroke-width="2.8" stroke-linejoin="round" marker-end="url(#ov-impact-member-arrow)"/><text x="${x+36}" y="362" text-anchor="end" fill="#d9bc9e" font-size="20">member of</text>`;}).join('');
 const systems=[['A',['D1','D2']],['B',['D3','D4']],['C',['D5','D6']]].map(([name,ids],i)=>`<g class="ov-impact-system" data-related="${scenario.systems.includes(name)}" transform="translate(0 40)">${ovTerrainSystem(170+i*250,name,ids,true)}${scenario.issue==='device'&&scenario.systems.includes(name)?badge(170+i*250-43,371):''}</g>`).join('');
 const dependencies=[{system:'A',service:'ict',path:'M240 498H275V710H269'},{system:'B',service:'mission-a',path:'M490 498H525V710H519'},{system:'C',service:'mission-a',path:'M740 498H775V620H542V729H519'},{system:'C',service:'mission-b',path:'M775 620V710H769'}].map(link=>`<path class="ov-impact-dependency" data-system-id="${link.system}" data-service-id="${link.service}" data-related="${scenario.systems.includes(link.system)}" d="${link.path}" stroke="${violet}" stroke-width="2.8" stroke-linejoin="round" fill="none" marker-end="url(#ov-impact-service-arrow)"/>`).join('');
 const services=[['ict','ICT service',''],['mission-a','Mission service','A'],['mission-b','Mission service','B']].map(([key,label,second],i)=>`<g class="ov-impact-service" data-related="${scenario.services.includes(key)}" transform="translate(0 580)">${ovTerrainService(170+i*250,key,label,second)}</g>`).join('');
 return ovSvg(`<defs><marker id="ov-impact-member-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" fill="${orange}"/></marker><marker id="ov-impact-service-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" fill="${violet}"/></marker><filter id="ov-impact-yellow-glow" filterUnits="userSpaceOnUse" x="140" y="220" width="310" height="40"><feGaussianBlur stdDeviation="4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
 <text x="45" y="40" fill="${blue}" font-family="Consolas,monospace" font-size="23">DEVICES + SHARED NETWORK</text><rect x="45" y="65" width="750" height="235" rx="16" fill="#102b39" stroke="#365c70" stroke-width="1.5"/><g class="ov-impact-network">${network}${link}${nodes}</g>${membership}
 <text x="45" y="391" fill="${green}" font-family="Consolas,monospace" font-size="23">ICT SYSTEMS</text>${systems}${dependencies}
 <text x="45" y="639" fill="#beaeea" font-size="20">supports</text><text x="45" y="665" fill="${violet}" font-family="Consolas,monospace" font-size="23">SERVICES</text>${services}
 <g font-size="21" fill="#b5cbd2"><circle cx="54" cy="815" r="8" fill="${scenario.issue==='network'?yellow:red}"/><text x="73" y="822">Issue to investigate</text><path d="M375 815h30" stroke="${violet}" stroke-width="2.8"/><text x="419" y="822">Dependency to review</text></g>`, `Illustrative scenario: ${scenario.label}. The six orange devices share a network; D1, D3 and D5 have attached blue software tiles. Highlighted device membership leads to green ${scenario.systems.map(id=>'System '+id).join(' and ')} and the purple ${ovServiceRecords.filter(service=>scenario.services.includes(service.id)).map(service=>service.label).join(' and ')}. System A contains D1 and D2; B contains D3 and D4; C contains D5 and D6. The ICT service depends on A, Mission service A on B and C, and Mission service B on C. ${scenario.issue==='network'?'The D2-to-D4 link is marked unavailable; the other network paths remain visible. The selected scope follows the two link endpoints. ':''}Highlighted services need review; the diagram does not establish a confirmed outage.`, '0 0 840 850');
}
function ovReportModel(index=0,scope='C',focus='D5') {
 const records=['D1','D2','D3','D4','D5','D6'].map((id,i)=>({id,system:['A','B','C'][Math.floor(i/2)],software:i%2===0}));
 const scoped=records.filter(record=>scope==='all'||record.system===scope),matched=scoped.filter(record=>focus==='all'||record.id===focus);
 const included=index===1?scoped:matched,systems=[...new Set(included.map(record=>record.system))];
 const services=ovServiceRecords.filter(service=>({ict:['A'],'mission-a':['B','C'],'mission-b':['C']}[service.id]).some(system=>systems.includes(system)));
 return {scoped,matched,included,systems,services};
}
function ovReportSummary(index=0,scope='C',focus='D5') {
 const count=ovReportModel(index,scope,focus).included.length;
 return ['Filtered Excel','Briefing PDF','Impact PDF'][index]+' / '+count+' '+(index===2?'starting CI'+(count===1?'':'s'):index===1?'device'+(count===1?'':'s')+' in scope':'matching record'+(count===1?'':'s'));
}
function ovReportReading(index=0,scope='C',focus='D5') {
 const model=ovReportModel(index,scope,focus),scopeName=scope==='all'?'Systems A, B and C':'System C';
 const explanation=[
  `Excel includes every record matching ${scopeName} and the Explorer search, across all pages. In this example, each row represents one device.`,
  `The briefing follows ${scopeName} and the loaded snapshot. Explorer search does not narrow this PDF: all ${model.scoped.length} devices in the selected scope are included.`,
  `The ${model.included.length===1?'matching device is a starting CI':'matching devices are starting CIs'} for a topology trace. The PDF contains the full traced graph and supporting evidence, using the selected graph mode and layout.`
 ][index];
 const rule=[
  ['Scope + snapshot + Explorer filters','A complete set of matching rows'],
  ['Applied header filters + snapshot','A summary of the selected cyber terrain'],
  ['Starting CIs + graph mode + layout','Recorded dependencies and supporting evidence']
 ][index];
 return `<div class="ov-report-explanation" data-report-count="${model.included.length}"><strong>Why this is included</strong><p>${ovEscape(explanation)}</p><dl class="ov-report-rules"><div><dt>Uses</dt><dd>${ovEscape(rule[0])}</dd></div><div><dt>Gives you</dt><dd>${ovEscape(rule[1])}</dd></div></dl></div>`;
}
function ovReportingArt(index=0,scope='C',focus='D5') {
 const model=ovReportModel(index,scope,focus),tone=['#79e2d2','#8edcff','#c7b7ff'][index];
 if(index===2){
  const groups=[{x:20,n:model.included.length,label:'Starting CIs',detail:model.included.map(record=>record.id).join(', '),color:'#f6aa63'},
   {x:260,n:model.systems.length,label:'ICT systems',detail:model.systems.join(', '),color:'#70e3a1'},
   {x:500,n:model.services.length,label:'Services',detail:'Dependencies to review',color:'#c7b7ff'}];
  return ovSvg(`<defs><marker id="ov-report-trace-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" fill="${tone}"/></marker></defs><g fill="none" stroke="${tone}" stroke-width="2" marker-end="url(#ov-report-trace-arrow)"><path d="M220 112H252"/><path d="M460 112H492"/></g>${groups.map(group=>`<g><rect x="${group.x}" y="30" width="200" height="168" rx="12" fill="#142e3b" stroke="${group.color}"/><text x="${group.x+100}" y="72" text-anchor="middle" fill="${group.color}" font-size="23">${group.label}</text><text x="${group.x+100}" y="134" text-anchor="middle" fill="#e4eeee" font-size="46">${group.n}</text><text x="${group.x+100}" y="174" text-anchor="middle" fill="#afc8d1" font-size="${group.detail.length>20?15:20}">${group.detail}</text></g>`).join('')}<text x="360" y="244" text-anchor="middle" fill="#b5cbd4" font-size="21">Illustrative membership and service trace</text>`, `Impact PDF example: ${model.included.length} starting CIs connect to ${model.systems.length} ICT systems and ${model.services.length} services in this illustrative trace. The real report includes the full traced graph and supporting evidence.`, '0 0 720 270');
 }
 const height=102+model.included.length*39;
 const rows=model.included.map((record,i)=>`<g class="ov-report-record" data-device="${record.id}" transform="translate(18 ${83+i*39})"><rect width="684" height="37" rx="4" fill="${i%2?'#18333f':'#132c38'}"/><text x="20" y="26" fill="#f6c493" font-size="23">${record.id}</text><text x="190" y="26" fill="#b6e9cb" font-size="23">System ${record.system}</text><text x="420" y="26" fill="#b6d6e6" font-size="21">${record.software?'SW shown':'Not shown'}</text></g>`).join('');
 return ovSvg(`<rect x="18" y="13" width="684" height="55" rx="7" fill="#1c3945"/><g fill="${tone}" font-size="22" font-weight="550"><text x="38" y="49">Device</text><text x="208" y="49">ICT system</text><text x="438" y="49">Software</text></g>${rows}`, `${index===0?'Filtered Excel':'Briefing PDF'} example includes ${model.included.map(record=>record.id).join(', ')}. ${index===0?'Every row matches both the selected scope and the Explorer search.':'Every device in the header scope is included; Explorer search does not narrow the briefing.'} Illustrative records only.`, `0 0 720 ${height}`);
}
function ovReportingWorkbench() {
 const choices=[
  {question:'Need the matching records?',format:'Filtered Excel',purpose:'Take the detailed rows into further analysis.'},
  {question:'Need to brief the terrain?',format:'Briefing PDF',purpose:'Share a summary of the selected scope.'},
  {question:'Need to explain dependencies?',format:'Impact PDF',purpose:'Show the connections behind an issue.'}
 ];
 return `<div class="ov-report-workbench ov-report-guide" data-report="0" data-report-scope="C" data-report-focus="D5">
  <div class="ov-report-choice-heading"><h3>Choose the question you need to answer</h3><p>Select an output to see what belongs in it.</p></div>
  <div class="ov-report-choices" role="group" aria-label="Compare reporting outputs">${choices.map((item,index)=>`<button type="button" data-ov-report="${index}" aria-pressed="${index===0}" aria-controls="ov-report-graphic ov-report-detail"><span>${item.question}</span><strong>${item.format}</strong><small>${item.purpose}</small></button>`).join('')}</div>
  <div class="ov-report-example">
   <div class="ov-report-filters"><h3>Try an example</h3><p>Six devices belong to three ICT systems. Change the selection to see what the report includes.</p>
    <fieldset><legend>ICT system scope</legend><div>${[['all','All 3 systems'],['C','System C']].map(([value,label])=>`<button type="button" data-ov-report-scope="${value}" aria-pressed="${value==='C'}" aria-controls="ov-report-graphic ov-report-detail">${label}</button>`).join('')}</div></fieldset>
    <fieldset><legend>Explorer search</legend><div>${[['all','All devices'],['D5','Device D5']].map(([value,label])=>`<button type="button" data-ov-report-focus="${value}" aria-pressed="${value==='D5'}" aria-controls="ov-report-graphic ov-report-detail">${label}</button>`).join('')}</div><p class="ov-report-search-note">Briefing PDFs keep the full header scope.</p></fieldset>
    <p class="ov-report-snapshot">Snapshot: illustrative example</p>
   </div>
   <div class="ov-report-result"><div class="ov-report-result-heading"><p>WHAT THE OUTPUT INCLUDES</p><h3 data-ov-report-summary aria-live="polite">${ovReportSummary()}</h3></div>
    <div class="ov-visual ov-report-visual">${ovExpandButton('reporting')}<div id="ov-report-graphic" tabindex="0" role="region" aria-label="Example report preview">${ovReportingArt()}</div></div>
    <div class="ov-report-reading"><div id="ov-report-detail" class="ov-live-detail" aria-live="polite" aria-atomic="true">${ovReportReading()}</div></div>
   </div>
  </div>
  <div class="ov-report-share"><p><strong>Keep the context with the report.</strong> Include the selected networks or ICT systems, Security Domain, loaded snapshot and relevant filters.</p><div class="ov-report-links">${link('topic/exports','Reporting and downloads')}${link('topic/scope','Scope and snapshots')}</div></div>
 </div>`;
}
function ovShadowArt() {
 const points=ovNetworkPoints(445),orange='#f6aa63',blue='#8edcff',amber='#ffe0a0';
 return ovSvg(`<text x="42" y="47" fill="${blue}" font-size="23" font-family="Consolas,monospace">KNOWN RECORDS / OBSERVED COMMUNICATION</text>
 <g transform="translate(0 -270)">${ovTerrainSystem(180,'B',['D3','D4'],true)}</g><text x="180" y="311" text-anchor="middle" fill="#b2ced4" font-size="22">Known system context</text>
 <g class="ov-unmatched"><rect x="594" y="99" width="112" height="112" rx="16" fill="#29323a" stroke="${amber}" stroke-width="2.4" stroke-dasharray="6 5"/><text x="650" y="174" fill="${amber}" text-anchor="middle" font-size="59" font-weight="300">?</text><text x="650" y="259" text-anchor="middle" fill="${amber}" font-size="26">Unmatched address</text><text x="650" y="291" text-anchor="middle" fill="#c5d6dc" font-size="22">Identity unknown</text></g>
 <g class="ov-shadow-network"><rect x="45" y="370" width="750" height="235" rx="16" fill="#102b39" stroke="#365c70" stroke-width="1.5"/>${ovNetworkPaths(points)}<path class="ov-flow-line ov-terrain-yellow-link" data-link="D2-D4" d="M170 545H420" fill="none" stroke="#ffe36e" stroke-width="3" stroke-dasharray="7 10"/><rect x="384" y="379" width="87" height="101" rx="12" fill="none" stroke="${orange}" stroke-width="2"/>${points.map(point=>ovTerrainDevice(point.x,point.y,point.id,point.software,.96,true,'ov-terrain-network-device')).join('')}</g>
 <g class="ov-unmatched-link" fill="none" stroke="${blue}" stroke-linejoin="round"><path class="ov-flow-line" d="M420 379V342H809V155H710" stroke-width="2.6" stroke-dasharray="6 10"/><text x="585" y="330" fill="${blue}" stroke="none" font-size="22" text-anchor="middle">Observed communication</text></g>
 <text x="420" y="651" text-anchor="middle" fill="${orange}" font-size="23">D3 is the reporting device</text>
 <text x="420" y="688" text-anchor="middle" fill="#b2c6cf" font-size="21">The observed address has no confirmed identity or system.</text>`, 'Illustrative network of six known orange devices. D1, D3 and D5 carry installed software. System B contains D3 and D4. D3 is the reporting device. Reveal the unmatched address observed by D3; its identity and system membership remain unknown. An observation is a lead to investigate, not proof of malicious activity.', '0 0 840 720');
}
function ovFilmButton(section) {if(!section.video)return '';return `<button type="button" class="ov-film-button" data-overview-video="${ovEscape(section.id)}" aria-label="Watch Video: ${ovEscape(section.title)}, ${Number(section.video?.duration || 24)} seconds" aria-haspopup="dialog" aria-controls="overview-video-dialog"><span class="ov-play" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg></span><span>Watch Video<small>${Number(section.video?.duration || 24)} sec</small></span></button>`;}
function ovCopy(section,additional='') {const heading=section.parent?'h3':'h2';return `<div class="ov-copy"><p class="ov-kicker"><span>${ovEscape(section.number)}</span>${ovEscape(section.kicker)}</p><${heading} id="ov-title-${ovEscape(section.id)}" tabindex="-1">${ovEscape(section.title)}</${heading}><p class="ov-lead">${ovEscape(section.lead)}</p><div class="ov-body">${ovParagraphs(section.body)}</div>${additional}${ovFilmButton(section)}</div>`;}
function ovTakeaway(section) {return section.takeaway?`<p class="ov-takeaway"><span aria-hidden="true">↳</span>${ovEscape(section.takeaway)}</p>`:'';}
function ovControls(items,kind,label) {return `<div class="ov-controls" role="group" aria-label="${ovEscape(label)}">${items.map((item,index)=>`<button type="button" data-ov-${kind}="${index}" aria-pressed="${index===0}" aria-controls="ov-${kind}-detail"><span class="ov-control-dot" aria-hidden="true"></span>${ovEscape(item.label || item.title)}</button>`).join('')}</div>`;}
function ovExplorePanel(items,kind,prompt) {
 const detail=kind==='layer'?items.map((item,index)=>`<div class="ov-layer-description${index===0?' is-active':''}" data-layer-description="${index}" aria-hidden="${index!==0}">${ovDetail(item)}</div>`).join(''):ovDetail(items[0]);
 return `<div class="ov-explore-panel"><p class="ov-explore-prompt">${ovEscape(prompt)}</p>${ovControls(items,kind,prompt)}<div id="ov-${kind}-detail" class="ov-live-detail" aria-live="polite" aria-atomic="true">${detail}</div></div>`;
}
function ovExpandButton(id) {return `<div class="ov-diagram-tools"><span>Illustrative model</span><button type="button" data-ov-expand="${id}" aria-label="Expand ${ovEscape(ovSection(id).title)} diagram" aria-haspopup="dialog" aria-controls="overview-diagram-dialog">${icon('scan',16)}<span>Expand diagram</span></button></div>`;}
// Drop-in origins timeline. Keeps the existing timeline selection handler.
function ovOriginsIcon(index) {
 const marks=[
  '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><path d="M16 5v11l8 5"/><circle cx="10" cy="20" r="1.6" fill="currentColor" stroke="none"/>',
  '<rect x="6" y="5" width="20" height="22" rx="3"/><path d="M6 12h20M6 19h20M13 12v15"/><path d="m10 8 1 1 2-2"/>',
  '<circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="3"/><path d="M16 2v5m0 18v5M2 16h5m18 0h5"/>',
  '<path d="m16 3 7 4-7 4-7-4Zm-8 13 7 4-7 4-7-4Zm16 0 7 4-7 4-7-4Z"/><path d="M16 11v4M8 16v-2h16v2M8 24v5m16-5v5"/>',
  '<path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z"/><circle cx="16" cy="16" r="4"/><path d="M16 3v2m0 22v2"/>',
  '<path d="M5 25V9a3 3 0 0 1 3-3h15M5 25h22"/><path d="m11 21 6-6 4 2 7-10m-6 0h6v6"/>'
 ];
 return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${marks[index] || marks[0]}</svg>`;
}
function ovOriginsTimeline(timeline) {
 const stages=['Discover','Model','Assess','Scale','Engage','Plan V3.0'];
 const planned=timeline.find(item=>item.status);
 return `<div class="ov-timeline ov-chronology">
  <div class="ov-history-heading"><div><p>THE CAPABILITY JOURNEY</p><span>Select a milestone to read its story.</span></div><span class="ov-history-range">2019 <span aria-hidden="true">&#8594;</span> 2027<small>planned delivery</small></span></div>
  <div class="ov-history-selector" role="group" aria-label="TSAAT history milestones">
   <div class="ov-history-rail" aria-hidden="true"><i></i></div>
   ${timeline.map((item,index)=>`<button type="button" class="ov-history-step" data-ov-timeline="${index}" ${item.status?'data-ov-planned="true"':''} aria-pressed="${index===0}" aria-controls="ov-timeline-detail" aria-label="Milestone ${index+1}: ${ovEscape(item.date)}. ${ovEscape(item.title)}${item.status?'. '+ovEscape(item.status):''}" title="${ovEscape(item.title)}"><span class="ov-history-node" aria-hidden="true">${ovOriginsIcon(index)}</span><span class="ov-history-stage"><small>${String(index+1).padStart(2,'0')}</small><b>${stages[index] || 'Milestone'}</b></span><span class="ov-history-date">${ovEscape(item.date)}</span>${item.status?`<em class="ov-history-planned">${ovEscape(item.status)}</em>`:''}</button>`).join('')}
  </div>
  <div class="ov-timeline-reading ov-history-panel">
   <div class="ov-history-panel-meta"><div><span class="ov-history-selected-label">SELECTED MILESTONE</span><span class="ov-timeline-year">${ovEscape(timeline[0].date)}</span>${planned?`<span class="ov-history-selected-status">${ovEscape(planned.status)}</span>`:''}</div><div class="ov-timeline-counter" aria-label="Milestone position"><b>01</b><span> / ${String(timeline.length).padStart(2,'0')}</span></div></div>
   <div class="ov-history-panel-content"><div class="ov-history-selected-icon" aria-hidden="true">${timeline.map((item,index)=>`<span data-ov-history-art="${index}">${ovOriginsIcon(index)}</span>`).join('')}</div><div id="ov-timeline-detail" class="ov-live-detail" aria-live="polite" aria-atomic="true">${ovDetail(timeline[0])}</div></div>
  </div>
 </div>`;
}
function overviewPage() {
 const sections=overviewContent.sections.filter(section=>!section.parent),layers=ovOptions(overviewContent.layers),flow=ovOptions(ovSection('understand').options),risk=ovOptions(ovSection('vulnerabilities').options),service=ovOptions(ovSection('services').options),benefits=ovOptions(overviewContent.benefits),timeline=overviewContent.timeline;
 const what=ovSection('what'),origins=ovSection('origins'),terrain=ovSection('terrain'),understand=ovSection('understand'),investigate=ovSection('investigate'),vulnerabilities=ovSection('vulnerabilities'),shadow=ovSection('shadow'),services=ovSection('services'),reporting=ovSection('reporting'),benefit=ovSection('benefits');
 return `<div class="overview-page" data-motion="active">
 <div class="ov-masthead"><p class="ov-eyebrow">TURN OBSERVATIONS INTO CONTEXT</p><span>${sections.length} chapters &middot; Explore at your own pace</span></div>
 <nav class="ov-rail" aria-label="Overview chapters"><div class="ov-rail-track">${sections.map((section,index)=>`<button type="button" data-ov-jump="${ovEscape(section.id)}" aria-label="Chapter ${index+1}: ${ovEscape(section.title)}" aria-controls="ov-${ovEscape(section.id)}" ${index===0?'aria-current="step"':''} title="${ovEscape(section.title)}"><span>${String(index+1).padStart(2,'0')}</span><b>${ovEscape(section.chapterLabel || section.title)}</b></button>`).join('')}</div><div class="ov-rail-mobile"><label for="ov-chapter-select">Explore the overview <span data-ov-chapter-count>01 / ${sections.length}</span></label><select id="ov-chapter-select" data-ov-chapter-select aria-label="Choose an overview chapter">${sections.map(section=>`<option value="${section.id}">${section.number} &middot; ${ovEscape(section.title)}</option>`).join('')}</select></div><div class="ov-rail-actions"><button type="button" data-ov-prev aria-label="Previous chapter" disabled>${icon('chev',16)}</button><button type="button" data-ov-next aria-label="Next chapter">${icon('chev',16)}</button></div><button type="button" class="ov-motion-toggle" data-ov-motion aria-pressed="false" aria-label="Pause overview animations"><span aria-hidden="true">&#8545;</span><span class="ov-motion-label">Pause motion</span></button><div class="ov-rail-progress" aria-hidden="true"><i class="ov-rail-fill"></i></div></nav>
 <section class="ov-section ov-intro" id="ov-what" data-ov-section="what" aria-labelledby="ov-title-what">
 <div class="ov-intro-copy"><p class="ov-kicker"><span>01</span>${ovEscape(what.kicker)}</p><h1 tabindex="-1">${ovEscape(overviewContent.title)}</h1><div class="ov-kinetic" aria-hidden="true"><span>See the terrain.</span><span>Connect the story.</span></div><h2 id="ov-title-what" tabindex="-1">${ovEscape(what.title)}</h2><p class="ov-lead">${ovEscape(what.lead)}</p><div class="ov-body">${ovParagraphs(what.body)}</div>${ovFilmButton(what)}<div class="ov-intro-actions">${link('feature-guide','Open the Feature Guide '+icon('arrow',16),'button secondary')}<button type="button" class="ov-scroll-cue" data-ov-jump="origins"><span aria-hidden="true">↓</span>Start the story</button></div></div>
 <div class="ov-visual ov-hero-visual">${ovHeroArt()}<div class="ov-visual-caption">A connected view of the cyber terrain.</div></div><div class="ov-start-here"><p>Or jump to what you need</p><div><button type="button" data-ov-jump="terrain"><span>Understand the Cyber Terrain</span><small>Devices, networks and systems</small>${icon('arrow',17)}</button><button type="button" data-ov-jump="investigate"><span>Investigate an issue or finding</span><small>Findings, unknowns and service impacts</small>${icon('arrow',17)}</button><button type="button" data-ov-jump="reporting"><span>Turn insights into a report</span><small>Scope, filters and the right output</small>${icon('arrow',17)}</button></div></div></section>
 <section class="ov-section ov-origins" id="ov-origins" data-ov-section="origins" aria-labelledby="ov-title-origins">
 <div class="ov-section-top">${ovCopy(origins)}<div class="ov-era" aria-hidden="true"><span>2019</span><svg viewBox="0 0 200 30"><path d="M0 15h190m-15-12 15 12-15 12" fill="none" stroke="currentColor"/></svg><span>2027</span><small>A journey in visibility</small></div></div>
 ${ovOriginsTimeline(timeline)}${ovTakeaway(origins)}</section>
 <section class="ov-section ov-terrain" id="ov-terrain" data-ov-section="terrain" aria-labelledby="ov-title-terrain">
 ${ovCopy(terrain)}<div class="ov-terrain-workbench">${ovExplorePanel(layers,'layer','Select a layer to see how it contributes')}<div class="ov-visual ov-terrain-visual" data-layer="0">${ovExpandButton('terrain')}${ovTerrainArt()}</div></div>${ovTakeaway(terrain)}</section>
 <section class="ov-section ov-investigate" id="ov-investigate" data-ov-section="investigate" aria-labelledby="ov-title-investigate">
 <div class="ov-investigate-intro">${ovCopy(investigate)}<nav class="ov-investigate-topics" aria-label="Investigation topics">${overviewContent.sections.filter(section=>section.parent==='investigate').map(section=>`<button type="button" data-ov-jump="${section.id}" aria-controls="ov-${section.id}"><span>${ovEscape(section.title)}</span><small>${ovEscape(section.lead)}</small></button>`).join('')}</nav></div>
 <section class="ov-section ov-subsection ov-vulnerabilities" id="ov-vulnerabilities" data-ov-subsection="vulnerabilities" aria-labelledby="ov-title-vulnerabilities">
 ${ovCopy(vulnerabilities,ovExplorePanel(risk,'risk','Follow a finding from the asset to its context'))}<div class="ov-visual ov-risk-stage" data-risk="0" data-risk-device="D3"><div class="ov-risk-device-picker"><span id="ov-risk-picker-label">Trace a finding on a device</span><div role="group" aria-labelledby="ov-risk-picker-label">${Object.keys(ovRiskExamples).map(id=>`<button type="button" data-ov-risk-device="${id}" aria-pressed="${id==='D3'}" aria-controls="ov-risk-graphic ov-risk-trace">${id}</button>`).join('')}</div></div><div id="ov-risk-trace" class="ov-risk-trace-detail" aria-live="polite" aria-atomic="true">${ovRiskTrace()}</div>${ovExpandButton('vulnerabilities')}<div id="ov-risk-graphic">${ovVulnerabilityArt()}</div><p class="ov-illustration-note">Illustrative finding and relationships. Validate the evidence and service impact.</p></div>${ovTakeaway(vulnerabilities)}</section>
 <section class="ov-section ov-subsection ov-shadow" id="ov-shadow" data-ov-subsection="shadow" aria-labelledby="ov-title-shadow">
 <div class="ov-visual ov-shadow-visual" data-shadow="hidden">${ovExpandButton('shadow')}${ovShadowArt()}</div>${ovCopy(shadow,`<div class="ov-explore-panel"><p class="ov-explore-prompt">Compare a known device with an unknown address</p><button type="button" class="ov-reveal-button" data-ov-shadow aria-pressed="false" aria-controls="ov-shadow-detail">${icon('scan',18)}<span>Reveal the unmatched address</span></button><div id="ov-shadow-detail" class="ov-live-detail" aria-live="polite" aria-atomic="true"><strong>Start with what is known.</strong><p>The orange devices are known records. Reveal the unmatched address observed by D3.</p></div></div>`)}${ovTakeaway(shadow)}</section>
 <section class="ov-section ov-subsection ov-services" id="ov-services" data-ov-subsection="services" aria-labelledby="ov-title-services">
 <div class="ov-section-top">${ovCopy(services)}</div><div class="ov-service-map" data-service="0"><div class="ov-impact-controls"><div><p class="ov-eyebrow">FOLLOW THE DEPENDENCIES</p><h4>Explore an illustrative issue</h4><p class="ov-inline-result" data-ov-service-summary>${ovServiceSummary()}</p></div>${ovControls(service,'service','Choose a device or network issue')}</div><div class="ov-visual ov-impact-visual">${ovExpandButton('services')}<div id="ov-service-graphic">${ovServiceImpactArt()}</div></div><div class="ov-impact-reading"><div id="ov-service-detail" class="ov-live-detail" aria-live="polite" aria-atomic="true">${ovServiceReading()}</div><p class="ov-illustration-note">Illustrative relationships. Highlighted services require investigation; an outage is not confirmed.</p></div></div>${ovTakeaway(services)}</section>
 </section>
 <section class="ov-section ov-reporting" id="ov-reporting" data-ov-section="reporting" aria-labelledby="ov-title-reporting">
 <div class="ov-section-top">${ovCopy(reporting)}</div>${ovReportingWorkbench()}${ovTakeaway(reporting)}</section>
 <section class="ov-section ov-understand" id="ov-understand" data-ov-section="understand" aria-labelledby="ov-title-understand">
 <div class="ov-section-top">${ovCopy(understand)}</div><div class="ov-flow" data-flow="0"><div class="ov-flow-steps" role="group" aria-label="Explore the TSAAT approach">${flow.map((item,index)=>`<button type="button" data-ov-flow="${index}" aria-pressed="${index===0}" aria-controls="ov-flow-detail"><span>${String(index+1).padStart(2,'0')}</span><strong>${ovEscape(item.label)}</strong><svg viewBox="0 0 30 20" aria-hidden="true"><path d="M2 10h24m-8-7 8 7-8 7" fill="none" stroke="currentColor"/></svg></button>`).join('')}</div><div class="ov-flow-stage"><div class="ov-visual ov-evidence-visual" id="ov-evidence-graphic">${ovEvidenceArt()}</div><div id="ov-flow-detail" class="ov-live-detail" aria-live="polite" aria-atomic="true">${ovDetail(flow[0])}</div></div></div>${ovTakeaway(understand)}</section>
 <section class="ov-section ov-benefits" id="ov-benefits" data-ov-section="benefits" aria-labelledby="ov-title-benefits">
 <div class="ov-section-top">${ovCopy(benefit)}</div><div class="ov-benefit-grid" role="group" aria-label="Explore TSAAT benefits">${benefits.map((item,index)=>`<button type="button" data-ov-benefit="${index}" aria-pressed="${index===0}" aria-controls="ov-benefit-detail"><span class="ov-benefit-number">${String(index+1).padStart(2,'0')}</span><strong>${ovEscape(item.label)}</strong><span class="ov-benefit-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><div id="ov-benefit-detail" class="ov-live-detail ov-benefit-detail" aria-live="polite" aria-atomic="true">${ovDetail(benefits[0])}</div>${ovTakeaway(benefit)}<div class="ov-next"><div><p class="ov-eyebrow">MAKE IT PRACTICAL</p><h3>Now explore the tool.</h3><p>Turn the overview into a first step.</p></div><div>${link('feature-guide','Open the Feature Guide '+icon('arrow',18),'button primary')}${link('practice','Try the practice lab '+icon('ne',16),'button secondary')}</div></div></section>
 <div class="ov-ending"><span>TSAAT</span><p>${ovEscape(overviewContent.sourceNote)}</p><button type="button" data-ov-jump="what">Back to the beginning ↑</button></div>
 <dialog id="overview-diagram-dialog" class="ov-diagram-dialog" aria-labelledby="ov-diagram-title"><div class="ov-diagram-heading"><div><p class="ov-eyebrow">EXPLORE THE DETAIL</p><h2 id="ov-diagram-title"></h2></div><button type="button" data-ov-close-diagram aria-label="Close diagram">${icon('close',22)}</button></div><div class="ov-diagram-zoom" role="group" aria-label="Diagram zoom"><button type="button" data-ov-zoom="out" aria-label="Zoom out">&minus;</button><output id="ov-diagram-scale" aria-live="polite">100%</output><button type="button" data-ov-zoom="in" aria-label="Zoom in">+</button><button type="button" data-ov-zoom="fit">Fit to view</button><span>Zoom in to inspect detail.</span></div><div id="ov-diagram-canvas" class="ov-diagram-canvas" tabindex="0" role="region" aria-label="Diagram fitted to view; zoom in to inspect and scroll"></div><p class="ov-diagram-caption">This is your selected view. Close the diagram to change its controls.</p></dialog>
 <dialog id="overview-video-dialog" class="ov-video-dialog" aria-labelledby="overview-film-title"><div class="ov-video-heading"><div><p class="ov-eyebrow">OVERVIEW VIDEOS</p><h2 id="overview-film-title"></h2></div><button type="button" class="ov-close-video" data-ov-close-video aria-label="Close video">${icon('close',24)}</button></div><div class="ov-film-frame"><video id="overview-film" controls playsinline preload="none"></video></div><p class="ov-film-status" role="status"></p><details class="ov-film-transcript"><summary>Read the video transcript</summary><div></div></details></dialog>
 </div>`;
}
function disposeOverview() {
 const r=overviewRuntime;if(!r)return;
 r.abort.abort();r.observer?.disconnect();cancelAnimationFrame(r.scrollFrame);
 r.video?.pause();r.video?.removeAttribute('src');r.video?.load();if(r.dialog?.open)r.dialog.close();
 if(r.diagram?.open)r.diagram.close();r.canvas?.replaceChildren();r.diagramOpener=null;
 r.urls.forEach(url=>URL.revokeObjectURL(url));overviewRuntime=null;
}
function setupOverview() {
 disposeOverview();const root=document.querySelector('.overview-page');if(!root)return;
 const abort=new AbortController(),signal=abort.signal,motion=matchMedia('(prefers-reduced-motion: reduce)');
 const r={root,abort,observer:null,scrollFrame:0,hoverHost:null,dialog:root.querySelector('#overview-video-dialog'),video:root.querySelector('#overview-film'),videoOpener:null,diagram:root.querySelector('#overview-diagram-dialog'),canvas:root.querySelector('#ov-diagram-canvas'),diagramOpener:null,diagramZoom:1,diagramWidth:840,diagramHeight:840,diagramFitted:true,urls:[]};overviewRuntime=r;
 const sections=[...root.querySelectorAll('[data-ov-section]')],nav=[...root.querySelectorAll('.ov-rail [data-ov-jump]')],reduced=()=>motion.matches||overviewMotionPaused;
 const resetHover=()=>{r.hoverHost?.querySelectorAll('.ov-entity-highlight').forEach(node=>node.classList.remove('ov-entity-highlight'));r.hoverHost=null;};
 const updateMotion=()=>{
  const paused=reduced();root.dataset.motion=paused?'paused':'active';root.classList.toggle('ov-motion-paused',paused);
  const button=root.querySelector('[data-ov-motion]');button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Resume overview animations':'Pause overview animations');button.querySelector('.ov-motion-label').textContent=motion.matches?'Reduced motion':paused?'Resume motion':'Pause motion';button.disabled=motion.matches;button.title=motion.matches?'Reduced motion follows your device preference.':'';
  if(paused)resetHover();
 };
 const jumpToChapter=id=>{
  const target=root.querySelector('#ov-'+CSS.escape(id));if(!target)return;
  const offset=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head'))+root.querySelector('.ov-rail').getBoundingClientRect().height+18;
  window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset),behavior:reduced()?'instant':'smooth'});
  target.querySelector('h1,h2,h3')?.focus({preventScroll:true});
 };
 const updateScroll=()=>{
  r.scrollFrame=0;if(!root.isConnected)return;
  const top=root.getBoundingClientRect().top,total=Math.max(1,root.scrollHeight-innerHeight);root.style.setProperty('--ov-progress',Math.max(0,Math.min(1,-top/total)).toFixed(4));
  const threshold=root.querySelector('.ov-rail').getBoundingClientRect().bottom+48;let active=sections[0]?.dataset.ovSection;
  for(const section of sections){if(section.getBoundingClientRect().top<=threshold)active=section.dataset.ovSection;}
  for(const button of nav){if(button.dataset.ovJump===active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
  const activeIndex=sections.findIndex(section=>section.dataset.ovSection===active),chooser=root.querySelector('[data-ov-chapter-select]');
  if(document.activeElement!==chooser)chooser.value=active;
  root.querySelector('[data-ov-chapter-count]').textContent=String(activeIndex+1).padStart(2,'0')+' / '+sections.length;
  for(const [direction,offset] of [['prev',-1],['next',1]]){
   const button=root.querySelector('[data-ov-'+direction+']'),next=sections[activeIndex+offset];button.disabled=!next;
   button.setAttribute('aria-label',(direction==='prev'?'Previous':'Next')+' chapter'+(next?': '+ovSection(next.dataset.ovSection).title:''));
  }
  if(root.dataset.activeChapter!==active){const button=nav.find(item=>item.dataset.ovJump===active),track=root.querySelector('.ov-rail-track');if(button&&track.clientWidth)track.scrollTo({left:button.offsetLeft-track.offsetLeft-(track.clientWidth-button.offsetWidth)/2,behavior:reduced()?'instant':'smooth'});}
  root.dataset.activeChapter=active;
 };
 const queueScroll=()=>{if(!r.scrollFrame)r.scrollFrame=requestAnimationFrame(updateScroll);};
 const refreshReport=()=>{
  const host=root.querySelector('.ov-report-workbench'),index=Number(host.dataset.report),scope=host.dataset.reportScope,focus=host.dataset.reportFocus;
  root.querySelector('#ov-report-graphic').innerHTML=ovReportingArt(index,scope,focus);
  root.querySelector('#ov-report-detail').innerHTML=ovReportReading(index,scope,focus);
  root.querySelector('[data-ov-report-summary]').textContent=ovReportSummary(index,scope,focus);
 };
 const select=(kind,index,items)=>{
  if(!items[index])return;
  for(const button of root.querySelectorAll('[data-ov-'+kind+']'))button.setAttribute('aria-pressed',String(Number(button.getAttribute('data-ov-'+kind))===index));
  const detail=root.querySelector('#ov-'+kind+'-detail');
  if(kind==='layer')detail.querySelectorAll('[data-layer-description]').forEach(panel=>{const active=Number(panel.dataset.layerDescription)===index;panel.classList.toggle('is-active',active);panel.setAttribute('aria-hidden',String(!active));});
  else if(detail)detail.innerHTML=ovDetail(items[index]);
  const visual=root.querySelector('[data-'+kind+']');if(visual)visual.dataset[kind]=String(index);
  if(kind==='report')refreshReport();
  if(kind==='flow')root.querySelector('#ov-evidence-graphic').innerHTML=ovEvidenceArt(index);
  if(kind==='service'){
   root.querySelector('#ov-service-graphic').innerHTML=ovServiceImpactArt(index);
   detail.innerHTML=ovServiceReading(index);
   root.querySelector('[data-ov-service-summary]').textContent=ovServiceSummary(index);
  }
 };
 const closeVideo=()=>{
  r.video.pause();r.video.removeAttribute('src');r.video.removeAttribute('poster');r.video.replaceChildren();r.video.load();if(r.dialog.open)r.dialog.close();r.urls.forEach(url=>URL.revokeObjectURL(url));r.urls=[];const button=r.videoOpener;r.videoOpener=null;if(button?.isConnected)button.focus({preventScroll:true});
 };
 const diagramFit=()=>{
  const style=getComputedStyle(r.canvas);
  const width=r.canvas.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const height=r.canvas.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  return Math.max(.01,Math.min(2,width/r.diagramWidth,height/r.diagramHeight));
 };
 const setDiagramZoom=(value,fitted=false)=>{
  const minimum=Math.min(.1,diagramFit());
  r.diagramZoom=Math.max(minimum,Math.min(2,value));r.diagramFitted=fitted;
  const svg=r.canvas.querySelector('.ov-diagram');if(svg)svg.style.width=Math.floor(r.diagramWidth*r.diagramZoom)+'px';
  root.querySelector('#ov-diagram-scale').textContent=Math.round(r.diagramZoom*100)+'%';
  root.querySelector('[data-ov-zoom="out"]').disabled=r.diagramZoom<=minimum+.001;
  root.querySelector('[data-ov-zoom="in"]').disabled=r.diagramZoom>=2;
  root.querySelector('[data-ov-zoom="fit"]').setAttribute('aria-pressed',String(fitted));
 };
 const fitDiagram=()=>{setDiagramZoom(diagramFit(),true);r.canvas.scrollTo(0,0);};
 const closeDiagram=()=>{if(r.diagram.open)r.diagram.close();};
 const openDiagram=(id,button)=>{
  const original=root.querySelector('#ov-'+id+' .ov-visual .ov-diagram');if(!original)return;
  const host=original.closest('.ov-visual'),wrapper=document.createElement('div'),svg=original.cloneNode(true);
  wrapper.className=host.className+' ov-diagram-expanded';
  for(const attribute of host.attributes)if(attribute.name.startsWith('data-'))wrapper.setAttribute(attribute.name,attribute.value);
  const ids=new Map();for(const node of svg.querySelectorAll('[id]')){const old=node.id,next='ov-zoom-'+old;ids.set(old,next);node.id=next;}
  for(const node of [svg,...svg.querySelectorAll('*')])for(const attribute of [...node.attributes]){
   let value=attribute.value;for(const [old,next] of ids){value=value.split('url(#'+old+')').join('url(#'+next+')');if(value==='#'+old)value='#'+next;}
   if(value!==attribute.value)node.setAttribute(attribute.name,value);
  }
  wrapper.append(svg);r.canvas.replaceChildren(wrapper);r.diagramWidth=original.viewBox.baseVal.width||840;r.diagramHeight=original.viewBox.baseVal.height||840;r.diagramOpener=button;
  root.querySelector('#ov-diagram-title').textContent=ovSection(id).title;r.diagram.showModal();
  fitDiagram();
  root.querySelector('[data-ov-close-diagram]').focus({preventScroll:true});
 };
 const openVideo=(id,button)=>{
  const section=ovSection(id),film=section.video || {};if(!film.file)return;r.videoOpener=button;
  root.querySelector('#overview-film-title').textContent=section.title;root.querySelector('.ov-film-status').textContent='A caption-led motion story. Use the video controls to pause, seek or view full screen.';
  r.video.pause();r.video.replaceChildren();r.video.src=film.file;if(film.poster)r.video.poster=film.poster;else r.video.removeAttribute('poster');
  if(film.captions){const track=document.createElement('track');track.kind='captions';track.srclang='en';track.label='English';track.default=false;let captionData=film.captions;
   if(captionData.startsWith('data:')){const comma=captionData.indexOf(',');captionData=captionData.slice(0,comma).includes(';base64')?new TextDecoder().decode(base64ToBytes(captionData.slice(comma+1))):decodeURIComponent(captionData.slice(comma+1));}
   if(captionData.trim().startsWith('WEBVTT')){const url=URL.createObjectURL(new Blob([captionData],{type:'text/vtt'}));r.urls.push(url);track.src=url;}else track.src=captionData;r.video.append(track);
  }
  const scenes=film.scenes || section.film || [];
  root.querySelector('.ov-film-transcript div').innerHTML=scenes.length?scenes.map(scene=>`<p><strong>${ovEscape(scene.headline)}</strong>${scene.subtitle?'<br>'+ovEscape(scene.subtitle):''}<br>${ovEscape(scene.body)}</p>`).join(''):ovParagraphs([section.lead,...section.body,section.takeaway]);
  root.querySelector('.ov-film-transcript').open=false;r.dialog.showModal();root.querySelector('[data-ov-close-video]').focus({preventScroll:true});
  r.video.play().catch(()=>{if(r.dialog.open&&!r.video.error)root.querySelector('.ov-film-status').textContent='Select Play in the video controls to begin the video.';});
 };
 root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!root.contains(button))return;
  if(button.hasAttribute('data-ov-jump')){jumpToChapter(button.dataset.ovJump);return;}
  if(button.hasAttribute('data-ov-prev')||button.hasAttribute('data-ov-next')){const index=sections.findIndex(section=>section.dataset.ovSection===root.dataset.activeChapter),next=sections[index+(button.hasAttribute('data-ov-prev')?-1:1)];if(next)jumpToChapter(next.dataset.ovSection);return;}
  if(button.hasAttribute('data-ov-expand')){openDiagram(button.dataset.ovExpand,button);return;}
  if(button.hasAttribute('data-ov-close-diagram')){closeDiagram();return;}
  if(button.hasAttribute('data-ov-zoom')){const action=button.dataset.ovZoom;if(action==='fit')fitDiagram();else setDiagramZoom(r.diagramZoom+(action==='in'?.25:-.25));return;}
  if(button.hasAttribute('data-ov-motion')){overviewMotionPaused=!overviewMotionPaused;updateMotion();return;}
  if(button.hasAttribute('data-overview-video')){openVideo(button.dataset.overviewVideo,button);return;}
  if(button.hasAttribute('data-ov-close-video')){closeVideo();return;}
  if(button.hasAttribute('data-ov-timeline')){const index=Number(button.dataset.ovTimeline);select('timeline',index,overviewContent.timeline);root.querySelector('.ov-timeline-year').textContent=overviewContent.timeline[index].date;root.querySelector('.ov-timeline-counter b').textContent=String(index+1).padStart(2,'0');return;}
  if(button.hasAttribute('data-ov-risk-device')){
   const id=button.dataset.ovRiskDevice;if(!ovRiskExamples[id])return;
   root.querySelectorAll('[data-ov-risk-device]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
   root.querySelector('.ov-risk-stage').dataset.riskDevice=id;
   root.querySelector('#ov-risk-graphic').innerHTML=ovVulnerabilityArt(id);
   root.querySelector('#ov-risk-trace').innerHTML=ovRiskTrace(id);return;
  }
  if(button.hasAttribute('data-ov-report-scope')||button.hasAttribute('data-ov-report-focus')){
   const kind=button.hasAttribute('data-ov-report-scope')?'scope':'focus',value=button.getAttribute('data-ov-report-'+kind);
   if(!(kind==='scope'?['all','C']:['all','D5']).includes(value))return;
   root.querySelectorAll('[data-ov-report-'+kind+']').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
   root.querySelector('.ov-report-workbench').setAttribute('data-report-'+kind,value);refreshReport();return;
  }
  const kinds={layer:overviewContent.layers,flow:ovSection('understand').options,risk:ovSection('vulnerabilities').options,service:ovSection('services').options,report:ovSection('reporting').options,benefit:overviewContent.benefits};
  for(const [kind,items] of Object.entries(kinds))if(button.hasAttribute('data-ov-'+kind)){select(kind,Number(button.getAttribute('data-ov-'+kind)),ovOptions(items));return;}
  if(button.hasAttribute('data-ov-shadow')){
   const reveal=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(reveal));button.querySelector('span').textContent=reveal?'Return to known records':'Reveal the unmatched address';root.querySelector('[data-shadow]').dataset.shadow=reveal?'revealed':'hidden';
   root.querySelector('#ov-shadow-detail').innerHTML=reveal?'<strong>An observation. A question to investigate.</strong><p>The unmatched address is separate from the device that reported it. Confirm what it represents before treating it as an unmanaged device or a threat.</p>':'<strong>Start with what is known.</strong><p>The orange devices are known records. Reveal the unmatched address observed by D3.</p>';
  }
 },{signal});
 root.addEventListener('change',event=>{if(event.target.matches('[data-ov-chapter-select]'))jumpToChapter(event.target.value);},{signal});
 r.diagram.addEventListener('cancel',event=>{event.preventDefault();closeDiagram();},{signal});
 r.diagram.addEventListener('close',()=>{r.canvas.replaceChildren();const button=r.diagramOpener;r.diagramOpener=null;if(button?.isConnected)button.focus({preventScroll:true});},{signal});
 r.diagram.addEventListener('click',event=>{if(event.target!==r.diagram)return;event.stopPropagation();const box=r.diagram.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDiagram();},{signal});
 r.dialog.addEventListener('click',event=>{if(event.target!==r.dialog)return;event.stopPropagation();const box=r.dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeVideo();},{signal});
 r.dialog.addEventListener('cancel',event=>{event.preventDefault();closeVideo();},{signal});r.dialog.addEventListener('close',()=>{if(r.video.hasAttribute('src'))closeVideo();},{signal});
 r.video.addEventListener('error',()=>{if(r.dialog.open){const filename=r.video.getAttribute('src') || 'the overview MP4 file';root.querySelector('.ov-film-status').textContent='This video could not be opened. Keep '+filename+' in the same folder as the guide, or read the transcript below.';}},{signal});
 root.addEventListener('pointerover',event=>{
  const device=event.target.closest('.ov-terrain-device'),host=device?.closest('.ov-visual');if(!host||event.pointerType==='touch')return;
  resetHover();r.hoverHost=host;host.querySelectorAll('.ov-terrain-device').forEach(node=>node.classList.toggle('ov-entity-highlight',node.dataset.device===device.dataset.device));
 },{signal,passive:true});
 root.addEventListener('pointerout',event=>{if(event.target.closest('.ov-terrain-device')&&!event.target.closest('.ov-terrain-device').contains(event.relatedTarget))resetHover();},{signal,passive:true});window.addEventListener('blur',resetHover,{signal});
 window.addEventListener('scroll',queueScroll,{signal,passive:true});window.addEventListener('resize',()=>{queueScroll();if(r.diagram.open&&r.diagramFitted)fitDiagram();},{signal,passive:true});document.addEventListener('visibilitychange',()=>{root.classList.toggle('ov-document-hidden',document.hidden);if(document.hidden)resetHover();},{signal});motion.addEventListener('change',updateMotion,{signal});
 if('IntersectionObserver' in window){r.observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('is-visible',entry.isIntersecting)),{rootMargin:'10% 0px 10% 0px'});sections.forEach(section=>r.observer.observe(section));}else sections.forEach(section=>section.classList.add('is-visible'));
 updateMotion();updateScroll();
}
