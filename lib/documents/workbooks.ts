import type { DocumentEnvelope, DocumentRenderContext } from "@/lib/documents/contracts";
import type { EndpointRecord } from "@/lib/endpoint-explorer";
import type { InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import type { SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
import type { PatchManagementRow } from "@/lib/patch-management-explorer";
import type { ShadowItRecord } from "@/lib/shadow-it-explorer";
import { DISCOVERY_COMPLIANCE_COLUMNS, discoveryComplianceValue, type DiscoveryComplianceRecord } from "@/lib/discovery-compliance-explorer";
import type { AssetDeviceDetails } from "@/lib/findings-assets";
import type { FindingDisplayConfiguration } from "@/lib/findings-config";
import type { Finding, ManagedNetwork } from "@/lib/types";
import { buildEndpointWorkbook } from "@/lib/endpoint-explorer-workbook";
import { buildInstalledSoftwareWorkbook } from "@/lib/installed-software-workbook";
import { buildSecurityVulnerabilityWorkbook } from "@/lib/security-vulnerability-workbook";
import { buildPatchManagementWorkbook } from "@/lib/patch-management-workbook";
import { buildShadowItWorkbook } from "@/lib/shadow-it-workbook";
import { buildFindingsWorkbook } from "@/lib/findings-workbook";
import { buildInventoryWorkbook } from "@/lib/inventory-explorer-workbook";
import { buildNetworkTargetStateTemplateWorkbook } from "@/lib/network-target-state-template-workbook";

export const WORKBOOK_DOCUMENT_KINDS = ["xlsx-endpoints", "xlsx-software", "xlsx-vulnerabilities", "xlsx-patches", "xlsx-shadow-it", "xlsx-compliance", "xlsx-findings", "xlsx-target-state"] as const;
type Rows<T> = { rows: T[]; snapshotDate: string };
export type WorkbookDocumentJob =
  | DocumentEnvelope<"xlsx-endpoints", Rows<EndpointRecord>>
  | DocumentEnvelope<"xlsx-software", Rows<InstalledSoftwareRecord>>
  | DocumentEnvelope<"xlsx-vulnerabilities", Rows<SecurityVulnerabilityRecord>>
  | DocumentEnvelope<"xlsx-patches", Rows<PatchManagementRow>>
  | DocumentEnvelope<"xlsx-shadow-it", Rows<ShadowItRecord>>
  | DocumentEnvelope<"xlsx-compliance", Rows<DiscoveryComplianceRecord>>
  | DocumentEnvelope<"xlsx-findings", { findings: Finding[]; asOf: string; assetDetailsByAssetId: Record<string, AssetDeviceDetails>; configuration: FindingDisplayConfiguration }>
  | DocumentEnvelope<"xlsx-target-state", { network: ManagedNetwork; snapshotDate: string }>;

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
    case "xlsx-patches": bytes = buildPatchManagementWorkbook(job.data.rows, generatedAt); break;
    case "xlsx-shadow-it": bytes = buildShadowItWorkbook(job.data.rows, generatedAt); break;
    case "xlsx-compliance": {
      const rows = job.data.rows.map(row => Object.fromEntries(DISCOVERY_COMPLIANCE_COLUMNS.map(({ key }) => [key,
        key === "lastDiscoveredDate" ? row.lastDiscoveredDate?.trim() || "Not recorded" : discoveryComplianceValue(row, key)])));
      const widths = [32, 22, 21, 28, 28, 35, 35, 22, 22, 50];
      bytes = buildInventoryWorkbook(rows, DISCOVERY_COMPLIANCE_COLUMNS.map((column, index) => ({ ...column, width: widths[index], date: column.key === "lastDiscoveredDate" })), "Discovery Compliance", generatedAt);
      break;
    }
    case "xlsx-findings": bytes = buildFindingsWorkbook(job.data.findings, job.data.asOf, job.data.assetDetailsByAssetId, job.data.configuration, generatedAt); break;
    case "xlsx-target-state": {
      context.onProgress("Loading workbook template");
      const response = await fetch(new URL("document-assets/network-target-state-template.xlsx", context.assetBaseUrl));
      if (!response.ok) throw new Error("The bundled workbook template could not be loaded.");
      const template = new Uint8Array(await response.arrayBuffer());
      context.onProgress("Filling network details and target-state assets");
      bytes = await buildNetworkTargetStateTemplateWorkbook(job.data.network, template, generatedAt);
      break;
    }
  }
  context.onProgress("Workbook ready", 1, 1);
  return bytes;
}
