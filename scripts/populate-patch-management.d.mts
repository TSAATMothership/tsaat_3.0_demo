import type { PopulationReport } from "./populate-json-store.mjs";
export function populatePatchManagement(options?: { target?: string; apply?: boolean; demo?: boolean; backupDirectory?: string }): Promise<PopulationReport>;
