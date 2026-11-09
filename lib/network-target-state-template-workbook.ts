import { ASSET_TYPES, assetTypeLabel } from "@/lib/asset-taxonomy";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import type { ManagedNetwork } from "@/lib/types";
import { readXlsxEntriesAsync, writeXlsxEntries } from "@/lib/xlsx-zip";
export { readXlsxEntries, readXlsxEntriesAsync, writeXlsxEntries } from "@/lib/xlsx-zip";
const encode = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder().decode(value);
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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

export async function buildNetworkTargetStateTemplateWorkbook(network: ManagedNetwork, templateBytes: Uint8Array, generatedAt = new Date()): Promise<Uint8Array> {
  const entries = await readXlsxEntriesAsync(templateBytes);
  const networkDetailsSheet = entries.get("xl/worksheets/sheet1.xml");
  if (!networkDetailsSheet) {
    throw new Error("Invalid target-state template: Network Details worksheet missing.");
  }
  const assetsSheet = entries.get("xl/worksheets/sheet2.xml");
  if (!assetsSheet) {
    throw new Error("Invalid target-state template: Assets worksheet missing.");
  }

  const updatedSheet = fillNetworkDetailsWorksheetXml(
    decode(networkDetailsSheet),
    networkDetailsTemplateValues(network)
  );
  entries.set("xl/worksheets/sheet1.xml", encode(updatedSheet));
  const updatedAssetsSheet = fillAssetsWorksheetXml(
    decode(assetsSheet),
    networkTargetStateTemplateAssetRows(network)
  );
  entries.set("xl/worksheets/sheet2.xml", encode(updatedAssetsSheet));

  return writeXlsxEntries(entries, generatedAt);
}
