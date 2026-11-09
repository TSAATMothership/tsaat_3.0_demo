"use client";
import { useSearchParams } from "next/navigation";
import { DocumentDownloadButton } from "@/components/document-download-button";
import { documentSourceMatchesHeader, isDocumentSourcePath } from "@/lib/documents/protocol";

export function DocumentGenerationPage({ source }: { source: string }) {
  const header = useSearchParams();
  const selectionMatches = documentSourceMatchesHeader(source, new URLSearchParams(header.toString()));
  return <div className="workspace-page"><section className="endpoint-results p-6">
    <h1 className="text-2xl font-semibold">Generate document</h1>
    {isDocumentSourcePath(source) ? <>
      <p className="my-4">Generate the document for the scope and snapshot in this link. The file will download when it is ready.</p>
      {!selectionMatches && <div className="my-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
        <p role="alert" data-document-selection-warning>The current header selection differs from this saved report. Restore the report selection to generate the document.</p>
        <a href={source} className="endpoint-export mt-3 inline-flex" data-restore-document-selection>Restore report selection</a>
      </div>}
      <DocumentDownloadButton href={source} disabled={!selectionMatches} className="endpoint-export">Generate document</DocumentDownloadButton>
    </> : <p role="alert" className="mt-4">This document link is unavailable. Open the report from its page and try again.</p>}
  </section></div>;
}
