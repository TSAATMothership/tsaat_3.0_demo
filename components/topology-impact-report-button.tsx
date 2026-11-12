"use client";
import { useSyncExternalStore } from "react";
import { generateLocalDocument, getDocumentGenerationState, getServerDocumentGenerationState, subscribeToDocumentGeneration } from "@/lib/documents/client";
import type { TopologyImpactReportJob } from "@/lib/topology-impact-report";

export function TopologyImpactReportButton({ createJob, disabled = false }: { createJob: () => TopologyImpactReportJob; disabled?: boolean }) {
  const { active } = useSyncExternalStore(subscribeToDocumentGeneration, getDocumentGenerationState, getServerDocumentGenerationState);
  async function generate() {
    try { await generateLocalDocument(createJob()); } catch { /* Shared dialog handles failure, retry and cancellation. */ }
  }
  return <button type="button" className="endpoint-export" data-topology-impact-report disabled={disabled || active}
    onClick={() => void generate()}>Generate Impact Report</button>;
}
