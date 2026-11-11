import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { addVisualSummaryPage } from "@/lib/report-pdf-visuals";
import { drawDeviceReportTable } from "@/lib/device-report-pdf";
import type { LegacyNarrativePdfData } from "@/lib/documents/legacy-pdf-data";
import type { DocumentRenderContext } from "@/lib/documents/contracts";

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

function classifyLine(line: string): {
  text: string;
  font: "bold" | "regular";
  size: number;
  color: { r: number; g: number; b: number };
  indent: number;
  spacingAfter: number;
} {
  if (line.startsWith("# ")) {
    return {
      text: line.slice(2).trim(),
      font: "bold",
      size: 16,
      color: { r: 0.07, g: 0.2, b: 0.31 },
      indent: 0,
      spacingAfter: 8
    };
  }
  if (line.startsWith("## ")) {
    return {
      text: line.slice(3).trim(),
      font: "bold",
      size: 12,
      color: { r: 0.08, g: 0.22, b: 0.34 },
      indent: 0,
      spacingAfter: 4
    };
  }
  if (line.startsWith("  - ")) {
    return {
      text: `- ${line.slice(4).trim()}`,
      font: "regular",
      size: 9,
      color: { r: 0.14, g: 0.17, b: 0.22 },
      indent: 16,
      spacingAfter: 2
    };
  }
  if (line.startsWith("- ")) {
    return {
      text: line,
      font: "regular",
      size: 10,
      color: { r: 0.14, g: 0.17, b: 0.22 },
      indent: 0,
      spacingAfter: 2
    };
  }
  return {
    text: line,
    font: "regular",
    size: 10,
    color: { r: 0.18, g: 0.2, b: 0.25 },
    indent: 0,
    spacingAfter: 2
  };
}

function createPage(pdfDoc: PDFDocument, pageTitle: string, titleFont: PDFFont): { page: PDFPage; yStart: number } {
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 56, width, height: 56, color: rgb(0.04, 0.16, 0.27) });
  page.drawRectangle({ x: 0, y: height - 60, width, height: 4, color: rgb(0.36, 0.75, 0.88) });
  page.drawText(pageTitle, {
    x: 32,
    y: height - 38,
    size: 12,
    font: titleFont,
    color: rgb(0.92, 0.97, 1)
  });
  return { page, yStart: height - 76 };
}

export async function renderLegacyNarrativePdf(data: LegacyNarrativePdfData, context: DocumentRenderContext): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica), fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { pageTitle, lines, snapshotDate } = data;
  if(data.visual) addVisualSummaryPage({ ...data.visual, pdfDoc, titleFont: fontBold, bodyFont: fontRegular });
  let pageState = createPage(pdfDoc, pageTitle, fontBold), page = pageState.page, y = pageState.yStart;
  const leftMargin = 32, rightMargin = 32, bottomMargin = 32;
  const startNewPage = () => { pageState = createPage(pdfDoc, pageTitle, fontBold); page = pageState.page; y = pageState.yStart; };
  for (const [index,line] of lines.entries()) {
    if(index % 25 === 0) context.onProgress("Laying out report narrative", index, lines.length);
    if (!line.trim()) { y -= 6; if(y < bottomMargin) startNewPage(); continue; }
    const style = classifyLine(line), font = style.font === "bold" ? fontBold : fontRegular, lineHeight = style.size + 3;
    const wrappedLines = wrapText(style.text, font, style.size, page.getSize().width - leftMargin - rightMargin - style.indent);
    const blockHeight = wrappedLines.length * lineHeight + style.spacingAfter;
    if(y - blockHeight < bottomMargin) startNewPage();
    for(const text of wrappedLines) { page.drawText(text,{x:leftMargin+style.indent,y,size:style.size,font,color:rgb(style.color.r,style.color.g,style.color.b)}); y -= lineHeight; }
    y -= style.spacingAfter;
  }
  for(const [index,table] of data.tables.entries()) {
    context.onProgress("Laying out evidence tables",index,data.tables.length);
    drawDeviceReportTable({...table,pdfDoc,fontRegular,fontBold,pageTitle,snapshotDate});
  }
  context.onProgress("Finishing PDF");
  return pdfDoc.save();
}
