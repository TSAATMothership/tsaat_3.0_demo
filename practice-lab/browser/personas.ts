import { parsePersonaSettings, PersonaConflictError } from '@/lib/personas';
import { readJson, atomicWriteJson, withStoreWriteLock } from './store';
export async function loadPersonaSettings() { return parsePersonaSettings(await readJson('settings/personas.json')); }
export async function savePersonaSettings(input: unknown) {
  return withStoreWriteLock(async () => {
    const settings = parsePersonaSettings(input, { forWrite: true });
    const previous = await loadPersonaSettings();
    if (settings.updatedAt !== previous.updatedAt) throw new PersonaConflictError();
    settings.updatedAt = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString();
    await atomicWriteJson('settings/personas.json', settings); return settings;
  });
}
