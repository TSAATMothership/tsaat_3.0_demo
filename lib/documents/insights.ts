import type { DocumentEnvelope, DocumentRenderContext } from "@/lib/documents/contracts";
import type { InventoryContextData } from "@/lib/inventory-context-data";
import type { SoftwareInsightsReportData } from "@/lib/software-insights-report-data";
import type { EndpointRecord } from "@/lib/endpoint-explorer";
import type { SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";

export const INSIGHTS_DOCUMENT_KINDS = ["insights-software", "insights-endpoint", "insights-vulnerability"] as const;

/** JSON report projections contain only the evidence consumed by the portable renderer. */
export type InventoryInsightsDocumentData = Pick<InventoryContextData, "model" | "scopeLabels">;
export type EndpointInsightsDocumentData = InventoryInsightsDocumentData & { rows: EndpointRecord[] };
export type VulnerabilityInsightsDocumentData = InventoryInsightsDocumentData & { rows: SecurityVulnerabilityRecord[] };
export type InsightsDocumentJob =
  | DocumentEnvelope<"insights-software", SoftwareInsightsReportData>
  | DocumentEnvelope<"insights-endpoint", EndpointInsightsDocumentData>
  | DocumentEnvelope<"insights-vulnerability", VulnerabilityInsightsDocumentData>;

/** Called by the document worker; no provider, filesystem or API handler is imported at runtime. */
export async function renderInsightsDocument(job: InsightsDocumentJob, context: DocumentRenderContext): Promise<Uint8Array> {
  const generatedAt = new Date(job.generatedAt);
  const options = { assetBaseUrl: context.assetBaseUrl, onProgress: context.onProgress };
  context.onProgress("Loading report artwork");
  switch (job.kind) {
    case "insights-software": return (await import("@/lib/software-insights-pdf")).createSoftwareInsightsPdf(job.data, generatedAt, options);
    case "insights-endpoint": return (await import("@/lib/inventory-insights-pdf")).createEndpointInsightsPdf(job.data, generatedAt, options);
    case "insights-vulnerability": return (await import("@/lib/inventory-insights-pdf")).createVulnerabilityInsightsPdf(job.data, generatedAt, options);
  }
}
