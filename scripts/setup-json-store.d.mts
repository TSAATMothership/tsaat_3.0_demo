export const repositoryRoot: string;
export function initializeJsonStore(options?: { target?: string; sourceRoot?: string }): Promise<{ directory: string; created: boolean; snapshots: number }>;
