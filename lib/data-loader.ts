import "server-only";
import * as sql from "@/lib/sql-data-loader";
import { jsonDataProvider } from "@/lib/json-store/data-loader";
import { IS_JSON_BUILD } from "@/lib/data-provider-mode";

// One shared contract; the build fixes the provider for every page and API.
const provider: typeof sql = IS_JSON_BUILD ? jsonDataProvider : sql;
export type { DatasetLoadProfile, WorkspaceFilterOptions, EndpointExplorerData, InstalledSoftwareExplorerData, SecurityVulnerabilityExplorerData, ShadowItExplorerData } from "@/lib/sql-data-loader";
export const loadCurrentDataset = provider.loadCurrentDataset;
export const loadSnapshots = provider.loadSnapshots;
export const loadLatestSnapshots = provider.loadLatestSnapshots;
export const loadDatasetTimeline = provider.loadDatasetTimeline;
export const loadDatasetForDate = provider.loadDatasetForDate;
export const loadSnapshotMetadataForDate = provider.loadSnapshotMetadataForDate;
export const loadCmdbDatasetForDate = provider.loadCmdbDatasetForDate;
export const loadTopologyDatasetForDate = provider.loadTopologyDatasetForDate;
export const loadWorkspaceFilterOptionsForDate = provider.loadWorkspaceFilterOptionsForDate;
export const loadEndpointExplorerData = provider.loadEndpointExplorerData;
export const loadInstalledSoftwareExplorerData = provider.loadInstalledSoftwareExplorerData;
export const loadSecurityVulnerabilityExplorerData = provider.loadSecurityVulnerabilityExplorerData;
export const loadShadowItExplorerData = provider.loadShadowItExplorerData;
export const loadLatestSnapshotsForDate = provider.loadLatestSnapshotsForDate;
export const loadSnapshotsForDateWindow = provider.loadSnapshotsForDateWindow;
export const loadDiscoveryToolsSettings = provider.loadDiscoveryToolsSettings;
export const saveDiscoveryToolsSettings = provider.saveDiscoveryToolsSettings;
export const loadPersonaSettings = provider.loadPersonaSettings;
export const savePersonaSettings = provider.savePersonaSettings;
export const clearDataLoaderCaches = provider.clearDataLoaderCaches;
export const __resetDataLoaderCachesForTest = provider.__resetDataLoaderCachesForTest;
