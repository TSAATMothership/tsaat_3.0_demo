import { DiscoveryCoverageCiTotals } from "@/components/discovery-coverage-ci-totals";
import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import { DiscoveryComplianceExplorer } from "@/components/discovery-compliance-explorer";
import { buildDiscoveryComplianceRows } from "@/lib/discovery-compliance-explorer";
import { FilterBar } from "@/components/filter-bar";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getCoreAppData } from "@/lib/app-data";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { filterDiscoveryAssets, removeUnassignedNetworkOption, sanitizeDiscoverySearchParams } from "@/lib/discovery-filter-scope";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { EndpointExplorer } from "@/components/endpoint-explorer";
import { InstalledSoftwareExplorer } from "@/components/installed-software-explorer";
import { ShadowItExplorer } from "@/components/shadow-it-explorer";
import { loadEndpointExplorerData, loadInstalledSoftwareExplorerData, loadShadowItExplorerData } from "@/lib/data-loader";
import { scopeIds } from "@/lib/workspace-navigation";

const pendingDiscoveryViews: Record<string, string> = {
  "target-state": "Target State Analyser"
};

export default async function DiscoveryCoveragePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
  const requestedView = Array.isArray(searchParams.discoveryView) ? searchParams.discoveryView[0] : searchParams.discoveryView;
  if (requestedView === "shadow-it") {
    const data = await loadShadowItExplorerData(searchParams);
    const selectedDate = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
    return <>
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <ShadowItExplorer key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system)])}
        rows={data.rows} snapshotDate={data.snapshotDate} scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), dataDate: selectedDate ?? data.snapshotDate }} />
    </>;
  }
  if (requestedView === "installed-software") {
    const data = await loadInstalledSoftwareExplorerData(searchParams);
    const selectedDate = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
    return <>
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <InstalledSoftwareExplorer key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system)])}
        rows={data.rows} snapshotDate={data.snapshotDate} scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), dataDate: selectedDate ?? data.snapshotDate }} />
    </>;
  }
  if (requestedView === "endpoints") {
    const data = await loadEndpointExplorerData(searchParams);
    const selectedDate = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
    return <>
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <EndpointExplorer key={`${data.snapshotDate}:${scopeIds(searchParams.network)}:${scopeIds(searchParams.system)}`}
        rows={data.rows} snapshotDate={data.snapshotDate} scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), dataDate: selectedDate ?? data.snapshotDate }} />
    </>;
  }
  if (requestedView && Object.hasOwn(pendingDiscoveryViews, requestedView)) {
    return <div className="workspace-page">
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Discovery</p>
        <h1 className="mt-1 text-2xl font-semibold">{pendingDiscoveryViews[requestedView]}</h1>
      </section>
      <section className="panel p-5"><p className="text-sm text-slate-300">This view is not available yet.</p></section>
    </div>;
  }
  const view = ["overview", "compliance", "endpoints"].includes(requestedView ?? "") ? requestedView! : "tools";
  const title = { overview: "Discovery Overview", compliance: "Discovery Compliance Explorer", endpoints: "End Point Explorer", tools: "Discovery Tool Coverage" }[view];
  const discoveryDataSearchParams = sanitizeDiscoverySearchParams(searchParams);
  delete discoveryDataSearchParams.criticality;
  const { dataset, analytics, filters, filterOptions, discoveryToolsSettings } = await getCoreAppData(discoveryDataSearchParams, { profile: "summary" });
  const discoveryFilterOptions = removeUnassignedNetworkOption(filterOptions);
  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)));
  const coverageModel = buildScopedDiscoveryToolCoverage(scopedAssets, discoveryToolsSettings, dataset.discoveryCoverageEvaluations);
  const coverageRows = scopedAssets.map((asset) => ({ asset, coverage: coverageModel.assetCoverageById.get(asset.id)! }));
  const toolStats = coverageModel.toolCards;
  const compliantCount = coverageRows.filter(({ coverage }) => coverage.coverageCompliance).length;
  const applicableSlots = toolStats.reduce((sum, tool) => sum + tool.applicable, 0);
  const coveredSlots = toolStats.reduce((sum, tool) => sum + tool.covered, 0);
  const overallToolCoveragePercent = applicableSlots ? (coveredSlots / applicableSlots * 100).toFixed(1) : "0";
  const complianceRows = buildDiscoveryComplianceRows(scopedAssets, coverageModel.assetCoverageById, dataset);
  const explorerView = view === "tools" || view === "compliance";
  return <div className={view === "tools" ? "workspace-page coverage-explorer" : view === "compliance" ? "workspace-page endpoint-explorer discovery-compliance-page" : "workspace-page"}>
    <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
    {explorerView ? <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Discovery / {view === "compliance" ? "Compliance" : "Tool coverage"}</p><h1>{title}</h1><p className="endpoint-description">{view === "compliance" ? "Find, filter and inspect CI discovery compliance and missing tool coverage." : "Compare discovery tools and investigate assets with missing coverage."}</p></div>
      <div className="endpoint-total"><span>{view === "compliance" ? "Total records in scope" : "Discovery tools"}</span><strong>{(view === "compliance" ? complianceRows.length : toolStats.length).toLocaleString("en-AU")}</strong><small>Snapshot · {dataset.snapshotDate}</small></div>
    </header> : <section className="panel shrink-0 p-3"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">Discovery · {dataset.snapshotDate}</p><h1 className="mt-1 text-2xl font-semibold">{title}</h1></section>}
    <FilterBar options={discoveryFilterOptions} filters={filters} hiddenFields={["systemCriticality"]} enableLoadingOverlay className="panel no-print flex shrink-0 flex-wrap gap-3 p-3" />
    <div id="discovery-coverage-summary-slideout-scope" className="relative flex min-h-0 flex-1 flex-col gap-3">
      {view !== "endpoints" && view !== "compliance" && <section className={explorerView ? "coverage-snapshot grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"} aria-label="Coverage Snapshot">
        {[{ label: "Total Assets In Scope", value: coverageRows.length }, { label: "Coverage Compliant Assets", value: compliantCount }, { label: "Assets With Coverage Gaps", value: coverageRows.length - compliantCount }, { label: "Overall Tool Coverage", value: `${overallToolCoveragePercent}%` }].map((card) => <div className="panel p-4" key={card.label}><p className="text-[11px] uppercase tracking-wider text-slate-400">{card.label}</p><p className="mt-2 text-2xl font-semibold text-sky-100">{card.value}</p></div>)}</section>}
      {view === "tools" && <DiscoveryCoverageCiTotals totals={coverageModel.ciTypeTotals} />}
      {view === "tools" ? <DiscoveryCoverageByToolSection
        key={`${view}:${JSON.stringify(discoveryDataSearchParams)}:${discoveryToolsSettings.updatedAt}`} variant="explorer"
        toolStats={toolStats} slideoutScopeId="discovery-coverage-summary-slideout-scope" className="min-h-0 flex-1" />
        : view === "overview" ? <section className="panel min-h-0 flex-1 overflow-auto p-4"><h2 className="mb-4 text-sm font-semibold">Discovery tools in the selected scope</h2><div className="grid gap-4 md:grid-cols-2">{toolStats.map((tool) => <div className="panel-alt p-4" key={tool.id}><div className="flex justify-between gap-3"><span>{tool.label}</span><span className="text-cyan-200">{tool.coveragePercent}%</span></div><progress aria-label={`${tool.label} coverage`} value={tool.coveragePercent} max={100} className="my-3 h-2 w-full accent-cyan-300" /><p className="text-xs text-slate-400">{tool.covered} covered · {tool.missing} missing · {tool.applicable} applicable</p></div>)}</div>{!toolStats.length && <p>No tools map to the CI types in the current filtered data.</p>}</section>
        : <DiscoveryComplianceExplorer key={`${JSON.stringify(discoveryDataSearchParams)}:${dataset.snapshotDate}:${discoveryToolsSettings.updatedAt}`} rows={complianceRows} snapshotDate={dataset.snapshotDate} scope={discoveryDataSearchParams} />}
    </div>
  </div>;
}
