import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSnapshotsForDateWindow
} from "@/lib/data-loader";
import {
  buildKpiReportModel,
  buildKpiTrendReportModel,
  isKpiReportAvailable,
  KpiTrendReportModel
} from "@/lib/kpi-report-model";
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
import { filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
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
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 62, width: PAGE_WIDTH, height: 62, color: rgb(0.04, 0.16, 0.27) });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 67, width: PAGE_WIDTH, height: 5, color: rgb(0.36, 0.75, 0.88) });
  page.drawText(pageTitle, {
    x: LEFT_MARGIN,
    y: PAGE_HEIGHT - 34,
    size: 13,
    font: fontBold,
    color: rgb(0.92, 0.97, 1)
  });
  page.drawText(`Snapshot Date: ${snapshotDate}`, {
    x: LEFT_MARGIN,
    y: PAGE_HEIGHT - 52,
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
  return { page, y: PAGE_HEIGHT - 92 };
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
  ensureReportSpace(context, 28);
  context.page.drawText(text, {
    x: LEFT_MARGIN,
    y: context.y,
    size: 12,
    font: context.fontBold,
    color: rgb(0.07, 0.2, 0.31)
  });
  context.y -= 18;
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

  drawHeader();

  const visibleRows = rows.length ? rows : [["None in current filtered scope.", ...headers.slice(1).map(() => "")]];

  for (const row of visibleRows) {
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
  drawReportHeading(context, `Indicator: ${model.indicatorLabel}`);
  drawReportParagraph(context, `Description: ${model.description}`);
  drawReportParagraph(context, `Success Measure: ${model.successMeasure}`);
  drawReportParagraph(context, `Score: ${model.scorePercent}%`);

  drawReportTable(
    context,
    ["Current Score", "Compliant CIs", "Non-Compliant CIs", "Unknown", "Total CIs"],
    [[`${model.scorePercent}%`, String(model.compliant), String(model.nonCompliant), String(model.unknown), String(model.total)]],
    [104, 104, 116, 94, 84]
  );

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

  drawReportHeading(context, "Supporting Findings Annex A:");
  drawReportParagraph(context, "This table presents the list of CIs where a compliance score can be calculated.");
  drawReportTable(
    context,
    ["CI Name", "Asset Type", "Score (Compliant/Non-Compliant)"],
    model.annexA.map((row) => [row.ciName, row.assetTypeLabel, row.score]),
    [255, 126, 150]
  );

  drawReportHeading(context, "Supporting Findings Annex B:");
  drawReportParagraph(context, "This table presents the list of CIs where a compliance score cannot be calculated (Unknown).");
  drawReportTable(
    context,
    ["CI Name", "Asset Type", "Score (Unknown)"],
    model.annexB.map((row) => [row.ciName, row.assetTypeLabel, row.score]),
    [255, 126, 150]
  );
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
  drawReportParagraph(context, `Score: ${current.scorePercent}%`);

  drawReportTable(
    context,
    ["Current Score", "Compliant CIs", "Non-Compliant CIs", "Unknown", "Total CIs"],
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

  drawReportHeading(context, `Indicator: ${model.indicatorLabel}`);
  drawReportParagraph(context, `Description: ${model.description}`);
  drawReportParagraph(context, `Success Measure: ${model.successMeasure}`);
  drawReportParagraph(context, `Score: ${model.scorePercent}%`);

  drawReportTable(
    context,
    ["Current Score", "Compliant CIs", "Non-Compliant CIs", "Unknown", "Total CIs"],
    [[`${model.scorePercent}%`, String(model.compliant), String(model.nonCompliant), String(model.unknown), String(model.total)]],
    [104, 104, 116, 94, 84]
  );

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

  drawReportHeading(context, `${model.indicatorLabel} - Supporting Findings Annex A:`);
  drawReportParagraph(context, "This table presents the list of CIs where a compliance score can be calculated.");
  drawReportTable(
    context,
    ["CI Name", "Asset Type", "Score (Compliant/Non-Compliant)"],
    model.annexA.map((row) => [row.ciName, row.assetTypeLabel, row.score]),
    [255, 126, 150]
  );

  drawReportHeading(context, `${model.indicatorLabel} - Supporting Findings Annex B:`);
  drawReportParagraph(context, "This table presents the list of CIs where a compliance score cannot be calculated (Unknown).");
  drawReportTable(
    context,
    ["CI Name", "Asset Type", "Score (Unknown)"],
    model.annexB.map((row) => [row.ciName, row.assetTypeLabel, row.score]),
    [255, 126, 150]
  );
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
  drawReportHeading(context, "Filter Scope");
  drawReportParagraph(context, filterText, { size: 9 });

  drawReportHeading(context, "Summary");
  drawReportParagraph(context, "This section shows the summary score for all SPIs.");
  drawReportTable(
    context,
    ["SPI", "Compliant CIs", "Non-Compliant CIs", "Unknown", "Total CIs"],
    models.map((model) => [
      `${model.indicatorLabel} ${model.scorePercent}%`,
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

  const requestedDataDate = taskingReportDataDateFromSearchParams(request.nextUrl.searchParams);
  const [dataset, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const scopedSystems = filterSystems(dataset.ictSystems, filters);
  const scopedNetworks = filterNetworks(dataset.managedNetworks, filters);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings, discoveryToolsSettings);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (kind === "spi") {
    const spiModel = buildSpiReportModel({ dataset, analytics, spiId: Number(id) });
    if (!spiModel) {
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

    const pdfBytes = await pdfDoc.save();
    const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename=${taskingReportFilename(kind, id)}`
      }
    });
  }

  if (kind === "spi-all") {
    const spiModels = buildSpiReportModels(dataset, analytics);
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

    const pdfBytes = await pdfDoc.save();
    const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename=${taskingReportFilename(kind, id)}`
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
          measuresSettings,
          discoveryToolsSettings
        )
      }))
    });

    if (!trendModel) {
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

    const pdfBytes = await pdfDoc.save();
    const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename=${taskingReportFilename(kind, id)}`
      }
    });
  }

  if (kind === "kpi-trend") {
    const trendDatasets = await loadSnapshotsForDateWindow(dataset.snapshotDate, 12);
    const trendModel = buildKpiTrendReportModel({
      kpiId: id,
      snapshots: trendDatasets.map((trendDataset) => ({
        snapshotDate: trendDataset.snapshotDate,
        analytics: buildAnalytics(
          trendDataset,
          trendDataset.ictSystems,
          filters,
          measuresSettings,
          discoveryToolsSettings
        ),
        systems: filterSystems(trendDataset.ictSystems, filters),
        networks: filterNetworks(trendDataset.managedNetworks, filters)
      }))
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

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": TASKING_REPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename=${taskingReportFilename(kind, id)}`
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
      analytics,
      systems: scopedSystems,
      networks: scopedNetworks,
      kpiId: id
    });
    if (!kpiModel || !isKpiReportAvailable(id)) {
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
      text: taskingConditionForKpi(row),
      x: 32,
      y: y - 14,
      maxWidth: 535,
      lineHeight: 13,
      font: fontRegular,
      size: 10,
      color: { r: 0.14, g: 0.17, b: 0.22 }
    });

    if (row.id === "KPI-4") {
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

    if (row.id === "KPI-5") {
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
        for (const item of shownRows) {
          y = drawWrappedBlock({
            page,
            text: `- ${item.assetName} (${item.assetId}) | Host ${item.hostname} | System ${item.systemName} (${item.systemId}) | Findings ${item.findingsCount}`,
            x: 40,
            y: y - 14,
            maxWidth: 525,
            lineHeight: 13,
            font: fontRegular,
            size: 10,
            color: { r: 0.14, g: 0.17, b: 0.22 }
          });
        }

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

    if (row.id === "KPI-9") {
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
    for (const action of remediationActionsForKpi(row)) {
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
    for (const team of teamsForKpi(row.id)) {
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
