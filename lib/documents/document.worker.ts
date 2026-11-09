/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse, AnyDocumentEnvelope } from "@/lib/documents/protocol";
import { INSIGHTS_DOCUMENT_KINDS, renderInsightsDocument, type InsightsDocumentJob } from "@/lib/documents/insights";
import { WORKBOOK_DOCUMENT_KINDS, renderWorkbookDocument, type WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { LEGACY_PDF_DOCUMENT_KINDS, renderLegacyPdfDocument, type LegacyPdfDocumentJob } from "@/lib/documents/legacy-pdf";
import { LOCAL_WORKBOOK_KINDS, renderLocalWorkbook, type LocalWorkbookJob } from "@/lib/documents/local-workbooks";
import { TASKING_PDF_DOCUMENT_KINDS, renderTaskingPdfDocument, type TaskingPdfDocumentJob } from "@/lib/documents/tasking-pdf";
import type { DocumentRenderContext } from "@/lib/documents/contracts";

declare const self: DedicatedWorkerGlobalScope;
const isInsights = (job: AnyDocumentEnvelope): job is InsightsDocumentJob => INSIGHTS_DOCUMENT_KINDS.some(kind => kind === job.kind);
const isWorkbook = (job: AnyDocumentEnvelope): job is WorkbookDocumentJob => WORKBOOK_DOCUMENT_KINDS.some(kind => kind === job.kind);
const isLegacy = (job: AnyDocumentEnvelope): job is LegacyPdfDocumentJob => LEGACY_PDF_DOCUMENT_KINDS.some(kind => kind === job.kind);
const isLocal = (job: AnyDocumentEnvelope): job is LocalWorkbookJob => LOCAL_WORKBOOK_KINDS.some(kind => kind === job.kind);
const isTasking = (job: AnyDocumentEnvelope): job is TaskingPdfDocumentJob => TASKING_PDF_DOCUMENT_KINDS.some(kind => kind === job.kind);

self.onmessage = async ({ data: { id, job, assetBaseUrl } }: MessageEvent<WorkerRequest>) => {
  const post = (message: WorkerResponse) => self.postMessage(message);
  const context: DocumentRenderContext = { assetBaseUrl, onProgress: (message, completed, total) => post({ type: "progress", progress: { id, title: job.title, stage: "generating", message, completed, total } }) };
  try {
    context.onProgress("Building the document");
    const bytes = isInsights(job) ? await renderInsightsDocument(job, context)
      : isWorkbook(job) ? await renderWorkbookDocument(job, context)
      : isLegacy(job) ? await renderLegacyPdfDocument(job, context)
      : isTasking(job) ? await renderTaskingPdfDocument(job, context)
      : isLocal(job) ? await renderLocalWorkbook(job, context) : undefined;
    if (!bytes?.byteLength) throw new Error("Unsupported or empty document.");
    const contentType = job.filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : job.filename.toLowerCase().endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.ms-excel;charset=utf-8";
    const output = Uint8Array.from(bytes);
    self.postMessage({ type: "result", id, bytes: output, contentType } satisfies WorkerResponse, [output.buffer]);
  } catch {
    post({ type: "error", id, message: "Unable to generate this document. Try again or choose a smaller selection." });
  }
};
