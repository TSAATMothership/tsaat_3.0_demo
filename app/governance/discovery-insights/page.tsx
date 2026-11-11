import { DiscoveryInsights } from "@/components/discovery-insights";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { insightsHref } from "@/lib/governance-insights";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function DiscoveryInsightsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const ready = <RouteReadyMarker pathname="/governance/discovery-insights" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return ready;
  const scope = { network: searchParams.network, system: searchParams.system, securityDomain: searchParams.securityDomain, dataDate: searchParams.dataDate };
  try {
    const data = await loadDiscoveryOverview(scope);
    return <>{ready}<DiscoveryInsights model={data.model} scope={data.scope} scopeLabels={data.scopeLabels} /></>;
  } catch {
    return <>{ready}<section className="panel insights-error" role="alert"><p className="endpoint-eyebrow">Governance / Discovery Insights</p>
      <h1>Discovery insights are temporarily unavailable</h1><p>The selected discovery evidence could not be loaded. Retry to refresh the briefing.</p>
      <a className="endpoint-export" href={insightsHref(scope, "/governance/discovery-insights")}>Try again</a></section></>;
  }
}
