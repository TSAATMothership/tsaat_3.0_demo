import { PDFDocument, StandardFonts } from "pdf-lib";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import {
  createReportPdfContext,
  drawReportHeading,
  drawReportParagraph,
  drawReportTable
} from "@/lib/report-template-pdf";
import { PerformanceKpiMatrixRow, PerformanceReportModel } from "@/lib/performance-report-model";

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function kpiScore(row: PerformanceKpiMatrixRow, kpiId: string): string {
  const kpi = row.kpis.find((item) => item.id === kpiId);
  return kpi ? formatPercent(kpi.scorePercent) : "-";
}

function kpiColumnGroups(model: PerformanceReportModel): Array<Array<{ id: string; name: string }>> {
  const columns = (() => {
    if (model.kpiColumns.length) {
      return model.kpiColumns;
    }
    const fallback = new Map<string, { id: string; name: string }>();
    for (const row of model.kpiMatrixRows) {
      for (const kpi of row.kpis) {
        if (!fallback.has(kpi.id)) {
          fallback.set(kpi.id, { id: kpi.id, name: kpi.name });
        }
      }
    }
    return Array.from(fallback.values());
  })();
  const groups: Array<Array<{ id: string; name: string }>> = [];
  for (let index = 0; index < columns.length; index += 5) {
    groups.push(columns.slice(index, index + 5));
  }
  return groups;
}

function drawKpiTable(model: PerformanceReportModel, columns: Array<{ id: string; name: string }>) {
  const kpiWidth = Math.floor((531 - 190) / Math.max(columns.length, 1));
  return {
    headers: ["Domain", model.entityLabelSingular, ...columns.map((column) => column.id)],
    rows: model.kpiMatrixRows.map((row) => [
      row.securityDomain,
      row.entityName,
      ...columns.map((column) => kpiScore(row, column.id))
    ]),
    widths: [70, 120, ...columns.map(() => kpiWidth)]
  };
}

function filterRows(model: PerformanceReportModel): string[][] {
  const filters = model.filters;
  return [
    ["Network", filters.managedNetwork ?? "All"],
    ["ICT System", filters.ictSystem ?? "All"],
    ["Criticality", filters.systemCriticality ?? "All"],
    ["Security Domain", filters.securityDomain ?? "All"],
    ["Environment", filters.environment ?? "All"],
    ["Asset Type", filters.assetType ?? "All"],
    ["Severity", filters.severity ?? "All"],
    ["Mission Capability", filters.missionCapability ?? "All"],
    ["Business Service", filters.businessService ?? "All"]
  ];
}

export async function createPerformanceReportPdf(model: PerformanceReportModel): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reportTitle = `${model.entityLabelPlural} Performance Report`;
  const oldestThreshold = model.findingAgeThresholdRows[model.findingAgeThresholdRows.length - 1];

  addVisualSummaryPage({
    pdfDoc,
    pageTitle: reportTitle,
    subtitle: `Performance summary for the current ${model.scopeLabel.toLowerCase()} action-tab scope, grouped by Security Domain x ${model.entityLabelSingular}.`,
    titleFont: fontBold,
    bodyFont: fontRegular,
    cards: [
      { label: "Compliance Score", value: formatPercent(model.summary.complianceScorePercent), tone: "good" },
      { label: "Discovery Score", value: formatPercent(model.summary.discoveryScorePercent), tone: "neutral" },
      { label: "Open Findings", value: `${model.summary.openFindings}`, tone: model.summary.openFindings ? "critical" : "good" },
      { label: "Not Modelled", value: `${model.summary.notModelledCount}`, tone: model.summary.notModelledCount ? "warning" : "good" }
    ],
    bars: [
      { label: "Open Findings", value: model.summary.openFindings, color: [0.86, 0.28, 0.24] },
      { label: ">30d Findings", value: model.findingAgeThresholdRows[0]?.total ?? 0, color: [0.86, 0.51, 0.2] },
      { label: ">60d Findings", value: model.findingAgeThresholdRows[1]?.total ?? 0, color: [0.79, 0.34, 0.17] },
      { label: ">90d Findings", value: oldestThreshold?.total ?? 0, color: [0.73, 0.12, 0.15] },
      { label: "Opened Weekly Window", value: model.summary.openedInWindow, color: [0.78, 0.48, 0.13] },
      { label: "Closed Weekly Window", value: model.summary.closedInWindow, color: [0.2, 0.62, 0.42] }
    ],
    segments: [
      { label: "Compliant", value: model.complianceStatusMix.compliant, color: [0.2, 0.62, 0.42] },
      { label: "Non-compliant", value: model.complianceStatusMix.nonCompliant, color: [0.82, 0.3, 0.29] },
      { label: "Unknown", value: model.complianceStatusMix.unknown, color: [0.58, 0.64, 0.72] }
    ],
    insights: [
      `Compliance is ${formatPercent(model.summary.complianceScorePercent)} across ${model.complianceStatusMix.total} checks.`,
      `Discovery coverage is ${formatPercent(model.summary.discoveryScorePercent)} across ${model.discoveryStatusMix.total} scoped assets.`,
      `${model.summary.openFindings} open finding(s) remain in scope; ${oldestThreshold?.total ?? 0} are older than 90 days.`,
      `${model.summary.notModelledCount} ${model.entityLabelPlural.toLowerCase()} are not modelled.`
    ]
  });

  const context = createReportPdfContext({
    pdfDoc,
    pageTitle: reportTitle,
    snapshotDate: model.snapshotDate,
    fontRegular,
    fontBold
  });

  drawReportHeading(context, "Report Scope");
  drawReportParagraph(
    context,
    `This performance report summarises the organisation's ${model.scopeLabel.toLowerCase()} action-tab posture for the current filter scope. All breakdowns use Security Domain x ${model.entityLabelSingular}.`
  );
  drawReportTable(context, ["Filter", "Value"], filterRows(model), [140, 260]);

  drawReportHeading(context, "Compliance by Security Domain x Entity");
  drawReportTable(
    context,
    ["Domain", model.entityLabelSingular, "Score", "C", "NC", "U", "Total"],
    model.domainEntityRows.map((row) => [
      row.securityDomain,
      row.entityName,
      formatPercent(row.scorePercent),
      `${row.compliant}`,
      `${row.nonCompliant}`,
      `${row.unknown}`,
      `${row.total}`
    ]),
    [70, 180, 55, 45, 45, 45, 55]
  );

  const kpiGroups = kpiColumnGroups(model);
  if (kpiGroups.length) {
    for (const columns of kpiGroups) {
      const label = columns.length === 1
        ? columns[0].id
        : `${columns[0].id}-${columns[columns.length - 1].id}`;
      drawReportHeading(context, `KPI Results by Security Domain x Entity (${label})`);
      const kpiTable = drawKpiTable(model, columns);
      drawReportTable(context, kpiTable.headers, kpiTable.rows, kpiTable.widths);
    }
  } else {
    drawReportHeading(context, "KPI Results by Security Domain x Entity");
    drawReportParagraph(context, "No KPI definitions are available in the current database.");
  }

  drawReportHeading(context, "Open Findings by Age and Severity");
  drawReportParagraph(context, "Age thresholds are cumulative: findings older than 90 days are also counted in >30d and >60d.");
  drawReportTable(
    context,
    ["Age", "Critical", "High", "Major", "Moderate", "Data Gap", "Total"],
    model.findingAgeThresholdRows.map((row) => [
      row.label,
      `${row.criticalExposureCount}`,
      `${row.highRiskCount}`,
      `${row.majorCount}`,
      `${row.moderateCount}`,
      `${row.dataGapCount}`,
      `${row.total}`
    ]),
    [60, 70, 70, 70, 80, 80, 65]
  );

  drawReportHeading(context, "Open Findings by SPI");
  drawReportTable(
    context,
    ["SPI", "Critical", "High", "Major", "Moderate", "Data Gap", "Total"],
    model.findingSpiRows.map((row) => [
      row.spiLabel,
      `${row.criticalExposureCount}`,
      `${row.highRiskCount}`,
      `${row.majorCount}`,
      `${row.moderateCount}`,
      `${row.dataGapCount}`,
      `${row.total}`
    ]),
    [60, 70, 70, 70, 80, 80, 65]
  );

  drawReportHeading(context, "Discovery Coverage Gap Scores");
  drawReportTable(
    context,
    ["Domain", model.entityLabelSingular, "Score", "C", "NC", "Other", "Total"],
    model.discoveryGapRows.map((row) => [
      row.securityDomain,
      row.entityName,
      formatPercent(row.scorePercent),
      `${row.compliant}`,
      `${row.nonCompliant}`,
      `${row.other}`,
      `${row.total}`
    ]),
    [70, 180, 55, 45, 45, 55, 55]
  );

  drawReportHeading(context, `${model.entityLabelPlural} Not Modelled`);
  drawReportTable(
    context,
    [model.entityLabelSingular, "Domain", "Owner", "Status"],
    model.modellingGapRows.map((row) => [
      row.entityName,
      row.securityDomain ?? "N/A",
      row.owner,
      row.status
    ]),
    [180, 90, 160, 90]
  );

  drawReportHeading(context, "Remediation Throughput (Weekly)");
  drawReportTable(
    context,
    ["Week", "Opened", "Closed", "Net Change"],
    model.throughputRows.map((row) => [
      row.weekLabel,
      `${row.openedCount}`,
      `${row.closedCount}`,
      `${row.netChange}`
    ]),
    [130, 90, 90, 100]
  );

  const pdfBytes = await pdfDoc.save();
  return Uint8Array.from(pdfBytes).buffer;
}
