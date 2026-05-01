import { FilterBar } from "@/components/filter-bar";
import { KpiSpiMatrix } from "@/components/kpi-spi-matrix";
import { MeasuresSettingsMatrix } from "@/components/measures-settings-matrix";
import { MeasuresTabs } from "@/components/measures-tabs";
import {
  KpiComplianceChart,
  SecurityPerformanceIndicatorComplianceChart
} from "@/components/security-performance-indicator-compliance-chart";
import { SPI_DESCRIPTIONS, SPI_IDS } from "@/lib/spi-metadata";
import { buildKpiRows } from "@/lib/measures";
import { getCoreAppData } from "@/lib/app-data";
import { FindingSeverity } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function MeasuresPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { analytics, filterOptions, filters, dataset, systems, networks, measuresSettings } = await getCoreAppData(
    searchParams
  );
  const requestedTab = firstParam(searchParams.measuresTab)?.trim().toLowerCase();
  const activeTab: "summary" | "measures-kpi" | "measures-spi" | "spi-settings" | "kpi-settings" =
    requestedTab === "measures-kpi" ||
    requestedTab === "measures-spi" ||
    requestedTab === "spi-settings" ||
    requestedTab === "kpi-settings"
      ? requestedTab
      : requestedTab === "settings"
        ? "spi-settings"
        : "summary";
  const kpiRows = buildKpiRows(analytics, systems, networks);
  const severityOptions: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
  const measuresExtraSelects = [
    {
      key: "severity",
      label: "Severity",
      value: filters.severity,
      options: severityOptions.map((severity) => ({ id: severity, label: severity }))
    }
  ];
  const spiCompliancePoints = SPI_IDS.map((spiId) => {
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
      description: SPI_DESCRIPTIONS[spiId],
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
        <p className="mt-1 max-w-4xl text-sm text-slate-300/85">
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
                systems={systems}
                networks={networks}
                filters={filters}
                filterOptions={filterOptions}
                mode="kpi"
              />
            </div>
          </div>
        ) : activeTab === "measures-spi" ? (
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
                systems={systems}
                networks={networks}
                filters={filters}
                filterOptions={filterOptions}
                mode="spi"
              />
            </div>
          </div>
        ) : activeTab === "spi-settings" ? (
          <MeasuresSettingsMatrix initialSettings={measuresSettings} />
        ) : (
          <section className="panel flex h-full min-h-0 items-center justify-center p-4">
            <p className="text-sm text-slate-300/80">KPI settings will be added in a future release.</p>
          </section>
        )}
      </div>
    </div>
  );
}
