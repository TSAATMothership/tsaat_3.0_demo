import { redirect } from "next/navigation";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default function HomePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (hasWorkspaceScope(searchParams)) {
    const params = new URLSearchParams();
    for (const key of ["network", "system", "dataDate"]) {
      const value = searchParams[key];
      if (value) params.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    redirect(`/cyber-cop?${params}`);
  }
  return <RouteReadyMarker pathname="/" searchParams={searchParams} />;
}

