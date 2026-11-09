"use client";

import { DocumentDownloadButton } from "@/components/document-download-button";

export function InsightsReportButton({ href, title }: { href: string; filename: string; title: string }) {
  return <div className="insight-report-download">
    <DocumentDownloadButton href={href} className="endpoint-export" insights ariaLabel={`Generate ${title} PDF`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
      Generate PDF
    </DocumentDownloadButton>
  </div>;
}
