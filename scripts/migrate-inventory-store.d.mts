export interface InventoryUpgradeOptions { target?: string; backupDirectory?: string; apply?: boolean }
export interface InventoryUpgradeReport { directory: string; fromVersion: number; toVersion: number; applied: boolean; snapshots: number; removedFiles: string[]; backupDirectory?: string }
export function migrateInventoryStore(options?: InventoryUpgradeOptions): Promise<InventoryUpgradeReport>;
