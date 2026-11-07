import "server-only";
import { loadDatasetForDate } from "@/lib/data-loader";
import { buildTopologyExplorer } from "@/lib/topology-explorer";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export async function loadTopologyExplorer(params: WorkspaceSearchParams) {
  const date = Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate;
  // Summary payloads omit installed software. One full, selected snapshot supplies every lookup field.
  return buildTopologyExplorer(await loadDatasetForDate(date, { profile: "full" }), params);
}
