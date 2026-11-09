import { buildIctSystemDependenciesWorkbookXml, type IctSystemDependencyExportRow } from "@/lib/ict-system-dependencies-export";
import type { DocumentEnvelope, DocumentRenderContext } from "@/lib/documents/contracts";

export interface RiskWorkbookData {
  findingsSheetHeaders: string[];
  findingsSheetRows: Array<Array<string | number>>;
  affectedSheetHeaders: string[];
  affectedSheetRows: Array<Array<string | number>>;
}
export type LocalWorkbookJob = DocumentEnvelope<"xls-dependencies", { rows: IctSystemDependencyExportRow[] }> | DocumentEnvelope<"xls-risk-findings", RiskWorkbookData>;
export const LOCAL_WORKBOOK_KINDS = ["xls-dependencies", "xls-risk-findings"] as const;
const escapeXml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function buildRiskWorkbookXml(data: RiskWorkbookData): string {
  const rows = (headers: string[], values: Array<Array<string | number>>) => [headers, ...values].map(row =>
    `<Row>${row.map(value => `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`).join("")}</Row>`).join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Findings"><Table>${rows(data.findingsSheetHeaders, data.findingsSheetRows)}</Table></Worksheet>
 <Worksheet ss:Name="Affected CIs"><Table>${rows(data.affectedSheetHeaders, data.affectedSheetRows)}</Table></Worksheet>
</Workbook>`;
}

export async function renderLocalWorkbook(job: LocalWorkbookJob, context: DocumentRenderContext): Promise<Uint8Array> {
  context.onProgress(job.kind === "xls-dependencies" ? "Writing dependency rows" : "Writing findings and affected CIs");
  const xml = job.kind === "xls-dependencies" ? buildIctSystemDependenciesWorkbookXml(job.data.rows) : buildRiskWorkbookXml(job.data);
  return new TextEncoder().encode(xml);
}
