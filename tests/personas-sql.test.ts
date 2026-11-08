import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPersonaSettings, savePersonaSettings } from "@/lib/sql-persona-settings";
import { executeSqlJson } from "@/lib/sql-server";
import { defaultPersonaSettings, parsePersonaSettings, PersonaConflictError } from "@/lib/personas";
vi.mock("@/lib/sql-server", () => ({ executeSqlJson: vi.fn(), toSqlUnicodeLiteral: (value: string) => `N'${value.replaceAll("'", "''")}'` }));
beforeEach(() => vi.resetAllMocks());
describe("SQL data-driven personas", () => {
  it("reads the latest stored names, order, IDs and permissions without inserting defaults", async () => {
    const settings = { ...defaultPersonaSettings(), personas: [{ id: "custom-auditor", label: "Auditor's view", sections: ["findings"], pages: ["findings-register"], popups: [] }] };
    vi.mocked(executeSqlJson).mockResolvedValue({ settings: JSON.stringify(settings) });
    expect(await loadPersonaSettings()).toEqual(settings);
    expect(vi.mocked(executeSqlJson).mock.calls[0][0]).toContain("ORDER BY [settings_version_id] DESC");
    expect(vi.mocked(executeSqlJson).mock.calls[0][0]).not.toContain("INSERT");
  });
  it("uses bootstrap data only when no revision exists, preserving an intentionally empty catalogue", async () => {
    vi.mocked(executeSqlJson).mockResolvedValueOnce(null).mockResolvedValueOnce({ settings: JSON.stringify({ ...defaultPersonaSettings(), personas: [] }) });
    expect(await loadPersonaSettings()).toEqual(defaultPersonaSettings());
    expect((await loadPersonaSettings()).personas).toEqual([]);
  });
  it.each([1, 2])("upgrades legacy version %i without modifying the stored revision", async schemaVersion => {
    const defaults = defaultPersonaSettings();
    const legacy = { ...defaults, schemaVersion, personas: defaults.personas.slice(0, 4).map(({ label: _label, ...entry }) => ({ ...entry, sections: [], pages: [], popups: [] })) };
    vi.mocked(executeSqlJson).mockResolvedValue({ settings: JSON.stringify(legacy) });
    expect(await loadPersonaSettings()).toEqual(parsePersonaSettings(legacy));
    expect(executeSqlJson).toHaveBeenCalledOnce();
    await expect(savePersonaSettings(legacy)).rejects.toThrow(/Reload the application/);
    expect(executeSqlJson).toHaveBeenCalledOnce();
  });
  it("validates before SQL and returns the persisted server revision", async () => {
    await expect(savePersonaSettings({})).rejects.toThrow(); expect(executeSqlJson).not.toHaveBeenCalled();
    const draft = defaultPersonaSettings(); draft.personas[0].label = "Reviewer's view";
    const saved = { ...draft, updatedAt: "2026-11-08T12:30:00.000Z" };
    vi.mocked(executeSqlJson).mockResolvedValue({ settings: JSON.stringify(saved) });
    expect(await savePersonaSettings(draft)).toEqual(saved);
    const query = vi.mocked(executeSqlJson).mock.calls[0][0];
    expect(query).toContain("Reviewer''s view");
    expect(query).toContain("UPDLOCK, HOLDLOCK"); expect(query).toContain("COMMIT TRANSACTION"); expect(query).toContain("ROLLBACK TRANSACTION");
    expect(query).toContain(draft.updatedAt);
  });
  it("reports conflicts and provider errors without claiming a save", async () => {
    vi.mocked(executeSqlJson).mockResolvedValueOnce({ conflict: true }).mockRejectedValueOnce(new Error("unavailable"));
    await expect(savePersonaSettings(defaultPersonaSettings())).rejects.toBeInstanceOf(PersonaConflictError);
    await expect(savePersonaSettings(defaultPersonaSettings())).rejects.toThrow("unavailable");
  });
});
