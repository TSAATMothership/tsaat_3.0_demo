import { activeWorkspaceItem, scopeIds, WORKSPACE_GROUPS, WORKSPACE_LINKS } from "@/lib/workspace-navigation";
import { resolveMeasuresTab } from "@/lib/measures-tab-routing";

export const PERSONAS = [
  { id: "analyst", label: "Analyst" },
  { id: "life-cycle-management", label: "Life Cycle Management" },
  { id: "configuration-management", label: "Configuration Management" },
  { id: "dsoc-analyst", label: "DSOC Analyst" },
  { id: "business-reporting", label: "Business Reporting" }
] as const;
export type PersonaId = typeof PERSONAS[number]["id"];
export const PERSONA_SECTIONS = [
  ...WORKSPACE_GROUPS.map(group => ({ id: group.id, label: group.label, pages: group.items })),
  { id: "briefs-reports", label: WORKSPACE_LINKS[0].label, pages: WORKSPACE_LINKS }
];
export const PERSONA_PAGES = PERSONA_SECTIONS.flatMap(section => section.pages.map(page => ({ ...page, section: section.id })));
// Accept known retired permissions in older settings, then discard them without granting a replacement.
const RETIRED_PERSONA_PAGES = ["governance-overview"];
export const PERSONA_POPUPS = [
  { id: "cmdb-details", label: "CMDB details" },
  { id: "network-details", label: "Network details" },
  { id: "ict-system-details", label: "ICT system details" },
  { id: "measure-scope", label: "KPI / SPI scope details" },
  { id: "risk-trend", label: "Expanded risk trend chart" },
  { id: "impact-graph", label: "Service Impact Topology" },
  { id: "impact-details", label: "Service impact findings & CIs" },
  { id: "finding-details", label: "Finding drill-through lists" },
  { id: "affected-cis", label: "Affected CI details" },
  { id: "cve-details", label: "High-risk CVE details" },
  { id: "asset-compliance", label: "Asset compliance view" },
  { id: "discovery-tool-details", label: "Discovery tool asset details" }
] as const;
export type PersonaPopupId = typeof PERSONA_POPUPS[number]["id"];
export interface PersonaSettings {
  schemaVersion: 2;
  updatedAt: string;
  personas: Array<{ id: PersonaId; sections: string[]; pages: string[]; popups: PersonaPopupId[] }>;
}
export class PersonaValidationError extends Error {}
export function isPersonaId(value: unknown): value is PersonaId {
  return PERSONAS.some(persona => persona.id === value);
}
function defaultPersonaConfiguration(id: PersonaId): PersonaSettings["personas"][number] {
  return { id, sections: PERSONA_SECTIONS.map(section => section.id),
    pages: PERSONA_PAGES.map(page => page.id), popups: PERSONA_POPUPS.map(popup => popup.id) };
}
export function defaultPersonaSettings(): PersonaSettings {
  return { schemaVersion: 2, updatedAt: "1970-01-01T00:00:00.000Z",
    personas: PERSONAS.map(({ id }) => defaultPersonaConfiguration(id)) };
}

/** Reads upgrade the original four-persona catalogue in memory; writes require the complete catalogue. */
export function parsePersonaSettings(input: unknown, { requireAllPersonas = false }: { requireAllPersonas?: boolean } = {}): PersonaSettings {
  const fail = (): never => { throw new PersonaValidationError("Provide a complete persona configuration with unique, valid sections, pages and popups (schema version 2). Reload the application if a persona is missing."); };
  if (!input || typeof input !== "object") return fail();
  const candidate = input as Record<string, unknown>;
  if (![1, 2].includes(Number(candidate.schemaVersion)) || typeof candidate.schemaVersion !== "number" || !Array.isArray(candidate.personas) || ![PERSONAS.length - 1, PERSONAS.length].includes(candidate.personas.length)) return fail();
  function selection<T extends string>(raw: unknown, ids: readonly T[]): T[] {
    if (!Array.isArray(raw) || raw.some(id => !ids.includes(id)) || new Set(raw).size !== raw.length) return fail();
    return ids.filter(id => raw.includes(id));
  }
  const personas: PersonaSettings["personas"] = [];
  for (const raw of candidate.personas) {
    if (!raw || typeof raw !== "object") return fail();
    const entry = raw as Record<string, unknown>;
    if (!isPersonaId(entry.id) || personas.some(persona => persona.id === entry.id) || !Array.isArray(entry.sections)) return fail();
    const sections = selection(entry.sections, PERSONA_SECTIONS.map(section => section.id));
    // Version 1 had only section gates. Upgrade in memory, without rewriting storage on read.
    const pages = candidate.schemaVersion === 1 ? PERSONA_PAGES.filter(page => sections.includes(page.section)).map(page => page.id)
      : selection(entry.pages, [...PERSONA_PAGES.map(page => page.id), ...RETIRED_PERSONA_PAGES]).filter(id => !RETIRED_PERSONA_PAGES.includes(id));
    const popups = candidate.schemaVersion === 1 ? PERSONA_POPUPS.map(popup => popup.id)
      : selection(entry.popups, PERSONA_POPUPS.map(popup => popup.id));
    personas.push({ id: entry.id, sections, pages, popups });
  }
  // Only Business Reporting may be absent from older saved configurations. Never refill existing selections.
  if (!requireAllPersonas && personas.length === PERSONAS.length - 1 && !personas.some(persona => persona.id === "business-reporting")) {
    personas.push(defaultPersonaConfiguration("business-reporting"));
  }
  if (personas.length !== PERSONAS.length) return fail();
  return { schemaVersion: 2,
    updatedAt: typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt)) ? candidate.updatedAt : "1970-01-01T00:00:00.000Z",
    personas: PERSONAS.map(persona => personas.find(entry => entry.id === persona.id)!) };
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
  let pathname = url.pathname.replace(/\/$/, "") || "/";
  if (pathname.startsWith("/networks/")) { url.searchParams.set("networkDetails", pathname.slice(10)); pathname = "/network-risk-profile"; }
  if (pathname.startsWith("/systems/")) { url.searchParams.set("systemDetails", pathname.slice(9)); pathname = "/ict-system-risk-profile"; }
  if (pathname === "/networks" || pathname === "/systems") {
    pathname = scopeIds(url.searchParams.getAll("network")).length ? "/network-risk-profile"
      : scopeIds(url.searchParams.getAll("system")).length ? "/ict-system-risk-profile"
      : pathname === "/networks" ? "/network-risk-profile" : "/ict-system-risk-profile";
  }
  if (pathname === "/cyber-cop" && url.searchParams.get("copView") === "network-impact-analyser") {
    pathname = scopeIds(url.searchParams.getAll("system")).length && !scopeIds(url.searchParams.getAll("network")).length ? "/ict-system-risk-profile" : "/network-risk-profile";
  }
  if (pathname === "/measures") {
    const tab = resolveMeasuresTab(url.searchParams.get("measuresTab") ?? undefined);
    if (tab === "spi-settings") return {}; // Settings compatibility route always stays available.
    url.searchParams.set("measuresTab", tab);
  }
  if (pathname === "/discovery-coverage" && url.searchParams.get("discoveryView") === "overview") pathname = "/governance/discovery-insights";
  if (pathname === "/discovery-coverage" && !PERSONA_PAGES.some(page => page.href.includes(`discoveryView=${url.searchParams.get("discoveryView")}`))) {
    url.searchParams.set("discoveryView", "tools"); // Same fallback as the page, including tools-2.
  }
  const pageId = activeWorkspaceItem(pathname, url.searchParams)?.id;
  const popup = pageId === "network-risk-profile" && url.searchParams.has("networkDetails") ? "network-details"
    : pageId === "ict-system-risk-profile" && url.searchParams.has("systemDetails") ? "ict-system-details" : undefined;
  return { pageId, popup };
}

export function personaAllowsHref(settings: PersonaSettings, persona: PersonaId | null, href: string): boolean {
  const { pageId, popup } = personaDestination(href);
  return (!pageId || personaShowsPage(settings, persona, pageId)) && (!popup || personaAllowsPopup(settings, persona, popup));
}
