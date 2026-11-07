import type { PopulationReport } from './populate-json-store.mjs';
export function appendSampleEvidence(options?: { target?: string; apply?: boolean; demo?: boolean; catalogue?: { id: number; date: string }[]; backupDirectory?: string }): Promise<PopulationReport>;
