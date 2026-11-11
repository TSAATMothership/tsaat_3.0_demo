export const RETIRED_PERSONA_PAGES = ["governance-overview","governance-trends","governance-insights","discovery-overview","network-risk-profile","ict-system-risk-profile","service-impact","ict-system-impact","ict-system-dependencies","discovery-tools","discovery-compliance","discovery-patches","discovery-life-cycle","measures-summary","measures-trends","measures-kpi","measures-spi","findings-register","briefs-reports"];
export const RETIRED_PERSONA_SECTIONS = ["cyber-security","observed-measures","findings","briefs-reports"];
export const RETIRED_PERSONA_POPUPS = ["network-details","ict-system-details","measure-scope","risk-trend","impact-graph","impact-details","finding-details","affected-cis","cve-details","asset-compliance","discovery-tool-details"];
export function retirePersonaPermissions(settings) {
  return { ...settings, personas: settings.personas.map(persona => ({ ...persona,
    sections: persona.sections.filter(id => !RETIRED_PERSONA_SECTIONS.includes(id)),
    ...(Array.isArray(persona.pages) ? { pages: persona.pages.filter(id => !RETIRED_PERSONA_PAGES.includes(id)) } : {}),
    ...(Array.isArray(persona.popups) ? { popups: persona.popups.filter(id => !RETIRED_PERSONA_POPUPS.includes(id)) } : {})
  })) };
}
