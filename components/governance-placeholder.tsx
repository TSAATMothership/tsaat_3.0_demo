import { RouteReadyMarker } from "@/components/route-ready-marker";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

const titles = { overview: "Overview", trends: "Trends", insights: "Insights" };

export function GovernancePlaceholder({ view, searchParams }: {
  view: keyof typeof titles;
  searchParams: WorkspaceSearchParams;
}) {
  return <div className="workspace-page governance-placeholder">
    <RouteReadyMarker pathname={`/governance/${view}`} searchParams={searchParams} />
    {hasWorkspaceScope(searchParams) && <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Governance</p><h1>{titles[view]}</h1></div>
    </header>}
  </div>;
}
