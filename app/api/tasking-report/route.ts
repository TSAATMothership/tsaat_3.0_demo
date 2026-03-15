import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import { loadCurrentDataset, loadDiscoveryToolsSettings, loadMeasuresSettings } from "@/lib/data-loader";
import { buildKpiRows, buildSpiRows } from "@/lib/measures";
import {
  remediationActionsForKpi,
  remediationActionsForSpi,
  taskingConditionForKpi,
  taskingConditionForSpi,
  teamsForKpi,
  teamsForSpi
} from "@/lib/tasking";
import { filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { AnalyticsResult, Dataset, ICTSystem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Kind = "kpi" | "spi";

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

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as Kind | null;
  const id = request.nextUrl.searchParams.get("id");

  if (!kind || !id || !["kpi", "spi"].includes(kind)) {
    return NextResponse.json({ error: "Missing or invalid kind/id parameters." }, { status: 400 });
  }

  const [dataset, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadCurrentDataset(),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const scopedSystems = filterSystems(dataset.ictSystems, filters);
  const scopedNetworks = filterNetworks(dataset.managedNetworks, filters);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings, discoveryToolsSettings);

  const kpiRows = buildKpiRows(analytics, scopedSystems, scopedNetworks);
  const spiRows = buildSpiRows(analytics);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
    const row = kpiRows.find((item) => item.id === id);
    if (!row) {
      return notFoundResponse("KPI row not found for supplied id.");
    }

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
  } else {
    const spiId = Number(id);
    const row = spiRows.find((item) => item.spiId === spiId);
    if (!row) {
      return notFoundResponse("SPI row not found for supplied id.");
    }

    page.drawText(`Indicator: SPI-${row.spiId}`, {
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
      text: `Current Score: ${row.scorePercent}% | Compliant=${row.compliant} | Non-compliant=${row.nonCompliant} | Unknown=${row.unknown} | Applicable=${row.total}`,
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
      text: taskingConditionForSpi(row),
      x: 32,
      y: y - 14,
      maxWidth: 535,
      lineHeight: 13,
      font: fontRegular,
      size: 10,
      color: { r: 0.14, g: 0.17, b: 0.22 }
    });

    y -= 8;
    page.drawText("Remediation Actions", { x: 32, y, size: 11, font: fontBold, color: rgb(0.07, 0.2, 0.31) });
    for (const action of remediationActionsForSpi(row)) {
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
    for (const team of teamsForSpi(row.spiId)) {
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
  const fileId = `${kind}-${String(id).toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  const pdfArrayBuffer = Uint8Array.from(pdfBytes).buffer;

  return new Response(pdfArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=tsaat-tasking-report-${fileId}.pdf`
    }
  });
}
