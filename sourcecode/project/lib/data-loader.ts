import { promises as fs } from "fs";
import path from "path";
import { normalizeDataDate, todayDateKey } from "@/lib/data-date";
import {
  defaultDiscoveryToolsSettings,
  DiscoveryToolsSettings,
  normalizeDiscoveryToolsSettings
} from "@/lib/discovery-tools-settings";
import { defaultMeasuresSettings, MeasuresSettings, normalizeMeasuresSettings } from "@/lib/measures-settings";
import { Dataset, ReferenceVersions } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const currentDatasetPath = path.join(dataDir, "current.json");
const snapshotsDir = path.join(dataDir, "snapshots");
const referenceVersionsPath = path.join(dataDir, "reference", "versions.json");
const measuresSettingsPath = path.join(dataDir, "measures-settings.json");
const discoveryToolsSettingsPath = path.join(dataDir, "discovery-tools-settings.json");

type JsonCacheEntry = {
  mtimeMs: number;
  size: number;
  value: unknown;
};

type SnapshotIndexEntry = {
  snapshotDate: string;
  filepath: string;
  source: "snapshot" | "current";
};

const jsonCache = new Map<string, JsonCacheEntry>();

let snapshotIndexSignature = "";
let snapshotIndexEntries: SnapshotIndexEntry[] | null = null;
let snapshotIndexPromise: Promise<SnapshotIndexEntry[]> | null = null;

type SnapshotFileInfo = {
  filename: string;
  filepath: string;
  mtimeMs: number;
  size: number;
};

async function readJsonFile<T>(filepath: string): Promise<T> {
  const stat = await fs.stat(filepath);
  const cached = jsonCache.get(filepath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.value as T;
  }

  const content = await fs.readFile(filepath, "utf-8");
  const parsed = JSON.parse(content) as T;
  jsonCache.set(filepath, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    value: parsed
  });
  return parsed;
}

async function primeJsonCache(filepath: string, value: unknown): Promise<void> {
  const stat = await fs.stat(filepath);
  jsonCache.set(filepath, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    value
  });
}

async function listSnapshotFiles(): Promise<SnapshotFileInfo[]> {
  const files = await fs.readdir(snapshotsDir);
  const snapshotFilenames = files
    .filter((filename) => filename.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const withStats = await Promise.all(
    snapshotFilenames.map(async (filename) => {
      const filepath = path.join(snapshotsDir, filename);
      const stat = await fs.stat(filepath);
      return {
        filename,
        filepath,
        mtimeMs: stat.mtimeMs,
        size: stat.size
      };
    })
  );

  return withStats;
}

async function buildSnapshotIndexSignature(): Promise<{
  signature: string;
  snapshotFiles: SnapshotFileInfo[];
}> {
  const [snapshotFiles, currentStat] = await Promise.all([listSnapshotFiles(), fs.stat(currentDatasetPath)]);
  const snapshotsSignature = snapshotFiles
    .map((file) => `${file.filename}:${file.mtimeMs}:${file.size}`)
    .join("|");

  return {
    signature: `current:${currentStat.mtimeMs}:${currentStat.size}|snapshots:${snapshotsSignature}`,
    snapshotFiles
  };
}

async function readSnapshotDate(filepath: string): Promise<string> {
  const handle = await fs.open(filepath, "r");
  try {
    const buffer = new Uint8Array(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = new TextDecoder("utf-8").decode(buffer.subarray(0, bytesRead));
    const matched = header.match(/"snapshotDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
    if (matched?.[1]) {
      return matched[1];
    }
  } finally {
    await handle.close();
  }

  const parsed = await readJsonFile<Dataset>(filepath);
  if (!parsed.snapshotDate) {
    throw new Error(`Dataset at ${filepath} is missing snapshotDate.`);
  }
  return parsed.snapshotDate;
}

async function buildSnapshotIndexEntries(snapshotFiles: SnapshotFileInfo[]): Promise<SnapshotIndexEntry[]> {
  const [snapshotEntries, currentSnapshotDate] = await Promise.all([
    Promise.all(
      snapshotFiles.map(async (file) => ({
        snapshotDate: await readSnapshotDate(file.filepath),
        filepath: file.filepath,
        source: "snapshot" as const
      }))
    ),
    readSnapshotDate(currentDatasetPath)
  ]);

  const byDate = new Map<string, SnapshotIndexEntry>();
  for (const entry of snapshotEntries) {
    byDate.set(entry.snapshotDate, entry);
  }
  byDate.set(currentSnapshotDate, {
    snapshotDate: currentSnapshotDate,
    filepath: currentDatasetPath,
    source: "current"
  });

  return Array.from(byDate.values()).sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
}

async function getSnapshotIndex(): Promise<SnapshotIndexEntry[]> {
  const { signature, snapshotFiles } = await buildSnapshotIndexSignature();
  if (snapshotIndexEntries && snapshotIndexSignature === signature) {
    return snapshotIndexEntries;
  }
  if (snapshotIndexPromise && snapshotIndexSignature === signature) {
    return snapshotIndexPromise;
  }

  snapshotIndexSignature = signature;
  const buildingSignature = signature;
  snapshotIndexPromise = buildSnapshotIndexEntries(snapshotFiles)
    .then((entries) => {
      if (snapshotIndexSignature === buildingSignature) {
        snapshotIndexEntries = entries;
        snapshotIndexPromise = null;
      }
      return entries;
    })
    .catch((error) => {
      if (snapshotIndexSignature === buildingSignature) {
        snapshotIndexPromise = null;
      }
      throw error;
    });

  return snapshotIndexPromise;
}

function targetDateKey(requestedDate: string | undefined): string {
  return normalizeDataDate(requestedDate) ?? todayDateKey();
}

function selectDatasetIndexEntry(entries: SnapshotIndexEntry[], requestedDate: string | undefined): SnapshotIndexEntry {
  if (!entries.length) {
    throw new Error("No datasets are available in the local timeline.");
  }

  const target = targetDateKey(requestedDate);
  const matching = entries.filter((entry) => entry.snapshotDate <= target);
  return matching[matching.length - 1] ?? entries[0];
}

export async function loadCurrentDataset(): Promise<Dataset> {
  return readJsonFile<Dataset>(currentDatasetPath);
}

export async function loadReferenceVersions(): Promise<ReferenceVersions> {
  return readJsonFile<ReferenceVersions>(referenceVersionsPath);
}

export async function loadSnapshots(): Promise<Dataset[]> {
  const snapshotFiles = await listSnapshotFiles();
  return Promise.all(snapshotFiles.map((file) => readJsonFile<Dataset>(file.filepath)));
}

export async function loadLatestSnapshots(limit = 12): Promise<Dataset[]> {
  const snapshotFiles = await listSnapshotFiles();
  const latestFiles = snapshotFiles.slice(-Math.max(0, limit));
  return Promise.all(latestFiles.map((file) => readJsonFile<Dataset>(file.filepath)));
}

export async function loadDatasetTimeline(): Promise<Dataset[]> {
  const entries = await getSnapshotIndex();
  return Promise.all(entries.map((entry) => readJsonFile<Dataset>(entry.filepath)));
}

export async function loadDatasetForDate(requestedDate?: string): Promise<Dataset> {
  const entries = await getSnapshotIndex();
  const selected = selectDatasetIndexEntry(entries, requestedDate);
  return readJsonFile<Dataset>(selected.filepath);
}

export async function loadLatestSnapshotsForDate(requestedDate: string | undefined, limit = 12): Promise<Dataset[]> {
  const entries = await getSnapshotIndex();
  const target = targetDateKey(requestedDate);
  const selectedEntries = entries
    .filter((entry) => entry.snapshotDate <= target)
    .slice(-Math.max(0, limit));

  return Promise.all(selectedEntries.map((entry) => readJsonFile<Dataset>(entry.filepath)));
}

export async function loadMeasuresSettings(): Promise<MeasuresSettings> {
  try {
    const parsed = await readJsonFile<unknown>(measuresSettingsPath);
    return normalizeMeasuresSettings(parsed);
  } catch {
    return defaultMeasuresSettings();
  }
}

export async function saveMeasuresSettings(input: unknown): Promise<MeasuresSettings> {
  const normalized = normalizeMeasuresSettings(input);
  const persisted: MeasuresSettings = {
    ...normalized,
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(measuresSettingsPath, JSON.stringify(persisted, null, 2), "utf-8");
  await primeJsonCache(measuresSettingsPath, persisted);
  return persisted;
}

export async function loadDiscoveryToolsSettings(): Promise<DiscoveryToolsSettings> {
  try {
    const parsed = await readJsonFile<unknown>(discoveryToolsSettingsPath);
    return normalizeDiscoveryToolsSettings(parsed);
  } catch {
    return defaultDiscoveryToolsSettings();
  }
}

export async function saveDiscoveryToolsSettings(input: unknown): Promise<DiscoveryToolsSettings> {
  const normalized = normalizeDiscoveryToolsSettings(input);
  const persisted: DiscoveryToolsSettings = {
    ...normalized,
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(discoveryToolsSettingsPath, JSON.stringify(persisted, null, 2), "utf-8");
  await primeJsonCache(discoveryToolsSettingsPath, persisted);
  return persisted;
}
