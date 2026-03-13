import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import { normalizeDataDate, todayDateKey } from "@/lib/data-date";
import { defaultMeasuresSettings, MeasuresSettings, normalizeMeasuresSettings } from "@/lib/measures-settings";
import { Dataset, ReferenceVersions } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const measuresSettingsPath = path.join(dataDir, "measures-settings.json");

async function readJsonFile<T>(filepath: string): Promise<T> {
  const content = await fs.readFile(filepath, "utf-8");
  return JSON.parse(content) as T;
}

export const loadCurrentDataset = cache(async (): Promise<Dataset> => {
  return readJsonFile<Dataset>(path.join(dataDir, "current.json"));
});

export const loadReferenceVersions = cache(async (): Promise<ReferenceVersions> => {
  return readJsonFile<ReferenceVersions>(path.join(dataDir, "reference", "versions.json"));
});

export const loadSnapshots = cache(async (): Promise<Dataset[]> => {
  const snapshotsDir = path.join(dataDir, "snapshots");
  const files = await fs.readdir(snapshotsDir);

  const snapshotFiles = files
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const snapshots = await Promise.all(
    snapshotFiles.map((filename) => readJsonFile<Dataset>(path.join(snapshotsDir, filename)))
  );

  return snapshots;
});

export const loadLatestSnapshots = cache(async (limit = 12): Promise<Dataset[]> => {
  const snapshotsDir = path.join(dataDir, "snapshots");
  const files = await fs.readdir(snapshotsDir);

  const snapshotFiles = files
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b))
    .slice(-Math.max(0, limit));

  const snapshots = await Promise.all(
    snapshotFiles.map((filename) => readJsonFile<Dataset>(path.join(snapshotsDir, filename)))
  );

  return snapshots;
});

export const loadDatasetTimeline = cache(async (): Promise<Dataset[]> => {
  const [currentDataset, snapshots] = await Promise.all([loadCurrentDataset(), loadSnapshots()]);

  const snapshotByDate = new Map<string, Dataset>();
  for (const snapshot of snapshots) {
    snapshotByDate.set(snapshot.snapshotDate, snapshot);
  }
  snapshotByDate.set(currentDataset.snapshotDate, currentDataset);

  return Array.from(snapshotByDate.values()).sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
});

function targetDateKey(requestedDate: string | undefined): string {
  return normalizeDataDate(requestedDate) ?? todayDateKey();
}

function selectDatasetByDate(timeline: Dataset[], requestedDate: string | undefined): Dataset {
  if (!timeline.length) {
    throw new Error("No datasets are available in the local timeline.");
  }

  const target = targetDateKey(requestedDate);
  const match = timeline.filter((snapshot) => snapshot.snapshotDate <= target).pop();
  return match ?? timeline[0];
}

export async function loadDatasetForDate(requestedDate?: string): Promise<Dataset> {
  const timeline = await loadDatasetTimeline();
  return selectDatasetByDate(timeline, requestedDate);
}

export const loadLatestSnapshotsForDate = cache(
  async (requestedDate: string | undefined, limit = 12): Promise<Dataset[]> => {
    const timeline = await loadDatasetTimeline();
    const target = targetDateKey(requestedDate);

    return timeline
      .filter((snapshot) => snapshot.snapshotDate <= target)
      .slice(-Math.max(0, limit));
  }
);

export async function loadMeasuresSettings(): Promise<MeasuresSettings> {
  try {
    const parsed = await readJsonFile<unknown>(measuresSettingsPath);
    return normalizeMeasuresSettings(parsed);
  } catch (error) {
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
  return persisted;
}
