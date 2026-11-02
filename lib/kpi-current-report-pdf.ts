import { rgb, type PDFDocument, type PDFFont } from "pdf-lib";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import type { KpiReportModel } from "@/lib/kpi-report-model";
import { createReportPdfContext, drawReportHeading, drawReportParagraph, type ReportPdfContext } from "@/lib/report-template-pdf";
import { remediationActionsForKpi, taskingConditionForKpi, teamsForKpi } from "@/lib/tasking";
import { KPI_ATO_REPORT_NAME, KPI_DIIS_REPORT_NAME } from "@/lib/tasking-report-links";

interface KpiReportContent {
  reportName: string;
  summaryTitle: string;
  scoreSuffix: string;
  compliantLabel: string;
  nonCompliantLabel: string;
  summaryNote: string;
  emptyScopeMessage: string;
}

const KPI_REPORT_CONTENT: Record<string, KpiReportContent> = {
  "KPI-1": {
    reportName: KPI_ATO_REPORT_NAME,
    summaryTitle: "ATO findings summary",
    scoreSuffix: "with ATO",
    compliantLabel: "ATO provided",
    nonCompliantLabel: "ATO missing",
    summaryNote: "ATO missing includes blank or whitespace-only ATO numbers.",
    emptyScopeMessage: "No ICT systems are in scope; ATO compliance cannot be assessed."
  },
  "KPI-2": {
    reportName: KPI_DIIS_REPORT_NAME,
    summaryTitle: "DIIS registration findings summary",
    scoreSuffix: "registered in DIIS",
    compliantLabel: "Registered in DIIS",
    nonCompliantLabel: "Not registered in DIIS",
    summaryNote: "Registration is assessed using each ICT system's DIIS Defined status.",
    emptyScopeMessage: "No ICT systems are in scope; DIIS registration compliance cannot be assessed."
  }
};

function drawKpiSummary(context: ReportPdfContext, model: KpiReportModel, content: KpiReportContent) {
  const { page, fontRegular, fontBold, y } = context;
  const left = 32;
  const width = 531.28;
  const height = 118;
  const green = rgb(0.08, 0.5, 0.24);
  const red = rgb(0.73, 0.11, 0.11);
  const ink = rgb(0.07, 0.2, 0.31);
  const format = (count: number) => count.toLocaleString("en-AU");
  const percent = (count: number) => model.total ? `${Math.round(count / model.total * 1000) / 10}%` : "N/A";

  page.drawRectangle({ x: left, y: y - height, width, height, color: rgb(0.96, 0.98, 1), borderColor: rgb(0.82, 0.88, 0.95), borderWidth: 0.7 });
  page.drawText(content.summaryTitle, { x: left + 12, y: y - 20, font: fontBold, size: 11, color: ink });
  const totalLabel = `ICT systems ${model.nonCompliantOnly ? "included" : "in scope"}: ${format(model.total)}`;
  page.drawText(totalLabel, { x: left + width - 12 - fontRegular.widthOfTextAtSize(totalLabel, 9), y: y - 20, font: fontRegular, size: 9, color: ink });

  const barX = left + 12;
  const barY = y - 52;
  const barWidth = width - 24;
  page.drawRectangle({ x: barX, y: barY, width: barWidth, height: 20, color: rgb(0.28, 0.33, 0.41) });
  if (model.total) {
    const compliantWidth = barWidth * model.compliant / model.total;
    const nonCompliantWidth = barWidth * model.nonCompliant / model.total;
    if (compliantWidth) page.drawRectangle({ x: barX, y: barY, width: compliantWidth, height: 20, color: green });
    if (nonCompliantWidth) page.drawRectangle({ x: barX + compliantWidth, y: barY, width: nonCompliantWidth, height: 20, color: red });
  }
  const scoreLabel = model.nonCompliantOnly ? model.total ? "100% non-compliant" : "No non-compliant ICT systems"
    : model.total ? `${model.scorePercent}% ${content.scoreSuffix}` : "N/A - no ICT systems in scope";
  page.drawText(scoreLabel, { x: barX + (barWidth - fontBold.widthOfTextAtSize(scoreLabel, 10)) / 2, y: barY + 6, font: fontBold, size: 10, color: rgb(1, 1, 1) });

  const legends = [
    { x: barX, color: green, label: `${content.compliantLabel}: ${format(model.compliant)} (${percent(model.compliant)})` },
    { x: barX + barWidth / 2, color: red, label: `${content.nonCompliantLabel}: ${format(model.nonCompliant)} (${percent(model.nonCompliant)})` }
  ];
  for (const legend of legends) {
    page.drawRectangle({ x: legend.x, y: y - 73, width: 8, height: 8, color: legend.color });
    page.drawText(legend.label, { x: legend.x + 13, y: y - 72, font: fontRegular, size: 9, color: ink });
  }
  page.drawText(model.unknown ? `Unknown: ${format(model.unknown)} (${percent(model.unknown)}) - shown in grey.` : content.summaryNote, {
    x: barX, y: y - 96, font: fontRegular, size: 8, color: rgb(0.3, 0.36, 0.42)
  });
  context.y -= height + 22;
}

export function drawKpiCurrentReport({ pdfDoc, fontRegular, fontBold, model, snapshotDate, filterText, kpiDefinitions }: {
  pdfDoc: PDFDocument;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  model: KpiReportModel;
  snapshotDate: string;
  filterText: string;
  kpiDefinitions: KpiDefinition[];
}) {
  const content = KPI_REPORT_CONTENT[model.id];
  if (!content) throw new Error(`Unsupported KPI current report: ${model.id}`);
  pdfDoc.setTitle(content.reportName + (model.nonCompliantOnly ? " - Non-Compliance Only" : ""));
  const context = createReportPdfContext({ pdfDoc, fontRegular, fontBold, pageTitle: content.reportName, snapshotDate });
  drawReportHeading(context, `Indicator: ${model.id} - ${model.name}`);
  if (model.nonCompliantOnly) drawReportParagraph(context, "Results: Non-Compliance Only. Compliant and unknown results are excluded.", { size: 9 });
  drawKpiSummary(context, model, content);
  drawReportHeading(context, "Description");
  drawReportParagraph(context, model.description);
  drawReportParagraph(context, `Success Measure: ${model.successMeasure}`);
  drawReportHeading(context, "Filter Scope");
  drawReportParagraph(context, filterText, { size: 9 });
  drawReportHeading(context, "Observed Non-compliant Condition");
  drawReportParagraph(context, model.total ? taskingConditionForKpi(model.sourceRow, kpiDefinitions)
    : model.nonCompliantOnly ? "No non-compliant ICT systems were found in the selected scope and snapshot." : content.emptyScopeMessage);
  drawReportHeading(context, "Remediation Actions");
  for (const action of remediationActionsForKpi(model.sourceRow, kpiDefinitions)) drawReportParagraph(context, `- ${action}`, { indent: 8 });
  drawReportHeading(context, "Who to contact?");
  for (const team of teamsForKpi(model.id, kpiDefinitions)) {
    drawReportParagraph(context, `- ${team.team} | Queue: ${team.supportQueue} | Email: ${team.contactEmail}`, { size: 9, indent: 8 });
  }
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    const pageLabel = `${index + 1} / ${pages.length}`;
    page.drawText(pageLabel, { x: 563.28 - fontRegular.widthOfTextAtSize(pageLabel, 8), y: 20, font: fontRegular, size: 8, color: rgb(0.42, 0.47, 0.54) });
  });
}
