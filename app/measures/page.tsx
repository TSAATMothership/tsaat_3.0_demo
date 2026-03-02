import { FilterBar } from "@/components/filter-bar";
import { KpiSpiMatrix } from "@/components/kpi-spi-matrix";
import { MeasuresSettingsMatrix } from "@/components/measures-settings-matrix";
import { MeasuresTabs } from "@/components/measures-tabs";
import {
  KpiComplianceChart,
  SecurityPerformanceIndicatorComplianceChart
} from "@/components/security-performance-indicator-compliance-chart";
import { SPI_DESCRIPTIONS } from "@/lib/constants";
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
  const activeTab: "measures" | "settings" = requestedTab === "settings" ? "settings" : "measures";
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
  const spiCompliancePoints = Array.from({ length: 10 }, (_, index) => {
    const spiId = index + 1;
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
      description: SPI_DESCRIPTIONS[spiId as keyof typeof SPI_DESCRIPTIONS],
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
    <div className="space-y-4">
      <section className="panel p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Measures View</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-100">KPI and SPI Measures</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-300/85">
          Performance and compliance measures for TSAAT posture. Snapshot date {dataset.snapshotDate}.
          All charts and scores are recalculated from the active filter scope.
        </p>
      </section>

      <MeasuresTabs activeTab={activeTab} />

      {activeTab === "measures" ? (
        <>
          <FilterBar
            options={filterOptions}
            filters={filters}
            hiddenFields={["systemCriticality"]}
            extraSelectFields={measuresExtraSelects}
            enableLoadingOverlay
          />

          <section className="grid gap-4 xl:grid-cols-2">
            <KpiComplianceChart data={kpiCompliancePoints} />
            <SecurityPerformanceIndicatorComplianceChart data={spiCompliancePoints} />
          </section>

          <KpiSpiMatrix
            analytics={analytics}
            systems={systems}
            networks={networks}
            filters={filters}
            filterOptions={filterOptions}
          />
        </>
      ) : (
        <MeasuresSettingsMatrix initialSettings={measuresSettings} />
      )}
    </div>
  );
}
