import type { DocumentEnvelope } from "@/lib/documents/contracts";
import type { DeviceReportRow } from "@/lib/device-report";
import type { VisualBar, VisualCard, VisualSegment } from "@/lib/report-pdf-visuals";
import type { PerformanceReportModel } from "@/lib/performance-report-model";
import type { NetworkDiscoveryReportModel } from "@/lib/network-discovery-report-model";

/** Only the scoped, displayed evidence crosses the document boundary. */
export interface LegacyNarrativePdfData {
  snapshotDate: string;
  pageTitle: string;
  lines: string[];
  visual?: {
    pageTitle: string;
    subtitle: string;
    cards: VisualCard[];
    bars: VisualBar[];
    segments: VisualSegment[];
    insights: string[];
  };
  tables: Array<{ sectionTitle: string; columns: Array<{ label: string; weight?: number }>; rows: DeviceReportRow[] }>;
}

export interface SummaryPdfData {
  snapshotDate: string;
  overallCompliancePercent: number;
  counts: { compliant: number; nonCompliant: number; unknown: number };
  topRisks: Array<{ priorityRank: number; spiId: number; severity: string; title: string; scope: { assetId: string } }>;
  productionExceptions: Array<{ severity: string; spiId: number; scope: { systemId?: string | null; assetId: string } }>;
  tables: LegacyNarrativePdfData["tables"];
}

export const LEGACY_NARRATIVE_PDF_KINDS = [
  "pdf-networks-remediation", "pdf-systems-remediation", "pdf-unsupported-os", "pdf-modelling-status",
  "pdf-discovery-remediation", "pdf-network-remediation", "pdf-system-remediation", "pdf-system-coverage-gaps"
] as const;

export const LEGACY_PDF_DOCUMENT_KINDS = [...LEGACY_NARRATIVE_PDF_KINDS, "pdf-posture-summary", "pdf-network-discovery", "pdf-network-performance", "pdf-system-performance"] as const;
export type LegacyPdfDocumentJob =
  | DocumentEnvelope<typeof LEGACY_NARRATIVE_PDF_KINDS[number], LegacyNarrativePdfData>
  | DocumentEnvelope<"pdf-posture-summary", SummaryPdfData>
  | DocumentEnvelope<"pdf-network-discovery", NetworkDiscoveryReportModel>
  | DocumentEnvelope<"pdf-network-performance" | "pdf-system-performance", PerformanceReportModel>;
