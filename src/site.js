(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const model=JSON.parse(byId('structure').textContent);
const media=JSON.parse(byId('media').textContent);
const required=JSON.parse(byId('required').textContent);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults=byId('workbook').textContent.trim();
let originalGuideText;
let book=defaults, copy=new Map(), sourceMode='embed', lastRoute='', searchItems=[], opener=null, workbookBusy=false;
const u=k=>msg('ui.'+k);
function msg(k){if(!copy.has(k))throw new Error('Missing text key '+k);return copy.get(k).text;}
const tx=k=>safe(msg(k));
const ui=k=>safe(u(k));
function base64ToBytes(str){return Uint8Array.from(atob(str),v=>v.charCodeAt(0));}
function bytesToBase64(bytes){let chunks=[];for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));return btoa(chunks.join(''));}
const descendants=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
async function readBook(bytes){
  const zip=await JSZip.loadAsync(bytes);
  const parser=new DOMParser();
  async function xml(file){
    const entry=zip.file(file);if(!entry)throw Error('Missing worksheet');
    const doc=parser.parseFromString(await entry.async('string'),'application/xml');
    if(descendants(doc,'parsererror').length)throw Error('Invalid workbook XML');
    return doc;
  }
  const [work,rels]=await Promise.all([xml('xl/workbook.xml'),xml('xl/_rels/workbook.xml.rels')]);
  const sheet=descendants(work,'sheet').find(el=>el.getAttribute('name')==='Guide text');
  if(!sheet)throw Error('Missing content sheet');
  const id=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id');
  const relationships=descendants(rels,'Relationship');
  function part(rel){
    if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('Missing internal part');
    return new URL(rel.getAttribute('Target'),'https://workbook.invalid/xl/').pathname.slice(1);
  }
  const textRuns=el=>descendants(el,'t').filter(t=>t.parentNode.localName!=='rPh').map(t=>t.textContent).join('');
  const sharedPath=relationships.find(el=>(el.getAttribute('Type')||'').endsWith('/sharedStrings'));
  const shared=sharedPath?descendants(await xml(part(sharedPath)),'si').map(textRuns):[];
  const sheetPath=part(relationships.find(el=>el.getAttribute('Id')===id));
  const sheetXml=await xml(sheetPath);
  let header=false, map=new Map();
  for(const row of descendants(sheetXml,'row')){
    const cells={};
    for(const cell of descendants(row,'c')){
      const col=(cell.getAttribute('r')||'').replace(/[0-9]/g,''), type=cell.getAttribute('t');
      const val=descendants(cell,'v')[0]?.textContent||'';
      cells[col]=type==='s'?shared[Number(val)]:type==='inlineStr'?textRuns(cell):val;
    }
    if(!header){header=cells.A==='Key'&&cells.C==='Text';continue;}
    if(!cells.A&&!cells.C)continue;
    if(!cells.A||!cells.C?.trim()||map.has(cells.A))throw Error('Invalid content row');
    map.set(cells.A,{text:cells.C,section:cells.B||'',source:cells.D||''});
  }
  if(!header)throw Error('Incomplete workbook');
  const missing=required.filter(k=>!map.has(k));
  if(missing.length){
    // Fill known additions in older workbooks while keeping the editor's wording.
    const legacyLab=![...map.keys()].some(k=>k.startsWith('lab.'));
    const addedGlossary=new Set((model.glossExtensions||[]).flatMap(id=>['gloss.'+id+'.title','gloss.'+id+'.body']));
    if(!originalGuideText||missing.some(k=>!addedGlossary.has(k)&&!(legacyLab&&k.startsWith('lab.'))))throw Error('Incomplete workbook');
    const data=descendants(sheetXml,'sheetData')[0],last=descendants(data,'row').at(-1),ns=data.namespaceURI;
    const oldEnd=Number(last.getAttribute('r'));let end=oldEnd;
    const serialize=doc=>new XMLSerializer().serializeToString(doc);
    for(const key of missing){
      const item=originalGuideText.get(key),row=last.cloneNode(false);row.setAttribute('r',String(++end));
      [key,item.section,item.text,item.source].forEach((v,i)=>{
        const col=String.fromCharCode(65+i),cell=descendants(last,'c').find(c=>c.getAttribute('r').replace(/\d/g,'')===col)?.cloneNode(false)||sheetXml.createElementNS(ns,'c');
        cell.setAttribute('r',col+end);cell.setAttribute('t','inlineStr');
        const inline=sheetXml.createElementNS(ns,'is'),text=sheetXml.createElementNS(ns,'t');text.textContent=v;inline.append(text);cell.append(inline);row.append(cell);
      });data.append(row);map.set(key,item);
    }
    const extend=el=>{const ref=el.getAttribute('ref');if(ref?.match(/:\$?D\$?(\d+)$/)?.[1]===String(oldEnd))el.setAttribute('ref',ref.replace(/\d+$/,String(end)));};
    for(const tag of ['dimension','autoFilter'])descendants(sheetXml,tag).forEach(extend);
    zip.file(sheetPath,serialize(sheetXml));
    for(const [name,entry] of Object.entries(zip.files)){
      if(entry.dir||!/^xl\/tables\/[^/]+\.xml$/.test(name))continue;
      const doc=await xml(name),table=doc.documentElement;
      if(table.getAttribute('displayName')==='GuideText'){extend(table);descendants(table,'autoFilter').forEach(extend);zip.file(name,serialize(doc));}
    }
    map.updatedBytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
  return map;
}
const glyph={
 overview:'<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
 roles:'<circle cx="9" cy="8" r="3"/><path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
 map:'<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15m6-12v15"/>',
 book:'<path d="M3 4.5q5-2 9 1.3 4-3.3 9-1.3v14q-5-1.5-9 1.8-4-3.3-9-1.8zM12 6v14"/>',
 workbook:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16m-10-6v12"/>',
 search:'<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.7 4.7"/>',
 arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',ne:'<path d="M6 18 18 6M7 6h11v11"/>',chev:'<path d="m9 5 7 7-7 7"/>',
 down:'<path d="m6 9 6 6 6-6"/>',menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2.3"/><path d="M8.5 7V5.2A2 2 0 0 1 10.5 3h3a2 2 0 0 1 2 2.2V7M3 12.2q9 5 18 0m-10 1v3h2v-3"/>',
 network:'<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/>',
 layers:'<path d="m2.2 8 9.8-5.7L21.8 8 12 13.7zM3 12l9 5.4 9-5.4M3 16.2l9 5.3 9-5.3"/>',
 scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M5 13h3l2.5-5 3.1 9 2.2-5H19"/>',
 scope:'<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="2.9"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
 compass:'<circle cx="12" cy="12" r="9.2"/><path d="m16 8-2.4 5.6L8 16l2.4-5.6Z"/>',
 table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10m0-5h12"/>',
 device:'<rect x="2.5" y="4" width="19" height="13" rx="1.8"/><path d="M12 17v4m-5 0h10"/>',
 shield:'<path d="M12 2 4 5v6c0 5 3.1 8 8 11 5-3 8-6 8-11V5z"/><path d="m8.5 11.5 2.2 2.2 4.8-5"/>',
 radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8.3-8.3"/>',
 download:'<path d="M12 2v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18"/>',
 lab:'<path d="M9 3h6m-5 0v6l-6 10a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10"/>',
 pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 check:'<path d="m4 12 5 5L20 6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 flag:'<path d="M5 22V3c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',chain:'<path d="m10 14 4-4m-7 2-2 2a3.5 3.5 0 0 0 5 5l3-3m-2-8 3-3a3.5 3.5 0 0 1 5 5l-2 2"/>',
};
function icon(key,size=20){return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph[key]||glyph.book}</svg>`;}
function link(route,body,cls='',extra=''){return `<a class="${cls}" href="#${route}" ${extra}>${body}</a>`;}
function pillIcon(symbol,cls=''){return `<span class="icon-box ${cls}">${icon(symbol,23)}</span>`;}
function coverImage(id,cls=''){return `<img alt="" class="${cls}" src="${media[id]}" draggable="false">`;}
function featureArtwork(){return new TextDecoder().decode(base64ToBytes(media.terrain.split(',')[1])).replace('<svg ','<svg class="terrain-art" aria-hidden="true" focusable="false" ');}
function eyebrow(label){return `<p class="eyebrow"><span></span>${label}</p>`;}
const pad=n=>String(n).padStart(2,'0');
function path(){return location.hash.slice(1).split('/').filter(Boolean);}
function activeLink(id,route,ico,label){return link(route,icon(ico,18)+`<span>${label}</span>`,'nav-item','data-nav="'+id+'"');}
function shell(){
  document.title=u('browserTitle');
  byId('app').innerHTML=`<a class="skip" href="#main">${ui('skip')}</a>
  <header class="topbar"><div class="brandblock"><button class="hamb" data-action="menu" aria-expanded="false" aria-controls="sidebar" aria-label="${ui('menu')}">${icon('menu')}</button>${link('feature-guide',coverImage('logo')+`<span><strong>${ui('brand')}</strong><small>${ui('brandSub')}</small></span>`,'brand')}</div>
  <div class="header-tools"><button class="search-trigger" data-action="search" aria-label="${ui('search')}">${icon('search',16)}<span>${ui('search')}</span><kbd aria-hidden="true">/</kbd></button></div></header>
  <div class="layout"><aside id="sidebar"><nav aria-label="${ui('guideNav')}"><div class="nav-caption">${ui('guideNav')}</div>
  ${activeLink('feature-guide','feature-guide','map',ui('map'))}${activeLink('roles','roles','roles',ui('roles'))}${activeLink('practice','practice','lab',ui('practice'))}${activeLink('reference','reference','book',ui('reference'))}</nav>
  <a class="sidebottom" href="#dialog" data-action="workbook" aria-label="${ui('handbook')} - ${ui('workbook')}" title="${ui('workbook')}" aria-haspopup="dialog" aria-controls="dialog">${icon('book',18)}<strong>${ui('handbook')}</strong></a></aside><button class="shade" data-action="menu" aria-label="${ui('menuClose')}"></button>
  <main id="main" tabindex="-1"></main></div><dialog id="dialog"></dialog>`;
}
function crumb(label,parent=''){return `<nav class="breadcrumb" aria-label="${ui('guideNav')}">${link('feature-guide',icon('book',15)+' '+ui('guide'))}${icon('chev',12)}${parent?parent+icon('chev',12):''}<span>${label}</span></nav>`;}
function heading(k,title,desc){return `<header class="pagehead">${eyebrow(k)}<h1>${title}</h1><p>${desc}</p></header>`;}
function sectionHead(title,desc='',right=''){return `<div class="section-head"><div><h2>${title}</h2>${desc?'<p>'+desc+'</p>':''}</div>${right}</div>`;}
function action(route,label,symbol='arrow',cls='primary'){return link(route,ui(label)+icon(symbol,16),'button '+cls);}
function roleCards(){
  return `<div class="roles-grid">${Object.entries(model.roles).map(([k,r])=>link('role/'+k,`<div class="role-card-top">${pillIcon(r.icon)}${icon('ne',17)}</div><h3>${tx('r.'+k+'.title')}</h3><p>${tx('r.'+k+'.short')}</p>`,'role-card '+r.color)).join('')}</div>`;
}
function miniTopic(id,label){const k='t.'+id+'.',t=model.topics[id];return link('topic/'+id,pillIcon(t.icon)+`<div><strong>${label||tx(k+'title')}</strong><small>${tx(k+'short')}</small></div>${icon('chev',16)}`,'mini-topic');}
function rolesPage(){return crumb(ui('roles'))+heading(ui('handbook'),ui('roles'),ui('rolesIntro'))+roleCards()+note(ui('roleNote'));}
function note(body,ico='info'){return `<div class="note">${icon(ico,18)}<p>${body}</p></div>`;}
function groupCards(g,klass=''){return `<div class="group-cards ${klass}">${model.groups[g].map(id=>miniTopic(id,id==='scope'?ui('begin'):undefined)).join('')}</div>`;}
function featureGuidePage(){
  const groups=['gov','dis'].map((g,i)=>`<section class="map-block ${g}"><header>${pillIcon(i?'scan':'layers')}<div><h2>${ui(g)}</h2><p>${ui(i?'introDis':'introGov')}</p></div><b>${pad(model.groups[g].length)}</b></header>${groupCards(g)}</section>`).join('');
  return crumb(ui('map'))+`<div class="feature-guide"><header class="hero"><div class="hero-copy">${eyebrow(ui('handbook'))}<h1>${ui('map')}</h1><p>${ui('mapIntro')}</p><div class="guide-pdf-action"><button id="generate-guide-pdf" class="button primary" type="button" data-action="generate-pdf" aria-describedby="pdf-help"${pdfGuideBusy?' disabled aria-busy="true"':''}>${icon('download',17)}<span>Generate PDF User Guide</span></button><p id="pdf-help">Download a PDF of the current guide text. Works offline.</p><p id="pdf-status" role="status" aria-live="polite" aria-atomic="true">${safe(pdfGuideStatus)}</p></div></div><div class="terrain" aria-hidden="true"><div class="plot"><i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i>${featureArtwork()}</div></div></header>
  <div class="map-grid feature-sections">${groups}<section class="map-block shared"><header>${pillIcon('flag')}<div><h2>${ui('shared')}</h2><p>${ui('coreIntro')}</p></div><b>${pad(model.groups.shared.length)}</b></header>${groupCards('shared','wide')}</section></div></div>`;
}
function rolePage(id){
  const r=model.roles[id],k='r.'+id+'.',title=tx(k+'title');
  const steps=r.links.map((tid,i)=>`<li><span class="step-index">${pad(i+1)}</span><div><h3>${tx(k+'s'+(i+1))}</h3><p>${tx(k+'b'+(i+1))}</p>${link('topic/'+tid,tx('t.'+tid+'.title')+icon('arrow',14),'inline-link')}</div></li>`).join('');
  return crumb(title,link('roles',ui('roles')))+`<header class="role-banner ${r.color}"><div>${eyebrow(ui('roleGroup'))}<h1>${title}</h1><p>${tx(k+'question')}</p></div><div class="role-emblem" aria-hidden="true">${icon(r.icon,55)}</div></header>
  <div class="reading-grid"><section>${sectionHead(ui('path'))}<ol class="steps ${r.color}">${steps}</ol></section><aside class="side-cards"><section class="takeaway ${r.color}">${icon('flag',23)}<h2>${ui('handoff')}</h2><p>${tx(k+'out')}</p></section>${note(ui('roleNote'))}${action('roles','relatedRole','arrow','secondary')}</aside></div>`;
}
function topicPage(id){
  const t=model.topics[id],k='t.'+id+'.',title=tx(k+'title');
  let steps='';for(let i=1;i<=t.n;i++)steps+=`<li id="step${i}" tabindex="0" aria-labelledby="step${i}-number step${i}-title"><span class="step-index" id="step${i}-number">${pad(i)}</span><div><h3 id="step${i}-title">${tx(k+'s'+i)}</h3><p>${tx(k+'b'+i)}</p></div></li>`;
  return crumb(title,link('feature-guide',ui('map')))+`<header class="topic-banner"><div>${eyebrow(ui(t.group))}<h1>${title}</h1><p>${tx(k+'short')}</p><div class="route-line">${icon('pin',15)}<span>${tx(k+'route')}</span></div></div>${coverImage(t.art,'topic-art')}</header>
  <div class="reading-grid"><section>${sectionHead(ui('steps'))}<ol class="steps interactive-steps">${steps}</ol></section><aside class="side-cards">${workedExample(id)}<section class="takeaway">${icon('scope',23)}<h2>${ui('interpret')}</h2><p>${tx(k+'interpret')}</p></section><section class="takeaway amber">${icon('flag',23)}<h2>${ui('deliver')}</h2><p>${tx(k+'output')}</p></section></aside></div>
  <section class="section">${sectionHead(ui('next'))}<div class="task-grid">${t.links.map(tid=>miniTopic(tid)).join('')}</div></section><details class="sourceline"><summary>${ui('source')}</summary><p>${safe(copy.get(k+'title').source)}</p></details>`;
}

