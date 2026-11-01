import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { FindingsStatusTabs } from "@/components/findings-status-tabs";
import { FindingsTimelineFilter } from "@/components/findings-timeline-filter";
import { FindingsTable } from "@/components/findings-table";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getCoreAppData } from "@/lib/app-data";
import { deviceReportDetails } from "@/lib/device-report";
import { loadSnapshotEffectiveFindings } from "@/lib/data-loader";
import { firstSearchParam } from "@/lib/data-date";
import { parseFindingDurationRange } from "@/lib/findings-duration";

function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export default async function FindingsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/findings" searchParams={searchParams} />;

  // Old Overview links now open the register, without restoring removed page filters.
  const effectiveSearchParams = {
    ...searchParams,
    findingsViewTab: undefined,
    criticality: undefined,
    securityDomain: undefined,
    environment: undefined,
    assetType: undefined,
    severity: undefined,
    search: undefined
  };
  const { analytics, dataset, spiDefinitions, findingDisplayConfiguration } =
    await getCoreAppData(effectiveSearchParams, { profile: "risk-summary" });
  const today = isDateOnly(dataset.snapshotDate) ? dataset.snapshotDate : new Date().toISOString().slice(0, 10);
  const historyStartDate = new Date(`${today}T00:00:00.000Z`);
  historyStartDate.setUTCFullYear(historyStartDate.getUTCFullYear() - 2);
  const historyStart = historyStartDate.toISOString().slice(0, 10);
  const requestedAsOf = firstSearchParam(searchParams.asOf)?.trim();
  const selectedAsOf = isDateOnly(requestedAsOf) ? requestedAsOf < historyStart ? historyStart : requestedAsOf > today ? today : requestedAsOf : today;
  const selectedStatus = firstSearchParam(searchParams.findingsTab)?.trim().toLowerCase() === "closed" ? "closed" : "open";
  const requestedSpi = Number(firstSearchParam(searchParams.spi));
  const selectedSpi = spiDefinitions.some(definition => definition.spiId === requestedSpi) ? requestedSpi : undefined;
  const requestedPriority = Number(firstSearchParam(searchParams.priority));
  const selectedPriority = Number.isInteger(requestedPriority) && requestedPriority >= 1 && requestedPriority !== 90 ? requestedPriority : undefined;
  const selectedSeverity = firstSearchParam(searchParams.severity)?.trim() || undefined;
  const selectedDurationRange = parseFindingDurationRange(firstSearchParam(searchParams.durationMin), firstSearchParam(searchParams.durationMax));

  const filteredAssetIds = new Set(analytics.evaluations.map(evaluation => evaluation.assetId));
  const timelineFindings = (dataset.snapshotId
    ? await loadSnapshotEffectiveFindings(dataset.snapshotId, selectedAsOf)
    : analytics.findings
  ).filter(finding => filteredAssetIds.has(finding.scope.assetId));
  const findings = timelineFindings.filter(finding => finding.status === selectedStatus);
  const assetDetailsByAssetId = Object.fromEntries(dataset.assets
    .filter(asset => filteredAssetIds.has(asset.id))
    .map(asset => [asset.id, { ...deviceReportDetails(asset, asset.id), assetType: asset.type }]));

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
        <FindingsTable findings={findings} selectedAsOf={selectedAsOf}
          selectedSpi={selectedSpi} selectedPriority={selectedPriority} selectedSeverity={selectedSeverity}
          selectedDurationRange={selectedDurationRange}
          findingDisplayConfiguration={findingDisplayConfiguration} assetDetailsByAssetId={assetDetailsByAssetId} />
      </div>
    </div>
  </div>;
}
