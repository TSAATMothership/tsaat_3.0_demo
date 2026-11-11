"use client";

import { MAX_DOCUMENT_INPUT_BYTES, type DocumentProgress } from "@/lib/documents/contracts";
import { parseDocumentEnvelope, readDocumentEnvelope, type AnyDocumentEnvelope, type WorkerResponse } from "@/lib/documents/protocol";

export interface DocumentGenerationState { progress: DocumentProgress | null; active: boolean; error: string | null }
const idle: DocumentGenerationState = { progress: null, active: false, error: null };
let state = idle, sequence = 0;
const subscribers = new Set<() => void>();
let current: { id: number; controller: AbortController; worker?: Worker; trigger: HTMLElement | null; retry: () => Promise<void> } | null = null;
let retryLast: (() => Promise<void>) | null = null;
const publish = (next: DocumentGenerationState) => { state = next; subscribers.forEach(listener => listener()); };
export const getDocumentGenerationState = () => state;
export const getServerDocumentGenerationState = () => idle;
export const subscribeToDocumentGeneration = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export const isDocumentCancellation = (error: unknown) => error instanceof Error && error.name === "AbortError";
const aborted = () => new DOMException("Document generation cancelled.", "AbortError");

export function cancelDocumentGeneration() { current?.controller.abort(); }
export function dismissDocumentGeneration() { if (!current) { retryLast = null; publish(idle); } }
export async function retryDocumentGeneration() { const retry = retryLast; if (retry && !current) { try { await retry(); } catch { /* Dialog owns the actionable error state. */ } } }

async function runDocument(load: (signal: AbortSignal) => Promise<AnyDocumentEnvelope>, retry: () => Promise<void>) {
  if (current) throw new Error("A document is already being generated.");
  const task = { id: ++sequence, controller: new AbortController(), worker: undefined as Worker | undefined,
    trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null, retry };
  current = task; retryLast = null;
  const update = (stage: DocumentProgress["stage"], message: string, title = "Document") => publish({ active: true, error: null, progress: { id: task.id, stage, message, title } });
  update("loading", "Loading the selected evidence");
  try {
    // Paint the real progress state before large structured-clone or rendering work starts.
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    const job = await load(task.controller.signal);
    if (task.controller.signal.aborted) throw aborted();
    update("preparing", "Preparing the document layout", job.title);
    const result = await new Promise<{ bytes: Uint8Array; contentType: string }>((resolve, reject) => {
      const worker = new Worker(new URL("./document.worker.ts", import.meta.url), { type: "module" }); task.worker = worker;
      task.controller.signal.addEventListener("abort", () => { worker.terminate(); reject(aborted()); }, { once: true });
      worker.onerror = () => reject(new Error("The document generator could not start. Please reload and try again."));
      worker.onmessageerror = () => reject(new Error("Unable to read the generated document."));
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (task.controller.signal.aborted || (data.type === "progress" ? data.progress.id : data.id) !== task.id) return;
        if (data.type === "progress") publish({ active: true, error: null, progress: data.progress });
        else if (data.type === "result") resolve(data);
        else reject(new Error(data.message));
      };
      worker.postMessage({ id: task.id, job, assetBaseUrl: new URL("/", window.location.href).href });
    });
    if (task.controller.signal.aborted) throw aborted();
    update("saving", "Preparing your download", job.title);
    const url = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes).buffer], { type: result.contentType }));
    try {
      const link = document.createElement("a"); link.href = url; link.download = job.filename; link.hidden = true;
      document.body.append(link); link.click(); link.remove();
    } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    publish({ active: false, error: null, progress: { id: task.id, title: job.title, stage: "complete", message: "Your document has been downloaded." } });
  } catch (error) {
    if (isDocumentCancellation(error) || task.controller.signal.aborted) publish(idle);
    else {
      const message = error instanceof Error ? error.message : "Unable to generate the document. Please try again.";
      retryLast = task.retry;
      publish({ active: false, error: message, progress: { id: task.id, title: state.progress?.title ?? "Document", stage: "error", message } });
    }
    throw task.controller.signal.aborted ? aborted() : error;
  } finally {
    task.worker?.terminate(); current = null;
    // The native dialog also restores focus; wait until it has closed before focusing the trigger.
    window.requestAnimationFrame(() => { if (!state.error && task.trigger?.isConnected) task.trigger.focus(); });
  }
}

export async function generateDocumentFromUrl(url: string, init: RequestInit = {}): Promise<void> {
  const source = new URL(url, window.location.href);
  if (source.origin !== window.location.origin) throw new Error("Document data must come from this application.");
  const headers = new Headers(init.headers); headers.set("Accept", "application/json");
  const retry = () => generateDocumentFromUrl(url, init);
  await runDocument(async signal => readDocumentEnvelope(await fetch(source.href, { ...init, headers, cache: "no-store", signal })), retry);
}

export async function generateLocalDocument(input: AnyDocumentEnvelope): Promise<void> {
  const job = parseDocumentEnvelope(input);
  const retry = () => generateLocalDocument(job);
  await runDocument(async signal => {
    if (signal.aborted) throw aborted();
    if (new TextEncoder().encode(JSON.stringify(job)).byteLength > MAX_DOCUMENT_INPUT_BYTES) throw new Error("This selection is too large to export in the browser. Choose a smaller scope.");
    return job;
  }, retry);
}
