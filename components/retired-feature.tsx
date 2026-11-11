import Link from "next/link";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { workspaceHref, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
export function RetiredFeature({ pathname, searchParams }: { pathname: string; searchParams: WorkspaceSearchParams }) {
  const params = new URLSearchParams();
  for (const key of ["network", "system", "securityDomain", "dataDate"]) {
    const value = searchParams[key]; if (value) params.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  return <><RouteReadyMarker pathname={pathname} searchParams={searchParams} /><section className="panel p-6">
    <h1 className="text-2xl font-semibold">This feature has been retired</h1>
    <p className="my-4">Use the remaining Governance and Discovery views to explore the selected inventory.</p>
    <Link href={workspaceHref("/discovery-coverage?discoveryView=endpoints", params)} className="endpoint-export">Open End Point Explorer</Link>
  </section></>;
}
