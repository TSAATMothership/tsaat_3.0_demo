import { documentResponse } from "@/lib/documents/server-response";
import { orderReportFindings } from "@/lib/documents/finding-order";
import type { SummaryPdfData } from "@/lib/documents/legacy-pdf-data";
import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { parseFilters } from "@/lib/selectors";
import { deviceReportDetails } from "@/lib/device-report";

export const dynamic = "force-dynamic";

function summaryReportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `tsaat-cyber-posture-summary-${safeDate}.pdf`;
}

export async function GET(request: NextRequest) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(request.nextUrl.searchParams.get("dataDate") ?? undefined),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);
  const requestedFormat = request.nextUrl.searchParams.get("format")?.toLowerCase();
  const findings = requestedFormat === "pdf" ? orderReportFindings(analytics.findings) : analytics.findings;
  const topRisks = findings.slice(0, 10);
  const productionExceptions = findings.filter(
    (finding) => finding.scope.environmentType === "Production" || finding.severity === "High Risk"
  );

  if (requestedFormat === "pdf") {
    const assetsById = new Map(dataset.assets.map(asset => [asset.id,asset]));
    const data: SummaryPdfData = {
      snapshotDate: dataset.snapshotDate, overallCompliancePercent: analytics.overallCompliancePercent, counts: analytics.statusTotals,
      topRisks: topRisks.map(risk=>({priorityRank:risk.priorityRank,spiId:risk.spiId,severity:risk.severity,title:risk.title,scope:{assetId:risk.scope.assetId}})),
      productionExceptions: productionExceptions.map(item=>({severity:item.severity,spiId:item.spiId,scope:{assetId:item.scope.assetId,systemId:item.scope.systemId}})),
      tables:[
        {sectionTitle:"Top 10 Risks",columns:[{label:"Priority / SPI / Severity",weight:1.5},{label:"Finding",weight:2.5}],
          rows:topRisks.slice(0,10).map(risk=>({device:deviceReportDetails(assetsById.get(risk.scope.assetId),risk.scope.assetId),details:[`P${risk.priorityRank} | SPI-${risk.spiId}\n${risk.severity}`,`CI ID: ${risk.scope.assetId}\n${risk.title}`]}))},
        {sectionTitle:"Production Exceptions / High Risk (First 20)",columns:[{label:"Severity / SPI",weight:1.5},{label:"CI ID / ICT System",weight:2}],
          rows:productionExceptions.slice(0,20).map(item=>({device:deviceReportDetails(assetsById.get(item.scope.assetId),item.scope.assetId),details:[`${item.severity}\nSPI-${item.spiId}`,`${item.scope.assetId}\n${item.scope.systemId ?? "Network"}`]}))}
      ]
    };
    return documentResponse(request,{version:1,kind:"pdf-posture-summary",title:"TSAAT Cyber Posture Summary",filename:summaryReportFileName(dataset.snapshotDate),generatedAt:new Date().toISOString(),data});
  }

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    overallCompliancePercent: analytics.overallCompliancePercent,
    counts: analytics.statusTotals,
    topRisks,
    productionExceptions
  });
}
