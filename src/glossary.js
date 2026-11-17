// Link first uses in explanatory text, leaving controls and navigation intact.
const glossaryAliases={
  terrain:['cyber terrain'],endpoint:['endpoints','endpoint','hosts','host'],
  ci:['configuration items','configuration item','CIs','CI'],scope:['scope'],
  date:['snapshot dates','snapshot date','snapshots','snapshot'],coverage:['required discovery checks','required discovery check','required tool checks','required tool check','discovery coverage'],
  observation:['vulnerability observations','vulnerability observation'],
  install:['software installations','software installation','installations','installation'],
  domain:['security domains','security domain'],relationship:['relationships','relationship'],
  arp:['ARP tables','ARP table','ARP'],cmdb:['CMDB'],cve:['CVEs','CVE'],
  vulnerability:['vulnerabilities','vulnerability'],ip:['IP addresses','IP address'],
  evidence:['evidence'],discovery:['discovery'],governance:['governance'],
  topology:['topology'],model:['models','model'],severity:['severity'],remediation:['remediation'],
  source:['discovery sources','discovery source','detection sources','detection source'],
  persona:['personas','persona'],utc:['UTC'],version:['software versions','software version'],
  inventory:['inventory'],ict:['ICT systems','ICT system'],os:['operating systems','operating system']
};
function linkGlossaryTerms(root){
  const aliases=Object.entries(glossaryAliases).flatMap(([id,terms])=>terms.map(term=>({id,term})));
  const lookup=new Map(aliases.map(({id,term})=>[term.toLowerCase(),id]));
  const pattern=new RegExp('\\b(?:'+aliases.map(({term})=>term).sort((a,b)=>b.length-a.length).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b','gi');
  const seen=new Set([...root.querySelectorAll('[data-glossary-term]')].map(a=>a.dataset.glossaryTerm));
  for(const paragraph of root.querySelectorAll('p,.ex-note span')){
    if(paragraph.closest('a,button,summary,.eyebrow,.breadcrumb,.route-line,.sourceline,.scope-video'))continue;
    const ownTerm=paragraph.closest('.reference-item')?.id.replace('ref-','');
    const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement.closest('a,button,code')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    let linked=0;
    for(const node of nodes){
      const text=node.nodeValue,fragment=document.createDocumentFragment();let offset=0;
      for(const match of text.matchAll(pattern)){
        const id=lookup.get(match[0].toLowerCase());
        if(seen.has(id)||id===ownTerm||linked>=3||!copy.has('gloss.'+id+'.body'))continue;
        fragment.append(document.createTextNode(text.slice(offset,match.index)));
        const anchor=document.createElement('a');anchor.className='glossary-link';anchor.href='#reference/gloss/'+id;
        anchor.dataset.glossaryTerm=id;anchor.textContent=match[0];anchor.title=msg('gloss.'+id+'.body');fragment.append(anchor);
        offset=match.index+match[0].length;seen.add(id);linked++;
      }
      if(offset){fragment.append(document.createTextNode(text.slice(offset)));node.replaceWith(fragment);}
    }
  }
}
