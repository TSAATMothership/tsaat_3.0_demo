"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { generateDocumentFromUrl, getDocumentGenerationState, getServerDocumentGenerationState, subscribeToDocumentGeneration } from "@/lib/documents/client";

export function DocumentDownloadButton({ href, children, className, title, ariaLabel, disabled = false, insights = false }: {
  href: string; children: ReactNode; className?: string; title?: string; ariaLabel?: string; disabled?: boolean; insights?: boolean;
}) {
  const { active } = useSyncExternalStore(subscribeToDocumentGeneration, getDocumentGenerationState, getServerDocumentGenerationState);
  async function generate() {
    try { await generateDocumentFromUrl(href); } catch { /* Shared dialog provides retry/errors and treats cancellation separately. */ }
  }
  return <button type="button" className={className} title={title} aria-label={ariaLabel} disabled={disabled || active}
    data-document-source={href} data-insights-report={insights ? href : undefined} onClick={() => void generate()}>{children}</button>;
}
