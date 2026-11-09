import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadKpiDefinitions,
  loadMeasuresSettings,
  loadSnapshotKpiEvaluationsForAnalyticsScope,
  loadSeverityDefinitions,
  loadSpiDefinitions,
  loadSnapshotsForDateWindow
} from "@/lib/data-loader";
import {
  buildKpiReportModel,
  buildKpiTrendReportModel,
  isKpiReportAvailable
} from "@/lib/kpi-report-model";
import { buildKpiRows } from "@/lib/measures";
import { deviceReportDetails } from "@/lib/device-report";
import {
  buildSpiReportModel,
  buildSpiReportModels,
  buildSpiTrendReportModel
} from "@/lib/spi-report-model";
import {
  remediationActionsForKpi,
  taskingConditionForKpi,
  teamsForKpi
} from "@/lib/tasking";
import {
  taskingReportDataDateFromSearchParams,
  taskingReportFilename
} from "@/lib/tasking-report-links";
import { parseFilters } from "@/lib/selectors";
import { resolveKpiScope } from "@/lib/kpi-scope";
import { AnalyticsResult, Dataset, ICTSystem } from "@/lib/types";

import { documentResponse } from "@/lib/documents/server-response";
import type { TaskingPdfDocumentJob } from "@/lib/documents/tasking-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Kind = "kpi" | "kpi-trend" | "spi" | "spi-trend" | "spi-all";

interface CriticalSystemComplianceRow {
  systemId: string;
  systemName: string;
  scorePercent: number;
  compliantCount: number;
  applicableCount: number;
}

interface CriticalExposureAssetRow {
  assetId: string;
  assetName: string;
  hostname: string;
  systemId: string;
  systemName: string;
  findingsCount: number;
}

interface UnmodelledSystemRow {
  systemId: string;
  systemName: string;
}

function filterSummary(searchParams: URLSearchParams): string {
  const parts = [
    `Network=${searchParams.get("network") ?? "All"}`,
    `ICT System=${searchParams.get("system") ?? "All"}`,
    `Criticality=${searchParams.get("criticality") ?? "All"}`,
    `Security Domain=${searchParams.get("securityDomain") ?? "All"}`,
    `Environment=${searchParams.get("environment") ?? "All"}`,
    `Asset Type=${searchParams.get("assetType") ?? "All"}`,
    `Severity=${searchParams.get("severity") ?? "All"}`,
    `Mission Capability=${searchParams.get("mission") ?? "All"}`,
    `Business Service=${searchParams.get("service") ?? "All"}`
  ];

  if (searchParams.get("results") === "non-compliant") parts.push("Results=Non-Compliance Only");

  return parts.join(" | ");
}

function notFoundResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function criticalSystemComplianceRowsAtOrBelowThreshold(
  dataset: Dataset,
  analytics: AnalyticsResult,
  threshold = 95
): CriticalSystemComplianceRow[] {
  const systemsById = new Map(dataset.ictSystems.map((system) => [system.id, system]));
  const statusesBySystem = new Map<string, Array<"Compliant" | "Non-compliant" | "Unknown">>();

  for (const evaluation of analytics.evaluations) {
    if (evaluation.systemCriticality !== "Critical" || !evaluation.systemId) {
      continue;
    }
    const statuses = statusesBySystem.get(evaluation.systemId) ?? [];
    statuses.push(...evaluation.evaluations.map((item) => item.status));
    statusesBySystem.set(evaluation.systemId, statuses);
  }

  return Array.from(statusesBySystem.entries())
    .map(([systemId, statuses]) => {
      const compliantCount = statuses.filter((status) => status === "Compliant").length;
      const applicableCount = statuses.length;
      const scorePercent = toPercent(compliantCount, applicableCount);
      const systemName = systemsById.get(systemId)?.name ?? systemId;
      return {
        systemId,
        systemName,
        scorePercent,
        compliantCount,
        applicableCount
      };
    })
    .filter((row) => row.applicableCount > 0 && row.scorePercent <= threshold)
    .sort((a, b) => {
      if (a.scorePercent !== b.scorePercent) {
        return a.scorePercent - b.scorePercent;
      }
      return a.systemName.localeCompare(b.systemName);
    });
}

function criticalExposureAssetRows(dataset: Dataset, analytics: AnalyticsResult): CriticalExposureAssetRow[] {
  const assetsById = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const systemsById = new Map(dataset.ictSystems.map((system) => [system.id, system]));
  const rowsByAsset = new Map<string, CriticalExposureAssetRow>();

  for (const finding of analytics.findings) {
    if (finding.severity !== "Critical Exposure" || !finding.scope.systemId) {
      continue;
    }

    const asset = assetsById.get(finding.scope.assetId);
    const system = systemsById.get(finding.scope.systemId);
    if (!asset || !system) {
      continue;
    }

    const existing =
      rowsByAsset.get(asset.id) ??
      {
        assetId: asset.id,
        assetName: asset.name,
        hostname: asset.hostname,
        systemId: system.id,
        systemName: system.name,
        findingsCount: 0
      };

    existing.findingsCount += 1;
    rowsByAsset.set(asset.id, existing);
  }

  return Array.from(rowsByAsset.values()).sort((a, b) => {
    if (b.findingsCount !== a.findingsCount) {
      return b.findingsCount - a.findingsCount;
    }
    return a.assetName.localeCompare(b.assetName);
    });
}

function unmodelledSystemRows(systems: ICTSystem[]): UnmodelledSystemRow[] {
  return systems
    .filter((system) => system.diisDefined && !system.modellingStatus)
    .map((system) => ({
      systemId: system.id,
      systemName: system.name
    }))
    .sort((a, b) => a.systemName.localeCompare(b.systemName));
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as Kind | null;
  const id = request.nextUrl.searchParams.get("id");

  if (!kind || !id || !["kpi", "kpi-trend", "spi", "spi-trend", "spi-all"].includes(kind)) {
    return NextResponse.json({ error: "Missing or invalid kind/id parameters." }, { status: 400 });
  }

  const results = request.nextUrl.searchParams.get("results");
  const nonCompliantOnly = results === "non-compliant";
  if ((results !== null && results !== "all" && !nonCompliantOnly) || (nonCompliantOnly && kind !== "kpi" && kind !== "spi")) {
    return NextResponse.json({ error: "Invalid results filter. Non-compliant results are supported for current KPI and SPI reports." }, { status: 400 });
  }

  const requestedDataDate = taskingReportDataDateFromSearchParams(request.nextUrl.searchParams);
  const [dataset, discoveryToolsSettings, kpiDefinitions, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadDiscoveryToolsSettings(),
    loadKpiDefinitions(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const { systems: scopedSystems, networks: scopedNetworks } = resolveKpiScope(dataset, filters);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);
  const kpiRows = buildKpiRows(
    kpiDefinitions,
    await loadSnapshotKpiEvaluationsForAnalyticsScope({
      dataset,
      analytics,
      systems: scopedSystems,
      networks: scopedNetworks,
      kpiDefinitions
    })
  );

  const generatedAt = new Date();
  const scope = { snapshotDate: dataset.snapshotDate, filterText: filterSummary(request.nextUrl.searchParams) };
  const respond = (job: TaskingPdfDocumentJob) => documentResponse(request, job);
  const envelope = { version: 1 as const, generatedAt: generatedAt.toISOString() };

  if (kind === "spi") {
    const spiModel = buildSpiReportModel({ dataset, analytics, spiId: Number(id), spiDefinitions, nonCompliantOnly });
    if (!spiModel || !spiModel.reportAvailable) {
      return notFoundResponse("SPI row not found for supplied id.");
    }

    return respond({ ...envelope, kind: "pdf-tasking-spi", title: spiModel.reportName,
      filename: taskingReportFilename(kind, id, generatedAt, spiModel.name, nonCompliantOnly),
      data: { ...scope, model: spiModel } });
  }

  if (kind === "spi-all") {
    const spiModels = buildSpiReportModels(dataset, analytics, spiDefinitions).filter((model) => model.reportAvailable);
    if (!spiModels.length) {
      return notFoundResponse("No SPI rows found for the current filtered scope.");
    }

    return respond({ ...envelope, kind: "pdf-tasking-spi-all", title: "SPI Tasking Reports",
      filename: taskingReportFilename(kind, id, generatedAt), data: { ...scope, models: spiModels } });
  }

  if (kind === "spi-trend") {
    const trendDatasets = await loadSnapshotsForDateWindow(dataset.snapshotDate, 12);
    const trendModel = buildSpiTrendReportModel({
      spiId: Number(id),
      snapshots: trendDatasets.map((trendDataset) => ({
        dataset: trendDataset,
        analytics: buildAnalytics(
          trendDataset,
          trendDataset.ictSystems,
          filters,
          spiDefinitions,
          measuresSettings,
          discoveryToolsSettings
        )
      })),
      spiDefinitions
    });

    if (!trendModel || !trendModel.current.trendReportAvailable) {
      return notFoundResponse("SPI trend row not found for supplied id.");
    }

    return respond({ ...envelope, kind: "pdf-tasking-spi-trend", title: trendModel.reportName,
      filename: taskingReportFilename(kind, id, generatedAt, trendModel.current.name), data: { ...scope, model: trendModel } });
  }

  if (kind === "kpi-trend") {
    const trendDatasets = await loadSnapshotsForDateWindow(dataset.snapshotDate, 12);
    const trendSnapshots = await Promise.all(
      trendDatasets.map(async (trendDataset) => {
        const trendAnalytics = buildAnalytics(
          trendDataset,
          trendDataset.ictSystems,
          filters,
          spiDefinitions,
          measuresSettings,
          discoveryToolsSettings
        );
        const { systems: trendSystems, networks: trendNetworks } = resolveKpiScope(trendDataset, filters);
        const trendKpiRows = buildKpiRows(
          kpiDefinitions,
          await loadSnapshotKpiEvaluationsForAnalyticsScope({
            dataset: trendDataset,
            analytics: trendAnalytics,
            systems: trendSystems,
            networks: trendNetworks,
            kpiDefinitions
          })
        );
        return {
          snapshotDate: trendDataset.snapshotDate,
          kpiRows: trendKpiRows
        };
      })
    );
    const trendModel = buildKpiTrendReportModel({
      kpiId: id,
      kpiDefinitions,
      snapshots: trendSnapshots
    });

    if (!trendModel) {
      return notFoundResponse("KPI trend report unavailable for supplied id.");
    }

    return respond({ ...envelope, kind: "pdf-tasking-kpi-trend", title: trendModel.reportName,
      filename: taskingReportFilename(kind, id, generatedAt, trendModel.current.name), data: { ...scope, model: trendModel } });
  }

  if (kind === "kpi" && (id === "KPI-1" || id === "KPI-2")) {
    const model = buildKpiReportModel({ kpiRows, kpiId: id, kpiDefinitions, nonCompliantOnly });
    if (!model || !isKpiReportAvailable(id, kpiDefinitions)) {
      return notFoundResponse("KPI tasking report unavailable for supplied id.");
    }
    return respond({ ...envelope, kind: "pdf-tasking-kpi", title: model.reportName,
      filename: taskingReportFilename(kind, id, generatedAt, undefined, nonCompliantOnly),
      data: { ...scope, model, kpiDefinitions: kpiDefinitions.filter(definition => definition.id === id) } });
  }

  const model = buildKpiReportModel({ kpiRows, kpiId: id, kpiDefinitions });
  if (!model || !isKpiReportAvailable(id, kpiDefinitions)) {
    return notFoundResponse("KPI tasking report unavailable for supplied id.");
  }
  const row = model.sourceRow;
  const exposureRows = row.reportDetailHandlerKey === "critical-exposure-assets" ? criticalExposureAssetRows(dataset, analytics) : [];
  const unmodelledRows = row.reportDetailHandlerKey === "unmodelled-diis-systems" ? unmodelledSystemRows(scopedSystems) : [];
  const assetsById = new Map(dataset.assets.map(asset => [asset.id, asset]));
  return respond({ ...envelope, kind: "pdf-tasking-kpi-legacy", title: model.reportName,
    filename: taskingReportFilename(kind, id, generatedAt),
    data: { ...scope, model, condition: taskingConditionForKpi(row, kpiDefinitions),
      actions: remediationActionsForKpi(row, kpiDefinitions), teams: teamsForKpi(row.id, kpiDefinitions),
      criticalSystems: row.reportDetailHandlerKey === "critical-system-threshold"
        ? criticalSystemComplianceRowsAtOrBelowThreshold(dataset, analytics, 95) : [],
      exposureRows: exposureRows.slice(0, 24).map(item => ({ assetId: item.assetId, systemId: item.systemId,
        systemName: item.systemName, findingsCount: item.findingsCount,
        device: deviceReportDetails(assetsById.get(item.assetId), item.assetId) })),
      exposureTotal: exposureRows.length, unmodelledRows: unmodelledRows.slice(0, 35), unmodelledTotal: unmodelledRows.length
    } });
}
