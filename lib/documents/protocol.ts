import { MAX_DOCUMENT_INPUT_BYTES, safeDocumentFilename, type DocumentEnvelope, type DocumentProgress } from "@/lib/documents/contracts";
import { sameWorkspaceScope } from "@/lib/workspace-navigation";

export type AnyDocumentEnvelope = DocumentEnvelope<string, unknown>;
export type WorkerRequest = { id: number; job: AnyDocumentEnvelope; assetBaseUrl: string };
export type WorkerResponse = { type: "progress"; progress: DocumentProgress } | { type: "result"; id: number; bytes: Uint8Array; contentType: string } | { type: "error"; id: number; message: string };

export function parseDocumentEnvelope(value: unknown): AnyDocumentEnvelope {
  if (!value || typeof value !== "object") throw new Error("The document data is unavailable.");
  const job = value as Record<string, unknown>;
  if (job.version !== 1 || typeof job.kind !== "string" || !/^(pdf|insights|xlsx|xls)-[a-z0-9-]+$/.test(job.kind) ||
      typeof job.filename !== "string" || !/\.(pdf|xlsx|xls)$/i.test(job.filename) || !safeDocumentFilename(job.filename) ||
      typeof job.title !== "string" || !job.title.trim() || job.title.length > 300 ||
      typeof job.generatedAt !== "string" || !Number.isFinite(Date.parse(job.generatedAt)) || !job.data || typeof job.data !== "object") {
    throw new Error("The document data has an unsupported format. Reload the page and try again.");
  }
  return { version: 1, kind: job.kind, filename: safeDocumentFilename(job.filename), title: job.title, generatedAt: job.generatedAt, data: job.data };
}

/** Stream with a byte limit: never turn a truncated response into a partial report. */
export async function readDocumentEnvelope(response: Response): Promise<AnyDocumentEnvelope> {
  if (!response.ok) {
    if (response.status === 409) throw new Error("The selected evidence has changed. Reload the page before generating this document.");
    throw new Error("Unable to load the document data. Please try again.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The server did not return document data.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The document data is empty.");
  const decoder = new TextDecoder(); let total = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > MAX_DOCUMENT_INPUT_BYTES) { await reader.cancel(); throw new Error("This selection is too large to export in the browser. Choose a smaller scope."); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return parseDocumentEnvelope(JSON.parse(text));
  } finally { reader.releaseLock(); }
}

/** Limit the compatibility landing page to the audited read-only document endpoints. */
export function isDocumentSourcePath(value: string): boolean {
  let url: URL; try { url = new URL(value, "https://tsaat.invalid"); } catch { return false; }
  if (url.origin !== "https://tsaat.invalid" || !value.startsWith("/") || value.startsWith("//")) return false;
  return [
    /^\/api\/governance\/(end-point-insights|security-vulnerability-insights)\/report$/,
    /^\/api\/discovery\/installed-software-insights\/report$/,
    /^\/api\/discovery-coverage\/(endpoints|installed-software|security-vulnerabilities|shadow-it)\/export$/
  ].some(pattern => pattern.test(url.pathname));
}

/** A saved report keeps its original endpoint/entity; header edits must not silently change its selection. */
export function documentSourceMatchesHeader(source: string, header: URLSearchParams): boolean {
  if (!isDocumentSourcePath(source)) return false;
  const selection = new URL(source, "https://tsaat.invalid").searchParams;
  return sameWorkspaceScope(selection, header) &&
    (selection.get("dataDate")?.trim() ?? "") === (header.get("dataDate")?.trim() ?? "");
}
