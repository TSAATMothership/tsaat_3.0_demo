import { GovernanceTrends } from "@/components/governance-trends";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { loadGovernanceTrends } from "@/lib/governance-trends-data";
import { insightsHref } from "@/lib/governance-insights";
import { trendHistory } from "@/lib/governance-trends";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function GovernanceTrendsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const ready = <RouteReadyMarker pathname="/governance/trends" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return ready;
  try {
    const model = await loadGovernanceTrends(searchParams);
    return <>{ready}<GovernanceTrends key={`${model.cutoff}:${model.history}:${JSON.stringify(model.scope)}`} model={model} /></>;
  } catch {
    return <>{ready}<section className="panel insights-error" role="alert"><p className="endpoint-eyebrow">Governance / Trends</p>
      <h1>Trends are temporarily unavailable</h1><p>The briefing could not load the selected history. Retry to refresh the evidence.</p>
      <a className="endpoint-export" href={insightsHref(searchParams, "/governance/trends", { key: "trendHistory", value: trendHistory(searchParams.trendHistory) })}>Try again</a></section></>;
  }
}
