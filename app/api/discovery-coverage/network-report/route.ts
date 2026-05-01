import { PDFDocument, StandardFonts } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { loadDatasetForDate, loadDiscoveryToolsSettings, loadMeasuresSettings } from "@/lib/data-loader";
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

  drawReportHeading(context, "Discovered Assets - Annex A:");
  drawReportParagraph(context, "Discovered Assets:", { size: 9 });
  drawReportTable(
    context,
    ["CI Name", "Asset Type", "IP Address", "ICT System", "Environment", "Coverage"],
    model.discoveredAssets.map((asset) => [
      asset.hostname || asset.name,
      asset.assetTypeLabel,
      asset.ipAddress,
      asset.systemName,
      asset.environment,
      asset.coverageStatus
    ]),
    [111, 75, 76, 104, 74, 91]
  );

  drawReportHeading(context, "Assets Not Discovered - Annex B:");
  drawReportParagraph(context, "Assets where discovery is not enabled:", { size: 9 });
  drawReportTable(
    context,
    ["CI Name", "Asset Type", "IP Address", "ICT System", "Missing Discovery Tools"],
    model.assetsNotDiscovered.map((asset) => [
      asset.hostname || asset.name,
      asset.assetTypeLabel,
      asset.ipAddress,
      asset.systemName,
      asset.missingTools.length ? asset.missingTools.join(", ") : "None"
    ]),
    [111, 75, 76, 104, 165]
  );
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
  const [dataset, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const model = buildNetworkDiscoveryReportModel({
    dataset,
    discoveryToolsSettings,
    measuresSettings,
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
