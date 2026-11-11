import "server-only";
import { promises as fs } from "node:fs";
import { defaultPersonaSettings, parsePersonaSettings, PersonaConflictError, type PersonaSettings } from "@/lib/personas";
import { atomicWriteJson, loadStoreManifest, storePath, withStoreWriteLock } from "./files";

const file = "settings/personas.json";
export async function loadPersonaSettings(): Promise<PersonaSettings> {
  await loadStoreManifest();
  let source: string;
  try { source = await fs.readFile(storePath(file), "utf8"); }
  catch (error) {
    // Optional additive settings file: old stores stay unchanged until the first explicit save.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultPersonaSettings();
    throw error;
  }
  return parsePersonaSettings(JSON.parse(source.replace(/^\uFEFF/, "")));
}

export async function savePersonaSettings(input: unknown): Promise<PersonaSettings> {
  const settings = parsePersonaSettings(input, { forWrite: true });
  await loadStoreManifest();
  return withStoreWriteLock(async () => {
    const previous = await loadPersonaSettings();
    if (settings.updatedAt !== previous.updatedAt) throw new PersonaConflictError();
    settings.updatedAt = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString();
    await atomicWriteJson("settings/history/personas-" + settings.updatedAt.replaceAll(":", "-") + ".json", settings);
    await atomicWriteJson(file, settings);
    return settings;
  });
}
