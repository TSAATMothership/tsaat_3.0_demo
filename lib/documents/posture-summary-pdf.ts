import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import { drawDeviceReportTable } from "@/lib/device-report-pdf";
import type { SummaryPdfData } from "@/lib/documents/legacy-pdf-data";
import type { DocumentRenderContext } from "@/lib/documents/contracts";
export async function createSummaryPdf(params: SummaryPdfData, generatedAt: string, context: DocumentRenderContext): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawPageHeader = () => {
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 56, width, height: 56, color: rgb(0.04, 0.16, 0.27) });
    page.drawRectangle({ x: 0, y: height - 60, width, height: 4, color: rgb(0.36, 0.75, 0.88) });
    page.drawText("TSAAT Cyber Posture Summary", {
      x: 24,
      y: height - 34,
      size: 12,
      font: boldFont,
      color: rgb(0.92, 0.97, 1)
    });
    return { page, height, width };
  };

  let pageState = drawPageHeader();
  let page = pageState.page;
  let y = pageState.height - 88;
  const lineGap = 14;
  const sectionGap = 20;
  const leftMargin = 24;
  const rightMargin = 24;
  const bottomMargin = 36;

  const wrapText = (text: string, font: typeof regularFont, size: number, maxWidth: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
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
  };

  const writeLine = (text: string, bold = false) => {
    const font = bold ? boldFont : regularFont;
    const maxWidth = pageState.width - leftMargin - rightMargin;
    const wrapped = wrapText(text, font, 10, maxWidth);
    const blockHeight = wrapped.length * lineGap;
    if (y - blockHeight < bottomMargin) {
      pageState = drawPageHeader();
      page = pageState.page;
      y = pageState.height - 88;
    }
    for (const line of wrapped) {
      page.drawText(line, {
        x: leftMargin,
        y,
        size: 10,
        font,
        color: rgb(0.12, 0.15, 0.2)
      });
      y -= lineGap;
    }
  };

  context.onProgress("Laying out posture summary");
  const highRiskCount = params.productionExceptions.filter((item) => item.severity === "High Risk").length;
  const productionContextCount = params.productionExceptions.length;
  const topRiskSummary = params.topRisks
    .slice(0, 3)
    .map((risk) => `SPI ${risk.spiId} P${risk.priorityRank} ${risk.severity}`)
    .join("; ");

  addVisualSummaryPage({
    pdfDoc,
    pageTitle: "TSAAT Cyber Posture Summary",
    subtitle: "Visualisation of compliance posture, risk concentration, and production exceptions.",
    titleFont: boldFont,
    bodyFont: regularFont,
    cards: [
      { label: "Compliance Score", value: `${params.overallCompliancePercent}%`, tone: "good" },
      { label: "Compliant", value: `${params.counts.compliant}`, tone: "good" },
      { label: "Non-compliant", value: `${params.counts.nonCompliant}`, tone: "critical" },
      { label: "Unknown", value: `${params.counts.unknown}`, tone: "warning" }
    ],
    bars: [
      { label: "Compliant", value: params.counts.compliant, color: [0.2, 0.62, 0.42] },
      { label: "Non-compliant", value: params.counts.nonCompliant, color: [0.82, 0.3, 0.29] },
      { label: "Unknown", value: params.counts.unknown, color: [0.89, 0.66, 0.28] },
      { label: "Production Exceptions", value: productionContextCount, color: [0.25, 0.46, 0.8] },
      { label: "High Risk Exceptions", value: highRiskCount, color: [0.86, 0.51, 0.2] }
    ],
    segments: [
      { label: "Compliant", value: params.counts.compliant, color: [0.2, 0.62, 0.42] },
      { label: "Non-compliant", value: params.counts.nonCompliant, color: [0.82, 0.3, 0.29] },
      { label: "Unknown", value: params.counts.unknown, color: [0.89, 0.66, 0.28] }
    ],
    insights: [
      `Overall compliance is ${params.overallCompliancePercent}% for snapshot ${params.snapshotDate}.`,
      `Top risk concentration: ${topRiskSummary || "No dominant SPI pattern in current scope."}`,
      `${productionContextCount} production/high-risk exception item(s) detected, including ${highRiskCount} high-risk items.`,
      "Use this view to prioritise remediation sequencing before detailed evidence review."
    ]
  });

  writeLine("Report Name", true);
  writeLine("Cyber Posture Summary Report");
  y -= sectionGap - lineGap;

  writeLine("Timestamp", true);
  writeLine(`Generated At: ${generatedAt}`);
  writeLine(`Snapshot Date: ${params.snapshotDate}`);
  y -= sectionGap - lineGap;

  writeLine("Introduction", true);
  writeLine(
    "This executive brief provides a concise summary of current TSAAT cyber posture for the active scope, supporting rapid leadership review and remediation direction."
  );
  y -= sectionGap - lineGap;

  writeLine("Audience", true);
  writeLine("Executive leadership, risk and assurance stakeholders, cyber operations, and remediation coordinators.");
  y -= sectionGap - lineGap;

  writeLine("Executive Summary", true);
  writeLine(
    `Overall compliance is ${params.overallCompliancePercent}% with counts of C ${params.counts.compliant}, NC ${params.counts.nonCompliant}, and U ${params.counts.unknown}. Current posture indicates focused remediation demand in high-priority security indicators and production-linked risk areas.`
  );
  y -= sectionGap - lineGap;

  writeLine("Findings Summary Including Impacts", true);
  writeLine(
    `Top risk concentration currently includes ${topRiskSummary || "no dominant SPI pattern"} and ${productionContextCount} production/high-risk exception item(s), including ${highRiskCount} High Risk finding(s). These conditions increase operational disruption and assurance risk if not rapidly contained and remediated.`
  );
  y -= sectionGap - lineGap;

  writeLine("Recommendations to Remediate", true);
  writeLine(
    "Prioritize closure of highest-priority SPI findings, assign accountable owners with dated remediation milestones, and enforce focused verification on production-exposed assets to reduce residual risk and improve compliance trend confidence."
  );
  y -= sectionGap - lineGap;

  const tableContext = { pdfDoc, fontRegular: regularFont, fontBold: boldFont, pageTitle: "TSAAT Cyber Posture Summary", snapshotDate: params.snapshotDate };
  for(const [index,table] of params.tables.entries()) { context.onProgress("Laying out evidence tables", index, params.tables.length); drawDeviceReportTable({...tableContext,...table}); }
  context.onProgress("Finishing PDF");
  return pdfDoc.save();
}
