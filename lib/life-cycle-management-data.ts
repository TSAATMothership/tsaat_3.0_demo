import "server-only";
import { loadDatasetForDate } from "@/lib/data-loader";
import { buildLifeCycleManagement } from "@/lib/life-cycle-management";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export async function loadLifeCycleManagement(searchParams: WorkspaceSearchParams) {
  const date = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
  // SQL summary payloads deliberately omit installed software. Both providers use the full snapshot.
  const dataset = await loadDatasetForDate(date, { profile: "full" });
  return buildLifeCycleManagement(dataset, searchParams);
}
