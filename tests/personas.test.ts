import { expect, it } from 'vitest';
import { defaultPersonaSettings, parsePersonaSettings, personaShowsSection, personaShowsPage, personaAllowsHref, personaAllowsPopup, personaDestination, PERSONA_SECTIONS, PERSONA_PAGES, PERSONA_POPUPS } from '@/lib/personas';
import { retirePersonaPermissions, RETIRED_PERSONA_PAGES, RETIRED_PERSONA_POPUPS, RETIRED_PERSONA_SECTIONS } from '@/lib/retired-capabilities.mjs';

it('preserves custom names, IDs, ordering, empty catalogues and intentionally empty permissions', () => {
  const source = { ...defaultPersonaSettings(), personas: [
    { id: 'operations-review', label: '  Operations review  ', sections: ['discovery'], pages: ['discovery-endpoints'], popups: [] },
    { id: 'custom-reader', label: 'Custom reader', sections: [], pages: [], popups: [] }
  ] };
  const parsed = parsePersonaSettings(source, { forWrite:true });
  expect(parsed.personas.map(p => [p.id,p.label])).toEqual([['operations-review','Operations review'],['custom-reader','Custom reader']]);
  expect(personaAllowsHref(parsed,'operations-review','/discovery-coverage?discoveryView=endpoints')).toBe(true);
  expect(personaAllowsHref(parsed,'custom-reader','/discovery-coverage?discoveryView=endpoints')).toBe(false);
  expect(parsePersonaSettings({...source,personas:[]}).personas).toEqual([]);
});
it('has only retained pages and popups while preserving independently cloned defaults', () => {
  const source=defaultPersonaSettings();
  expect(PERSONA_SECTIONS.map(s=>s.id)).toEqual(['governance','discovery']);
  expect(PERSONA_POPUPS.map(p=>p.id)).toEqual(['cmdb-details']);
  for(const persona of source.personas){
    expect(persona.sections).toEqual(PERSONA_SECTIONS.map(s=>s.id));
    expect(persona.pages).toEqual(PERSONA_PAGES.map(p=>p.id));
  }
  source.personas[0].sections.length=0;
  expect(source.personas[1].sections).toHaveLength(2);
  expect(defaultPersonaSettings().personas[0].sections).toHaveLength(2);
});
it('removes retired permissions across revisions without granting replacement pages or mutating the source', () => {
  const defaults=defaultPersonaSettings();
  const source={...defaults,personas:defaults.personas.map((persona,index)=>index?persona:{...persona,
    sections:[...RETIRED_PERSONA_SECTIONS,'governance'],pages:[...RETIRED_PERSONA_PAGES],popups:[...RETIRED_PERSONA_POPUPS]})};
  const before=JSON.stringify(source);
  for(const forWrite of [false,true]) {
    const parsed=parsePersonaSettings(source,{forWrite});
    expect(parsed).toEqual(retirePersonaPermissions(source));
    expect(parsed.personas[0]).toMatchObject({sections:['governance'],pages:[],popups:[]});
    expect(personaShowsSection(parsed,'analyst','governance')).toBe(false);
    expect(personaAllowsHref(parsed,'analyst','/governance/end-point-insights')).toBe(false);
  }
  expect(JSON.stringify(source)).toBe(before);
  source.personas[0].pages.push(RETIRED_PERSONA_PAGES[0]);
  expect(()=>parsePersonaSettings(source)).toThrow();
});
it.each([1,2])('upgrades legacy v%i settings without refilling intentionally hidden retained pages',schemaVersion=>{
  const source=defaultPersonaSettings();
  source.personas[0]={id:'analyst',label:'Analyst',sections:[],pages:[],popups:[]};
  const original=source.personas.slice(0,4);
  const legacy={...source,schemaVersion,personas:schemaVersion===1?original.map(({id,sections})=>({id,sections})):original};
  const before=JSON.stringify(legacy), parsed=parsePersonaSettings(legacy);
  expect(parsed.personas).toHaveLength(5); expect(parsed.personas[0].pages).toEqual([]);
  expect(parsed.updatedAt).toBe(source.updatedAt);expect(JSON.stringify(legacy)).toBe(before);
  expect(()=>parsePersonaSettings(legacy,{forWrite:true})).toThrow();
  expect(parsePersonaSettings(parsed,{forWrite:true})).toEqual(parsed);
});
it('enforces page and CMDB popup permissions separately and allows login-free unselected access',()=>{
  const source=defaultPersonaSettings();source.personas[0].pages=['discovery-endpoints'];source.personas[0].popups=[];
  expect(personaShowsPage(source,'analyst','discovery-endpoints')).toBe(true);
  expect(personaShowsPage(source,'analyst','governance-endpoint-insights')).toBe(false);
  expect(personaAllowsPopup(source,'analyst','cmdb-details')).toBe(false);
  expect(personaAllowsPopup(source,null,'cmdb-details')).toBe(true);
  expect(personaAllowsHref(source,null,'/governance/end-point-insights')).toBe(true);
  for(const page of PERSONA_PAGES)expect(personaDestination(page.href).pageId).toBe(page.id);
});
it.each(['/findings','/cyber-cop','/network-risk-profile','/ict-system-risk-profile','/measures','/report','/governance/trends','/discovery-coverage?discoveryView=tools-2'])('treats retired %s as an informational compatibility URL',href=>{
  expect(personaDestination(href).pageId).toBeUndefined();
});
it('rejects invalid revisions, unknown/duplicate permissions, ambiguous labels and invalid IDs',()=>{
  const source=defaultPersonaSettings();
  for(const value of [null,{}, {...source,schemaVersion:99}, {...source,personas:[{...source.personas[0],sections:['/admin']}]}, {...source,personas:[{...source.personas[0],pages:['discovery-endpoints','discovery-endpoints']}]}, {...source,personas:[{...source.personas[0],popups:['unknown']}]}, {...source,personas:[{...source.personas[0],id:'bad id'}]}, {...source,personas:[{...source.personas[0],label:' '}]}]) expect(()=>parsePersonaSettings(value)).toThrow();
  expect(()=>parsePersonaSettings({...source,personas:[source.personas[0],{...source.personas[1],label:source.personas[0].label}]})).toThrow();
});
