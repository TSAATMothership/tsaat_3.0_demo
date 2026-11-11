export const RETIRED_PERSONA_PAGES: string[];
export const RETIRED_PERSONA_SECTIONS: string[];
export const RETIRED_PERSONA_POPUPS: string[];
export function retirePersonaPermissions<T extends { personas: Array<{ sections: string[]; pages?: string[]; popups?: string[] }> }>(settings: T): T;
