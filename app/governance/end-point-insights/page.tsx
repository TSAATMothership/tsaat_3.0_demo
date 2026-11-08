import { EndpointInsights } from "@/components/endpoint-insights";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { loadEndpointExplorerData } from "@/lib/data-loader";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { insightsHref } from "@/lib/governance-insights";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function EndpointInsightsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const ready = <RouteReadyMarker pathname="/governance/end-point-insights" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return ready;
  const scope = { network: searchParams.network, system: searchParams.system, securityDomain: searchParams.securityDomain, dataDate: searchParams.dataDate };
  try {
    const data = await loadDiscoveryOverview(scope);
    // Reuse the Explorer's cached projection at the overview's resolved snapshot.
    const endpoints = await loadEndpointExplorerData(data.scope);
    return <>{ready}<EndpointInsights rows={endpoints.rows} model={data.model} scope={data.scope} scopeLabels={data.scopeLabels} /></>;
  } catch {
    return <>{ready}<section className="panel insights-error" role="alert"><p className="endpoint-eyebrow">Governance / End Point Insights</p>
      <h1>End point insights are temporarily unavailable</h1><p>The selected endpoint evidence could not be loaded. Retry to refresh the briefing.</p>
      <a className="endpoint-export" href={insightsHref(scope, "/governance/end-point-insights")}>Try again</a></section></>;
  }
}
