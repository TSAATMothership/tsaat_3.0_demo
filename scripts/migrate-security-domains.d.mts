import type { PopulationReport } from "./populate-json-store.mjs";
export function migrateSecurityDomains(options?: { target?: string; apply?: boolean; backupDirectory?: string }): Promise<PopulationReport>;
