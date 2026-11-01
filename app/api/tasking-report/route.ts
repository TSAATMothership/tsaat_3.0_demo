import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
  isKpiReportAvailable,
  KpiTrendReportModel
} from "@/lib/kpi-report-model";
import { buildKpiRows } from "@/lib/measures";
import { drawKpiCurrentReport } from "@/lib/kpi-current-report-pdf";
import { drawSpiReportSummary } from "@/lib/spi-report-summary-pdf";
import { drawDeviceReportTable } from "@/lib/device-report-pdf";
import { deviceReportDetails } from "@/lib/device-report";
import {
  buildSpiReportModel,
  buildSpiReportModels,
  buildSpiTrendReportModel,
  SpiReportModel,
  SpiTrendReportModel
} from "@/lib/spi-report-model";
import {
  remediationActionsForKpi,
  taskingConditionForKpi,
  teamsForKpi
} from "@/lib/tasking";
import {
  TASKING_REPORT_CONTENT_TYPE,
  taskingReportDataDateFromSearchParams,
  taskingReportFilename
} from "@/lib/tasking-report-links";
import { parseFilters } from "@/lib/selectors";
import { resolveKpiScope } from "@/lib/kpi-scope";
import { AnalyticsResult, Dataset, ICTSystem } from "@/lib/types";

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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) {
        lines.push(line);
      }
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [""];
}

function drawWrappedBlock({
  page,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  font,
  size,
  color
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  font: PDFFont;
  size: number;
  color: { r: number; g: number; b: number };
}): number {
  const lines = wrapText(text, font, size, maxWidth);
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color: rgb(color.r, color.g, color.b) });
    cursor -= lineHeight;
  }
  return cursor;
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

interface PdfDrawContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  y: number;
  pageTitle: string;
  snapshotDate: string;
  fontRegular: PDFFont;
  fontBold: PDFFont;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT_MARGIN = 32;
const RIGHT_MARGIN = 32;
const BOTTOM_MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;

function createReportPage({
  pdfDoc,
  pageTitle,
  snapshotDate,
  fontRegular,
  fontBold
}: {
  pdfDoc: PDFDocument;
  pageTitle: string;
  snapshotDate: string;
  fontRegular: PDFFont;
  fontBold: PDFFont;
}): { page: PDFPage; y: number } {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const titleLines = wrapText(pageTitle, fontBold, 13, CONTENT_WIDTH);
  const headerHeight = 62 + (titleLines.length - 1) * 16;
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - headerHeight, width: PAGE_WIDTH, height: headerHeight, color: rgb(0.04, 0.16, 0.27) });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - headerHeight - 5, width: PAGE_WIDTH, height: 5, color: rgb(0.36, 0.75, 0.88) });
  titleLines.forEach((line, index) => page.drawText(line, {
    x: LEFT_MARGIN,
    y: PAGE_HEIGHT - 34 - index * 16,
    size: 13,
    font: fontBold,
    color: rgb(0.92, 0.97, 1)
  }));
  page.drawText(`Snapshot Date: ${snapshotDate}`, {
    x: LEFT_MARGIN,
    y: PAGE_HEIGHT - headerHeight + 10,
    size: 9,
    font: fontRegular,
    color: rgb(0.84, 0.91, 0.96)
  });
  page.drawText("Generated from the current filtered operational scope.", {
    x: LEFT_MARGIN,
    y: 20,
    size: 8,
    font: fontRegular,
    color: rgb(0.42, 0.47, 0.54)
  });
  return { page, y: PAGE_HEIGHT - headerHeight - 30 };
}

function startNewReportPage(context: PdfDrawContext) {
  const pageState = createReportPage(context);
  context.page = pageState.page;
  context.y = pageState.y;
}

function ensureReportSpace(context: PdfDrawContext, requiredHeight: number) {
  if (context.y - requiredHeight < BOTTOM_MARGIN) {
    startNewReportPage(context);
  }
}

function drawReportHeading(context: PdfDrawContext, text: string) {
  const lines = wrapText(text, context.fontBold, 12, CONTENT_WIDTH);
  ensureReportSpace(context, lines.length * 15 + 13);
  lines.forEach((line, index) => context.page.drawText(line, {
    x: LEFT_MARGIN,
    y: context.y - index * 15,
    size: 12,
    font: context.fontBold,
    color: rgb(0.07, 0.2, 0.31)
  }));
  context.y -= lines.length * 15 + 3;
}

function drawSpiContacts(context: PdfDrawContext, model: SpiReportModel) {
  ensureReportSpace(context, 65);
  drawReportHeading(context, "Who to contact?");
  for (const team of model.taskingTeams) {
    drawReportParagraph(context, `- ${team.team} | Queue: ${team.supportQueue} | Email: ${team.contactEmail}`, { size: 9, indent: 8 });
  }
}

function numberReportPages(pdfDoc: PDFDocument, font: PDFFont) {
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawText(label, { x: page.getWidth() - RIGHT_MARGIN - font.widthOfTextAtSize(label, 8), y: 20, font, size: 8, color: rgb(0.42, 0.47, 0.54) });
  });
}

function drawSpiDeviceAnnex(context: PdfDrawContext, title: string, rows: SpiReportModel["annexA"]) {
  if (!rows.length) {
    drawReportHeading(context, title);
    drawReportParagraph(context, "None in current filtered scope.");
    return;
  }
  drawDeviceReportTable({ ...context, sectionTitle: title,
    columns: [{ label: "Asset Type" }, { label: "Score" }],
    rows: rows.map(row => ({ device: row.device, details: [row.assetTypeLabel, row.score] })) });
}

function drawReportParagraph(context: PdfDrawContext, text: string, options: { size?: number; indent?: number } = {}) {
  const size = options.size ?? 10;
  const indent = options.indent ?? 0;
  const lineHeight = size + 3;
  const lines = wrapText(text, context.fontRegular, size, CONTENT_WIDTH - indent);
  ensureReportSpace(context, lines.length * lineHeight + 8);
  for (const line of lines) {
    context.page.drawText(line, {
      x: LEFT_MARGIN + indent,
      y: context.y,
      size,
      font: context.fontRegular,
      color: rgb(0.14, 0.17, 0.22)
    });
    context.y -= lineHeight;
  }
  context.y -= 6;
}

function drawReportBullet(context: PdfDrawContext, text: string) {
  drawReportParagraph(context, `- ${text}`, { indent: 8 });
}

function drawReportTable(context: PdfDrawContext, headers: string[], rows: string[][], columnWidths: number[]) {
  if (!rows.length) {
    drawReportParagraph(context, "None in current filtered scope.", { size: 9 });
    return;
  }
  const drawHeader = () => {
    const headerHeight = 22;
    ensureReportSpace(context, headerHeight + 8);
    let x = LEFT_MARGIN;
    for (let index = 0; index < headers.length; index += 1) {
      const width = columnWidths[index] ?? 80;
      context.page.drawRectangle({
        x,
        y: context.y - headerHeight + 5,
        width,
        height: headerHeight,
        color: rgb(0.06, 0.18, 0.3),
        borderColor: rgb(0.58, 0.73, 0.84),
        borderWidth: 0.5
      });
      context.page.drawText(headers[index] ?? "", {
        x: x + 4,
        y: context.y - 9,
        size: 8,
        font: context.fontBold,
        color: rgb(0.92, 0.97, 1)
      });
      x += width;
    }
    context.y -= headerHeight;
  };

  const firstRowLines = rows[0].map((cell, index) => wrapText(String(cell ?? ""), context.fontRegular, 8, Math.max((columnWidths[index] ?? 80) - 8, 20)));
  ensureReportSpace(context, 22 + Math.max(22, ...firstRowLines.map((lines) => lines.length * 10 + 10)) + 8);
  drawHeader();

  for (const row of rows) {
    const cellLines = row.map((cell, index) =>
      wrapText(String(cell ?? ""), context.fontRegular, 8, Math.max((columnWidths[index] ?? 80) - 8, 20))
    );
    const rowHeight = Math.max(22, Math.max(...cellLines.map((lines) => lines.length)) * 10 + 10);

    if (context.y - rowHeight < BOTTOM_MARGIN) {
      startNewReportPage(context);
      drawHeader();
    }

    let x = LEFT_MARGIN;
    for (let index = 0; index < headers.length; index += 1) {
      const width = columnWidths[index] ?? 80;
      context.page.drawRectangle({
        x,
        y: context.y - rowHeight + 5,
        width,
        height: rowHeight,
        color: rgb(0.98, 0.99, 1),
        borderColor: rgb(0.82, 0.88, 0.95),
        borderWidth: 0.5
      });

      let textY = context.y - 8;
      for (const line of cellLines[index] ?? [""]) {
        context.page.drawText(line, {
          x: x + 4,
          y: textY,
          size: 8,
          font: context.fontRegular,
          color: rgb(0.16, 0.2, 0.27)
        });
        textY -= 10;
      }
      x += width;
    }

    context.y -= rowHeight;
  }

  context.y -= 12;
}

function drawReportTrendChart(
  context: PdfDrawContext,
  model: {
    trendPoints: Array<{
      snapshotDate: string;
      compliant: number;
      nonCompliant: number;
      unknown: number;
    }>;
  }
) {
  const points = model.trendPoints;
  const chartHeight = 224;
  ensureReportSpace(context, chartHeight + 8);

  const top = context.y;
  const chartX = LEFT_MARGIN;
  const chartY = top - chartHeight + 10;
  const chartWidth = CONTENT_WIDTH;
  const plotLeft = chartX + 44;
  const plotRight = chartX + chartWidth - 12;
  const plotTop = top - 30;
  const plotBottom = chartY + 34;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotTop - plotBottom;
  const maxCount = Math.max(
    1,
    ...points.flatMap((point) => [point.compliant, point.nonCompliant, point.unknown])
  );

  context.page.drawRectangle({
    x: chartX,
    y: chartY,
    width: chartWidth,
    height: chartHeight - 10,
    color: rgb(0.97, 0.99, 1),
    borderColor: rgb(0.82, 0.88, 0.95),
    borderWidth: 0.6
  });

  const legend = [
    { label: "Compliant", color: rgb(0.05, 0.52, 0.31) },
    { label: "Non-compliant", color: rgb(0.79, 0.11, 0.16) },
    { label: "Unknown", color: rgb(0.74, 0.45, 0.03) }
  ];
  let legendX = plotLeft;
  for (const item of legend) {
    context.page.drawRectangle({ x: legendX, y: top - 18, width: 8, height: 8, color: item.color });
    context.page.drawText(item.label, {
      x: legendX + 12,
      y: top - 18,
      size: 8,
      font: context.fontRegular,
      color: rgb(0.16, 0.2, 0.27)
    });
    legendX += 88;
  }

  for (const tick of [0, 0.5, 1]) {
    const y = plotBottom + plotHeight * tick;
    const value = Math.round(maxCount * tick);
    context.page.drawLine({
      start: { x: plotLeft, y },
      end: { x: plotRight, y },
      thickness: 0.35,
      color: rgb(0.82, 0.88, 0.95)
    });
    context.page.drawText(String(value), {
      x: chartX + 12,
      y: y - 3,
      size: 7,
      font: context.fontRegular,
      color: rgb(0.42, 0.47, 0.54)
    });
  }

  context.page.drawLine({
    start: { x: plotLeft, y: plotBottom },
    end: { x: plotLeft, y: plotTop },
    thickness: 0.6,
    color: rgb(0.46, 0.56, 0.66)
  });
  context.page.drawLine({
    start: { x: plotLeft, y: plotBottom },
    end: { x: plotRight, y: plotBottom },
    thickness: 0.6,
    color: rgb(0.46, 0.56, 0.66)
  });

  const xForIndex = (index: number) => {
    if (points.length <= 1) {
      return plotLeft + plotWidth / 2;
    }
    return plotLeft + (plotWidth * index) / (points.length - 1);
  };
  const yForValue = (value: number) => plotBottom + (plotHeight * value) / maxCount;

  const drawSeries = (
    valueForPoint: (point: (typeof points)[number]) => number,
    color: { r: number; g: number; b: number }
  ) => {
    const seriesColor = rgb(color.r, color.g, color.b);
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      context.page.drawLine({
        start: { x: xForIndex(index - 1), y: yForValue(valueForPoint(previous)) },
        end: { x: xForIndex(index), y: yForValue(valueForPoint(current)) },
        thickness: 1.4,
        color: seriesColor
      });
    }
    points.forEach((point, index) => {
      const x = xForIndex(index);
      const y = yForValue(valueForPoint(point));
      context.page.drawRectangle({ x: x - 2, y: y - 2, width: 4, height: 4, color: seriesColor });
    });
  };

  drawSeries((point) => point.compliant, { r: 0.05, g: 0.52, b: 0.31 });
  drawSeries((point) => point.nonCompliant, { r: 0.79, g: 0.11, b: 0.16 });
  drawSeries((point) => point.unknown, { r: 0.74, g: 0.45, b: 0.03 });

  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  points.forEach((point, index) => {
    if (index % labelEvery !== 0 && index !== points.length - 1) {
      return;
    }
    const x = xForIndex(index);
    context.page.drawText(point.snapshotDate.slice(5), {
      x: x - 14,
      y: chartY + 16,
      size: 7,
      font: context.fontRegular,
      color: rgb(0.42, 0.47, 0.54)
    });
  });

  context.y -= chartHeight;
}

function drawSpiTemplateReport({
  pdfDoc,
  fontRegular,
  fontBold,
  model,
  snapshotDate,
  filterText
}: {
  pdfDoc: PDFDocument;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  model: SpiReportModel;
  snapshotDate: string;
  filterText: string;
}) {
  pdfDoc.setTitle(model.reportName + (model.nonCompliantOnly ? " - Non-Compliance Only" : ""));
  const pageState = createReportPage({
    pdfDoc,
    pageTitle: model.reportName,
    snapshotDate,
    fontRegular,
    fontBold
  });
  const context: PdfDrawContext = {
    pdfDoc,
    page: pageState.page,
    y: pageState.y,
    pageTitle: model.reportName,
    snapshotDate,
    fontRegular,
    fontBold
  };

  drawReportHeading(context, `Indicator: ${model.indicatorLabel} - ${model.name}`);
  if (model.nonCompliantOnly) drawReportParagraph(context, "Results: Non-Compliance Only. Compliant and unknown results are excluded.", { size: 9 });
  drawSpiReportSummary(context, model);
  drawReportHeading(context, "Description");
  drawReportParagraph(context, model.description);
  drawReportParagraph(context, `Success Measure: ${model.successMeasure}`);
  drawReportHeading(context, "Filter Scope");
  drawReportParagraph(context, filterText, { size: 9 });

  drawReportHeading(context, "Non-Compliant CIs by Asset Type");
  drawReportTable(
    context,
    model.assetTypeBreakdown.map((group) => group.label),
    [model.assetTypeBreakdown.map((group) => String(group.nonCompliant))],
    [84, 92, 99, 99, 84, 73]
  );

  if (!model.nonCompliantOnly) {
    drawReportHeading(context, "Unknown Score CIs by Asset Type");
    drawReportTable(context, model.assetTypeBreakdown.map((group) => group.label),
      [model.assetTypeBreakdown.map((group) => String(group.unknown))], [84, 92, 99, 99, 84, 73]);
  }

  drawReportHeading(context, "Observed Non-compliant Condition");
  drawReportParagraph(context, model.observedNonCompliantCondition);
  if (!model.nonCompliantOnly) {
    drawReportHeading(context, "Observed Unknown CI Score needing investigation");
    drawReportParagraph(context, model.observedUnknownCondition);
  }

  drawReportHeading(context, "Remediation Actions");
  for (const action of model.remediationActions) {
    drawReportBullet(context, action);
  }
  drawSpiContacts(context, model);

  drawSpiDeviceAnnex(context, `${model.indicatorLabel} - Supporting Findings Annex A: ${model.nonCompliantOnly ? "Non-compliant" : "Compliant / Non-compliant"} CIs`, model.annexA);
  if (!model.nonCompliantOnly) drawSpiDeviceAnnex(context, `${model.indicatorLabel} - Supporting Findings Annex B: Unknown CIs`, model.annexB);
}

function drawSpiTrendTemplateReport({
  pdfDoc,
  fontRegular,
  fontBold,
  model,
  snapshotDate,
  filterText
}: {
  pdfDoc: PDFDocument;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  model: SpiTrendReportModel;
  snapshotDate: string;
  filterText: string;
}) {
  pdfDoc.setTitle(model.reportName);
  const current = model.current;
  const pageState = createReportPage({
    pdfDoc,
    pageTitle: model.reportName,
    snapshotDate,
    fontRegular,
    fontBold
  });
  const context: PdfDrawContext = {
    pdfDoc,
    page: pageState.page,
    y: pageState.y,
    pageTitle: model.reportName,
    snapshotDate,
    fontRegular,
    fontBold
  };

  drawReportHeading(context, `Indicator: ${current.indicatorLabel} - ${current.name}`);
  drawSpiReportSummary(context, current);
  drawReportHeading(context, "Description");
  drawReportParagraph(context, current.description);
  drawReportParagraph(context, `Success Measure: ${current.successMeasure}`);
  drawReportHeading(context, "Filter Scope");
  drawReportParagraph(context, filterText, { size: 9 });

  drawReportHeading(context, "Non-Compliant CIs by Asset Type");
  drawReportTable(
    context,
    current.assetTypeBreakdown.map((group) => group.label),
    [current.assetTypeBreakdown.map((group) => String(group.nonCompliant))],
    [84, 92, 99, 99, 84, 73]
  );

  drawReportHeading(context, "Unknown Score CIs by Asset Type");
  drawReportTable(
    context,
    current.assetTypeBreakdown.map((group) => group.label),
    [current.assetTypeBreakdown.map((group) => String(group.unknown))],
    [84, 92, 99, 99, 84, 73]
  );

  drawReportHeading(context, "12 months Trend Chart");
  drawReportParagraph(
    context,
    `This chart shows the Compliant CIs, Non-compliant CIs and Unknown CIs over the available snapshot period between ${model.rangeStartDate} and ${model.rangeEndDate}.`
  );
  drawReportTrendChart(context, model);
}

function drawKpiTrendTemplateReport({
  pdfDoc,
  fontRegular,
  fontBold,
  model,
  snapshotDate,
  filterText
}: {
  pdfDoc: PDFDocument;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  model: KpiTrendReportModel;
  snapshotDate: string;
  filterText: string;
}) {
  const current = model.current;
  const pageState = createReportPage({
    pdfDoc,
    pageTitle: model.reportName,
    snapshotDate,
    fontRegular,
    fontBold
  });
  const context: PdfDrawContext = {
    pdfDoc,
    page: pageState.page,
    y: pageState.y,
    pageTitle: model.reportName,
    snapshotDate,
    fontRegular,
    fontBold
  };

  drawReportHeading(context, "Report Name");
  drawReportParagraph(context, model.reportName);
  drawReportHeading(context, "Filter Scope");
  drawReportParagraph(context, filterText, { size: 9 });
  drawReportHeading(context, `Indicator: ${current.indicatorLabel}`);
  drawReportParagraph(context, `Description: ${current.description}`);
  drawReportParagraph(context, `Success Measure: ${current.successMeasure}`);
  drawReportParagraph(context, `Score: ${current.score}`);

  drawReportTable(
    context,
    ["Current Score", "Compliant", "Non-Compliant", "Unknown", "Total"],
    [
      [
        `${current.scorePercent}%`,
        String(current.compliant),
        String(current.nonCompliant),
        String(current.unknown),
        String(current.total)
      ]
    ],
    [104, 104, 116, 94, 84]
  );

  drawReportHeading(context, "12 months Trend Chart");
  drawReportParagraph(
    context,
    `This chart shows the Compliant, Non-compliant and Unknown KPI counts over the available snapshot period between ${model.rangeStartDate} and ${model.rangeEndDate}.`
  );
  drawReportTrendChart(context, model);
}

function drawSpiAllDetailSections(context: PdfDrawContext, model: SpiReportModel) {
  startNewReportPage(context);

  drawReportHeading(context, `Indicator: ${model.indicatorLabel} - ${model.name}`);
  drawSpiReportSummary(context, model);
  drawReportHeading(context, "Description");
  drawReportParagraph(context, model.description);
  drawReportParagraph(context, `Success Measure: ${model.successMeasure}`);

  drawReportHeading(context, "Non-Compliant CIs by Asset Type");
  drawReportTable(
    context,
    model.assetTypeBreakdown.map((group) => group.label),
    [model.assetTypeBreakdown.map((group) => String(group.nonCompliant))],
    [84, 92, 99, 99, 84, 73]
  );

  drawReportHeading(context, "Unknown Score CIs by Asset Type");
  drawReportTable(
    context,
    model.assetTypeBreakdown.map((group) => group.label),
    [model.assetTypeBreakdown.map((group) => String(group.unknown))],
    [84, 92, 99, 99, 84, 73]
  );

  drawReportHeading(context, "Observed Non-compliant Condition");
  drawReportParagraph(context, model.observedNonCompliantCondition);
  drawReportHeading(context, "Observed Unknown CI Score needing investigation");
  drawReportParagraph(context, model.observedUnknownCondition);

  drawReportHeading(context, "Remediation Actions");
  for (const action of model.remediationActions) {
    drawReportBullet(context, action);
  }
  drawSpiContacts(context, model);

  drawSpiDeviceAnnex(context, `${model.indicatorLabel} - Supporting Findings Annex A: Compliant / Non-compliant CIs`, model.annexA);
  drawSpiDeviceAnnex(context, `${model.indicatorLabel} - Supporting Findings Annex B: Unknown CIs`, model.annexB);
}

function drawSpiAllTemplateReport({
  pdfDoc,
  fontRegular,
  fontBold,
  models,
  snapshotDate,
  filterText
}: {
  pdfDoc: PDFDocument;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  models: SpiReportModel[];
  snapshotDate: string;
  filterText: string;
}) {
  const reportName = "All SPI Report";
  pdfDoc.setTitle(reportName);
  const pageState = createReportPage({
    pdfDoc,
    pageTitle: reportName,
    snapshotDate,
    fontRegular,
    fontBold
  });
  const context: PdfDrawContext = {
    pdfDoc,
    page: pageState.page,
    y: pageState.y,
    pageTitle: reportName,
    snapshotDate,
    fontRegular,
    fontBold
  };

  drawReportHeading(context, "Report Name");
  drawReportParagraph(context, reportName);
  drawSpiReportSummary(context, models.reduce((total, model) => ({ compliant: total.compliant + model.compliant,
    nonCompliant: total.nonCompliant + model.nonCompliant, unknown: total.unknown + model.unknown, total: total.total + model.total }),
  { compliant: 0, nonCompliant: 0, unknown: 0, total: 0 }), true);
  drawReportHeading(context, "Filter Scope");
  drawReportParagraph(context, filterText, { size: 9 });

  drawReportHeading(context, "Summary");
  drawReportParagraph(context, "This section shows the summary score for all SPIs.");
  drawReportTable(
    context,
    ["SPI", "Compliant CIs", "Non-Compliant CIs", "Unknown", "Total CIs"],
    models.map((model) => [
      `${model.indicatorLabel} ${model.total ? `${model.scorePercent}%` : "N/A"}`,
      String(model.compliant),
      String(model.nonCompliant),
      String(model.unknown),
      String(model.total)
    ]),
    [104, 104, 116, 94, 84]
  );

  drawReportHeading(context, "Overview");
  drawReportTable(
    context,
    ["SPI", "Description", "Success Measure", "Findings"],
    models.map((model) => [
      `${model.indicatorLabel}: ${model.name}`,
      model.description,
      model.successMeasure,
      `${model.observedNonCompliantCondition} ${model.observedUnknownCondition}`
    ]),
    [92, 134, 146, 159]
  );

  for (const model of models) {
    drawSpiAllDetailSections(context, model);
  }
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

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (kind === "spi") {
    const spiModel = buildSpiReportModel({ dataset, analytics, spiId: Number(id), spiDefinitions, nonCompliantOnly });
    if (!spiModel || !spiModel.reportAvailable) {
      return notFoundResponse("SPI row not found for supplied id.");
    }

    drawSpiTemplateReport({
      pdfDoc,
      fontRegular,
      fontBold,
      model: spiModel,
      snapshotDate: dataset.snapshotDate,
      filterText: filterSummary(request.nextUrl.searchParams)
    });
    numberReportPages(pdfDoc, fontRegular);
    const pdfBytes = await pdfDoc.save();
    const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${taskingReportFilename(kind, id, new Date(), spiModel.name, nonCompliantOnly)}"`
      }
    });
  }

  if (kind === "spi-all") {
    const spiModels = buildSpiReportModels(dataset, analytics, spiDefinitions).filter((model) => model.reportAvailable);
    if (!spiModels.length) {
      return notFoundResponse("No SPI rows found for the current filtered scope.");
    }

    drawSpiAllTemplateReport({
      pdfDoc,
      fontRegular,
      fontBold,
      models: spiModels,
      snapshotDate: dataset.snapshotDate,
      filterText: filterSummary(request.nextUrl.searchParams)
    });
    numberReportPages(pdfDoc, fontRegular);
    const pdfBytes = await pdfDoc.save();
    const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${taskingReportFilename(kind, id)}"`
      }
    });
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

    drawSpiTrendTemplateReport({
      pdfDoc,
      fontRegular,
      fontBold,
      model: trendModel,
      snapshotDate: dataset.snapshotDate,
      filterText: filterSummary(request.nextUrl.searchParams)
    });
    numberReportPages(pdfDoc, fontRegular);
    const pdfBytes = await pdfDoc.save();
    const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${taskingReportFilename(kind, id, new Date(), trendModel.current.name)}"`
      }
    });
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

    drawKpiTrendTemplateReport({
      pdfDoc,
      fontRegular,
      fontBold,
      model: trendModel,
      snapshotDate: dataset.snapshotDate,
      filterText: filterSummary(request.nextUrl.searchParams)
    });

    const pdfBytes = await pdfDoc.save();
    const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;
    const filename = taskingReportFilename(kind, id, new Date(), trendModel.current.name);

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  }

  if (kind === "kpi" && (id === "KPI-1" || id === "KPI-2")) {
    const model = buildKpiReportModel({ kpiRows, kpiId: id, kpiDefinitions, nonCompliantOnly });
    if (!model || !isKpiReportAvailable(id, kpiDefinitions)) {
      return notFoundResponse("KPI tasking report unavailable for supplied id.");
    }
    drawKpiCurrentReport({ pdfDoc, fontRegular, fontBold, model, snapshotDate: dataset.snapshotDate,
      filterText: filterSummary(request.nextUrl.searchParams), kpiDefinitions });
    const pdfBytes = await pdfDoc.save();
    return new Response(Uint8Array.from(pdfBytes).buffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${taskingReportFilename(kind, id, new Date(), undefined, nonCompliantOnly)}"`
      }
    });
  }

  const page = pdfDoc.addPage([595.28, 841.89]);

  page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 61.89, color: rgb(0.04, 0.16, 0.27) });
  page.drawRectangle({ x: 0, y: 775, width: 595.28, height: 5, color: rgb(0.36, 0.75, 0.88) });

  page.drawText("TSAAT - Tasking Report", {
    x: 32,
    y: 813,
    size: 16,
    font: fontBold,
    color: rgb(0.92, 0.97, 1)
  });

  page.drawText(`Snapshot Date: ${dataset.snapshotDate}`, {
    x: 32,
    y: 793,
    size: 10,
    font: fontRegular,
    color: rgb(0.84, 0.91, 0.96)
  });

  let y = 754;
  page.drawText("Filter Scope", { x: 32, y, size: 11, font: fontBold, color: rgb(0.07, 0.2, 0.31) });
  y -= 16;
  y = drawWrappedBlock({
    page,
    text: filterSummary(request.nextUrl.searchParams),
    x: 32,
    y,
    maxWidth: 535,
    lineHeight: 13,
    font: fontRegular,
    size: 9,
    color: { r: 0.23, g: 0.3, b: 0.36 }
  });
  y -= 8;

  if (kind === "kpi") {
    const kpiModel = buildKpiReportModel({
      kpiRows,
      kpiId: id,
      kpiDefinitions
    });
    if (!kpiModel || !isKpiReportAvailable(id, kpiDefinitions)) {
      return notFoundResponse("KPI tasking report unavailable for supplied id.");
    }
    const row = kpiModel.sourceRow;

    page.drawText(`Indicator: ${row.id} - ${row.name}`, {
      x: 32,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.07, 0.2, 0.31)
    });
    y -= 18;

    y = drawWrappedBlock({
      page,
      text: `Description: ${row.description}`,
      x: 32,
      y,
      maxWidth: 535,
      lineHeight: 13,
      font: fontRegular,
      size: 10,
      color: { r: 0.14, g: 0.17, b: 0.22 }
    });
    y = drawWrappedBlock({
      page,
      text: `Success Measure: ${row.successMeasure}`,
      x: 32,
      y: y - 4,
      maxWidth: 535,
      lineHeight: 13,
      font: fontRegular,
      size: 10,
      color: { r: 0.14, g: 0.17, b: 0.22 }
    });
    y = drawWrappedBlock({
      page,
      text: `Current Score: ${row.score}`,
      x: 32,
      y: y - 4,
      maxWidth: 535,
      lineHeight: 13,
      font: fontBold,
      size: 10,
      color: { r: 0.62, g: 0.16, b: 0.11 }
    });

    y -= 10;
    page.drawText("Observed Non-compliant Condition", {
      x: 32,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.07, 0.2, 0.31)
    });
    y = drawWrappedBlock({
      page,
      text: taskingConditionForKpi(row, kpiDefinitions),
      x: 32,
      y: y - 14,
      maxWidth: 535,
      lineHeight: 13,
      font: fontRegular,
      size: 10,
      color: { r: 0.14, g: 0.17, b: 0.22 }
    });

    if (row.reportDetailHandlerKey === "critical-system-threshold") {
      const criticalSystemsBelowThreshold = criticalSystemComplianceRowsAtOrBelowThreshold(dataset, analytics, 95);

      y -= 8;
      page.drawText("Critical ICT Systems at or below 95% compliance", {
        x: 32,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.07, 0.2, 0.31)
      });

      if (!criticalSystemsBelowThreshold.length) {
        y = drawWrappedBlock({
          page,
          text: "- None in current filtered scope.",
          x: 40,
          y: y - 14,
          maxWidth: 525,
          lineHeight: 13,
          font: fontRegular,
          size: 10,
          color: { r: 0.14, g: 0.17, b: 0.22 }
        });
      } else {
        for (const systemRow of criticalSystemsBelowThreshold) {
          y = drawWrappedBlock({
            page,
            text: `- ${systemRow.systemName} (${systemRow.systemId}) | Score ${systemRow.scorePercent}% (${systemRow.compliantCount}/${systemRow.applicableCount})`,
            x: 40,
            y: y - 14,
            maxWidth: 525,
            lineHeight: 13,
            font: fontRegular,
            size: 10,
            color: { r: 0.14, g: 0.17, b: 0.22 }
          });
        }
      }
    }

    if (row.reportDetailHandlerKey === "critical-exposure-assets") {
      const exposureAssetRows = criticalExposureAssetRows(dataset, analytics);
      const maxRows = 24;
      const shownRows = exposureAssetRows.slice(0, maxRows);

      y -= 8;
      page.drawText("Assets with ICT Critical Exposure findings", {
        x: 32,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.07, 0.2, 0.31)
      });

      if (!shownRows.length) {
        y = drawWrappedBlock({
          page,
          text: "- None in current filtered scope.",
          x: 40,
          y: y - 14,
          maxWidth: 525,
          lineHeight: 13,
          font: fontRegular,
          size: 10,
          color: { r: 0.14, g: 0.17, b: 0.22 }
        });
      } else {
        const assetsById = new Map(dataset.assets.map(asset => [asset.id, asset]));
        drawDeviceReportTable({ pdfDoc, fontRegular, fontBold, pageTitle: "KPI Tasking Report", snapshotDate: dataset.snapshotDate,
          sectionTitle: "Assets with ICT Critical Exposure findings", columns: [{ label: "CI ID" }, { label: "ICT System", weight: 1.5 }, { label: "Findings", weight: .6 }],
          rows: shownRows.map(item => ({ device: deviceReportDetails(assetsById.get(item.assetId), item.assetId), details: [item.assetId, `${item.systemName} (${item.systemId})`, String(item.findingsCount)] })) });

        if (exposureAssetRows.length > shownRows.length) {
          y = drawWrappedBlock({
            page,
            text: `- ... ${exposureAssetRows.length - shownRows.length} more assets in current filtered scope.`,
            x: 40,
            y: y - 14,
            maxWidth: 525,
            lineHeight: 13,
            font: fontRegular,
            size: 10,
            color: { r: 0.14, g: 0.17, b: 0.22 }
          });
        }
      }
    }

    if (row.reportDetailHandlerKey === "unmodelled-diis-systems") {
      const unmodelledRows = unmodelledSystemRows(scopedSystems);
      const maxRows = 35;
      const shownRows = unmodelledRows.slice(0, maxRows);

      y -= 8;
      page.drawText("ICT Systems not modelled", {
        x: 32,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.07, 0.2, 0.31)
      });

      if (!shownRows.length) {
        y = drawWrappedBlock({
          page,
          text: "- None in current filtered scope.",
          x: 40,
          y: y - 14,
          maxWidth: 525,
          lineHeight: 13,
          font: fontRegular,
          size: 10,
          color: { r: 0.14, g: 0.17, b: 0.22 }
        });
      } else {
        for (const systemRow of shownRows) {
          y = drawWrappedBlock({
            page,
            text: `- ${systemRow.systemName} (${systemRow.systemId})`,
            x: 40,
            y: y - 14,
            maxWidth: 525,
            lineHeight: 13,
            font: fontRegular,
            size: 10,
            color: { r: 0.14, g: 0.17, b: 0.22 }
          });
        }

        if (unmodelledRows.length > shownRows.length) {
          y = drawWrappedBlock({
            page,
            text: `- ... ${unmodelledRows.length - shownRows.length} more ICT systems in current filtered scope.`,
            x: 40,
            y: y - 14,
            maxWidth: 525,
            lineHeight: 13,
            font: fontRegular,
            size: 10,
            color: { r: 0.14, g: 0.17, b: 0.22 }
          });
        }
      }
    }

    y -= 8;
    page.drawText("Remediation Actions", { x: 32, y, size: 11, font: fontBold, color: rgb(0.07, 0.2, 0.31) });
    for (const action of remediationActionsForKpi(row, kpiDefinitions)) {
      y = drawWrappedBlock({
        page,
        text: `- ${action}`,
        x: 40,
        y: y - 14,
        maxWidth: 525,
        lineHeight: 13,
        font: fontRegular,
        size: 10,
        color: { r: 0.14, g: 0.17, b: 0.22 }
      });
    }

    y -= 6;
    page.drawText("Operations Team to Contact", {
      x: 32,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.07, 0.2, 0.31)
    });
    for (const team of teamsForKpi(row.id, kpiDefinitions)) {
      y = drawWrappedBlock({
        page,
        text: `- ${team.team} | Queue: ${team.supportQueue} | Email: ${team.contactEmail}`,
        x: 40,
        y: y - 14,
        maxWidth: 525,
        lineHeight: 13,
        font: fontRegular,
        size: 9,
        color: { r: 0.14, g: 0.17, b: 0.22 }
      });
    }
  }

  page.drawText("This tasking report is generated from the current filtered operational scope.", {
    x: 32,
    y: 24,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.52)
  });

  const pdfBytes = await pdfDoc.save();
  const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

  return new Response(pdfArrayBuffer, {
    headers: {
      "Content-Type": TASKING_REPORT_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename=${taskingReportFilename(kind, id)}`
    }
  });
}
