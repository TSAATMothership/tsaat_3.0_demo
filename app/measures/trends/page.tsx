import { MeasuresTrends } from "@/components/measures-trends";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { loadMeasuresTrends } from "@/lib/measures-trends-data";
import { hasWorkspaceScope, workspaceHref, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { measureHistory, measureTrendTab } from "@/lib/measures-trends";

export default async function MeasuresTrendsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const ready = <RouteReadyMarker pathname="/measures/trends" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return ready;
  try {
    const model = await loadMeasuresTrends(searchParams);
    return <>{ready}<MeasuresTrends key={JSON.stringify(model.scope)} model={model} /></>;
  } catch {
    const scope = new URLSearchParams();
    for (const key of ["network", "system", "securityDomain", "dataDate"]) {
      const value = searchParams[key]; if (value) scope.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    const href = workspaceHref(`/measures/trends?measureHistory=${measureHistory(searchParams.measureHistory)}&measureTrendTab=${measureTrendTab(searchParams.measureTrendTab)}`, scope);
    return <>{ready}<section className="panel insights-error" role="alert"><p className="endpoint-eyebrow">Observed Measures / Trends</p>
      <h1>Measures Trends are temporarily unavailable</h1><p>The selected measure history could not be loaded. Retry to refresh the evidence.</p>
      <a className="endpoint-export" href={href}>Try again</a></section></>;
  }
}
