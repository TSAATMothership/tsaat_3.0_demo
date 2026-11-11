import type { DocumentEnvelope, DocumentRenderContext } from "@/lib/documents/contracts";
import type { EndpointRecord } from "@/lib/endpoint-explorer";
import type { InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import type { SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
import type { ShadowItRecord } from "@/lib/shadow-it-explorer";
import { buildEndpointWorkbook } from "@/lib/endpoint-explorer-workbook";
import { buildInstalledSoftwareWorkbook } from "@/lib/installed-software-workbook";
import { buildSecurityVulnerabilityWorkbook } from "@/lib/security-vulnerability-workbook";
import { buildShadowItWorkbook } from "@/lib/shadow-it-workbook";

export const WORKBOOK_DOCUMENT_KINDS = ["xlsx-endpoints", "xlsx-software", "xlsx-vulnerabilities", "xlsx-shadow-it"] as const;
type Rows<T> = { rows: T[]; snapshotDate: string };
export type WorkbookDocumentJob =
  | DocumentEnvelope<"xlsx-endpoints", Rows<EndpointRecord>>
  | DocumentEnvelope<"xlsx-software", Rows<InstalledSoftwareRecord>>
  | DocumentEnvelope<"xlsx-vulnerabilities", Rows<SecurityVulnerabilityRecord>>
  | DocumentEnvelope<"xlsx-shadow-it", Rows<ShadowItRecord>>;

/** All binary workbook assembly runs in the browser document worker. */
export async function renderWorkbookDocument(job: WorkbookDocumentJob, context: DocumentRenderContext): Promise<Uint8Array> {
  const generatedAt = new Date(job.generatedAt);
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("Invalid workbook generation timestamp.");
  context.onProgress("Preparing workbook sheets");
  let bytes: Uint8Array;
  switch (job.kind) {
    case "xlsx-endpoints": bytes = buildEndpointWorkbook(job.data.rows, generatedAt); break;
    case "xlsx-software": bytes = buildInstalledSoftwareWorkbook(job.data.rows, generatedAt); break;
    case "xlsx-vulnerabilities": bytes = buildSecurityVulnerabilityWorkbook(job.data.rows, generatedAt); break;
    case "xlsx-shadow-it": bytes = buildShadowItWorkbook(job.data.rows, generatedAt); break;
  }
  context.onProgress("Workbook ready", 1, 1);
  return bytes;
}
