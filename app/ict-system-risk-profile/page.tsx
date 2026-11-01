import { RouteReadyMarker } from "@/components/route-ready-marker";
import { IctSystemRiskProfile } from "@/components/ict-system-risk-profile";
import { getCoreAppData } from "@/lib/app-data";
import { buildIctSystemRiskProfile } from "@/lib/ict-system-risk-profile";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export default async function IctSystemRiskProfilePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const marker = <RouteReadyMarker pathname="/ict-system-risk-profile" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return marker;
  const scope = { network: searchParams.network, system: searchParams.system, dataDate: searchParams.dataDate };
  const { dataset, analytics, filters, severityDefinitions, spiDefinitions, measuresSettings } = await getCoreAppData(scope, { profile: "risk-summary" });
  const model = buildIctSystemRiskProfile({ dataset, analytics, filters, severityDefinitions, spiDefinitions, measuresSettings });
  return <>{marker}<IctSystemRiskProfile key={JSON.stringify([filters, dataset.snapshotDate])} model={model} filters={filters} /></>;
}
