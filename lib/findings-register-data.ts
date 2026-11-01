import { getCoreAppData } from "@/lib/app-data";
import { deviceReportDetails } from "@/lib/device-report";
import { loadSnapshotEffectiveFindings } from "@/lib/data-loader";
import { firstSearchParam } from "@/lib/data-date";
import { parseFindingDurationRange } from "@/lib/findings-duration";

import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import type { FindingsExportContext } from "@/lib/findings-export";

function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export async function loadFindingsRegisterData(searchParams: WorkspaceSearchParams) {
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
  const selectedStatus: "open" | "closed" = firstSearchParam(searchParams.findingsTab)?.trim().toLowerCase() === "closed" ? "closed" : "open";
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

  const exportContext: FindingsExportContext = {
    scope: { network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), dataDate: today },
    asOf: selectedAsOf, status: selectedStatus
  };
  return { findings, assetDetailsByAssetId, findingDisplayConfiguration, today, historyStart, selectedAsOf,
    selectedStatus, selectedSpi, selectedPriority, selectedSeverity, selectedDurationRange, exportContext };
}
