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

function ovTerrainDevice(x,y,id,software=false,scale=1,label=true,extra='') {
 const orange='#f6aa63',blue='#8edcff';
 return `<g class="ov-terrain-device ${extra}" data-device="${id}" data-software="${software}" transform="translate(${x} ${y}) scale(${scale})"><title>Device ${id}; System ${id==='D1'||id==='D2'?'A':id==='D3'||id==='D4'?'B':'C'}${software?'; installed software shown':'; no software shown'}</title><g stroke="${orange}" stroke-width="1.8" stroke-linejoin="round"><path d="M0-56 28-42V-14L0 0-28-14V-42Z" fill="#30291f"/><path d="M0-56 28-42 0-28-28-42Z" fill="#704523"/><path d="M0-28V0M0-28 28-42M0-28-28-42" fill="none"/><path d="M-20-31-8-25M-20-24-8-18" opacity=".7"/><circle cx="19" cy="-22" r="2" fill="${orange}" stroke="none"/></g>${software?`<g class="ov-terrain-software"><path d="M19-31 29-49" fill="none" stroke="${blue}" stroke-width="2"/><rect x="12" y="-67" width="39" height="31" rx="5" fill="#153b50" stroke="${blue}" stroke-width="2"/><path d="M18-59h27" stroke="${blue}" stroke-width="1.5"/><text x="31.5" y="-43" fill="#d4f3ff" text-anchor="middle" font-size="14" font-family="Consolas,monospace">SW</text></g>`:''}${label?`<text x="0" y="29" fill="#e5bb91" font-size="23" font-family="Consolas,monospace" text-anchor="middle">${id}</text>`:''}</g>`;
}
const ovTopologyTones={asset:'#f6aa63',network:'#8edcff',system:'#70e3a1',mission:'#c7b7ff',business:'#efb8dc'};
const ovTopologyClusters=[
  {system:'A',network:'Operations network',x:210,ids:['D1','D2','D7','D8','D9','D10']},
  {system:'B',network:'Enterprise network',x:600,ids:['D3','D4','D11','D12','D13','D14']},
  {system:'C',network:'Support network',x:990,ids:['D5','D6','D15','D16','D17','D18']}
 ];
const ovTopologyServices=[
  {id:'mission-a',label:'Mission service A',x:150,kind:'mission',layer:4,systems:['B','C']},
  {id:'mission-b',label:'Mission service B',x:450,kind:'mission',layer:4,systems:['C']},
  {id:'business-a',label:'Business service A',x:750,kind:'business',layer:5,systems:['A']},
  {id:'business-b',label:'Business service B',x:1050,kind:'business',layer:5,systems:['A','B']}
 ];
const ovTopologyGlyph=type=>type==='Server'?'<rect x="-15" y="-18" width="30" height="35" rx="4"/><path d="M-15-6h30M-15 6h30M-8-12h9M-8 0h9M-8 12h9"/><circle cx="8" cy="-12" r="1" fill="currentColor"/><circle cx="8" cy="0" r="1" fill="currentColor"/>':type==='Workstation'?'<rect x="-19" y="-14" width="38" height="26" rx="3"/><path d="M0 12v6m-10 0h20"/>':type==='Switch'?'<rect x="-20" y="-11" width="40" height="23" rx="4"/><path d="M-13-3h6m4 0h6m4 0h6M-13 5h6m4 0h6m4 0h6"/>':type==='Storage'?'<ellipse cy="-11" rx="18" ry="6"/><path d="M-18-11v24c0 8 36 8 36 0v-24M-18 1c0 8 36 8 36 0"/>':'<path d="M-12-9v-9h24v9M-12 11h-7V-8h38v19h-7M-12 5h24v14h-24Z"/><path d="M10-1h3"/>';
function ovTopologyArt({findingId='',impact=null}={}) {
 const tones=ovTopologyTones,clusters=ovTopologyClusters,services=ovTopologyServices;
 const findingSystem=clusters.find(cluster=>cluster.ids.includes(findingId))?.system;
 const activeSystems=findingId?[findingSystem]:impact?.systems||[],activeDevices=findingId?[findingId]:impact?.devices||[];
 const focusKind=findingId?'risk':impact?'impact':'';
 const markerPrefix=focusKind?'ov-'+focusKind+'-topology':'ov-topology';
 const systemLayers=system=>['3',...new Set(services.filter(service=>service.systems.includes(system)).map(service=>String(service.layer)))].join(' ');
 const nodes=clusters.flatMap(cluster=>cluster.ids.map((id,index)=>({id,system:cluster.system,x:cluster.x+(index%3-1)*112,y:index<3?380:508,server:index===0||index===2,type:['Server','Workstation','Server','Switch','Storage','Printer'][index]})));
 const part=(layers,body,extra='',role='background',related=false)=>`<g class="ov-topology-part ${extra}" data-layer-part="${layers}"${focusKind?` data-${focusKind}-role="${role}" data-related="${related}"`:''}>${body}</g>`;
 const dependency=services.flatMap(service=>service.systems.map(system=>{const target=clusters.find(cluster=>cluster.system===system),curve=service.kind==='mission'?104:120;return part(`3 ${service.layer}`,`<path class="ov-topology-dependency" data-from="${service.id}" data-to="${system}" d="M${service.x} 76C${service.x} ${curve} ${target.x} ${curve} ${target.x} 147" fill="none" stroke="${tones[service.kind]}" stroke-width="2" marker-end="url(#${markerPrefix}-arrow-${service.kind})"/>`,'','context',activeSystems.includes(system));})).join('');
 const membership=clusters.map(cluster=>{
  const members=nodes.filter(node=>node.system===cluster.system),railX=cluster.x-168,rows=[...new Set(members.map(node=>node.y))];
  const trunk=`<path d="M${cluster.x} 197V211H${railX}V${Math.max(...rows)-61}" fill="none" stroke="${tones.system}" stroke-width="1.7"/>`;
  const branches=rows.map(y=>{
   const row=members.filter(node=>node.y===y),railY=y-61;
   return `<path d="M${railX} ${railY}H${Math.max(...row.map(node=>node.x))-20}" fill="none" stroke="${tones.system}" stroke-width="1.5" stroke-opacity=".7"/>${row.map(node=>`<path d="M${node.x-20} ${railY}V${node.y-21}" fill="none" stroke="${tones.system}" stroke-width="1.5" stroke-opacity=".7"/>`).join('')}`;
  }).join('');
  return part(systemLayers(cluster.system),trunk+branches,'ov-topology-membership','context',false);
 }).join('');
 const networkLinks=clusters.map(cluster=>part('2',`<path class="ov-flow-line" d="M${cluster.x} 300V315H${cluster.x+112}V479M${cluster.x-112} 315H${cluster.x}M${cluster.x-112} 315V479M${cluster.x} 315V479" fill="none" stroke="${tones.network}" stroke-width="2" stroke-dasharray="5 12"/>${nodes.filter(node=>node.system===cluster.system).map(node=>`<path class="ov-flow-line" d="M${node.x} ${node.y-29}V${node.y<400?315:450}" fill="none" stroke="${tones.network}" stroke-width="2" stroke-dasharray="5 12"/>`).join('')}`,'','network',false)).join('');
 const crossLinks=part('2',`<path class="ov-flow-line" data-network-link="A-B" d="M230 280H580" fill="none" stroke="${tones.network}" stroke-width="2.5" stroke-dasharray="6 12"/><path class="ov-flow-line" data-network-link="B-C" d="M620 280H970" fill="none" stroke="${tones.network}" stroke-width="2.5" stroke-dasharray="6 12"/>`);
 const endpoints=impact?.issue==='link'?impact.devices.map(id=>nodes.find(node=>node.id===id)):[];
 const linkMid=endpoints.length?(endpoints[0].x+endpoints[1].x)/2:0;
 const deviceLink=endpoints.length?part('',`<path class="ov-impact-unavailable" data-device-link="${impact.devices.join('-')}" data-from="${endpoints[0].id}" data-to="${endpoints[1].id}" d="M${endpoints[0].x+29} ${endpoints[0].y}H${linkMid-19}M${linkMid+19} ${endpoints[1].y}H${endpoints[1].x-29}" fill="none" stroke="#ffe36e" stroke-width="3"/><g class="ov-impact-link-issue" transform="translate(${linkMid} ${endpoints[0].y})"><title>D7-to-D3 device link unavailable</title><circle r="13" fill="#3d3522" stroke="#ffe36e" stroke-width="2"/><text y="7" text-anchor="middle" fill="#ffe36e" font-size="22" font-weight="600">!</text></g>`,'','issue',true):'';
 const findingBadge=`<g class="ov-risk-finding-badge" transform="translate(-27 -28)"><title>Finding F-01 on installed software</title><circle r="13" fill="#572d2e" stroke="#ff958b" stroke-width="2"/><text y="7" text-anchor="middle" fill="#ffe4dc" font-size="22" font-weight="600">!</text></g>`;
 const impactBadge='<g class="ov-impact-issue" transform="translate(-27 -28)"><title>Device issue to investigate</title><circle r="13" fill="#572d2e" stroke="#ff958b" stroke-width="2"/><text y="7" text-anchor="middle" fill="#ffe4dc" font-size="22" font-weight="600">!</text></g>';
 const deviceNodes=nodes.map(node=>part(`1 2 ${systemLayers(node.system)}`,`<g class="ov-topology-ci ov-terrain-device" data-device="${node.id}" data-software="${node.server}" data-system-id="${node.system}" transform="translate(${node.x} ${node.y})"><title>${node.id}: ${node.type}; ICT System ${node.system}${node.server?'; installed software shown':''}</title><circle class="ov-topology-node-face" r="29" fill="#302b27" stroke="${tones.asset}" stroke-width="1.8"/><g fill="none" color="${tones.asset}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ovTopologyGlyph(node.type)}</g>${node.server?`<g class="ov-topology-software"><path d="M18-20 31-35" fill="none" stroke="${tones.network}" stroke-width="2"/><rect x="19" y="-51" width="38" height="29" rx="5" fill="#173e51" stroke="${tones.network}" stroke-width="1.8"/><path d="M25-44h26" stroke="${tones.network}"/><text x="38" y="-29" text-anchor="middle" fill="#d6f3ff" font-size="14" font-family="Consolas,monospace">SW</text></g>`:''}<text x="0" y="49" fill="#f6cfaa" text-anchor="middle" font-size="20" font-weight="600">${node.id}</text>${node.id===findingId?findingBadge:impact?.issue==='device'&&activeDevices.includes(node.id)?impactBadge:''}</g>`,'','asset',activeDevices.includes(node.id))).join('');
 const systemNodes=clusters.map(cluster=>part(systemLayers(cluster.system),`<g class="ov-topology-system" data-system-id="${cluster.system}"><rect class="ov-topology-node-face" x="${cluster.x-92}" y="147" width="184" height="50" rx="10" fill="#163b30" stroke="${tones.system}" stroke-width="1.8"/><text x="${cluster.x}" y="179" text-anchor="middle" fill="#b5f0cc" font-size="23" font-weight="600">ICT System ${cluster.system}</text></g>`,'','context',activeSystems.includes(cluster.system))).join('');
 const networkNodes=clusters.map(cluster=>part('2',`<g class="ov-topology-network" data-network="${cluster.system}"><circle class="ov-topology-node-face" cx="${cluster.x}" cy="280" r="20" fill="#153746" stroke="${tones.network}" stroke-width="1.8"/><path d="M${cluster.x-11} 287L${cluster.x} 269L${cluster.x+11} 287ZM${cluster.x} 269V287" fill="none" stroke="${tones.network}" stroke-width="1.8"/><text x="${cluster.x}" y="246" fill="#a9e4fc" text-anchor="middle" font-size="21" font-weight="550">${cluster.network}</text></g>`,'','network',false)).join('');
 const serviceNodes=services.map(service=>part(`3 ${service.layer}`,`<g class="ov-topology-service" data-service-id="${service.id}"><rect class="ov-topology-node-face" x="${service.x-105}" y="18" width="210" height="58" rx="10" fill="${service.kind==='business'?'#332b3e':'#282d48'}" stroke="${tones[service.kind]}" stroke-width="1.8"/><text x="${service.x}" y="54" fill="${tones[service.kind]}" font-size="20" text-anchor="middle" font-weight="550">${service.label}</text></g>`,'','context',service.systems.some(system=>activeSystems.includes(system)))).join('');
 const selected=nodes.find(node=>node.id===findingId),cluster=clusters.find(cluster=>cluster.system===findingSystem);
 const findingTrace=selected?part('',`<path class="ov-risk-membership" data-device="${findingId}" data-system-id="${findingSystem}" d="M${selected.x-20} ${selected.y-21}V${selected.y-61}H${cluster.x-168}V211H${cluster.x}V197" fill="none" stroke="${tones.system}" stroke-width="3" stroke-linejoin="round"/>`,'','context',true):'';
 const impactTrace=impact?nodes.filter(node=>activeDevices.includes(node.id)).map(node=>{const group=clusters.find(cluster=>cluster.system===node.system);return part('',`<path class="ov-impact-membership" data-device="${node.id}" data-system-id="${node.system}" d="M${node.x-20} ${node.y-21}V${node.y-61}H${group.x-168}V211H${group.x}V197" fill="none" stroke="${tones.system}" stroke-width="3" stroke-linejoin="round"/>`,'','context',true);}).join(''):'';
 const description=impact?`Illustrative issue: ${impact.label}. Highlighted devices and ICT Systems ${activeSystems.join(' and ')} connect to ${services.filter(service=>impact.services.includes(service.id)).map(service=>service.label).join(', ')}. ${impact.issue==='link'?'The D7-to-D3 device link is shown with a gap and an unavailable-link marker; other communication paths remain visible. ':''}Highlighted services need review. This is not a confirmed service outage. `:findingId?`Finding F-01 is on software installed on ${findingId} in the ${cluster.network}. ${findingId} belongs to ICT System ${findingSystem}, which supports ${services.filter(service=>service.systems.includes(findingSystem)).map(service=>service.label).join(' and ')}. The finding marker appears only on the selected device. Highlighted dependencies show context to investigate, not confirmed service impact. `:'';
 const svg=ovSvg(`<defs>${['mission','business'].map(kind=>`<marker id="${markerPrefix}-arrow-${kind}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z" fill="${tones[kind]}"/></marker>`).join('')}</defs><rect width="1200" height="580" rx="12" fill="#102633"/>
 ${clusters.map(cluster=>`<rect class="ov-topology-network-zone" x="${cluster.x-177}" y="220" width="354" height="344" rx="16" fill="#102d3b" fill-opacity=".8" stroke="#315363" stroke-dasharray="5 7"/>`).join('')}
 ${dependency}${membership}${networkLinks}${crossLinks}${deviceLink}${findingTrace}${impactTrace}${serviceNodes}${systemNodes}${networkNodes}${deviceNodes}`, description+'Illustrative topology with 18 device configuration items, three networks, three ICT systems and four services: two mission services and two business services. Operations network contains D1, D2 and D7 to D10 in System A. Enterprise network contains D3, D4 and D11 to D14 in System B. Support network contains D5, D6 and D15 to D18 in System C. Six servers carry blue SW software badges. Business service A depends on System A; Business service B depends on A and B. Mission service A depends on B and C; Mission service B depends on C. Animated blue dashed links show communication. Solid coloured lines show recorded membership or service dependencies. The same recorded terrain supports layer exploration, finding investigation and service impact review.', '0 0 1200 580');
 return `<div class="ov-topology-scroll" role="group" aria-label="${findingId?'Finding F-01 in the example cyber terrain':impact?'Issue trace in the example cyber terrain':'Complete example cyber terrain topology'}. Expand for more detail.">${svg}</div><div class="ov-topology-legend" aria-label="Topology legend">${findingId?'<span><i style="--key:#ff958b"></i>Finding F-01</span>':''}${impact?`<span><i style="--key:${impact.issue==='link'?'#ffe36e':'#ff958b'}"></i>${impact.issue==='link'?'Unavailable link':'Device issue'}</span>`:''}<span><i style="--key:${tones.asset}"></i>Device CI</span><span><i style="--key:${tones.network}"></i>Software / network</span><span><i style="--key:${tones.system}"></i>ICT system</span><span><i style="--key:${tones.mission}"></i>Mission service</span><span><i style="--key:${tones.business}"></i>Business service</span></div><p class="ov-topology-note">Dashed lines: communication. Solid lines: membership and dependencies. 18 example CIs across three networks.</p>`;
}
function ovTerrainArt() {return ovTopologyArt();}
const ovRiskExamples=Object.fromEntries(['D1','D3','D5'].map(id=>{
 const cluster=ovTopologyClusters.find(cluster=>cluster.ids.includes(id));
 const services=ovTopologyServices.filter(service=>service.systems.includes(cluster.system));
 return [id,{system:cluster.system,network:cluster.network,services:services.map(service=>service.id),serviceText:services.map(service=>service.label).join(' and ')}];
}));
function ovRiskTrace(id='D3') {
 return Object.entries(ovRiskExamples).map(([key,item])=>`<div class="ov-risk-trace-option${key===id?' is-active':''}" aria-hidden="${key!==id}"><strong>F-01 &#8594; ${key} &#8594; ICT System ${item.system}</strong><p>In the ${item.network}, ${key}'s recorded system membership connects it to ${item.serviceText}. These dependencies need review; they do not confirm a service impact.</p></div>`).join('');
}
function ovVulnerabilityArt(id='D3') {return ovTopologyArt({findingId:id});}
const ovServiceScenarios=[
 {devices:['D1'],issue:'device',label:'Device D1 needs attention'},
 {devices:['D5'],issue:'device',label:'Device D5 needs attention'},
 {devices:['D7','D3'],issue:'link',label:'The D7-to-D3 device link is unavailable'}
].map(scenario=>{
 const systems=scenario.systems||ovTopologyClusters.filter(cluster=>scenario.devices.some(id=>cluster.ids.includes(id))).map(cluster=>cluster.system);
 const devices=scenario.devices||ovTopologyClusters.filter(cluster=>systems.includes(cluster.system)).flatMap(cluster=>cluster.ids);
 return {...scenario,systems,devices,services:ovTopologyServices.filter(service=>service.systems.some(system=>systems.includes(system))).map(service=>service.id)};
});
function ovServiceSummary(index=0) {return ovServiceScenarios[index].services.length+' services to review';}
function ovServiceReview(index=0) {
 const scenario=ovServiceScenarios[index];
 return ovTopologyServices.map(service=>{const related=scenario.services.includes(service.id);return `<li class="ov-impact-service-card" data-review-service="${service.id}" data-related="${related}" style="--service-tone:${ovTopologyTones[service.kind]}"><strong>${service.label}</strong><span>${related?'Review dependency':'Outside this trace'}</span><small>${service.systems.length>1?'Systems':'System'} ${service.systems.join(' + ')}</small></li>`;}).join('');
}
function ovServiceImpactArt(index=0) {return ovTopologyArt({impact:ovServiceScenarios[index]});}
function ovServiceWorkbench() {
 return `<div class="ov-service-workbench">${ovExplorePanel(ovOptions(ovSection('services').options),'service','Choose a starting issue')}<div class="ov-service-result"><div class="ov-visual ov-impact-visual ov-topology-visual" data-service="0" data-impact-issue="device">${ovExpandButton('services')}<div id="ov-service-graphic">${ovServiceImpactArt()}</div></div><div class="ov-impact-outcomes"><h4 data-ov-service-summary aria-live="polite">${ovServiceSummary()}</h4><ul id="ov-service-review" aria-label="Service dependency review">${ovServiceReview()}</ul><p>Highlighted dependencies show potential impact. Confirm alternative paths and the current service state with the service owner.</p></div></div></div>`;
}
const ovReportStageMs=2500,ovReportDuration=10000;
function ovReportModel(index=0,scope='all',focus='all') {
 const records=['D1','D2','D3','D4','D5','D6'].map((id,i)=>({id,system:['A','B','C'][Math.floor(i/2)],software:i%2===0}));
 const scoped=records.filter(record=>scope==='all'||record.system===scope),matched=scoped.filter(record=>focus==='all'||record.id===focus);
 const included=index===1?scoped:matched,systems=[...new Set(included.map(record=>record.system))];
 const services=ovTopologyServices.filter(service=>service.systems.some(system=>systems.includes(system)));
 return {records,scoped,matched,included,systems,services};
}
function ovReportSummary(index=0,scope='all',focus='all') {
 const count=ovReportModel(index,scope,focus).included.length;
 return ['Filtered Excel','Briefing PDF','Impact PDF'][index]+' / '+count+' '+(index===2?'starting CI'+(count===1?'':'s'):index===1?'device'+(count===1?'':'s')+' in scope':'matching record'+(count===1?'':'s'));
}
function ovReportSteps(index=0,scope='all',focus='all') {
 const model=ovReportModel(index,scope,focus),name=scope==='all'?'Systems A, B and C':'System C',search=focus==='all'?'all devices':'D5';
 return [
  [{label:'Select terrain',body:`Begin with ${name} in the loaded snapshot.`},{label:'Apply search',body:`Search for ${search} keeps ${model.matched.length} matching record${model.matched.length===1?'':'s'} within that scope.`},{label:'Build Excel',body:'Matching rows flow into Excel, including every matching Explorer page.'},{label:'Ready to share',body:`Share ${model.included.length} matching record${model.included.length===1?'':'s'} with the scope, snapshot and filters.`}],
  [{label:'Select terrain',body:`Start with ${name} and the loaded snapshot.`},{label:'Keep header scope',body:`Keep all ${model.scoped.length} devices in scope. Explorer search does not narrow the PDF.`},{label:'Build briefing',body:'Build a summary from the scoped devices and supporting context.'},{label:'Ready to share',body:`The briefing includes all ${model.scoped.length} devices in scope, even when Explorer search shows fewer.`}],
  [{label:'Choose starting CIs',body:`Use the ${model.included.length} matching device${model.included.length===1?'':'s'} to start the trace.`},{label:'Trace relationships',body:'Follow devices to their ICT systems and dependent mission or business services.'},{label:'Build evidence',body:'Package the full traced graph and supporting evidence using the selected graph mode and layout.'},{label:'Ready to share',body:'Share the trace and evidence. Recorded dependencies do not prove a service outage.'}]
 ][index];
}
function ovReportReading(index=0,scope='all',focus='all') {
 const count=ovReportModel(index,scope,focus).included.length, rules=['Uses the header scope and Explorer filters. Every matching row is included across all pages; pagination only changes the view.','Uses the applied header scope and loaded snapshot. Explorer search does not narrow this PDF. Keep the Security Domain with the shared report.','Uses the chosen starting CIs, graph mode and layout. The full traced graph and supporting evidence explain why a service appears in the report.'];
 return `<div class="ov-report-explanation" data-report-count="${count}">${[0,1,2].map(choice=>`<div class="ov-report-rule-option${choice===index?' is-active':''}" aria-hidden="${choice!==index}"><strong>${['Excel: scope and Explorer filters','Briefing: header scope and snapshot','Impact: full trace and evidence'][choice]}</strong><p>${ovEscape(rules[choice])}</p></div>`).join('')}</div>`;
}
function ovReportCaptions(index=0,scope='all',focus='all') {
 return [0,1,2].flatMap(choice=>ovReportSteps(choice,scope,focus).map((step,i)=>`<div class="ov-report-caption${choice===index&&i===0?' is-active':''}" data-report-caption="${choice}-${i}" aria-hidden="${choice!==index||i!==0}"><strong>${step.label}</strong><p>${ovEscape(step.body)}</p></div>`)).join('');
}
function ovReportingArt(index=0,scope='all',focus='all') {
 const model=ovReportModel(index,scope,focus),tone=['#79e2d2','#8edcff','#c7b7ff'][index],scopeName=scope==='all'?'All three ICT systems':'ICT System C';
 const positions=Object.fromEntries(model.records.map((record,i)=>[record.id,{x:82+Math.floor(i/2)*104,y:143+(i%2)*134}]));
 const card=(x,y,w,h,stroke='#365563',fill='#102633')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
 const text=(x,y,label,size=20,fill='#bad0da',anchor='start')=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}">${ovEscape(label)}</text>`;
 const transfer=(record,start,end,phase,order=0)=>`<g class="ov-report-transfer" data-report-transfer="${phase}" data-start-x="${start.x}" data-start-y="${start.y}" data-end-x="${end.x}" data-end-y="${end.y}" data-order="${order}" transform="translate(${start.x} ${start.y})" opacity="0"><rect x="-22" y="-15" width="44" height="30" rx="7" fill="#21453e" stroke="${tone}"/><text y="7" text-anchor="middle" fill="#e0f7ef" font-size="20">${record.id}</text></g>`;
 const records=model.records.map(record=>{const pos=positions[record.id],inScope=model.scoped.includes(record);return `<g class="ov-report-source-record" data-in-scope="${inScope}" data-included="${model.included.includes(record)}" data-device="${record.id}" transform="translate(${pos.x} ${pos.y})"><circle r="25" fill="#302b27" stroke="#f6aa63" stroke-width="1.8"/><g fill="none" stroke="#f6aa63" stroke-width="1.5">${ovTopologyGlyph(record.software?'Server':'Workstation')}</g>${record.software?'<rect x="18" y="-40" width="29" height="21" rx="4" fill="#173e51" stroke="#8edcff"/><text x="32" y="-25" font-size="12" fill="#bdeaff" text-anchor="middle">SW</text>':''}<text y="47" text-anchor="middle" fill="#f6c493" font-size="22">${record.id}</text><text y="70" text-anchor="middle" fill="#9dbac7" font-size="17">System ${record.system}</text></g>`;}).join('');
 const chips=(items,y)=>items.map((record,i)=>`<g class="ov-report-record" data-device="${record.id}" data-report-reveal="${i}" transform="translate(${860+(i%3)*95} ${y+Math.floor(i/3)*36})" opacity="0"><rect width="79" height="31" rx="6" fill="#1b3c47" stroke="${tone}"/><text x="39" y="23" text-anchor="middle" fill="#f6c493" font-size="21">${record.id}</text></g>`).join('');
 let middle='',output='',flights='',traces='';
 if(index===0){
  middle=card(420,94,320,54,'#699caa','#173641')+text(580,128,focus==='all'?'Explorer: all devices':'Explorer search: D5',23,'#bceafa','middle');
  middle+=model.scoped.map((record,i)=>`<g class="ov-report-candidate" data-matched="${model.matched.includes(record)}" transform="translate(420 ${166+i*32})"><rect width="320" height="28" rx="5" fill="#1d3b43"/><text x="18" y="22" fill="#f6c493" font-size="22">${record.id}</text><text x="150" y="22" fill="#b5e2c9" font-size="20">System ${record.system}</text></g>`).join('');
  middle+=text(580,374,'Keep every matching row',19,'#a8daca','middle');
  output=text(858,124,'Device',18,tone)+text(955,124,'System',18,tone)+text(1065,124,'Software',18,tone);
  output+=model.included.map((record,i)=>`<g class="ov-report-record" data-device="${record.id}" data-report-reveal="${i}" transform="translate(850 ${140+i*32})" opacity="0"><rect width="314" height="28" rx="5" fill="${i%2?'#18333f':'#132c38'}"/><text x="12" y="23" fill="#f6c493" font-size="22">${record.id}</text><text x="112" y="23" fill="#b6e9cb" font-size="22">${record.system}</text><text x="219" y="23" fill="#b6d6e6" font-size="18">${record.software?'SW':'-'} </text></g>`).join('');
  output+=text(1007,374,'Across all Explorer pages',18,'#a8daca','middle');
  flights=model.scoped.map((record,i)=>transfer(record,positions[record.id],{x:450,y:185+i*32},1,i)).join('')+model.included.map((record,i)=>transfer(record,{x:450,y:185+model.scoped.indexOf(record)*32},{x:880,y:160+i*32},2,i)).join('');
 }else if(index===1){
  middle=card(420,99,320,68,'#70e3a1','#163b30')+text(580,126,'Header scope',22,'#b5f0cc','middle')+text(580,153,scopeName,22,'#d2e8df','middle')+card(420,194,320,64,'#699caa','#173641')+text(580,222,'Loaded snapshot',23,'#bceafa','middle')+text(580,247,'Same saved observations',18,'#b0c9d2','middle')+`<g class="ov-report-search-bypass">${card(420,290,320,66,'#446573')}<path d="M438 330H722" stroke="#446573" stroke-dasharray="4 6"/>${text(580,315,focus==='all'?'Explorer: all devices':'Explorer search: D5',20,'#96b4bf','middle')}${text(580,346,'Does not narrow this PDF',19,'#bceafa','middle')}</g>`;
  output=`<g data-report-reveal="0" opacity="0"><text x="1007" y="160" fill="${tone}" font-size="46" text-anchor="middle" data-report-total="${model.scoped.length}">0</text>${text(1007,191,'devices in the header scope',19,'#c0d7df','middle')}</g>`;
  output+=['A','B','C'].map((system,i)=>{const count=model.scoped.filter(record=>record.system===system).length;return `<g data-report-reveal="${i}" opacity="0">${text(850,234+i*27,'System '+system,17)}<rect x="947" y="217" width="0" height="18" rx="4" fill="${tone}" transform="translate(0 ${i*27})" data-report-bar="${count*78}"/>${text(1132,234+i*27,String(count),18,tone)}</g>`;}).join('');
  output+=chips(model.included,313);
  flights=model.scoped.map((record,i)=>transfer(record,positions[record.id],{x:580,y:149},1,i)+transfer(record,{x:580,y:149},{x:899+(i%3)*95,y:328+Math.floor(i/3)*36},2,i)).join('');
 }else{
  const systemY=system=>model.systems.length===1?231:129+model.systems.indexOf(system)*197/(model.systems.length-1);
  const serviceY=service=>model.services.length===1?231:129+model.services.indexOf(service)*203/(model.services.length-1);
  traces=model.services.flatMap(service=>service.systems.filter(system=>model.systems.includes(system)).map((system,i)=>`<path class="ov-report-trace-edge" data-system-id="${system}" data-service-id="${service.id}" d="M515 ${systemY(system)}C550 ${systemY(system)} 550 ${serviceY(service)} 590 ${serviceY(service)}" fill="none" stroke="${service.kind==='business'?'#efb8dc':'#c7b7ff'}" stroke-width="2.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`)).join('');
  middle=traces+model.systems.map(system=>`${card(407,systemY(system)-25,108,50,'#70e3a1','#163b30')}${text(461,systemY(system)+7,'System '+system,20,'#b5f0cc','middle')}`).join('')+model.services.map(service=>`<g class="ov-report-traced-service" data-service-id="${service.id}">${card(590,serviceY(service)-25,160,50,service.kind==='business'?'#efb8dc':'#c7b7ff','#282d48')}${text(670,serviceY(service)-3,service.kind==='business'?'Business':'Mission',19,'#e5dcf3','middle')}${text(670,serviceY(service)+18,'service '+service.label.slice(-1),20,'#e5dcf3','middle')}</g>`).join('');
  output=`<g data-report-reveal="0" opacity="0">${text(850,130,model.included.length+' starting CI'+(model.included.length===1?'':'s'),23,'#f6c493')}${text(850,161,model.systems.length+' ICT system'+(model.systems.length===1?'':'s'),23,'#b5f0cc')}${text(850,192,model.services.length+' dependent services',23,tone)}${text(850,239,'Full traced graph',22,'#e2e9ed')}${text(850,268,'+ supporting evidence',21,'#b7cdd5')}<path d="M886 285H998M998 285L1110 274M998 285L1110 296" fill="none" stroke="${tone}" stroke-width="2.5"/>${[[886,285,'#f6aa63'],[998,285,'#70e3a1'],[1110,274,'#c7b7ff'],[1110,296,'#c7b7ff']].map(([x,y,color])=>`<circle cx="${x}" cy="${y}" r="9" fill="#152d3a" stroke="${color}" stroke-width="2"/>`).join('')}</g>`+chips(model.included,317);
  flights=model.included.map((record,i)=>transfer(record,positions[record.id],{x:461,y:systemY(record.system)},1,i)+transfer(record,{x:670,y:231},{x:899+(i%3)*95,y:332+Math.floor(i/3)*36},2,i)).join('');
 }
 return ovSvg(`<rect width="1200" height="420" rx="12" fill="#0d2330"/>${text(185,30,'Selected terrain',23,'#c4dce3','middle')}${text(580,30,['Apply Explorer search','Keep the header scope','Trace dependencies'][index],23,tone,'middle')}${text(1007,30,'Create the output',23,tone,'middle')}${card(20,56,325,330)}${card(395,56,370,330)}${card(830,56,355,330,tone)}${text(182,87,'Six illustrative records',19,'#aac4ce','middle')}${records}<g class="ov-report-processing">${middle}</g>${text(1007,88,['Filtered Excel','Briefing PDF','Impact PDF'][index],27,tone,'middle')}<g class="ov-report-output">${output}</g><g class="ov-report-output-placeholder">${text(1007,231,'The output builds here',22,'#7697a6','middle')}</g><g fill="none" stroke="${tone}" stroke-width="2"><path d="M350 231H387m-8-6 8 6-8 6"/><path d="M773 231H822m-8-6 8 6-8 6"/></g>${flights}<g class="ov-report-context-note">${text(600,413,scopeName+' / loaded snapshot / illustrative subset of the terrain',18,'#98b8c5','middle')}</g>`, ovReportSummary(index,scope,focus)+'. '+ovReportSteps(index,scope,focus)[3].body, '0 0 1200 420');
}
function ovReportingWorkbench() {
 const choices=[{question:'Matching records',format:'Filtered Excel'},{question:'Scoped summary',format:'Briefing PDF'},{question:'Dependency evidence',format:'Impact PDF'}];
 return `<div class="ov-report-workbench ov-report-guide" data-report="0" data-report-scope="all" data-report-focus="all" data-report-playback="waiting">
  <div class="ov-report-config"><div class="ov-report-choices" role="group" aria-label="Choose a reporting animation">${choices.map((choice,index)=>`<button type="button" data-ov-report="${index}" aria-pressed="${index===0}" aria-controls="ov-report-graphic ov-report-detail"><strong>${choice.format}</strong><span>${choice.question}</span></button>`).join('')}</div>
  <div class="ov-report-filters"><fieldset><legend>ICT system scope</legend><div>${[['all','All 3 systems'],['C','System C']].map(([value,label])=>`<button type="button" data-ov-report-scope="${value}" aria-pressed="${value==='all'}" aria-controls="ov-report-graphic ov-report-detail">${label}</button>`).join('')}</div></fieldset><fieldset><legend>Explorer search</legend><div>${[['all','All devices'],['D5','Device D5']].map(([value,label])=>`<button type="button" data-ov-report-focus="${value}" aria-pressed="${value==='all'}" aria-controls="ov-report-graphic ov-report-detail">${label}</button>`).join('')}</div></fieldset></div></div>
  <div class="ov-report-player">
   <div class="ov-report-player-heading"><h3 data-ov-report-summary>${ovReportSummary()}</h3>${ovExpandButton('reporting').replace('<span>Expand diagram</span>','<span>Expand frame</span>')}</div>
   <div class="ov-visual ov-report-visual" data-report-step="0" data-report-running="false"><div id="ov-report-graphic" role="region" aria-label="Animated example report">${ovReportingArt()}</div></div>
   <div class="ov-report-playback"><div class="ov-report-transport" role="group" aria-label="Report animation playback"><button type="button" data-ov-report-play aria-label="Pause report animation">Pause</button><button type="button" data-ov-report-replay>Replay</button><span data-ov-report-status>Plays when in view</span></div><div class="ov-report-steps" role="group" aria-label="Report animation steps">${ovReportSteps().map((step,i)=>`<button type="button" data-ov-report-step="${i}" aria-pressed="${i===0}" aria-controls="ov-report-graphic ov-report-caption"><small>${i+1}</small><span>${step.label}</span></button>`).join('')}</div></div>
   <div class="ov-report-progress" role="progressbar" aria-label="Report animation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div id="ov-report-caption" aria-live="polite" aria-atomic="true">${ovReportCaptions()}</div>
  </div>
  <details class="ov-report-notes"><summary>Report rules and sharing</summary><div class="ov-report-notes-content"><div id="ov-report-detail" class="ov-live-detail">${ovReportReading()}</div><div class="ov-report-share"><p>Keep the selected scope, Security Domain, snapshot and relevant filters with the output.</p><div class="ov-report-links">${link('topic/exports','Reporting and downloads')}${link('topic/scope','Scope and snapshots')}</div></div></div></details>
 </div>`;
}
function ovShadowReading(index=0,revealed=false) {
 return ovSection('shadow').options.flatMap((scenario,i)=>[false,true].map(shown=>`<div class="ov-shadow-reading-option${i===index&&shown===revealed?' is-active':''}" data-shadow-reading="${i}-${shown}" aria-hidden="${i!==index||shown!==revealed}"><strong>${ovEscape(shown?scenario.revealedTitle:scenario.title)}</strong><p>${ovEscape(shown?scenario.revealedBody:scenario.body)}</p></div>`)).join('');
}
function ovShadowArt(index=0) {
 const scenario=ovSection('shadow').options[index],scan=index===2,network=index===1;
 const orange='#f6aa63',blue='#8edcff',amber='#ffe0a0';
 const node=(x,y,id,type,software=false,source=false)=>`<g class="ov-terrain-device ov-shadow-known-device" data-device="${id}" data-device-type="${type}" data-observer="${source}" transform="translate(${x} ${y})"><title>${id}: known ${type}${source?'; source of the communication observation':''}</title>${source?`<circle r="43" fill="none" stroke="${blue}" stroke-width="2.5"/>`:''}<circle r="29" fill="#302b27" stroke="${orange}" stroke-width="1.8"/><g fill="none" stroke="${orange}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${type==='Router'?'<path d="M-20-10h40v22h-40ZM-14-2h28m-28 6h28M-8-16h16m-3-3 3 3-3 3M8 18H-8m3-3-3 3 3 3"/>':ovTopologyGlyph(type==='Computer'?'Workstation':type)}</g>${software?`<g class="ov-topology-software"><path d="M18-20 31-35" fill="none" stroke="${blue}" stroke-width="2"/><rect x="19" y="-51" width="38" height="29" rx="5" fill="#173e51" stroke="${blue}" stroke-width="1.8"/><text x="38" y="-29" text-anchor="middle" fill="#d6f3ff" font-size="14" font-family="Consolas,monospace">SW</text></g>`:''}<text y="65" text-anchor="middle" fill="${orange}" font-size="23" font-weight="550">${id}</text>${scan?`<text y="93" text-anchor="middle" fill="#b4ccd5" font-size="20">${type}</text>`:''}</g>`;
 const source=network?'ND1':'D3';
 const points=[{id:'D1',x:160,y:250,type:'Server',software:true},{id:'D2',x:160,y:400,type:'Computer'},{id:source,x:405,y:250,type:network?'Router':'Server',software:!network},{id:'D4',x:405,y:400,type:'Computer'},{id:'D5',x:650,y:250,type:'Server',software:true},{id:'D6',x:650,y:400,type:'Computer'}];
 const known=scan?`<rect x="40" y="80" width="740" height="148" rx="14" fill="#153340" stroke="${blue}"/><g transform="translate(110 150)" fill="none" stroke="${blue}" stroke-width="2.5"><rect x="-34" y="-30" width="68" height="56" rx="8"/><path d="M-22-14h44M-22-2h27M-22 10h18"/><circle cx="18" cy="16" r="12"/><path d="m27 25 13 13"/></g><text x="175" y="140" fill="${blue}" font-size="27" font-weight="600">CMDB discovery</text><text x="175" y="180" fill="#b4ccd5" font-size="23">Scan the configured IP range</text><path class="ov-flow-line" d="M405 228V286" fill="none" stroke="${blue}" stroke-width="2.6" stroke-dasharray="5 12"/><rect x="40" y="284" width="740" height="235" rx="14" fill="#102b39" stroke="#365c70"/><text x="65" y="320" fill="${blue}" font-size="22" font-family="Consolas,monospace">192.0.2.1 - 192.0.2.254</text><text x="65" y="353" fill="#b4ccd5" font-size="20">Examples the scan can classify</text>${[['192.0.2.10','Server'],['192.0.2.20','Computer'],['192.0.2.30','Printer'],['192.0.2.1','Router']].map(([id,type],i)=>node(135+i*180,408,id,type)).join('')}`:
 `<rect x="40" y="80" width="740" height="439" rx="14" fill="#102b39" stroke="#365c70"/><text x="65" y="118" fill="${blue}" font-size="22" font-family="Consolas,monospace">KNOWN RECORDS / NETWORK CONTEXT</text><text x="65" y="151" fill="#b4ccd5" font-size="20">${network?'ND1 is a known network device':'D3 belongs to ICT System B'}</text><g fill="none" stroke="${blue}" stroke-width="2" stroke-dasharray="5 12">${[[0,2],[2,4],[0,1],[2,3],[4,5],[1,3],[3,5]].map(([a,b])=>`<path class="ov-flow-line" d="M${points[a].x} ${points[a].y}L${points[b].x} ${points[b].y}"/>`).join('')}</g>${points.map(point=>node(point.x,point.y,point.id,point.type,point.software,point.id===source)).join('')}`;
 const observed=scan?'Discovery result':'Observed communication';
 const connection=scan?'M780 153H855V236H912':'M405 207V180H855V236H912';
 const unknownLabel=scan?'Unclassified address':'Unmatched address';
 return ovSvg(`<text x="40" y="40" fill="${blue}" font-family="Consolas,monospace" font-size="22">${scan?'CMDB DISCOVERY / DEVICE TYPE UNKNOWN':network?'NETWORK DEVICE / UNMATCHED ADDRESS':'ENDPOINT OBSERVATION / UNMATCHED ADDRESS'}</text>${known}<g class="ov-unmatched-link"><path class="ov-flow-line" d="${connection}" fill="none" stroke="${blue}" stroke-width="2.6" stroke-dasharray="5 12"/><text x="1020" y="122" text-anchor="middle" fill="${blue}" font-size="22">${observed}</text></g><g class="ov-unmatched" data-unknown-address="${scenario.address}" data-unknown-kind="${scan?'unclassified':'unmatched'}"><rect x="915" y="180" width="210" height="112" rx="16" fill="#29323a" stroke="${amber}" stroke-width="2.4" stroke-dasharray="6 5"/><text x="1020" y="259" fill="${amber}" text-anchor="middle" font-size="66" font-weight="300">?</text><text x="1020" y="337" text-anchor="middle" fill="${amber}" font-size="24">${unknownLabel}</text><text x="1020" y="376" text-anchor="middle" fill="#e5d0a9" font-size="24" font-family="Consolas,monospace">${scenario.address}</text><text x="1020" y="414" text-anchor="middle" fill="#c5d6dc" font-size="21">${scan?'Device type unknown':'Identity not yet matched'}</text>${scan?'<text x="1020" y="455" text-anchor="middle" fill="#b4ccd5" font-size="20">Server? Computer?</text><text x="1020" y="484" text-anchor="middle" fill="#b4ccd5" font-size="20">Printer? Router?</text>':''}</g><text x="600" y="557" text-anchor="middle" fill="#b4ccd5" font-size="21">${scan?'Detection confirms an address was found; it does not establish its device type.':source+' is the known source. The unmatched address is a separate endpoint.'}</text>`, `Illustrative ${scenario.label.toLowerCase()}. ${scenario.body} ${scenario.revealedBody} Addresses are examples.`, '0 0 1200 580');
}
function ovShadowWorkbench() {
 const scenarios=ovSection('shadow').options;
 return `<div class="ov-shadow-workbench"><div class="ov-explore-panel"><p class="ov-explore-prompt">Explore how the unknown is found</p><div class="ov-shadow-scenarios" role="group" aria-label="Choose a Shadow IT scenario">${scenarios.map((scenario,index)=>`<button type="button" data-ov-shadow-scenario="${index}" aria-pressed="${index===0}" aria-controls="ov-shadow-graphic ov-shadow-detail"><small>${String(index+1).padStart(2,'0')}</small><span>${ovEscape(scenario.label)}</span></button>`).join('')}</div><button type="button" class="ov-reveal-button" data-ov-shadow aria-pressed="false" aria-controls="ov-shadow-graphic ov-shadow-detail">${icon('scan',18)}<span>${scenarios[0].revealLabel}</span></button><div id="ov-shadow-detail" class="ov-live-detail ov-shadow-detail-grid" aria-live="polite" aria-atomic="true">${ovShadowReading()}</div></div><div class="ov-visual ov-shadow-visual ov-topology-visual" data-shadow="hidden" data-shadow-scenario="0">${ovExpandButton('shadow')}<div id="ov-shadow-graphic" class="ov-topology-scroll">${ovShadowArt()}</div><p class="ov-topology-note">Illustrative records and example IP addresses. An unmatched or unclassified address is a lead to investigate, not proof of malicious activity.</p></div></div>`;
}
function ovFilmButton(section) {if(!section.video)return '';return `<button type="button" class="ov-film-button" data-overview-video="${ovEscape(section.id)}" aria-label="Watch Video: ${ovEscape(section.title)}, ${Number(section.video?.duration || 24)} seconds" aria-haspopup="dialog" aria-controls="overview-video-dialog"><span class="ov-play" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg></span><span>Watch Video<small>${Number(section.video?.duration || 24)} sec</small></span></button>`;}
function ovCopy(section,additional='') {const heading=section.parent?'h3':'h2';return `<div class="ov-copy"><p class="ov-kicker"><span>${ovEscape(section.number)}</span>${ovEscape(section.kicker)}</p><${heading} id="ov-title-${ovEscape(section.id)}" tabindex="-1">${ovEscape(section.title)}</${heading}><p class="ov-lead">${ovEscape(section.lead)}</p><div class="ov-body">${ovParagraphs(section.body)}</div>${additional}${ovFilmButton(section)}</div>`;}
function ovTakeaway(section) {return section.takeaway?`<p class="ov-takeaway"><span aria-hidden="true">↳</span>${ovEscape(section.takeaway)}</p>`:'';}
function ovControls(items,kind,label) {return `<div class="ov-controls" role="group" aria-label="${ovEscape(label)}">${items.map((item,index)=>`<button type="button" data-ov-${kind}="${index}" aria-pressed="${index===0}" aria-controls="ov-${kind}-detail"><span class="ov-control-dot" aria-hidden="true"></span>${ovEscape(item.label || item.title)}</button>`).join('')}</div>`;}
function ovExplorePanel(items,kind,prompt,beforeControls='') {
 const detail=['layer','risk','service'].includes(kind)?items.map((item,index)=>`<div class="ov-layer-description${index===0?' is-active':''}" data-${kind}-description="${index}" aria-hidden="${index!==0}">${ovDetail(item)}</div>`).join(''):ovDetail(items[0]);
 return `<div class="ov-explore-panel"><p class="ov-explore-prompt">${ovEscape(prompt)}</p>${beforeControls}${ovControls(items,kind,prompt)}<div id="ov-${kind}-detail" class="ov-live-detail" aria-live="polite" aria-atomic="true">${detail}</div></div>`;
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
 const sections=overviewContent.sections.filter(section=>!section.parent),layers=ovOptions(overviewContent.layers),risk=ovOptions(ovSection('vulnerabilities').options),service=ovOptions(ovSection('services').options),benefits=ovOptions(overviewContent.benefits),timeline=overviewContent.timeline;
 const what=ovSection('what'),origins=ovSection('origins'),terrain=ovSection('terrain'),investigate=ovSection('investigate'),vulnerabilities=ovSection('vulnerabilities'),shadow=ovSection('shadow'),services=ovSection('services'),reporting=ovSection('reporting'),benefit=ovSection('benefits');
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
 ${ovCopy(terrain)}<div class="ov-terrain-workbench">${ovExplorePanel(layers,'layer','Select a layer to see how it contributes')}<div class="ov-visual ov-terrain-visual ov-topology-visual" data-layer="0">${ovExpandButton('terrain')}${ovTerrainArt()}</div></div>${ovTakeaway(terrain)}</section>
 <section class="ov-section ov-investigate" id="ov-investigate" data-ov-section="investigate" aria-labelledby="ov-title-investigate">
 <div class="ov-investigate-intro">${ovCopy(investigate)}${ovInvestigationStory()}</div>
 <section class="ov-section ov-subsection ov-vulnerabilities" id="ov-vulnerabilities" data-ov-subsection="vulnerabilities" aria-labelledby="ov-title-vulnerabilities">
 ${ovCopy(vulnerabilities)}<div class="ov-risk-workbench">${ovExplorePanel(risk,'risk','Follow the finding through the terrain',`<div class="ov-risk-device-picker"><span id="ov-risk-picker-label">Finding F-01 on software</span><div role="group" aria-labelledby="ov-risk-picker-label">${Object.keys(ovRiskExamples).map(id=>`<button type="button" data-ov-risk-device="${id}" aria-pressed="${id==='D3'}" aria-controls="ov-risk-graphic ov-risk-trace">${id}</button>`).join('')}</div></div>`)}<div class="ov-visual ov-risk-stage ov-topology-visual" data-risk="0" data-risk-device="D3">${ovExpandButton('vulnerabilities')}<div id="ov-risk-graphic">${ovVulnerabilityArt()}</div><div id="ov-risk-trace" class="ov-risk-trace-detail" aria-live="polite" aria-atomic="true">${ovRiskTrace()}</div></div></div>${ovTakeaway(vulnerabilities)}</section>
 <section class="ov-section ov-subsection ov-shadow" id="ov-shadow" data-ov-subsection="shadow" aria-labelledby="ov-title-shadow">
 ${ovCopy(shadow)}${ovShadowWorkbench()}${ovTakeaway(shadow)}</section>
 <section class="ov-section ov-subsection ov-services" id="ov-services" data-ov-subsection="services" aria-labelledby="ov-title-services">
 ${ovCopy(services)}${ovServiceWorkbench()}${ovTakeaway(services)}</section>
 </section>
 <section class="ov-section ov-reporting" id="ov-reporting" data-ov-section="reporting" aria-labelledby="ov-title-reporting">
 <div class="ov-section-top">${ovCopy(reporting)}</div>${ovReportingWorkbench()}</section>
 <section class="ov-section ov-benefits" id="ov-benefits" data-ov-section="benefits" aria-labelledby="ov-title-benefits">
 <div class="ov-section-top">${ovCopy(benefit)}</div><div class="ov-benefit-grid" role="group" aria-label="Explore TSAAT benefits">${benefits.map((item,index)=>`<button type="button" data-ov-benefit="${index}" aria-pressed="${index===0}" aria-controls="ov-benefit-detail"><span class="ov-benefit-number">${String(index+1).padStart(2,'0')}</span><strong>${ovEscape(item.label)}</strong><span class="ov-benefit-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><div id="ov-benefit-detail" class="ov-live-detail ov-benefit-detail" aria-live="polite" aria-atomic="true">${ovDetail(benefits[0])}</div>${ovTakeaway(benefit)}<div class="ov-next"><div><p class="ov-eyebrow">MAKE IT PRACTICAL</p><h3>Now explore the tool.</h3><p>Turn the overview into a first step.</p></div><div>${link('feature-guide','Open the Feature Guide '+icon('arrow',18),'button primary')}${link('practice','Try the practice lab '+icon('ne',16),'button secondary')}</div></div></section>
 <div class="ov-ending"><span>TSAAT</span><p>${ovEscape(overviewContent.sourceNote)}</p><button type="button" data-ov-jump="what">Back to the beginning ↑</button></div>
 <dialog id="overview-diagram-dialog" class="ov-diagram-dialog" aria-labelledby="ov-diagram-title"><div class="ov-diagram-heading"><div><p class="ov-eyebrow">EXPLORE THE DETAIL</p><h2 id="ov-diagram-title"></h2></div><button type="button" data-ov-close-diagram aria-label="Close diagram">${icon('close',22)}</button></div><div class="ov-diagram-zoom" role="group" aria-label="Diagram zoom"><button type="button" data-ov-zoom="out" aria-label="Zoom out">&minus;</button><output id="ov-diagram-scale" aria-live="polite">100%</output><button type="button" data-ov-zoom="in" aria-label="Zoom in">+</button><button type="button" data-ov-zoom="fit">Fit to view</button><span>Zoom in to inspect detail.</span></div><div id="ov-diagram-canvas" class="ov-diagram-canvas" tabindex="0" role="region" aria-label="Diagram fitted to view; zoom in to inspect and scroll"></div><p class="ov-diagram-caption">This is your selected view. Close the diagram to change its controls.</p></dialog>
 <dialog id="overview-video-dialog" class="ov-video-dialog" aria-labelledby="overview-film-title"><div class="ov-video-heading"><div><p class="ov-eyebrow">OVERVIEW VIDEOS</p><h2 id="overview-film-title"></h2></div><button type="button" class="ov-close-video" data-ov-close-video aria-label="Close video">${icon('close',24)}</button></div><div class="ov-film-frame"><video id="overview-film" controls playsinline preload="none"></video></div><p class="ov-film-status" role="status"></p><details class="ov-film-transcript"><summary>Read the video transcript</summary><div></div></details></dialog>
 </div>`;
}
function disposeOverview() {
 const r=overviewRuntime;if(!r)return;
 r.abort.abort();r.investigation?.dispose();r.observer?.disconnect();r.reportObserver?.disconnect();cancelAnimationFrame(r.scrollFrame);cancelAnimationFrame(r.reportFrame);
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
  if(motion.matches&&r.paintReport){r.reportElapsed=ovReportDuration;r.reportIntent=false;r.reportManual=true;r.paintReport();}
  r.syncReportPlayback?.();r.investigation?.motionChanged();
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
 const updateShadow=(index,revealed=false)=>{
  const scenario=ovSection('shadow').options[index];if(!scenario)return;
  const host=root.querySelector('.ov-shadow-visual'),button=root.querySelector('[data-ov-shadow]');
  host.dataset.shadowScenario=String(index);host.dataset.shadow=revealed?'revealed':'hidden';
  root.querySelectorAll('[data-ov-shadow-scenario]').forEach(item=>item.setAttribute('aria-pressed',String(Number(item.dataset.ovShadowScenario)===index)));
  button.setAttribute('aria-pressed',String(revealed));button.querySelector('span').textContent=revealed?'Hide the result':scenario.revealLabel;
  root.querySelector('#ov-shadow-graphic').innerHTML=ovShadowArt(index);
  root.querySelector('#ov-shadow-detail').innerHTML=ovShadowReading(index,revealed);
 };
 const reportHost=root.querySelector('.ov-report-workbench'),reportVisual=root.querySelector('.ov-report-visual');
 Object.assign(r,{reportFrame:0,reportElapsed:0,reportIntent:true,reportVisible:false,reportLastTime:0,reportManual:false,reportObserver:null});
 const paintReport=()=>{
  const index=Number(reportHost.dataset.report),step=Math.min(3,Math.floor(r.reportElapsed/ovReportStageMs)),phase=r.reportManual||r.reportElapsed>=ovReportDuration?1:(r.reportElapsed%ovReportStageMs)/ovReportStageMs,clamp=value=>Math.max(0,Math.min(1,value));
  const graphic=reportVisual.querySelector('.ov-diagram'),compact=innerWidth<=760;
  graphic.dataset.reportCompact=String(compact);graphic.setAttribute('viewBox',compact?`${[ -15,380,807.5,807.5 ][step]} 0 400 420`:'0 0 1200 420');
  reportVisual.dataset.reportStep=String(step);reportHost.dataset.reportElapsed=String(Math.round(r.reportElapsed));
  root.querySelectorAll('[data-ov-report-step]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.ovReportStep)===step)));
  root.querySelectorAll('[data-report-caption]').forEach(caption=>{const active=caption.dataset.reportCaption===index+'-'+step;if(caption.classList.contains('is-active')!==active){caption.classList.toggle('is-active',active);caption.setAttribute('aria-hidden',String(!active));}});
  reportVisual.querySelectorAll('[data-report-transfer]').forEach(token=>{
   const local=clamp((phase-Number(token.dataset.order)*.065)/.64),eased=local*local*(3-2*local),active=step===Number(token.dataset.reportTransfer)&&!r.reportManual;
   token.setAttribute('opacity',active&&local>0&&local<1?'1':'0');
   const x=Number(token.dataset.startX)+(Number(token.dataset.endX)-Number(token.dataset.startX))*eased,y=Number(token.dataset.startY)+(Number(token.dataset.endY)-Number(token.dataset.startY))*eased;
   token.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);
  });
  reportVisual.querySelectorAll('.ov-report-trace-edge').forEach((edge,i)=>edge.setAttribute('stroke-dashoffset',String(1-(step>=2?1:step===1?clamp((phase-.15-i*.045)/.6):0))));
  reportVisual.querySelectorAll('[data-report-reveal]').forEach(node=>node.setAttribute('opacity',String(step>=3?1:step===2?clamp((phase-Number(node.dataset.reportReveal)*.065-.6)/.07):0)));
  const built=step>=3?1:step===2?phase:0;
  reportVisual.querySelectorAll('[data-report-total]').forEach(node=>{const value=String(Math.round(Number(node.dataset.reportTotal)*built));if(node.textContent!==value)node.textContent=value;});
  reportVisual.querySelectorAll('[data-report-bar]').forEach(node=>node.setAttribute('width',String(Number(node.dataset.reportBar)*built)));
  reportVisual.querySelector('.ov-report-output-placeholder').setAttribute('opacity',step<2?'1':'0');
  const percent=Math.round(r.reportElapsed/ovReportDuration*100),progress=root.querySelector('.ov-report-progress');progress.setAttribute('aria-valuenow',String(percent));progress.firstElementChild.style.width=percent+'%';
 };
 const canPlayReport=()=>r.reportIntent&&!reduced()&&!document.hidden&&!r.diagram.open&&!r.dialog.open&&r.reportVisible&&r.reportElapsed<ovReportDuration;
 const reportTick=now=>{
  r.reportFrame=0;if(!canPlayReport()){syncReportPlayback();return;}
  if(r.reportLastTime)r.reportElapsed=Math.min(ovReportDuration,r.reportElapsed+Math.min(100,now-r.reportLastTime));
  r.reportLastTime=now;paintReport();if(r.reportElapsed>=ovReportDuration)r.reportIntent=false;syncReportPlayback();
 };
 const syncReportPlayback=()=>{
  const playing=canPlayReport(),done=r.reportElapsed>=ovReportDuration;
  if(playing&&!r.reportFrame)r.reportFrame=requestAnimationFrame(reportTick);
  if(!playing){cancelAnimationFrame(r.reportFrame);r.reportFrame=0;r.reportLastTime=0;}
  const state=reduced()?'motion-paused':done?'complete':playing?'playing':r.reportIntent?'waiting':'paused';
  reportHost.dataset.reportPlayback=state;reportVisual.dataset.reportRunning=String(playing);
  const status=root.querySelector('[data-ov-report-status]'),label=motion.matches?'Reduced motion':overviewMotionPaused?'Motion paused':done?'Ready to share':playing?'Playing':r.reportIntent?'Plays when in view':'Paused';
  if(status.textContent!==label)status.textContent=label;
  const button=root.querySelector('[data-ov-report-play]'),action=done?'Play':r.reportIntent?'Pause':'Play';
  button.textContent=action;button.setAttribute('aria-label',action+' report animation');button.disabled=reduced();root.querySelector('[data-ov-report-replay]').disabled=reduced();
 };
 r.paintReport=paintReport;r.syncReportPlayback=syncReportPlayback;
 const restartReport=()=>{r.reportElapsed=reduced()?ovReportDuration:0;r.reportManual=reduced();r.reportIntent=!reduced();r.reportLastTime=0;paintReport();syncReportPlayback();};
 const refreshReport=()=>{
  const host=root.querySelector('.ov-report-workbench'),index=Number(host.dataset.report),scope=host.dataset.reportScope,focus=host.dataset.reportFocus;
  root.querySelector('#ov-report-graphic').innerHTML=ovReportingArt(index,scope,focus);
  root.querySelector('#ov-report-detail').innerHTML=ovReportReading(index,scope,focus);
  root.querySelector('[data-ov-report-summary]').textContent=ovReportSummary(index,scope,focus);
  root.querySelector('#ov-report-caption').innerHTML=ovReportCaptions(index,scope,focus);
  const steps=ovReportSteps(index,scope,focus);root.querySelectorAll('[data-ov-report-step]').forEach(button=>button.querySelector('span').textContent=steps[Number(button.dataset.ovReportStep)].label);
  restartReport();
 };
 const select=(kind,index,items)=>{
  if(!items[index])return;
  for(const button of root.querySelectorAll('[data-ov-'+kind+']'))button.setAttribute('aria-pressed',String(Number(button.getAttribute('data-ov-'+kind))===index));
  const detail=root.querySelector('#ov-'+kind+'-detail');
  if(['layer','risk','service'].includes(kind))detail.querySelectorAll('[data-'+kind+'-description]').forEach(panel=>{const active=Number(panel.getAttribute('data-'+kind+'-description'))===index;panel.classList.toggle('is-active',active);panel.setAttribute('aria-hidden',String(!active));});
  else if(detail)detail.innerHTML=ovDetail(items[index]);
  const visual=root.querySelector('[data-'+kind+']');if(visual)visual.dataset[kind]=String(index);
  if(kind==='report')refreshReport();
  if(kind==='service'){
   root.querySelector('#ov-service-graphic').innerHTML=ovServiceImpactArt(index);
   root.querySelector('#ov-service-review').innerHTML=ovServiceReview(index);
   root.querySelector('.ov-impact-visual').dataset.impactIssue=ovServiceScenarios[index].issue;
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
  if(id==='reporting'){svg.setAttribute('viewBox','0 0 1200 420');svg.dataset.reportCompact='false';}
  wrapper.append(svg);r.canvas.replaceChildren(wrapper);r.diagramWidth=svg.viewBox.baseVal.width||840;r.diagramHeight=original.viewBox.baseVal.height||840;r.diagramOpener=button;
  root.querySelector('#ov-diagram-title').textContent=ovSection(id).title;r.diagram.showModal();syncReportPlayback();r.investigation?.sync();
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
  root.querySelector('.ov-film-transcript').open=false;r.dialog.showModal();syncReportPlayback();r.investigation?.sync();root.querySelector('[data-ov-close-video]').focus({preventScroll:true});
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
  if(button.hasAttribute('data-ov-report-play')){
   if(r.reportElapsed>=ovReportDuration){restartReport();return;}
   r.reportIntent=!r.reportIntent;r.reportManual=false;r.reportLastTime=0;paintReport();syncReportPlayback();return;
  }
  if(button.hasAttribute('data-ov-report-replay')){restartReport();return;}
  if(button.hasAttribute('data-ov-report-step')){
   const step=Number(button.dataset.ovReportStep);r.reportElapsed=step===3?ovReportDuration:step*ovReportStageMs;r.reportManual=true;r.reportIntent=false;paintReport();syncReportPlayback();return;
  }
  if(button.hasAttribute('data-ov-report-scope')||button.hasAttribute('data-ov-report-focus')){
   const kind=button.hasAttribute('data-ov-report-scope')?'scope':'focus',value=button.getAttribute('data-ov-report-'+kind);
   if(!(kind==='scope'?['all','C']:['all','D5']).includes(value))return;
   root.querySelectorAll('[data-ov-report-'+kind+']').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
   root.querySelector('.ov-report-workbench').setAttribute('data-report-'+kind,value);refreshReport();return;
  }
  const kinds={layer:overviewContent.layers,risk:ovSection('vulnerabilities').options,service:ovSection('services').options,report:ovSection('reporting').options,benefit:overviewContent.benefits};
  for(const [kind,items] of Object.entries(kinds))if(button.hasAttribute('data-ov-'+kind)){select(kind,Number(button.getAttribute('data-ov-'+kind)),ovOptions(items));return;}
  if(button.hasAttribute('data-ov-shadow-scenario')){updateShadow(Number(button.dataset.ovShadowScenario));return;}
  if(button.hasAttribute('data-ov-shadow'))updateShadow(Number(root.querySelector('.ov-shadow-visual').dataset.shadowScenario),button.getAttribute('aria-pressed')!=='true');
 },{signal});
 root.addEventListener('change',event=>{if(event.target.matches('[data-ov-chapter-select]'))jumpToChapter(event.target.value);},{signal});
 r.diagram.addEventListener('cancel',event=>{event.preventDefault();closeDiagram();},{signal});
 r.diagram.addEventListener('close',()=>{r.canvas.replaceChildren();const button=r.diagramOpener;r.diagramOpener=null;if(button?.isConnected)button.focus({preventScroll:true});syncReportPlayback();r.investigation?.sync();},{signal});
 r.diagram.addEventListener('click',event=>{if(event.target!==r.diagram)return;event.stopPropagation();const box=r.diagram.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDiagram();},{signal});
 r.dialog.addEventListener('click',event=>{if(event.target!==r.dialog)return;event.stopPropagation();const box=r.dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeVideo();},{signal});
 r.dialog.addEventListener('cancel',event=>{event.preventDefault();closeVideo();},{signal});r.dialog.addEventListener('close',()=>{if(r.video.hasAttribute('src'))closeVideo();syncReportPlayback();r.investigation?.sync();},{signal});
 r.video.addEventListener('error',()=>{if(r.dialog.open){const filename=r.video.getAttribute('src') || 'the overview MP4 file';root.querySelector('.ov-film-status').textContent='This video could not be opened. Keep '+filename+' in the same folder as the guide, or read the transcript below.';}},{signal});
 root.addEventListener('pointerover',event=>{
  const device=event.target.closest('.ov-terrain-device'),host=device?.closest('.ov-visual');if(!host||event.pointerType==='touch')return;
  resetHover();r.hoverHost=host;host.querySelectorAll('.ov-terrain-device').forEach(node=>node.classList.toggle('ov-entity-highlight',node.dataset.device===device.dataset.device));
 },{signal,passive:true});
 root.addEventListener('pointerout',event=>{if(event.target.closest('.ov-terrain-device')&&!event.target.closest('.ov-terrain-device').contains(event.relatedTarget))resetHover();},{signal,passive:true});window.addEventListener('blur',resetHover,{signal});
 window.addEventListener('scroll',queueScroll,{signal,passive:true});window.addEventListener('resize',()=>{queueScroll();paintReport();r.investigation?.resize();if(r.diagram.open&&r.diagramFitted)fitDiagram();},{signal,passive:true});document.addEventListener('visibilitychange',()=>{root.classList.toggle('ov-document-hidden',document.hidden);if(document.hidden)resetHover();syncReportPlayback();r.investigation?.sync();},{signal});motion.addEventListener('change',updateMotion,{signal});
 if('IntersectionObserver' in window){r.observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('is-visible',entry.isIntersecting)),{rootMargin:'10% 0px 10% 0px'});sections.forEach(section=>r.observer.observe(section));}else sections.forEach(section=>section.classList.add('is-visible'));
 if('IntersectionObserver' in window){r.reportObserver=new IntersectionObserver(entries=>{r.reportVisible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.15;syncReportPlayback();},{threshold:[0,.15]});r.reportObserver.observe(reportVisual);}else r.reportVisible=true;
 r.investigation=ovSetupInvestigationStory(root,{signal,reduced,prefersReduced:()=>motion.matches,isBlocked:()=>document.hidden||r.diagram.open||r.dialog.open});
 restartReport();updateMotion();updateScroll();
}
