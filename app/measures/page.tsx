import { FilterBar } from "@/components/filter-bar";
import { KpiSpiMatrix } from "@/components/kpi-spi-matrix";
import { MeasuresSettingsMatrix } from "@/components/measures-settings-matrix";
import { MeasuresSpiFilters } from "@/components/measures-spi-filters";
import { MeasuresTabs } from "@/components/measures-tabs";
import {
  KpiComplianceChart,
  SecurityPerformanceIndicatorComplianceChart
} from "@/components/security-performance-indicator-compliance-chart";
import { buildKpiRows } from "@/lib/measures";
import { getCoreAppData } from "@/lib/app-data";
import { loadSnapshotKpiEvaluationsForAnalyticsScope } from "@/lib/data-loader";
import { resolveMeasuresTab } from "@/lib/measures-tab-routing";
import { FindingSeverity, type SpiId } from "@/lib/types";
import { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function readSpiFilter(
  searchParams: Record<string, string | string[] | undefined>,
  spiDefinitions: SpiDefinition[]
): SpiId | undefined {
  const value = firstParam(searchParams.spi)?.trim();
  const numericValue = Number(value);
  if (spiDefinitions.some((definition) => definition.spiId === numericValue)) {
    return numericValue as SpiId;
  }
  return undefined;
}

function readMeasureSearch(searchParams: Record<string, string | string[] | undefined>): string {
  return firstParam(searchParams.measureSearch)?.trim() ?? "";
}

export default async function MeasuresPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const requestedTab = firstParam(searchParams.measuresTab)?.trim().toLowerCase();
  const activeTab = resolveMeasuresTab(requestedTab);
  const measureSearch = readMeasureSearch(searchParams);
  const {
    analytics,
    filterOptions,
    filters,
    dataset,
    systems,
    networks,
    kpiDefinitions,
    spiDefinitions,
    severityDefinitions,
    priorityDefinitions,
    measuresSettings
  } =
    await getCoreAppData(searchParams);
  const selectedSpiId = readSpiFilter(searchParams, spiDefinitions);
  const kpiEvaluations = await loadSnapshotKpiEvaluationsForAnalyticsScope({
    dataset,
    analytics,
    systems,
    networks,
    kpiDefinitions
  });
  const kpiRows = buildKpiRows(kpiDefinitions, kpiEvaluations);
  const severityOptions: FindingSeverity[] = severityDefinitions.map((definition: SeverityDefinition) => definition.severityKey);
  const measuresExtraSelects = [
    {
      key: "severity",
      label: "Severity",
      value: filters.severity,
      options: severityOptions.map((severity) => ({ id: severity, label: severity }))
    }
  ];
  const spiCompliancePoints = spiDefinitions.map((definition) => {
    const spiId = definition.spiId;
    const statuses = analytics.evaluations.flatMap((assetEvaluation) =>
      assetEvaluation.evaluations
        .filter((evaluation) => evaluation.spiId === spiId)
        .map((evaluation) => evaluation.status)
    );
    const possibleCompliance = statuses.length;
    const actualCompliance = statuses.filter((status) => status === "Compliant").length;
    const actualCompliancePercent = possibleCompliance
      ? Number(((actualCompliance / possibleCompliance) * 100).toFixed(1))
      : 0;

    return {
      label: `SPI ${spiId}`,
      description: definition.description,
      possibleCompliancePercent: possibleCompliance > 0 ? 100 : 0,
      actualCompliancePercent,
      possibleCompliance,
      actualCompliance
    };
  });
  const kpiCompliancePoints = kpiRows.map((row) => {
    return {
      label: row.id,
      description: row.name,
      possibleCompliancePercent: row.applicableCount > 0 ? 100 : 0,
      actualCompliancePercent: row.scorePercent,
      possibleCompliance: row.applicableCount,
      actualCompliance: row.compliantCount
    };
  });

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Measures View</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">KPI and SPI Measures</h1>
        <p className="mt-1 max-w-none whitespace-nowrap text-sm text-slate-300/85">
          Performance and compliance measures for TSAAT posture. Snapshot date {dataset.snapshotDate}.
          All charts and scores are recalculated from the active filter scope.
        </p>
      </section>

      <MeasuresTabs activeTab={activeTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "summary" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["systemCriticality"]}
                extraSelectFields={measuresExtraSelects}
                enableLoadingOverlay
              />
            </div>
            <section className="min-h-0 overflow-auto pr-1">
              <div className="grid h-full min-h-[28rem] w-full min-w-[calc(50rem+0.5rem)] grid-cols-[repeat(2,minmax(25rem,1fr))] gap-2">
                <KpiComplianceChart data={kpiCompliancePoints} />
                <SecurityPerformanceIndicatorComplianceChart data={spiCompliancePoints} />
              </div>
            </section>
          </div>
        ) : activeTab === "measures-kpi" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["systemCriticality"]}
                extraSelectFields={measuresExtraSelects}
                enableLoadingOverlay
              />
            </div>
            <div className="min-h-0 flex-1">
              <KpiSpiMatrix
                dataset={dataset}
                analytics={analytics}
                kpiRows={kpiRows}
                spiDefinitions={spiDefinitions}
                filters={filters}
                filterOptions={filterOptions}
                mode="kpi"
              />
            </div>
          </div>
        ) : activeTab === "measures-spi" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["systemCriticality"]}
                extraSelectFields={measuresExtraSelects}
                enableLoadingOverlay
              />
            </div>
            <MeasuresSpiFilters
              selectedSpiId={selectedSpiId}
              spiDefinitions={spiDefinitions}
              searchValue={measureSearch}
              placeholder="Search SPI name, description or success measure"
            />
            <div className="min-h-0 flex-1">
              <KpiSpiMatrix
                dataset={dataset}
                analytics={analytics}
                spiDefinitions={spiDefinitions}
                filters={filters}
                filterOptions={filterOptions}
                mode="spi"
                selectedSpiId={selectedSpiId}
                searchValue={measureSearch}
              />
            </div>
          </div>
        ) : (
          <MeasuresSettingsMatrix
            initialSettings={measuresSettings}
            spiDefinitions={spiDefinitions}
            severityDefinitions={severityDefinitions}
            priorityDefinitions={priorityDefinitions}
          />
        )}
      </div>
    </div>
  );
}
