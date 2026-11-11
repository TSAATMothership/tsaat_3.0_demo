/** The shared wire contract contains evidence and presentation metadata, never document bytes. */
export interface DocumentEnvelope<Kind extends string, Data> {
  version: 1;
  kind: Kind;
  filename: string;
  title: string;
  generatedAt: string;
  data: Data;
}

export interface DocumentRenderContext {
  /** Absolute, trailing-slash URL for this installation's bundled public assets. */
  assetBaseUrl: string;
  onProgress: (message: string, completed?: number, total?: number) => void;
}

export type DocumentStage = "loading" | "preparing" | "generating" | "saving" | "complete" | "error";
export interface DocumentProgress {
  id: number;
  title: string;
  stage: DocumentStage;
  message: string;
  completed?: number;
  total?: number;
}

export const DOCUMENT_SCHEMA_VERSION = 1;
export const MAX_DOCUMENT_INPUT_BYTES = 64 * 1024 * 1024;

/** File names are supplied by validated data routes and still normalized at the download boundary. */
export function safeDocumentFilename(filename: string): string {
  const cleaned = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  const extension = cleaned.match(/\.(?:pdf|xlsx|xls)$/i)?.[0] ?? "";
  const basename = extension ? cleaned.slice(0, -extension.length) : cleaned;
  // Keep the format suffix (and complete UTF-16 characters) when shortening configurable report names.
  return basename.slice(0, 220 - extension.length).replace(/[\uD800-\uDBFF]$/, "") + extension;
}
