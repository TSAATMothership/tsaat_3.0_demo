import { writeXlsxEntries } from "@/lib/network-target-state-template-workbook";

export const INVENTORY_XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const textCell = (reference: string, value: string, style = 0) =>
  `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const dateCell = (reference: string, value: Date) =>
  `<c r="${reference}" s="2"><v>${value.getTime() / 86400000 + 25569}</v></c>`;

export interface InventoryWorkbookColumn<Row> { key: keyof Row; label: string; width?: number; date?: boolean }
function columnName(index: number): string {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}
export function buildInventoryWorkbook<Row extends object>(rows: readonly Row[], columns: readonly InventoryWorkbookColumn<Row>[], sheetName: string, exportedAt = new Date()): Buffer {
  if (!Number.isFinite(exportedAt.getTime())) throw new Error("Invalid export timestamp.");
  if (rows.length > 1048575) throw new Error("Too many records for one Excel worksheet.");
  const headers = [...columns.map((column) => column.label), "Export Timestamp (UTC)"];
  const sheetRows = [`<row r="1" ht="28" customHeight="1">${headers.map((label, index) => textCell(`${columnName(index)}1`, label, 1)).join("")}</row>`];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const cells = columns.map(({ key, date }, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowNumber}`;
      const value = String(row[key] ?? "");
      if (date && value && Number.isFinite(Date.parse(value))) return dateCell(reference, new Date(value));
      // Inline text preserves versions, paths and addresses and cannot execute formulas.
      return textCell(reference, value);
    });
    cells.push(dateCell(`${columnName(columns.length)}${rowNumber}`, exportedAt));
    sheetRows.push(`<row r="${rowNumber}" ht="22" customHeight="1">${cells.join("")}</row>`);
  });
  const lastRow = rows.length + 1;
  const lastColumn = columnName(columns.length);
  const files = new Map<string, Buffer>();
  const add = (name: string, value: string) => files.set(name, Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${value}`, "utf8"));
  add("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  add("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  add("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  add("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add("xl/styles.xml", `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss &quot;UTC&quot;"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163B50"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  add("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${[...columns.map((column) => column.width ?? 24), 28].map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows.join("")}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`);
  return writeXlsxEntries(files);
}
