import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { loadPersonaSettings, savePersonaSettings } from "@/lib/json-store/persona-settings";
import { defaultPersonaSettings, parsePersonaSettings, PersonaConflictError } from "@/lib/personas";
const directory = mkdtempSync(path.join(os.tmpdir(), "tsaat-persona-test-"));
const previous = process.env.TSAAT_JSON_DATA_DIR;
const file = path.join(directory, "settings/personas.json");
beforeAll(async () => { process.env.TSAAT_JSON_DATA_DIR = directory; await initializeJsonStore({ target: directory }); });
afterAll(() => {
  if (previous === undefined) delete process.env.TSAAT_JSON_DATA_DIR; else process.env.TSAAT_JSON_DATA_DIR = previous;
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-persona-test-")) throw new Error("Unsafe test directory.");
  rmSync(directory, { recursive: true, force: true });
});
describe.sequential("JSON data-driven persona persistence", () => {
  it("initializes the shared catalogue in a fresh store and leaves old stores without a file unchanged on read", async () => {
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(defaultPersonaSettings());
    unlinkSync(file);
    expect(await loadPersonaSettings()).toEqual(defaultPersonaSettings()); expect(existsSync(file)).toBe(false);
  });
  it("round-trips added/renamed/reordered personas and survives reinitialization", async () => {
    const settings = await loadPersonaSettings();
    settings.personas = [{ id: "custom-reviewer", label: "Reviewer's view", sections: ["findings"], pages: ["findings-register"], popups: [] }, ...settings.personas.slice(0, 2).reverse()];
    settings.personas[1].label = "Renamed persona";
    const saved = await savePersonaSettings(settings);
    expect(saved.updatedAt).not.toBe(settings.updatedAt);
    expect(await loadPersonaSettings()).toEqual(saved);
    const original = readFileSync(file, "utf8"); await initializeJsonStore({ target: directory });
    expect(readFileSync(file, "utf8")).toBe(original);
    expect(readdirSync(path.join(directory, "settings/history")).filter(name => name.startsWith("personas-"))).toHaveLength(1);
  });
  it("rejects invalid and stale writes without changing saved data", async () => {
    const before = readFileSync(file, "utf8");
    await expect(savePersonaSettings({ personas: [] })).rejects.toThrow();
    await expect(savePersonaSettings(defaultPersonaSettings())).rejects.toBeInstanceOf(PersonaConflictError);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("allows exactly one concurrent save from the same revision", async () => {
    const current = await loadPersonaSettings(), a = structuredClone(current), b = structuredClone(current);
    a.personas[0].label = "First writer"; b.personas[0].label = "Second writer";
    const results = await Promise.allSettled([savePersonaSettings(a), savePersonaSettings(b)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason instanceof PersonaConflictError).toBe(true);
    const fulfilled = results.find(result => result.status === "fulfilled");
    expect(await loadPersonaSettings()).toEqual(fulfilled?.status === "fulfilled" ? fulfilled.value : undefined);
    expect(existsSync(path.join(directory, ".write-lock"))).toBe(false);
  });
  it("persists removal of all personas without repopulating defaults", async () => {
    const current = await loadPersonaSettings(); current.personas = [];
    const saved = await savePersonaSettings(current);
    expect(await loadPersonaSettings()).toEqual(saved); expect(saved.personas).toEqual([]);
  });
  it("refuses to overwrite corrupt settings with defaults", async () => {
    writeFileSync(file, "{broken");
    await expect(loadPersonaSettings()).rejects.toThrow();
    await expect(savePersonaSettings(defaultPersonaSettings())).rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe("{broken");
  });
  it.each([1, 2])("upgrades legacy version %i only on explicit save", async schemaVersion => {
    const legacy = { ...defaultPersonaSettings(), schemaVersion, personas: defaultPersonaSettings().personas.slice(0, 4).map(({ label: _label, ...entry }) => ({ ...entry, sections: [], pages: [], popups: [] })) };
    writeFileSync(file, JSON.stringify(legacy)); const before = readFileSync(file, "utf8");
    const loaded = await loadPersonaSettings(); expect(loaded).toEqual(parsePersonaSettings(legacy));
    expect(readFileSync(file, "utf8")).toBe(before);
    await expect(savePersonaSettings(legacy)).rejects.toThrow();
    const saved = await savePersonaSettings(loaded);
    expect(await loadPersonaSettings()).toEqual(saved); expect(JSON.parse(readFileSync(file, "utf8")).schemaVersion).toBe(3);
  });
  it("preserves direct source edits and removes only retired page permissions", async () => {
    const direct = { ...defaultPersonaSettings(), personas: [{ id: "source-persona", label: "From JSON", sections: ["governance"], pages: ["governance-overview"], popups: [] }] };
    writeFileSync(file, JSON.stringify(direct)); const before = readFileSync(file, "utf8");
    const loaded = await loadPersonaSettings(); expect(loaded.personas[0]).toMatchObject({ id: "source-persona", label: "From JSON", pages: [] });
    expect(readFileSync(file, "utf8")).toBe(before);
    await savePersonaSettings(loaded); expect(readFileSync(file, "utf8")).not.toContain("governance-overview");
  });
});
