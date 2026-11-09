import { expect } from "vitest";
import { readXlsxEntries } from "@/lib/xlsx-zip";
import { renderWorkbookDocument, type WorkbookDocumentJob } from "@/lib/documents/workbooks";

export function readXlsxTextEntries(bytes: Uint8Array): Map<string, string> {
  return new Map([...readXlsxEntries(bytes)].map(([name, value]) => [name, new TextDecoder().decode(value)]));
}

/** Exercise the exact JSON-to-browser-renderer boundary, rather than accepting backend document bytes. */
export async function renderWorkbookResponse(response: Response): Promise<Uint8Array> {
  expect(response.headers.get("Content-Type")).toContain("application/json");
  expect(response.headers.get("Content-Disposition")).toBeNull();
  const job: WorkbookDocumentJob = await response.json();
  expect(job.version).toBe(1);
  expect(job.kind).toMatch(/^xlsx-/);
  expect(job.filename).toMatch(/\.xlsx$/);
  return renderWorkbookDocument(job, { assetBaseUrl: "http://localhost/", onProgress: () => undefined });
}
