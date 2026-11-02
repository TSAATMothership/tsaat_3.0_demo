import { rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { DEVICE_REPORT_COLUMNS, type DeviceReportRow } from "@/lib/device-report";

export function wrapDeviceReportText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= width) {
        line = line ? `${line} ${word}` : word;
        continue;
      }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

/** Landscape device lists share inventory columns, wrapping and repeated page headers. */
export function drawDeviceReportTable({ pdfDoc, fontRegular, fontBold, pageTitle, snapshotDate, sectionTitle, rows, columns = [] }: {
  pdfDoc: PDFDocument; fontRegular: PDFFont; fontBold: PDFFont; pageTitle: string; snapshotDate: string;
  sectionTitle: string; rows: DeviceReportRow[]; columns?: Array<{ label: string; weight?: number }>;
}) {
  const width = 841.89;
  const height = 595.28;
  const margin = 32;
  const tableWidth = width - margin * 2;
  const size = 8;
  const lineHeight = 10;
  const allColumns = [...DEVICE_REPORT_COLUMNS, ...columns];
  const totalWeight = allColumns.reduce((sum, column) => sum + (column.weight ?? 1), 0);
  const widths = allColumns.map(column => tableWidth * (column.weight ?? 1) / totalWeight);
  const headings = allColumns.map((column, index) => wrapDeviceReportText(column.label, fontBold, size, widths[index] - 10));
  const headerHeight = Math.max(...headings.map(lines => lines.length)) * lineHeight + 12;
  let page: PDFPage;
  let y: number;
  const newPage = () => {
    page = pdfDoc.addPage([width, height]);
    const titleLines = wrapDeviceReportText(pageTitle, fontBold, 12, tableWidth);
    const titleHeight = 40 + titleLines.length * 14;
    page.drawRectangle({ x: 0, y: height - titleHeight, width, height: titleHeight, color: rgb(.04, .16, .27) });
    titleLines.forEach((line, index) => page.drawText(line, { x: margin, y: height - 25 - index * 14, font: fontBold, size: 12, color: rgb(.92, .97, 1) }));
    page.drawText(`Snapshot Date: ${snapshotDate}`, { x: margin, y: height - titleHeight + 10, font: fontRegular, size: 8, color: rgb(.84, .91, .96) });
    y = height - titleHeight - 24;
    const sectionLines = wrapDeviceReportText(sectionTitle, fontBold, 11, tableWidth);
    sectionLines.forEach(line => { page.drawText(line, { x: margin, y, font: fontBold, size: 11, color: rgb(.07, .2, .31) }); y -= 14; });
    y -= 6;
    let x = margin;
    headings.forEach((lines, index) => {
      page.drawRectangle({ x, y: y - headerHeight, width: widths[index], height: headerHeight, color: rgb(.06, .18, .3), borderColor: rgb(.58, .73, .84), borderWidth: .5 });
      lines.forEach((line, lineIndex) => page.drawText(line, { x: x + 5, y: y - 11 - lineIndex * lineHeight, font: fontBold, size, color: rgb(.92, .97, 1) }));
      x += widths[index];
    });
    y -= headerHeight;
    page.drawText(`${rows.length.toLocaleString("en-AU")} device record(s) | Missing inventory values: Not recorded`, { x: margin, y: 18, font: fontRegular, size: 8, color: rgb(.42, .47, .54) });
  };
  newPage();
  if (!rows.length) page!.drawText("None in current filtered scope.", { x: margin + 5, y: y! - 18, font: fontRegular, size: 9 });
  for (const row of rows) {
    const values = [...DEVICE_REPORT_COLUMNS.map(column => row.device[column.key]), ...row.details];
    const cells = allColumns.map((_, index) => wrapDeviceReportText(values[index] ?? "", fontRegular, size, widths[index] - 10));
    const lineCount = Math.max(...cells.map(lines => lines.length));
    const fullHeight = lineCount * lineHeight + 12;
    if (y! - Math.min(fullHeight, 200) < 36) newPage();
    let offset = 0;
    while (offset < lineCount) {
      const availableLines = Math.floor((y! - 36 - 12) / lineHeight);
      if (availableLines < 1) { newPage(); continue; }
      const count = Math.min(availableLines, lineCount - offset);
      const rowHeight = count * lineHeight + 12;
      let x = margin;
      cells.forEach((lines, index) => {
        page!.drawRectangle({ x, y: y! - rowHeight, width: widths[index], height: rowHeight, color: rgb(.98, .99, 1), borderColor: rgb(.82, .87, .92), borderWidth: .5 });
        const visible = lines.slice(offset, offset + count);
        if (offset && index < DEVICE_REPORT_COLUMNS.length && !visible.length) visible.push(...lines.slice(0, count));
        visible.forEach((line, lineIndex) => page!.drawText(line, { x: x + 5, y: y! - 11 - lineIndex * lineHeight, font: fontRegular, size, color: rgb(.14, .17, .22) }));
        x += widths[index];
      });
      y! -= rowHeight;
      offset += count;
      if (offset < lineCount) newPage();
    }
  }
}
