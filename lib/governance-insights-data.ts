import { getCoreAppData } from "@/lib/app-data";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { buildServiceImpactModel } from "@/lib/service-impact";
import { buildGovernanceInsights } from "@/lib/governance-insights";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export async function loadGovernanceInsights(searchParams: WorkspaceSearchParams) {
  const scope = { network: searchParams.network, system: searchParams.system,
    securityDomain: searchParams.securityDomain, dataDate: searchParams.dataDate };
  const discovery = await loadDiscoveryOverview(scope);
  const core = await getCoreAppData({ ...scope, dataDate: discovery.model.snapshotDate }, { profile: "full" });
  if (core.dataset.snapshotDate !== discovery.model.snapshotDate) throw new Error("Insights snapshot mismatch");
  const impact = buildServiceImpactModel(core);
  return { ...discovery, impact, snapshotGeneratedAt: core.dataset.generatedAt, insights: buildGovernanceInsights(discovery.model, impact) };
}
export type GovernanceInsightsData = Awaited<ReturnType<typeof loadGovernanceInsights>>;
