import { type PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";

export interface ReportPdfContext {
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
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

export function createReportPage({
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
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 62,
    width: PAGE_WIDTH,
    height: 62,
    color: rgb(0.04, 0.16, 0.27)
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 67,
    width: PAGE_WIDTH,
    height: 5,
    color: rgb(0.36, 0.75, 0.88)
  });
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

export function createReportPdfContext(params: {
  pdfDoc: PDFDocument;
  pageTitle: string;
  snapshotDate: string;
  fontRegular: PDFFont;
  fontBold: PDFFont;
}): ReportPdfContext {
  const pageState = createReportPage(params);
  return {
    ...params,
    page: pageState.page,
    y: pageState.y
  };
}

function startNewReportPage(context: ReportPdfContext) {
  const pageState = createReportPage(context);
  context.page = pageState.page;
  context.y = pageState.y;
}

function ensureReportSpace(context: ReportPdfContext, requiredHeight: number) {
  if (context.y - requiredHeight < BOTTOM_MARGIN) {
    startNewReportPage(context);
  }
}

export function drawReportHeading(context: ReportPdfContext, text: string) {
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

export function drawReportParagraph(
  context: ReportPdfContext,
  text: string,
  options: { size?: number; indent?: number } = {}
) {
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

export function drawReportTable(
  context: ReportPdfContext,
  headers: string[],
  rows: string[][],
  columnWidths: number[]
) {
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
