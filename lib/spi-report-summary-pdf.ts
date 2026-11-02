import { rgb } from "pdf-lib";
import type { ReportPdfContext } from "@/lib/report-template-pdf";

export interface SpiSummaryCounts {
  nonCompliantOnly?: boolean;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
}

/** The KPI report's summary layout, with CI assessments and a separate Unknown category. */
export function drawSpiReportSummary(context: ReportPdfContext, counts: SpiSummaryCounts, aggregate = false) {
  const { page, fontRegular, fontBold, y } = context;
  const left = 32;
  const width = 531.28;
  const height = 118;
  const ink = rgb(0.07, 0.2, 0.31);
  const format = (count: number) => count.toLocaleString("en-AU");
  const percent = (count: number) => counts.total ? `${Math.round(count / counts.total * 1000) / 10}%` : "N/A";
  page.drawRectangle({ x: left, y: y - height, width, height, color: rgb(0.96, 0.98, 1), borderColor: rgb(0.82, 0.88, 0.95), borderWidth: 0.7 });
  page.drawText("Findings summary", { x: left + 12, y: y - 20, font: fontBold, size: 11, color: ink });
  const totalLabel = `${aggregate ? "CI assessments" : "CIs"} ${counts.nonCompliantOnly ? "included" : "in scope"}: ${format(counts.total)}`;
  page.drawText(totalLabel, { x: left + width - 12 - fontRegular.widthOfTextAtSize(totalLabel, 9), y: y - 20, font: fontRegular, size: 9, color: ink });
  const barX = left + 12;
  const barY = y - 52;
  const barWidth = width - 24;
  const groups = [
    { label: "Compliant", count: counts.compliant, color: rgb(0.08, 0.5, 0.24) },
    { label: "Non-compliant", count: counts.nonCompliant, color: rgb(0.73, 0.11, 0.11) },
    { label: "Unknown", count: counts.unknown, color: rgb(0.28, 0.33, 0.41) }
  ];
  page.drawRectangle({ x: barX, y: barY, width: barWidth, height: 20, color: groups[2].color });
  let x = barX;
  for (const group of groups) {
    const segmentWidth = counts.total ? barWidth * group.count / counts.total : 0;
    if (segmentWidth) page.drawRectangle({ x, y: barY, width: segmentWidth, height: 20, color: group.color });
    x += segmentWidth;
  }
  const scoreLabel = counts.nonCompliantOnly ? counts.total ? "100% non-compliant" : "No non-compliant CIs"
    : counts.total ? `${percent(counts.compliant)} compliant` : "N/A - no CIs in scope";
  page.drawText(scoreLabel, { x: barX + (barWidth - fontBold.widthOfTextAtSize(scoreLabel, 10)) / 2, y: barY + 6, font: fontBold, size: 10, color: rgb(1, 1, 1) });
  groups.forEach((group, index) => {
    const legendX = barX + index * barWidth / groups.length;
    page.drawRectangle({ x: legendX, y: y - 73, width: 8, height: 8, color: group.color });
    page.drawText(`${group.label}: ${format(group.count)} (${percent(group.count)})`, { x: legendX + 13, y: y - 72, font: fontRegular, size: 8, color: ink });
  });
  page.drawText(counts.nonCompliantOnly ? "Only non-compliant CIs are included; compliant and unknown results are excluded."
    : aggregate ? "Each CI is counted once per applicable SPI; Unknown assessments need more evidence." : "Unknown CIs need additional evidence to assess compliance.", {
    x: barX, y: y - 96, font: fontRegular, size: 8, color: rgb(0.3, 0.36, 0.42)
  });
  context.y -= height + 22;
}
