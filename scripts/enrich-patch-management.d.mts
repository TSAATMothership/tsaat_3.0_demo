import type { ServerPatchRecord } from "../lib/types";
export const PATCH_SAMPLE_PROFILE: string;
export function enrichPatchManagement<T extends { snapshotDate: string; assets: Array<{ id: string; type: string; operatingSystem?: { patchLevel?: string | null } | null; patchManagement?: ServerPatchRecord | null }> }>(dataset: T): T;
