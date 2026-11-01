import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { FindingsStatusTabs } from "@/components/findings-status-tabs";
import { FindingsTimelineFilter } from "@/components/findings-timeline-filter";
import { FindingsTable } from "@/components/findings-table";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { loadFindingsRegisterData } from "@/lib/findings-register-data";

export default async function FindingsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/findings" searchParams={searchParams} />;

  const { findings, assetDetailsByAssetId, findingDisplayConfiguration, today, historyStart, selectedAsOf,
    selectedStatus, selectedSpi, selectedPriority, selectedSeverity, selectedDurationRange, exportContext } =
    await loadFindingsRegisterData(searchParams);

  return <div className="workspace-page">
    <RouteReadyMarker pathname="/findings" searchParams={searchParams} />
    <section className="panel shrink-0 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Findings Register</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-100">Findings and Evidence</h1>
      <p className="mt-1 text-sm text-slate-300/80">Prioritized register with SPI alignment, scope, and remediation guidance across the current filtered context.</p>
    </section>
    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
      <FindingsStatusTabs activeTab={selectedStatus}>
        <FindingsTimelineFilter selectedAsOf={selectedAsOf} minDate={historyStart} maxDate={today} variant="embedded" />
      </FindingsStatusTabs>
      <div className="min-h-0">
        <FindingsTable findings={findings} selectedAsOf={selectedAsOf} exportContext={exportContext}
          selectedSpi={selectedSpi} selectedPriority={selectedPriority} selectedSeverity={selectedSeverity}
          selectedDurationRange={selectedDurationRange}
          findingDisplayConfiguration={findingDisplayConfiguration} assetDetailsByAssetId={assetDetailsByAssetId} />
      </div>
    </div>
  </div>;
}
