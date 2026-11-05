import "server-only";
import { loadDiscoveryToolsSettings, loadSnapshotsForDateWindow } from "@/lib/data-loader";
import { buildGovernanceTrends } from "@/lib/governance-trends";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export async function loadGovernanceTrends(searchParams: WorkspaceSearchParams) {
  const requested = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
  const valid = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && Number.isFinite(Date.parse(requested)) && new Date(requested).toISOString().slice(0, 10) === requested;
  const cutoff = valid ? requested : new Date().toISOString().slice(0, 10);
  // Full SQL snapshots include installed software; summary payloads cannot support lifecycle trends.
  // The shared reader anchors to its resolved snapshot. The projection enforces the requested
  // week/month boundaries, excluding stale history and the reader's earliest-snapshot fallback.
  const [snapshots, settings] = await Promise.all([
    loadSnapshotsForDateWindow(cutoff, 1, { profile: "full" }),
    loadDiscoveryToolsSettings()
  ]);
  return buildGovernanceTrends(snapshots, settings, searchParams, cutoff);
}
