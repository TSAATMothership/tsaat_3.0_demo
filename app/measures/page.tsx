import { redirect } from "next/navigation";
import { hasWorkspaceScope, workspaceHref, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { FilterBar } from "@/components/filter-bar";
import { MeasuresExplorer } from "@/components/measures-explorer";
import { MeasuresSummary } from "@/components/measures-summary";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { buildKpiRows } from "@/lib/measures";
import { getCoreAppData } from "@/lib/app-data";
import { loadSnapshotKpiEvaluationsForAnalyticsScope } from "@/lib/data-loader";
import { MEASURES_TABS, resolveMeasuresTab } from "@/lib/measures-tab-routing";
import { buildKpiExplorerRows, buildSpiExplorerRows } from "@/lib/measures-explorer-model";
import { initialMeasureFilters } from "@/lib/measures-explorer";
import { buildMeasuresSummary } from "@/lib/measures-summary";
import { buildTaskingReportHref } from "@/lib/tasking-report-links";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function MeasuresPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const activeTab = resolveMeasuresTab(first(searchParams.measuresTab));
  if (activeTab === "spi-settings") {
    const scope = new URLSearchParams();
    for (const key of ["network", "system", "dataDate"]) {
      const value = searchParams[key];
      if (value) scope.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    redirect(workspaceHref("/settings?settingsTab=spi-risk-matrix", scope));
  }
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/measures" searchParams={searchParams} />;
  const { analytics, filterOptions, filters, dataset, systems, networks, kpiDefinitions, spiDefinitions,
    severityDefinitions, priorityDefinitions, measuresSettings } = await getCoreAppData(searchParams, { profile: "summary" });
  const marker = <RouteReadyMarker pathname="/measures" searchParams={searchParams} />;
  const title = MEASURES_TABS.find((tab) => tab.id === activeTab)!.label;

  const kpis = activeTab !== "measures-spi" ? buildKpiExplorerRows(buildKpiRows(kpiDefinitions,
    await loadSnapshotKpiEvaluationsForAnalyticsScope({ dataset, analytics, systems, networks, kpiDefinitions })), filters, dataset.snapshotDate) : [];
  const spis = activeTab !== "measures-kpi" ? buildSpiExplorerRows(dataset, analytics, spiDefinitions, filters) : [];
  const allSpiReportHref = buildTaskingReportHref({ kind: "spi-all", id: "all", filters, dataDate: dataset.snapshotDate });
  if (activeTab === "summary") {
    const model = buildMeasuresSummary({ kpis, spis, analytics, settings: measuresSettings, spiDefinitions, severityDefinitions, priorityDefinitions });
    return <>{marker}<MeasuresSummary model={model} filters={filters} snapshotDate={dataset.snapshotDate} allSpiReportHref={allSpiReportHref} /></>;
  }
  const filterBar = <FilterBar options={filterOptions} filters={filters} hiddenFields={["systemCriticality"]}
    extraSelectFields={[{ key: "severity", label: "Severity", value: filters.severity, options: severityDefinitions.map((definition) => ({ id: definition.severityKey, label: definition.label })) }]}
    enableLoadingOverlay className="panel no-print flex shrink-0 flex-wrap gap-3 p-3 measures-scope-filters" />;
  const mode = activeTab === "measures-kpi" ? "kpi" : "spi";
  const rows = mode === "kpi" ? kpis : spis;
  const selectedSpiId = Number(first(searchParams.spi));
  const initialFilters = initialMeasureFilters(searchParams, mode === "spi" && spiDefinitions.some((definition) => definition.spiId === selectedSpiId) ? selectedSpiId : undefined);
  return <div className="workspace-page measures-page">
    {marker}<header className="endpoint-hero"><div><p className="endpoint-eyebrow">Observed measures / {mode === "kpi" ? "Performance" : "Security posture"}</p><h1>{title}</h1><p className="endpoint-description">Compare indicator results, inspect definitions and open current or trend reports.</p></div><div className="endpoint-total"><span>Indicators in scope</span><strong>{rows.length}</strong><small>Snapshot · {dataset.snapshotDate}</small></div></header>
    {filterBar}
    <MeasuresExplorer key={JSON.stringify([activeTab, filters, dataset.snapshotDate, initialFilters])} rows={rows} mode={mode} initialFilters={initialFilters} allSpiReportHref={mode === "spi" ? allSpiReportHref : undefined} />
  </div>;
}
