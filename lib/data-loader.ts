import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
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
