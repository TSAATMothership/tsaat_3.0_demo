import type { Dataset } from "../lib/types";
import type { DemoDataSummary } from "./enrich-demo-dataset.mjs";
export interface PopulationReport {
  directory: string; profile: string; applied: boolean; changedSnapshots: number; backupDirectory?: string;
  snapshots: Array<{ id: number; before: DemoDataSummary | null; after: DemoDataSummary }>;
}
export function populateJsonStore(options?: { target?: string; apply?: boolean; demo?: boolean; sourceExport?: string; transformDataset?: (dataset: Dataset) => Dataset | Promise<Dataset>; profile?: string; migration?: "security-domains-v1"; backupDirectory?: string }): Promise<PopulationReport>;
