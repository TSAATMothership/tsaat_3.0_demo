import { RouteReadyMarker } from "@/components/route-ready-marker";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function HomePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  // Header selections alone never activate a data view.
  return <RouteReadyMarker pathname="/" searchParams={searchParams} />;
}
