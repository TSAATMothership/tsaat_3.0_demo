import { NextRequest } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadKpiDefinitions,
  loadMeasuresSettings
} from "@/lib/data-loader";
import { extractDataDateParam } from "@/lib/data-date";
import { createPerformanceReportPdf } from "@/lib/performance-report-pdf";
import { buildNetworkPerformanceReportModel } from "@/lib/performance-report-model";
import { filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `tsaat-network-performance-report-${safeDate}.pdf`;
}

export async function GET(request: NextRequest) {
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const selectedDataDate = extractDataDateParam(queryObject);
  const [dataset, measuresSettings, discoveryToolsSettings, kpiDefinitions] = await Promise.all([
    loadDatasetForDate(selectedDataDate),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings(),
    loadKpiDefinitions()
  ]);
  const filters = parseFilters(queryObject);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings, discoveryToolsSettings);
  const networks = filterNetworks(dataset.managedNetworks, filters);
  const systems = filterSystems(dataset.ictSystems, filters);
  const model = buildNetworkPerformanceReportModel({
    dataset,
    analytics,
    filters,
    networks,
    systems,
    kpiDefinitions,
    asOfDate: selectedDataDate ?? dataset.snapshotDate
  });
  const pdfArrayBuffer = await createPerformanceReportPdf(model);

  return new Response(pdfArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${reportFileName(dataset.snapshotDate)}`
    }
  });
}
