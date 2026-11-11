import { activeWorkspaceItem, WORKSPACE_GROUPS } from "@/lib/workspace-navigation";
import { RETIRED_PERSONA_PAGES, RETIRED_PERSONA_SECTIONS, RETIRED_PERSONA_POPUPS } from "@/lib/retired-capabilities.mjs";
import initialSettings from "@/Database Schema/data/personas.json";

// Bootstrap and legacy upgrade only. Runtime consumers use the stored catalogue.
export const DEFAULT_PERSONAS = initialSettings.personas.map(({ id, label }) => ({ id, label }));
export type PersonaId = string;
export const MAX_PERSONAS = 50;
export const PERSONA_SECTIONS = WORKSPACE_GROUPS.map(group => ({ id: group.id, label: group.label, pages: group.items }));
export const PERSONA_PAGES = PERSONA_SECTIONS.flatMap(section => section.pages.map(page => ({ ...page, section: section.id })));
// Accept known retired permissions in older settings, then discard them without granting a replacement.
export const PERSONA_POPUPS = [{ id: "cmdb-details", label: "CMDB details" }] as const;
export type PersonaPopupId = typeof PERSONA_POPUPS[number]["id"];
export interface PersonaSettings {
  schemaVersion: 3;
  updatedAt: string;
  personas: Array<{ id: PersonaId; label: string; sections: string[]; pages: string[]; popups: PersonaPopupId[] }>;
}
export class PersonaValidationError extends Error {}
export class PersonaConflictError extends Error {
  constructor() { super("Personas changed in the data source. Reload saved personas before saving again."); }
}
export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(value);
}
export function defaultPersonaSettings(): PersonaSettings {
  return parsePersonaSettings(initialSettings);
}

/** Legacy reads preserve selections; explicit writes publish the complete data-driven catalogue. */
export function parsePersonaSettings(input: unknown, { forWrite = false }: { forWrite?: boolean } = {}): PersonaSettings {
  const fail = (): never => { throw new PersonaValidationError("Provide a complete persona configuration with unique IDs and names, valid sections, pages and popups (schema version 3). Reload the application if it is out of date."); };
  if (!input || typeof input !== "object") return fail();
  const candidate = input as Record<string, unknown>;
  if (![1, 2, 3].includes(Number(candidate.schemaVersion)) || typeof candidate.schemaVersion !== "number" || !Array.isArray(candidate.personas) || candidate.personas.length > MAX_PERSONAS) return fail();
  const legacy = candidate.schemaVersion !== 3;
  if (forWrite && (legacy || typeof candidate.updatedAt !== "string" || !Number.isFinite(Date.parse(candidate.updatedAt)))) return fail();
  if (legacy && ![4, 5].includes(candidate.personas.length)) return fail();
  function selection<T extends string>(raw: unknown, ids: readonly T[]): T[] {
    if (!Array.isArray(raw) || raw.some(id => !ids.includes(id)) || new Set(raw).size !== raw.length) return fail();
    return ids.filter(id => raw.includes(id));
  }
  const personas: PersonaSettings["personas"] = [];
  for (const raw of candidate.personas) {
    if (!raw || typeof raw !== "object") return fail();
    const entry = raw as Record<string, unknown>;
    if (!isPersonaId(entry.id) || personas.some(persona => persona.id === entry.id) || !Array.isArray(entry.sections)) return fail();
    const original = DEFAULT_PERSONAS.find(persona => persona.id === entry.id);
    if (legacy && !original) return fail();
    const label = legacy ? original!.label : typeof entry.label === "string" ? entry.label.trim() : "";
    if (!label || label.length > 80 || /[\u0000-\u001f\u007f]/.test(label) || personas.some(persona => persona.label.toLowerCase() === label.toLowerCase())) return fail();
    const sections = selection(entry.sections, [...PERSONA_SECTIONS.map(section => section.id), ...RETIRED_PERSONA_SECTIONS]).filter(id => !RETIRED_PERSONA_SECTIONS.includes(id));
    // Version 1 had only section gates. Upgrade in memory, without rewriting storage on read.
    const pages = candidate.schemaVersion === 1 ? PERSONA_PAGES.filter(page => sections.includes(page.section)).map(page => page.id)
      : selection(entry.pages, [...PERSONA_PAGES.map(page => page.id), ...RETIRED_PERSONA_PAGES]).filter(id => !RETIRED_PERSONA_PAGES.includes(id));
    const popups = candidate.schemaVersion === 1 ? PERSONA_POPUPS.map(popup => popup.id)
      : selection(entry.popups, [...PERSONA_POPUPS.map(popup => popup.id), ...RETIRED_PERSONA_POPUPS]).filter((id): id is PersonaPopupId => PERSONA_POPUPS.some(popup => popup.id === id));
    personas.push({ id: entry.id, label, sections, pages, popups });
  }
  // Only Business Reporting may be absent from older saved configurations. Never refill existing selections.
  if (legacy && personas.length === 4 && !personas.some(persona => persona.id === "business-reporting")) {
    personas.push(defaultPersonaSettings().personas.find(persona => persona.id === "business-reporting")!);
  }
  if (legacy && DEFAULT_PERSONAS.some(persona => !personas.some(entry => entry.id === persona.id))) return fail();
  return { schemaVersion: 3,
    updatedAt: typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt)) ? candidate.updatedAt : "1970-01-01T00:00:00.000Z",
    personas };
}

export function personaShowsSection(settings: PersonaSettings, persona: PersonaId | null, section: string): boolean {
  return PERSONA_PAGES.some(page => page.section === section && personaShowsPage(settings, persona, page.id));
}

export function personaShowsPage(settings: PersonaSettings, persona: PersonaId | null, pageId: string): boolean {
  const page = PERSONA_PAGES.find(page => page.id === pageId);
  const entry = settings.personas.find(entry => entry.id === persona);
  return Boolean(page && (persona === null || (entry?.sections.includes(page.section) && entry.pages.includes(page.id))));
}

export function personaAllowsPopup(settings: PersonaSettings, persona: PersonaId | null, popup: PersonaPopupId): boolean {
  return persona === null || Boolean(settings.personas.find(entry => entry.id === persona)?.popups.includes(popup));
}

/** Resolve sidebar destinations independently of entity, filter and snapshot query parameters. */
export function personaDestination(href: string): { pageId?: string; popup?: PersonaPopupId } {
  if (!href.startsWith("/") || href.startsWith("//")) return {};
  const url = new URL(href, "http://localhost");
  return { pageId: activeWorkspaceItem(url.pathname.replace(/\/$/, "") || "/", url.searchParams)?.id };
}

export function personaAllowsHref(settings: PersonaSettings, persona: PersonaId | null, href: string): boolean {
  const { pageId, popup } = personaDestination(href);
  return (!pageId || personaShowsPage(settings, persona, pageId)) && (!popup || personaAllowsPopup(settings, persona, popup));
}
