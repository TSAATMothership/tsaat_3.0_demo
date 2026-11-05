import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { loadPersonaSettings, savePersonaSettings } from "@/lib/json-store/persona-settings";
import { defaultPersonaSettings, parsePersonaSettings } from "@/lib/personas";

const directory = mkdtempSync(path.join(os.tmpdir(), "tsaat-persona-test-"));
const previous = process.env.TSAAT_JSON_DATA_DIR;
const file = path.join(directory, "settings/personas.json");
beforeAll(async () => { process.env.TSAAT_JSON_DATA_DIR = directory; await initializeJsonStore({ target: directory }); });
afterAll(() => {
  if (previous === undefined) delete process.env.TSAAT_JSON_DATA_DIR; else process.env.TSAAT_JSON_DATA_DIR = previous;
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-persona-test-")) throw new Error("Unsafe test directory.");
  rmSync(directory, { recursive: true, force: true });
});
describe.sequential("JSON persona persistence", () => {
  it("reads additive defaults without modifying an existing store", async () => {
    expect(await loadPersonaSettings()).toEqual(defaultPersonaSettings());
    expect(existsSync(file)).toBe(false);
  });
  it("saves all personas and retains selections through reinitialization", async () => {
    const settings = defaultPersonaSettings(); settings.personas[0].sections = [];
    settings.personas[1].sections = ["findings"];
    const saved = await savePersonaSettings(settings);
    expect(saved.updatedAt).not.toBe(settings.updatedAt);
    expect(await loadPersonaSettings()).toEqual(saved);
    const original = readFileSync(file, "utf8");
    await initializeJsonStore({ target: directory });
    expect(readFileSync(file, "utf8")).toBe(original);
    expect(readdirSync(path.join(directory, "settings/history")).filter(name => name.startsWith("personas-"))).toHaveLength(1);
  });
  it("rejects invalid writes without changing the current configuration", async () => {
    const before = readFileSync(file, "utf8");
    await expect(savePersonaSettings({ personas: [] })).rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("serializes concurrent full saves without mixing persona sections", async () => {
    const a = defaultPersonaSettings(), b = defaultPersonaSettings();
    a.personas[0].sections = ["findings"]; b.personas[0].sections = ["governance"];
    const results = await Promise.all([savePersonaSettings(a), savePersonaSettings(b)]);
    expect(results[0].updatedAt).not.toBe(results[1].updatedAt);
    expect(results).toContainEqual(await loadPersonaSettings());
    expect(existsSync(path.join(directory, ".write-lock"))).toBe(false);
  });
  it("reports corrupt files and refuses to overwrite them with defaults", async () => {
    writeFileSync(file, "{broken");
    await expect(loadPersonaSettings()).rejects.toThrow();
    await expect(savePersonaSettings(defaultPersonaSettings())).rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe("{broken");
  });
  it("reads legacy settings without writes and upgrades only on explicit save", async () => {
    const legacy = { ...defaultPersonaSettings(), schemaVersion: 1, personas: defaultPersonaSettings().personas.map(({ id }, index) => ({ id, sections: index ? [] : ["discovery"] })) };
    writeFileSync(file, JSON.stringify(legacy));
    const original = readFileSync(file, "utf8");
    expect(await loadPersonaSettings()).toEqual(parsePersonaSettings(legacy));
    expect(readFileSync(file, "utf8")).toBe(original);
    const upgraded = parsePersonaSettings(legacy);
    upgraded.personas[0].pages = ["discovery-overview"];
    upgraded.personas[0].popups = [];
    await savePersonaSettings(upgraded);
    expect((await loadPersonaSettings()).personas[0]).toEqual(upgraded.personas[0]);
    expect(JSON.parse(readFileSync(file, "utf8")).schemaVersion).toBe(2);
  });
  it.each([1, 2])("adds Business Reporting to four-persona version %i files without rewriting them", async schemaVersion => {
    const original = defaultPersonaSettings();
    original.personas[0] = { id: "analyst", sections: [], pages: [], popups: [] };
    const personas = original.personas.filter(persona => persona.id !== "business-reporting");
    const legacy = { ...original, schemaVersion, personas: schemaVersion === 1 ? personas.map(({ id, sections }) => ({ id, sections })) : personas };
    writeFileSync(file, JSON.stringify(legacy));
    const before = readFileSync(file, "utf8");
    const upgraded = await loadPersonaSettings();
    expect(upgraded).toEqual(parsePersonaSettings(legacy));
    expect(upgraded.personas[4].id).toBe("business-reporting");
    expect(upgraded.personas[0].pages).toEqual([]);
    expect(readFileSync(file, "utf8")).toBe(before);
    await expect(savePersonaSettings(legacy)).rejects.toThrow(/complete persona configuration/);
    expect(readFileSync(file, "utf8")).toBe(before);
    upgraded.personas[4] = { id: "business-reporting", sections: ["briefs-reports"], pages: ["briefs-reports"], popups: [] };
    const saved = await savePersonaSettings(upgraded);
    await initializeJsonStore({ target: directory });
    expect(await loadPersonaSettings()).toEqual(saved);
    expect(JSON.parse(readFileSync(file, "utf8")).personas[4]).toEqual(upgraded.personas[4]);
  });
});

it("ignores retired Overview permission on read and removes it only on explicit save", async () => {
  const legacy = defaultPersonaSettings();
  legacy.personas[0].pages = ["governance-overview"];
  legacy.personas[1].pages.push("governance-overview");
  writeFileSync(file, JSON.stringify(legacy));
  const original = readFileSync(file, "utf8");
  const loaded = await loadPersonaSettings();
  expect(loaded.personas[0].pages).toEqual([]);
  expect(loaded.personas[0].sections).toEqual(legacy.personas[0].sections);
  expect(loaded.personas[1].pages).toEqual(defaultPersonaSettings().personas[1].pages);
  expect(readFileSync(file, "utf8")).toBe(original);
  const saved = await savePersonaSettings(legacy);
  expect(saved.personas).toEqual(loaded.personas);
  expect(readFileSync(file, "utf8")).not.toContain("governance-overview");
  await initializeJsonStore({ target: directory });
  expect(await loadPersonaSettings()).toEqual(saved);
});
