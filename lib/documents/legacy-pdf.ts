import type { DocumentRenderContext } from "@/lib/documents/contracts";
import type { LegacyPdfDocumentJob } from "@/lib/documents/legacy-pdf-data";
export { LEGACY_PDF_DOCUMENT_KINDS } from "@/lib/documents/legacy-pdf-data";
export type { LegacyPdfDocumentJob } from "@/lib/documents/legacy-pdf-data";

/** This dispatcher runs in the document worker. API handlers only produce its scoped models. */
export async function renderLegacyPdfDocument(job: LegacyPdfDocumentJob, context: DocumentRenderContext): Promise<Uint8Array> {
  switch(job.kind) {
    case "pdf-posture-summary":
      return (await import("@/lib/documents/posture-summary-pdf")).createSummaryPdf(job.data,job.generatedAt,context);
    case "pdf-network-discovery":
      return (await import("@/lib/documents/network-discovery-pdf")).createNetworkDiscoveryPdf(job.data,context);
    case "pdf-network-performance":
    case "pdf-system-performance": {
      context.onProgress("Laying out performance measures and evidence");
      const buffer=await (await import("@/lib/performance-report-pdf")).createPerformanceReportPdf(job.data);
      context.onProgress("Finishing PDF");
      return new Uint8Array(buffer);
    }
    default:
      return (await import("@/lib/documents/legacy-narrative-pdf")).renderLegacyNarrativePdf(job.data,context);
  }
}
