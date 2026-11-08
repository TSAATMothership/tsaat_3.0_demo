import { describe, expect, it } from "vitest";
import { defaultPersonaSettings, isPersonaId, parsePersonaSettings, personaShowsSection, personaShowsPage, personaAllowsHref, personaAllowsPopup, personaDestination, PERSONAS, PERSONA_SECTIONS, PERSONA_PAGES, PERSONA_POPUPS } from "@/lib/personas";
import { isWorkspaceItemVisible, WORKSPACE_GROUPS, workspaceHref } from "@/lib/workspace-navigation";

describe("persona navigation preferences", () => {
  it("starts every named persona with all existing sidebar sections enabled", () => {
    const settings = defaultPersonaSettings();
    expect(PERSONAS.map(p => p.label)).toEqual(["Analyst", "Life Cycle Management", "Configuration Management", "DSOC Analyst", "Business Reporting"]);
    expect(PERSONA_SECTIONS.map(s => s.label)).toEqual([...WORKSPACE_GROUPS.map(g => g.label), "Briefs & Reports"]);
    for (const persona of settings.personas) expect(persona.sections).toHaveLength(6);
    settings.personas[0].sections.length = 0;
    expect(settings.personas[1].sections).toHaveLength(6);
    expect(defaultPersonaSettings().personas[0].sections).toHaveLength(6);
  });
  it("retains empty selections, isolates personas and leaves no-persona navigation available", () => {
    const input = defaultPersonaSettings();
    input.personas[0].sections = [];
    const settings = parsePersonaSettings(input);
    expect(personaShowsSection(settings, "analyst", "discovery")).toBe(false);
    expect(personaShowsSection(settings, "dsoc-analyst", "discovery")).toBe(true);
    expect(personaShowsSection(settings, null, "discovery")).toBe(true);
    expect(isPersonaId("administrator")).toBe(false);
  });
  it("retires Overview without granting Trends or changing other saved preferences", () => {
    const legacy = defaultPersonaSettings();
    legacy.personas[0].sections = ["governance"];
    legacy.personas[0].pages = ["governance-overview"];
    legacy.personas[0].popups = [];
    legacy.personas[1].pages.push("governance-overview");
    const before = JSON.stringify(legacy);
    for (const requireAllPersonas of [false, true]) {
      const settings = parsePersonaSettings(legacy, { requireAllPersonas });
      expect(settings.personas[0]).toEqual({ id: "analyst", sections: ["governance"], pages: [], popups: [] });
      expect(settings.personas[1].pages).toEqual(defaultPersonaSettings().personas[1].pages);
      expect(settings.personas.slice(2)).toEqual(legacy.personas.slice(2));
      expect(personaShowsSection(settings, "analyst", "governance")).toBe(false);
      expect(personaAllowsHref(settings, "analyst", "/governance/overview?network=net-1")).toBe(false);
      expect(personaAllowsHref(settings, "life-cycle-management", "/governance/overview")).toBe(true);
    }
    expect(JSON.stringify(legacy)).toBe(before);
    expect(PERSONA_PAGES.some(page => page.id === "governance-overview")).toBe(false);
    legacy.personas[0].pages.push("governance-overview");
    expect(() => parsePersonaSettings(legacy)).toThrow(); // Retired IDs still cannot be duplicated.
  });
  it.each([
    null, {}, { ...defaultPersonaSettings(), schemaVersion: 3 },
    { ...defaultPersonaSettings(), personas: [] },
    { ...defaultPersonaSettings(), personas: Array(4).fill({ id: "analyst", sections: [] }) },
    { ...defaultPersonaSettings(), personas: [{ id: "unknown", sections: [] }, ...defaultPersonaSettings().personas.slice(1)] },
    { ...defaultPersonaSettings(), personas: [{ id: "analyst", sections: ["discovery", "discovery"] }, ...defaultPersonaSettings().personas.slice(1)] },
    { ...defaultPersonaSettings(), personas: [{ id: "analyst", sections: ["/admin"] }, ...defaultPersonaSettings().personas.slice(1)] },
    { ...defaultPersonaSettings(), personas: [{ id: "analyst", sections: "discovery" }, ...defaultPersonaSettings().personas.slice(1)] }
  ])("rejects incomplete or unsupported settings: %j", input => {
    expect(() => parsePersonaSettings(input)).toThrow(/complete persona configuration/);
  });
  it.each([1, 2])("adds Business Reporting when reading the original four-persona version %i catalogue", schemaVersion => {
    const current = defaultPersonaSettings();
    current.personas[0] = { id: "analyst", sections: [], pages: [], popups: [] };
    current.personas[1] = { id: "life-cycle-management", sections: ["discovery"], pages: ["discovery-overview"], popups: ["cmdb-details"] };
    const originalPersonas = current.personas.filter(persona => persona.id !== "business-reporting");
    const legacy = { ...current, schemaVersion, personas: schemaVersion === 1 ? originalPersonas.map(({ id, sections }) => ({ id, sections })) : originalPersonas };
    const before = JSON.stringify(legacy);
    const upgraded = parsePersonaSettings(legacy);
    expect(upgraded.personas).toHaveLength(5);
    expect(upgraded.personas[0].sections).toEqual([]);
    expect(upgraded.personas[0].pages).toEqual([]);
    if (schemaVersion === 2) expect(upgraded.personas.slice(0, 4)).toEqual(originalPersonas);
    else {
      expect(upgraded.personas[1].pages).toEqual(PERSONA_SECTIONS.find(section => section.id === "discovery")!.pages.map(page => page.id));
      expect(upgraded.personas[0].popups).toEqual(PERSONA_POPUPS.map(popup => popup.id));
    }
    expect(upgraded.personas[4]).toEqual({ id: "business-reporting", sections: PERSONA_SECTIONS.map(section => section.id), pages: PERSONA_PAGES.map(page => page.id), popups: PERSONA_POPUPS.map(popup => popup.id) });
    expect(upgraded.updatedAt).toBe(current.updatedAt);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(() => parsePersonaSettings(legacy, { requireAllPersonas: true })).toThrow(/complete persona configuration/);
    expect(parsePersonaSettings(upgraded, { requireAllPersonas: true })).toEqual(upgraded);
  });
  it("does not refill configured Business Reporting permissions or accept missing original personas", () => {
    const configured = defaultPersonaSettings();
    configured.personas[4] = { id: "business-reporting", sections: ["briefs-reports"], pages: ["briefs-reports"], popups: [] };
    const saved = parsePersonaSettings(configured);
    expect(isPersonaId("business-reporting")).toBe(true);
    expect(saved).toEqual(configured);
    expect(personaAllowsHref(saved, "business-reporting", "/report")).toBe(true);
    expect(personaAllowsHref(saved, "business-reporting", "/findings")).toBe(false);
    expect(personaAllowsPopup(saved, "business-reporting", "cmdb-details")).toBe(false);
    for (const missing of PERSONAS.filter(persona => persona.id !== "business-reporting")) {
      expect(() => parsePersonaSettings({ ...configured, personas: configured.personas.filter(persona => persona.id !== missing.id) })).toThrow();
    }
  });
  it("applies persona sections in addition to existing network/system visibility and retains scope/date", () => {
    const settings = defaultPersonaSettings();
    const cyber = WORKSPACE_GROUPS.find(g => g.id === "cyber-security")!;
    const params = new URLSearchParams("network=net-1&securityDomain=SECRET&dataDate=2026-03-05");
    const visible = cyber.items.filter(item => personaShowsSection(settings, "analyst", cyber.id) && isWorkspaceItemVisible(item, params, item.href));
    expect(visible.some(item => item.label === "ICT System Impact Analyser")).toBe(false);
    expect(visible.some(item => item.label === "Network Risk Profile")).toBe(true);
    expect(workspaceHref("/findings", params)).toBe("/findings?network=net-1&securityDomain=SECRET&dataDate=2026-03-05");
    settings.personas[0].sections = ["discovery"];
    expect(cyber.items.filter(item => personaShowsSection(settings, "analyst", cyber.id) && isWorkspaceItemVisible(item, params, item.href))).toEqual([]);
  });
  it("upgrades section-only settings in memory, preserving hidden sections and enabling existing popups", () => {
    const legacy = { schemaVersion: 1, updatedAt: "2026-11-05T00:00:00Z", personas: PERSONAS.map(({ id }, index) => ({ id, sections: index === 0 ? ["discovery"] : [] })) };
    const before = JSON.stringify(legacy);
    const settings = parsePersonaSettings(legacy);
    expect(settings.schemaVersion).toBe(2);
    expect(settings.personas[0].pages).toEqual(PERSONA_SECTIONS.find(section => section.id === "discovery")!.pages.map(page => page.id));
    expect(settings.personas[1].pages).toEqual([]);
    expect(settings.personas.every(persona => persona.popups.length === PERSONA_POPUPS.length)).toBe(true);
    expect(JSON.stringify(legacy)).toBe(before);
  });
  it("filters individual pages while leaving other pages and independently enabled popups available", () => {
    const settings = defaultPersonaSettings();
    settings.personas[0].pages = ["discovery-overview"];
    settings.personas[0].popups = ["cmdb-details"];
    expect(personaShowsSection(settings, "analyst", "governance")).toBe(true);
    expect(personaShowsSection(settings, "analyst", "findings")).toBe(false);
    expect(personaShowsPage(settings, "analyst", "discovery-tools")).toBe(false);
    expect(personaShowsPage(settings, "life-cycle-management", "discovery-tools")).toBe(true);
    expect(personaAllowsPopup(settings, "analyst", "cmdb-details")).toBe(true);
    expect(personaAllowsPopup(settings, "analyst", "impact-graph")).toBe(false);
    expect(personaAllowsPopup(settings, null, "impact-graph")).toBe(true);
    for (const page of PERSONA_PAGES) expect(personaDestination(page.href).pageId).toBe(page.id);
  });
  it.each([
    ["/governance/overview?securityDomain=SECRET&dataDate=2026-01-01", "governance-trends"],
    ["/networks/net-1?dataDate=2026-01-01", "network-risk-profile"],
    ["/systems/sys-1", "ict-system-risk-profile"],
    ["/networks?system=sys-1", "ict-system-risk-profile"],
    ["/systems?network=net-1", "network-risk-profile"],
    ["/cyber-cop?copView=network-impact-analyser&system=sys-1", "ict-system-risk-profile"],
    ["/discovery-coverage?discoveryView=tools-2", "discovery-tools"],
    ["/discovery-coverage?discoveryView=unknown", "discovery-tools"],
    ["/measures?measuresTab=%20MEASURES-SPI%20&network=net-1", "measures-spi"],
    ["/measures?measuresTab=invalid", "measures-summary"],
    ["/findings/?severity=High+Risk#table", "findings-register"]
  ])("maps compatibility and filtered destinations: %s", (href, page) => {
    const settings = defaultPersonaSettings(); settings.personas[0].pages = [];
    expect(personaDestination(href).pageId).toBe(page);
    expect(personaAllowsHref(settings, "analyst", href)).toBe(false);
    expect(personaAllowsHref(settings, null, href)).toBe(true);
  });
  it("requires both page and popup permission for links that open entity details", () => {
    const settings = defaultPersonaSettings(); settings.personas[0].popups = [];
    expect(personaAllowsHref(settings, "analyst", "/network-risk-profile?networkDetails=net-1")).toBe(false);
    expect(personaAllowsHref(settings, "analyst", "/networks/net-1")).toBe(false);
    expect(personaAllowsHref(settings, "analyst", "/systems/sys-1")).toBe(false);
    expect(personaAllowsHref(settings, "analyst", "/network-risk-profile")).toBe(true);
    for (const href of ["/settings", "/measures?measuresTab=settings", "/api/findings/report", "https://example.test/findings", "#section", "mailto:a@example.test"]) {
      expect(personaAllowsHref(settings, "analyst", href)).toBe(true);
    }
  });
  it.each(["pages", "popups"] as const)("rejects missing, duplicate or unknown %s in version 2", key => {
    for (const invalid of [undefined, ["unknown"], ["cmdb-details", "cmdb-details"], "all"]) {
      const settings = defaultPersonaSettings();
      const input = { ...settings, personas: settings.personas.map((p, index) => index ? p : { ...p, [key]: invalid }) };
      expect(() => parsePersonaSettings(input)).toThrow();
    }
  });
});
