export function migrateModelCiCmdb(options?: { target?: string; apply?: boolean; backupDirectory?: string }): Promise<{
  migration: string; directory: string; applied: boolean; addedTypes: string[]; backupFile?: string;
}>;
