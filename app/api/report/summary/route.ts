import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import { loadCurrentDataset, loadDiscoveryToolsSettings, loadMeasuresSettings } from "@/lib/data-loader";
import { parseFilters } from "@/lib/selectors";

export async function GET(request: NextRequest) {
  const [dataset, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadCurrentDataset(),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings, discoveryToolsSettings);

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    overallCompliancePercent: analytics.overallCompliancePercent,
    counts: analytics.statusTotals,
    topRisks: analytics.findings.slice(0, 10),
    productionExceptions: analytics.findings.filter(
      (finding) => finding.scope.environmentType === "Production" || finding.severity === "High Risk"
    )
  });
}
