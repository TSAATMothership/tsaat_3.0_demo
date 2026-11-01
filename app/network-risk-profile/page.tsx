import { RouteReadyMarker } from "@/components/route-ready-marker";
import { NetworkRiskProfile } from "@/components/network-risk-profile";
import { getCoreAppData } from "@/lib/app-data";
import { buildNetworkRiskProfile } from "@/lib/network-risk-profile";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function NetworkRiskProfilePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const marker = <RouteReadyMarker pathname="/network-risk-profile" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return marker;
  // The shared header owns the scope; local explorer controls never change report scope.
  const scope = { network: searchParams.network, system: searchParams.system, dataDate: searchParams.dataDate };
  const { dataset, analytics, filters, severityDefinitions, spiDefinitions, measuresSettings } = await getCoreAppData(scope, { profile: "risk-summary" });
  const model = buildNetworkRiskProfile({ dataset, analytics, filters, severityDefinitions, spiDefinitions, measuresSettings });
  const detailsId = Array.isArray(searchParams.networkDetails) ? searchParams.networkDetails[0] : searchParams.networkDetails;
  const initialNetworkId = model.rows.some(row => row.id === detailsId) ? detailsId : undefined;
  return <>{marker}<NetworkRiskProfile key={JSON.stringify([filters, dataset.snapshotDate, initialNetworkId])} model={model} filters={filters} initialNetworkId={initialNetworkId} /></>;
}
