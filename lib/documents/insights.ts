import type { DocumentEnvelope, DocumentRenderContext } from "@/lib/documents/contracts";
import type { DiscoveryOverviewData } from "@/lib/discovery-overview-data";
import type { GovernanceInsightsData } from "@/lib/governance-insights-data";
import type { SoftwareInsightsReportData } from "@/lib/software-insights-report-data";
import type { EndpointRecord } from "@/lib/endpoint-explorer";
import type { SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";

export const INSIGHTS_DOCUMENT_KINDS = ["insights-cyber", "insights-software", "insights-discovery", "insights-endpoint", "insights-vulnerability"] as const;

/** JSON report projections contain only the evidence consumed by the portable renderer. */
export type CyberInsightsDocumentData = Pick<GovernanceInsightsData, "model" | "insights" | "scopeLabels" | "snapshotGeneratedAt"> & {
  impact: { unattributedFindings: number; missionCount: number; businessCount: number };
};
export type DiscoveryInsightsDocumentData = Pick<DiscoveryOverviewData, "model" | "scopeLabels">;
export type EndpointInsightsDocumentData = DiscoveryInsightsDocumentData & { rows: EndpointRecord[] };
export type VulnerabilityInsightsDocumentData = DiscoveryInsightsDocumentData & { rows: SecurityVulnerabilityRecord[] };
export type InsightsDocumentJob =
  | DocumentEnvelope<"insights-cyber", CyberInsightsDocumentData>
  | DocumentEnvelope<"insights-software", SoftwareInsightsReportData>
  | DocumentEnvelope<"insights-discovery", DiscoveryInsightsDocumentData>
  | DocumentEnvelope<"insights-endpoint", EndpointInsightsDocumentData>
  | DocumentEnvelope<"insights-vulnerability", VulnerabilityInsightsDocumentData>;

/** Called by the document worker; no provider, filesystem or API handler is imported at runtime. */
export async function renderInsightsDocument(job: InsightsDocumentJob, context: DocumentRenderContext): Promise<Uint8Array> {
  const generatedAt = new Date(job.generatedAt);
  const options = { assetBaseUrl: context.assetBaseUrl, onProgress: context.onProgress };
  context.onProgress("Loading report artwork");
  switch (job.kind) {
    case "insights-cyber": return (await import("@/lib/governance-insights-pdf")).createGovernanceInsightsPdf(job.data, generatedAt, options);
    case "insights-software": return (await import("@/lib/software-insights-pdf")).createSoftwareInsightsPdf(job.data, generatedAt, options);
    case "insights-discovery": return (await import("@/lib/discovery-overview-report-pdf")).createDiscoveryOverviewPdf(job.data, generatedAt, options);
    case "insights-endpoint": return (await import("@/lib/inventory-insights-pdf")).createEndpointInsightsPdf(job.data, generatedAt, options);
    case "insights-vulnerability": return (await import("@/lib/inventory-insights-pdf")).createVulnerabilityInsightsPdf(job.data, generatedAt, options);
  }
}
