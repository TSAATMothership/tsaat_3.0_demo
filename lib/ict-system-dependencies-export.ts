export const ICT_SYSTEM_DEPENDENCIES_EXCEL_MIME_TYPE = "application/vnd.ms-excel;charset=utf-8;";

export const ICT_SYSTEM_DEPENDENCIES_EXPORT_HEADERS = [
  "ICT System",
  "Environment",
  "Server",
  "Dependent Server",
  "Dependent Environment",
  "Dependent ICT System"
] as const;

export interface IctSystemDependencyExportRow {
  systemName?: string | null;
  environmentType?: string | null;
  serverName?: string | null;
  assetName?: string | null;
  assetHostname?: string | null;
  assetId?: string | null;
  relatedAssetName?: string | null;
  relatedAssetHostname?: string | null;
  relatedAssetId?: string | null;
  relatedAssetEnvironmentType?: string | null;
  relatedSystemName?: string | null;
}

function firstNonBlank(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalizedValue = value?.trim();
    if (normalizedValue) {
      return normalizedValue;
    }
  }
  return "";
}

function stripInvalidXmlCharacters(value: string): string {
  let sanitizedValue = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isValidXmlCharacter =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (isValidXmlCharacter) {
      sanitizedValue += character;
    }
  }
  return sanitizedValue;
}

function escapeXml(value: string): string {
  return stripInvalidXmlCharacters(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dependencyExportValues(row: IctSystemDependencyExportRow): string[] {
  return [
    firstNonBlank(row.systemName),
    firstNonBlank(row.environmentType) || "Unassigned",
    firstNonBlank(row.serverName, row.assetName, row.assetHostname, row.assetId),
    firstNonBlank(row.relatedAssetName, row.relatedAssetHostname, row.relatedAssetId),
    firstNonBlank(row.relatedAssetEnvironmentType) || "Unassigned",
    firstNonBlank(row.relatedSystemName) || "Not Modelled"
  ];
}

function buildSpreadsheetRow(values: readonly string[]): string {
  return `<Row>${values
    .map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
    .join("")}</Row>`;
}

export function buildIctSystemDependenciesWorkbookXml(rows: readonly IctSystemDependencyExportRow[]): string {
  const spreadsheetRows = [
    buildSpreadsheetRow(ICT_SYSTEM_DEPENDENCIES_EXPORT_HEADERS),
    ...rows.map((row) => buildSpreadsheetRow(dependencyExportValues(row)))
  ].join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="ICT System Dependencies">
  <Table ss:ExpandedColumnCount="6" ss:ExpandedRowCount="${rows.length + 1}" x:FullColumns="1" x:FullRows="1">${spreadsheetRows}</Table>
 </Worksheet>
</Workbook>`;
}

export function buildIctSystemDependenciesExportFileName(snapshotDate?: string | null): string {
  const safeDate = (snapshotDate ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "current";
  return `ict-system-dependencies-${safeDate}.xls`;
}
