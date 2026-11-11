import { InstalledSoftwareInsights } from "@/components/installed-software-insights";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { loadInstalledSoftwareExplorerData } from "@/lib/data-loader";
import { buildInstalledSoftwareInsights } from "@/lib/installed-software-insights";
import { insightsHref } from "@/lib/insights-navigation";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function InstalledSoftwareInsightsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const ready = <RouteReadyMarker pathname="/governance/installed-software-insights" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return ready;
  const scope = { network: searchParams.network, system: searchParams.system, securityDomain: searchParams.securityDomain, dataDate: searchParams.dataDate };
  try {
    const data = await loadInstalledSoftwareExplorerData(scope);
    return <>{ready}<InstalledSoftwareInsights model={buildInstalledSoftwareInsights(data.rows, data.snapshotDate)} scope={scope} /></>;
  } catch {
    return <>{ready}<section className="panel insights-error" role="alert"><p className="endpoint-eyebrow">Governance / Installed Software Insights</p>
      <h1>Software insights are temporarily unavailable</h1><p>The selected software inventory could not be loaded. Retry to refresh the evidence.</p>
      <a className="endpoint-export" href={insightsHref(scope, "/governance/installed-software-insights")}>Try again</a></section></>;
  }
}
