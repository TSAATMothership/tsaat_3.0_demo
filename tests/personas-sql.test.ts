import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPersonaSettings, parsePersonaSettings } from "@/lib/personas";
import { executeSqlJson, executeSqlText } from "@/lib/sql-server";
import { loadPersonaSettings, savePersonaSettings } from "@/lib/sql-persona-settings";
vi.mock("@/lib/sql-server", () => ({ executeSqlJson: vi.fn(), executeSqlText: vi.fn(), toSqlUnicodeLiteral: (value: string) => "N'" + value.replaceAll("'", "''") + "'" }));
beforeEach(() => vi.resetAllMocks());
describe("SQL persona provider", () => {
  it("normalizes retired Overview permissions without a read-time write or replacement grant", async () => {
    const legacy = defaultPersonaSettings(); legacy.personas[0].pages = ["governance-overview"];
    vi.mocked(executeSqlJson).mockResolvedValue({ settings: JSON.stringify(legacy) });
    const loaded = await loadPersonaSettings();
    expect(loaded.personas[0].pages).toEqual([]);
    expect(loaded.personas[0].sections).toEqual(legacy.personas[0].sections);
    expect(loaded.personas.slice(1)).toEqual(legacy.personas.slice(1));
    expect(executeSqlText).not.toHaveBeenCalled();
    const saved = await savePersonaSettings(legacy);
    expect(saved.personas).toEqual(loaded.personas);
    expect(vi.mocked(executeSqlText).mock.calls[0][0]).not.toContain("governance-overview");
    expect(vi.mocked(executeSqlText).mock.calls[0][0]).toContain(JSON.stringify(saved));
  });
  it("uses additive defaults for an empty migrated table", async () => {
    vi.mocked(executeSqlJson).mockResolvedValue(null);
    expect(await loadPersonaSettings()).toEqual(defaultPersonaSettings());
    expect(vi.mocked(executeSqlJson).mock.calls[0][0]).toContain("FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), N'null')");
    expect(executeSqlText).not.toHaveBeenCalled();
  });
  it("loads stored sections without filling deliberately hidden sections", async () => {
    const saved = defaultPersonaSettings(); saved.personas[0].sections = [];
    vi.mocked(executeSqlJson).mockResolvedValue({ settings: JSON.stringify(saved) });
    expect(await loadPersonaSettings()).toEqual(saved);
    expect(vi.mocked(executeSqlJson).mock.calls[0][0]).toContain("ORDER BY [settings_version_id] DESC");
  });
  it("validates before writing and reports storage failure without success", async () => {
    await expect(savePersonaSettings({})).rejects.toThrow();
    expect(executeSqlText).not.toHaveBeenCalled();
    vi.mocked(executeSqlText).mockRejectedValue(new Error("Storage unavailable"));
    await expect(savePersonaSettings(defaultPersonaSettings())).rejects.toThrow("Storage unavailable");
  });
  it("appends one complete settings revision with a server timestamp", async () => {
    const settings = defaultPersonaSettings(); settings.personas[2].sections = ["discovery"];
    settings.personas[2].pages = ["discovery-overview"];
    settings.personas[2].popups = [];
    const saved = await savePersonaSettings(settings);
    expect(saved.personas).toEqual(settings.personas);
    expect(saved.updatedAt).not.toBe(settings.updatedAt);
    expect(executeSqlText).toHaveBeenCalledOnce();
    expect(vi.mocked(executeSqlText).mock.calls[0][0]).toContain(JSON.stringify(saved));
  });
  it("upgrades stored section-only revisions without rewriting them", async () => {
    const legacy = { schemaVersion: 1, personas: defaultPersonaSettings().personas.map(({ id }) => ({ id, sections: ["discovery"] })) };
    vi.mocked(executeSqlJson).mockResolvedValue({ settings: JSON.stringify(legacy) });
    expect(await loadPersonaSettings()).toEqual(parsePersonaSettings(legacy));
    expect(executeSqlText).not.toHaveBeenCalled();
  });
  it.each([1, 2])("adds Business Reporting to four-persona version %i revisions only in memory", async schemaVersion => {
    const original = defaultPersonaSettings();
    original.personas[0] = { id: "analyst", sections: [], pages: [], popups: [] };
    const personas = original.personas.filter(persona => persona.id !== "business-reporting");
    const legacy = { ...original, schemaVersion, personas: schemaVersion === 1 ? personas.map(({ id, sections }) => ({ id, sections })) : personas };
    vi.mocked(executeSqlJson).mockResolvedValue({ settings: JSON.stringify(legacy) });
    const upgraded = await loadPersonaSettings();
    expect(upgraded).toEqual(parsePersonaSettings(legacy));
    expect(upgraded.personas[4].id).toBe("business-reporting");
    expect(executeSqlText).not.toHaveBeenCalled();
    await expect(savePersonaSettings(legacy)).rejects.toThrow(/complete persona configuration/);
    expect(executeSqlText).not.toHaveBeenCalled();
    upgraded.personas[4] = { id: "business-reporting", sections: ["briefs-reports"], pages: ["briefs-reports"], popups: [] };
    const saved = await savePersonaSettings(upgraded);
    expect(saved.personas).toEqual(upgraded.personas);
    expect(executeSqlText).toHaveBeenCalledOnce();
    expect(vi.mocked(executeSqlText).mock.calls[0][0]).toContain(JSON.stringify(saved));
  });
});
