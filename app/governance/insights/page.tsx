import { GovernanceInsights } from "@/components/governance-insights";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { loadGovernanceInsights } from "@/lib/governance-insights-data";
import { insightsHref } from "@/lib/governance-insights";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function GovernanceInsightsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const ready = <RouteReadyMarker pathname="/governance/insights" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return ready;
  try {
    const data = await loadGovernanceInsights(searchParams);
    return <>{ready}<GovernanceInsights data={data} /></>;
  } catch {
    return <>{ready}<section className="panel insights-error" role="alert"><p className="endpoint-eyebrow">Governance / Insights</p>
      <h1>Insights are temporarily unavailable</h1><p>The briefing could not load the selected snapshot. Retry to refresh the evidence.</p>
      <a className="endpoint-export" href={insightsHref(searchParams, "/governance/insights")}>Try again</a></section></>;
  }
}
