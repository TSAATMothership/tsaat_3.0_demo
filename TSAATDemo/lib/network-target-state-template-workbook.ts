import { readFile } from "fs/promises";
import path from "path";
import { inflateRawSync } from "zlib";
import { ASSET_TYPES, assetTypeLabel } from "@/lib/asset-taxonomy";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import type { ManagedNetwork } from "@/lib/types";

const TEMPLATE_PATH = path.join(process.cwd(), "data", "templates", "network-target-state-template.xlsx");
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_STORE_METHOD = 0;
const ZIP_DEFLATE_METHOD = 8;

interface ZipEntry {
  name: string;
  data: Buffer;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time, date: dosDate };
}

function concatBuffers(parts: readonly Buffer[]): Buffer {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = Buffer.alloc(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(new Uint8Array(part), offset);
    offset += part.length;
  }
  return output;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return index;
    }
  }
  throw new Error("Invalid XLSX template: central directory not found.");
}

export function readXlsxEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const endDirectoryOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endDirectoryOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endDirectoryOffset + 16);
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Invalid XLSX template: central directory entry is corrupt.");
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Invalid XLSX template: local header missing for ${name}.`);
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data: Buffer | null =
      method === ZIP_STORE_METHOD
        ? compressedData
        : method === ZIP_DEFLATE_METHOD
          ? inflateRawSync(new Uint8Array(compressedData))
          : null;

    if (!data) {
      throw new Error(`Unsupported XLSX template compression method ${method} for ${name}.`);
    }

    entries.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function writeZip(entries: Map<string, Buffer>): Buffer {
  const timestamp = dosTimestamp();
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const [name, data] of entries.entries()) {
    const nameBuffer = Buffer.from(name, "utf8");
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(ZIP_STORE_METHOD, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(ZIP_STORE_METHOD, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, nameBuffer);

    localOffset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectory = concatBuffers(centralParts);
  const endDirectory = Buffer.alloc(22);
  endDirectory.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  endDirectory.writeUInt16LE(0, 4);
  endDirectory.writeUInt16LE(0, 6);
  endDirectory.writeUInt16LE(entries.size, 8);
  endDirectory.writeUInt16LE(entries.size, 10);
  endDirectory.writeUInt32LE(centralDirectory.length, 12);
  endDirectory.writeUInt32LE(localOffset, 16);
  endDirectory.writeUInt16LE(0, 20);

  return concatBuffers([...localParts, centralDirectory, endDirectory]);
}

interface TargetStateTemplateAssetRow {
  assetName: string;
  assetTypeLabel: string;
}

function inlineStringCell(cellRef: string, value: string): string {
  return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

export function fillNetworkDetailsWorksheetXml(sheetXml: string, values: readonly string[]): string {
  let nextXml = sheetXml.replace('dimension ref="A1:A6"', 'dimension ref="A1:B6"').replace(/spans="1:1"/g, 'spans="1:2"');

  values.slice(0, 6).forEach((value, index) => {
    const rowNumber = index + 1;
    const cellXml = inlineStringCell(`B${rowNumber}`, value);
    const rowPattern = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(</row>)`);
    nextXml = nextXml.replace(rowPattern, `$1$2${cellXml}$3`);
  });

  return nextXml;
}

export function networkDetailsTemplateValues(network: ManagedNetwork): string[] {
  const details = resolveNetworkDetailFields(network);
  return [
    network.name,
    details.description,
    details.atoNumber,
    network.diisId?.trim() ?? "",
    details.owner,
    details.supportEmail
  ];
}

export function networkTargetStateTemplateAssetRows(network: ManagedNetwork): TargetStateTemplateAssetRow[] {
  const rows: TargetStateTemplateAssetRow[] = [];
  for (const assetType of ASSET_TYPES) {
    const assetNames = network.targetStateAssets?.[assetType] ?? [];
    for (const assetName of assetNames) {
      const normalizedAssetName = typeof assetName === "string" ? assetName.trim() : "";
      if (!normalizedAssetName) {
        continue;
      }
      rows.push({
        assetName: normalizedAssetName,
        assetTypeLabel: assetTypeLabel(assetType)
      });
    }
  }
  return rows;
}

export function fillAssetsWorksheetXml(sheetXml: string, rows: readonly TargetStateTemplateAssetRow[]): string {
  const lastRow = Math.max(1, rows.length + 1);
  const validationLastRow = Math.max(39, lastRow);
  const dataRows = rows
    .map((row, index) => {
      const rowNumber = index + 2;
      return `<row r="${rowNumber}" spans="1:2" x14ac:dyDescent="0.25">${inlineStringCell(
        `A${rowNumber}`,
        row.assetName
      )}${inlineStringCell(`B${rowNumber}`, row.assetTypeLabel)}</row>`;
    })
    .join("");

  return sheetXml
    .replace(/dimension ref="A1:B\d+"/, `dimension ref="A1:B${lastRow}"`)
    .replace(/(<sheetData>)([\s\S]*?)(<\/sheetData>)/, (_match, openTag, sheetData, closeTag) => {
      const headerRowMatch = String(sheetData).match(/<row\b[^>]*\br="1"[\s\S]*?<\/row>/);
      const headerRow = headerRowMatch?.[0] ?? "";
      return `${openTag}${headerRow}${dataRows}${closeTag}`;
    })
    .replace(/<xm:sqref>B2:B\d+<\/xm:sqref>/, `<xm:sqref>B2:B${validationLastRow}</xm:sqref>`);
}

export async function buildNetworkTargetStateTemplateWorkbook(network: ManagedNetwork): Promise<Buffer> {
  const templateBuffer = await readFile(TEMPLATE_PATH);
  const entries = readXlsxEntries(templateBuffer);
  const networkDetailsSheet = entries.get("xl/worksheets/sheet1.xml");
  if (!networkDetailsSheet) {
    throw new Error("Invalid target-state template: Network Details worksheet missing.");
  }
  const assetsSheet = entries.get("xl/worksheets/sheet2.xml");
  if (!assetsSheet) {
    throw new Error("Invalid target-state template: Assets worksheet missing.");
  }

  const updatedSheet = fillNetworkDetailsWorksheetXml(
    networkDetailsSheet.toString("utf8"),
    networkDetailsTemplateValues(network)
  );
  entries.set("xl/worksheets/sheet1.xml", Buffer.from(updatedSheet, "utf8"));
  const updatedAssetsSheet = fillAssetsWorksheetXml(
    assetsSheet.toString("utf8"),
    networkTargetStateTemplateAssetRows(network)
  );
  entries.set("xl/worksheets/sheet2.xml", Buffer.from(updatedAssetsSheet, "utf8"));

  return writeZip(entries);
}
