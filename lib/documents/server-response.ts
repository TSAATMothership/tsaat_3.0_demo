import type { DocumentEnvelope } from "@/lib/documents/contracts";

/** Retain bookmark URLs without ever constructing a file in the backend. */
export function documentResponse(request: Request, job: DocumentEnvelope<string, unknown>): Response {
  if (request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
    const source = new URL(request.url);
    const destination = new URL("/documents/generate", source.origin);
    destination.searchParams.set("source", source.pathname + source.search);
    // Keep the application header aligned with the report opened from a bookmark.
    for (const key of ["network", "system", "securityDomain", "dataDate"]) {
      for (const value of source.searchParams.getAll(key)) destination.searchParams.append(key, value);
    }
    return new Response(null, { status: 303, headers: { Location: destination.toString(), "Cache-Control": "no-store" } });
  }
  return Response.json(job, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
