import { PDFDocument, StandardFonts } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { isUnassignedNetworkId } from "@/lib/discovery-filter-scope";
import { buildNetworkDiscoveryReportModel, type NetworkDiscoveryReportModel } from "@/lib/network-discovery-report-model";
import {
  NETWORK_DISCOVERY_REPORT_CONTENT_TYPE,
  networkDiscoveryReportDataDateFromSearchParams,
  networkDiscoveryReportFilename
} from "@/lib/network-discovery-report-links";
import {
  createReportPdfContext,
  drawReportHeading,
  drawReportParagraph,
  drawReportTable
} from "@/lib/report-template-pdf";
import { parseFilters } from "@/lib/selectors";
import { drawDeviceReportTable } from "@/lib/device-report-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function drawNetworkDiscoveryReport(model: NetworkDiscoveryReportModel, pdfDoc: PDFDocument) {
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const context = createReportPdfContext({
    pdfDoc,
    pageTitle: "TSAAT - Network Discovery Report",
    snapshotDate: model.snapshotDate,
    fontRegular,
    fontBold
  });

  drawReportHeading(context, "Report Name");
  drawReportParagraph(context, model.reportName);

  drawReportHeading(context, "Filter Scope");
  drawReportParagraph(context, model.filterText, { size: 9 });

  drawReportHeading(context, "Network Profile");
  drawReportTable(
    context,
    ["Field", "Value"],
    [
      ["Network Name", model.network.name],
      ["Network Description", model.network.description],
      ["Authority To Operate (ATO) Number", model.network.atoNumber],
      ["DIIS Number", model.network.diisId],
      ["Modelling Status", model.network.modellingStatus]
    ],
    [185, 346]
  );

  drawReportHeading(context, "Target State Discovery");
  drawReportTable(
    context,
    ["Asset Type", "Target", "Discovered", "Matched", "Coverage", "Status"],
    model.targetStateRows.map((row) => [
      row.assetTypeLabel,
      String(row.targetTotal),
      String(row.discoveredTotal),
      String(row.matchedTotal),
      `${row.coveragePercent}%`,
      row.status
    ]),
    [92, 58, 72, 65, 65, 179]
  );

  drawReportHeading(context, "Discovery Tool Coverage");
  drawReportTable(
    context,
    ["Metric", "Value"],
    [
      ["Assets In Scope", String(model.summary.assetsInScope)],
      ["Coverage Compliant Assets", String(model.summary.coverageCompliantAssets)],
      ["Assets With Coverage Gaps", String(model.summary.assetsWithCoverageGaps)],
      ["Overall Tool Coverage", `${model.summary.overallToolCoveragePercent}%`]
    ],
    [185, 346]
  );
  drawReportTable(
    context,
    ["Tool", "Covered", "Missing", "Applicable", "Coverage"],
    model.toolCoverageRows.map((row) => [
      row.toolName,
      String(row.covered),
      String(row.missing),
      String(row.applicable),
      `${row.coveragePercent}%`
    ]),
    [179, 75, 75, 85, 117]
  );

  drawDeviceReportTable({ ...context, sectionTitle: "Discovered Assets - Annex A",
    columns: [{ label: "Asset Type" }, { label: "Hostname / ICT System / Environment", weight: 1.5 }, { label: "Coverage" }],
    rows: model.discoveredAssets.map(asset => ({ device: asset.device, details: [asset.assetTypeLabel, `${asset.hostname}\n${asset.systemName}\n${asset.environment}`, asset.coverageStatus] })) });
  drawDeviceReportTable({ ...context, sectionTitle: "Assets Not Discovered - Annex B: Discovery Coverage Gaps",
    columns: [{ label: "Asset Type" }, { label: "Hostname / ICT System", weight: 1.5 }, { label: "Missing Discovery Tools", weight: 2 }],
    rows: model.assetsNotDiscovered.map(asset => ({ device: asset.device, details: [asset.assetTypeLabel, `${asset.hostname}\n${asset.systemName}`, asset.missingTools.join(", ") || "None"] })) });
}

export async function GET(request: NextRequest) {
  const networkId = request.nextUrl.searchParams.get("network")?.trim();
  if (!networkId) {
    return errorResponse("Missing network parameter.", 400);
  }
  if (isUnassignedNetworkId(networkId)) {
    return errorResponse("Unassigned Systems is not a network and cannot be used for network discovery reports.", 400);
  }

  const requestedDataDate = networkDiscoveryReportDataDateFromSearchParams(request.nextUrl.searchParams);
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(requestedDataDate, { profile: "summary" }),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const model = buildNetworkDiscoveryReportModel({
    dataset,
    discoveryToolsSettings,
    measuresSettings,
    spiDefinitions,
    networkId,
    filters
  });

  if (!model) {
    return errorResponse("Network row not found for supplied id.", 404);
  }

  const pdfDoc = await PDFDocument.create();
  await drawNetworkDiscoveryReport(model, pdfDoc);
  const pdfBytes = await pdfDoc.save();
  const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

  return new Response(pdfArrayBuffer, {
    headers: {
      "Content-Type": NETWORK_DISCOVERY_REPORT_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename=${networkDiscoveryReportFilename(networkId, dataset.snapshotDate)}`
    }
  });
}
