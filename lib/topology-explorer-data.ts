import "server-only";
import { loadTopologyDatasetForDate } from "@/lib/data-loader";
import { buildTopologyExplorer } from "@/lib/topology-explorer";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export async function loadTopologyExplorer(params: WorkspaceSearchParams) {
  const date = Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate;
  // Retain all scoped lookup evidence and model relationships without discovery evaluation or CI communication reads.
  return buildTopologyExplorer(await loadTopologyDatasetForDate(date, params), params);
}
