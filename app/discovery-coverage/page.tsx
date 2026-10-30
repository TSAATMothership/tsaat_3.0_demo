import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import { DiscoveryEndpoints, type DiscoveryEndpoint } from "@/components/discovery-endpoints";
import { FilterBar } from "@/components/filter-bar";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getCoreAppData } from "@/lib/app-data";
import { discoveryCoverageByAssetId, discoveryCoverageForAssetId } from "@/lib/discovery-coverage";
import { filterDiscoveryAssets, removeUnassignedNetworkOption, sanitizeDiscoverySearchParams } from "@/lib/discovery-filter-scope";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { type Asset } from "@/lib/types";

function endpointIpAddress(asset: Asset): string {
  const source = asset as Asset & { ipAddress?: string; ip?: string; ipv4?: string; ipv4Address?: string; primaryIp?: string };
  return source.ipAddress || source.ip || source.ipv4 || source.ipv4Address || source.primaryIp || "N/A";
}

export default async function DiscoveryCoveragePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
  const requestedView = Array.isArray(searchParams.discoveryView) ? searchParams.discoveryView[0] : searchParams.discoveryView;
  const view = ["overview", "compliance", "endpoints"].includes(requestedView ?? "") ? requestedView! : "tools";
  const title = { overview: "Discovery Overview", compliance: "Discovery Compliance", endpoints: "End Point Explorer", tools: "Discovery Tool Coverage" }[view];
  const discoveryDataSearchParams = sanitizeDiscoverySearchParams(searchParams);
  delete discoveryDataSearchParams.criticality;
  const { dataset, analytics, filters, filterOptions, discoveryToolsSettings } = await getCoreAppData(discoveryDataSearchParams, { profile: "summary" });
  const discoveryFilterOptions = removeUnassignedNetworkOption(filterOptions);
  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)));
  const storedCoverage = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const coverageRows = scopedAssets.map((asset) => ({ asset, coverage: discoveryCoverageForAssetId(asset.id, storedCoverage) }));
  const toolStats = discoveryToolsSettings.tools.map((tool) => {
    const applicable = coverageRows.filter(({ coverage }) => coverage.toolValues[tool.id] === 0 || coverage.toolValues[tool.id] === 1).length;
    const covered = coverageRows.filter(({ coverage }) => coverage.toolValues[tool.id] === 1).length;
    const missing = coverageRows.filter(({ coverage }) => coverage.toolValues[tool.id] === 0).length;
    return { id: tool.id, label: tool.name, covered, missing, applicable, coveragePercent: applicable ? Number((covered / applicable * 100).toFixed(1)) : 0 };
  });
  const compliantCount = coverageRows.filter(({ coverage }) => coverage.coverageCompliance).length;
  const applicableSlots = toolStats.reduce((sum, tool) => sum + tool.applicable, 0);
  const coveredSlots = toolStats.reduce((sum, tool) => sum + tool.covered, 0);
  const overallToolCoveragePercent = applicableSlots ? (coveredSlots / applicableSlots * 100).toFixed(1) : "0";
  const networkNames = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const systemNames = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));
  const endpointRows: DiscoveryEndpoint[] = coverageRows.map(({ asset, coverage }) => ({
    assetId: asset.id, hostname: asset.hostname || asset.name, ipAddress: endpointIpAddress(asset), assetType: asset.type,
    network: networkNames.get(asset.networkId) ?? asset.networkId,
    system: systemNames.get(asset.systemContext?.systemId ?? "") ?? "Unassigned",
    environment: asset.systemContext?.environmentType ?? "—", compliant: coverage.coverageCompliance, missingTools: coverage.missingToolNames
  })).sort((a, b) => a.hostname.localeCompare(b.hostname));
  return <div className="workspace-page">
    <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
    <section className="panel shrink-0 p-3"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">Discovery · {dataset.snapshotDate}</p><h1 className="mt-1 text-2xl font-semibold">{title}</h1></section>
    <FilterBar options={discoveryFilterOptions} filters={filters} hiddenFields={["systemCriticality"]} enableLoadingOverlay className="panel no-print flex shrink-0 flex-wrap gap-3 p-3" />
    <div id="discovery-coverage-summary-slideout-scope" className="relative flex min-h-0 flex-1 flex-col gap-3">
      {view !== "endpoints" && <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Coverage Snapshot">
        {[{ label: "Total Assets In Scope", value: coverageRows.length }, { label: "Coverage Compliant Assets", value: compliantCount }, { label: "Assets With Coverage Gaps", value: coverageRows.length - compliantCount }, { label: "Overall Tool Coverage", value: `${overallToolCoveragePercent}%` }].map((card) => <div className="panel p-4" key={card.label}><p className="text-[11px] uppercase tracking-wider text-slate-400">{card.label}</p><p className="mt-2 text-2xl font-semibold text-sky-100">{card.value}</p></div>)}</section>}
      {view === "tools" ? <DiscoveryCoverageByToolSection toolStats={toolStats} slideoutScopeId="discovery-coverage-summary-slideout-scope" className="min-h-0 flex-1" />
        : view === "overview" ? <section className="panel min-h-0 flex-1 overflow-auto p-4"><h2 className="mb-4 text-sm font-semibold">Discovery tools in the selected scope</h2><div className="grid gap-4 md:grid-cols-2">{toolStats.map((tool) => <div className="panel-alt p-4" key={tool.id}><div className="flex justify-between gap-3"><span>{tool.label}</span><span className="text-cyan-200">{tool.coveragePercent}%</span></div><progress aria-label={`${tool.label} coverage`} value={tool.coveragePercent} max={100} className="my-3 h-2 w-full accent-cyan-300" /><p className="text-xs text-slate-400">{tool.covered} covered · {tool.missing} missing · {tool.applicable} applicable</p></div>)}</div>{!toolStats.length && <p>No discovery tools are configured.</p>}</section>
        : <DiscoveryEndpoints key={`${view}:${filters.managedNetwork ?? ""}:${filters.ictSystem ?? ""}:${dataset.snapshotDate}`} rows={endpointRows} compliance={view === "compliance"} />}
    </div>
  </div>;
}
