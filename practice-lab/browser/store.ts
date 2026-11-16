/** Virtual files backed only by the bundled sample ZIP and this window's edits. */
const parsed = new Map<string, Promise<unknown>>();
const edited = new Map<string, unknown>();
const versions = new Map<string, number>();
let archive: Promise<any>;
let writer = Promise.resolve();

export function jsonStoreDirectory() { return 'embedded-practice-data'; }
export function storePath(path: string) {
  if (!/^[\w./-]+$/.test(path) || path.startsWith('/') || path.split('/').includes('..')) throw Error('Invalid sample data path.');
  return path;
}
export async function readJson<T>(relative: string): Promise<T> {
  const path = storePath(relative);
  if (edited.has(path)) return structuredClone(edited.get(path)) as T;
  if (!archive) archive = (window as any).JSZip.loadAsync(document.getElementById('practice-data')!.textContent!.trim(), { base64: true });
  if (!parsed.has(path)) parsed.set(path, archive.then(async zip => {
    const file = zip.file(path);
    if (!file) throw Error('Missing bundled sample data: ' + path);
    return JSON.parse(await file.async('string'));
  }));
  return parsed.get(path)! as Promise<T>;
}
export async function fileVersion(path: string) { return String(versions.get(path) ?? 0); }
export async function loadStoreManifest() {
  const manifest = await readJson<any>('store.json');
  if (manifest.format !== 'tsaat-json-store' || manifest.schemaVersion !== 2 || manifest.snapshots.length !== 8) throw Error('Invalid practice data bundle.');
  return { ...manifest, snapshots: [...manifest.snapshots].sort((a, b) => a.date.localeCompare(b.date)) };
}
export async function atomicWriteJson(path: string, value: unknown) {
  storePath(path);
  if (!path.startsWith('settings/')) throw Error('Practice evidence is read-only.');
  edited.set(path, structuredClone(value)); versions.set(path, (versions.get(path) ?? 0) + 1);
}
export async function withStoreWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const next = writer.then(task); writer = next.then(() => {}, () => {}); return next;
}
