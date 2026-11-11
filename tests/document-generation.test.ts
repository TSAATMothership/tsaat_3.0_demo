import { safeDocumentFilename } from "@/lib/documents/contracts";
import { isDocumentSourcePath, parseDocumentEnvelope, readDocumentEnvelope } from "@/lib/documents/protocol";
import { documentResponse } from "@/lib/documents/server-response";
import { describe, expect, it } from "vitest";
const job = { version: 1 as const, kind: "pdf-example", filename: "example.pdf", title: "Example report", generatedAt: "2026-11-09T01:02:03Z", data: { snapshotDate: "2026-11-07" } };
describe("browser document transport", () => {
    it.each([".pdf", ".xlsx", ".xls"])("preserves the %s format when configured report names are long", extension => {
        const filename = parseDocumentEnvelope({ ...job, filename: "Report/" + "a".repeat(250) + extension }).filename;
        expect(filename).toHaveLength(220);
        expect(filename).toMatch(/^Report_/);
        expect(filename.endsWith(extension)).toBe(true);
        expect(safeDocumentFilename("a".repeat(215) + "😀-report.pdf")).toBe("a".repeat(215) + ".pdf");
    });
    it("returns scoped JSON data, never a generated attachment", async () => {
        const response = documentResponse(new Request("http://localhost/api/example", { headers: { Accept: "application/json" } }), job);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(response.headers.get("content-disposition")).toBeNull();
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await readDocumentEnvelope(response)).toEqual(job);
    });
    it("retains old browser GET links through the client generation page and preserves their entire selection", () => {
        const source = "/api/governance/end-point-insights/report?format=pdf&dataDate=2026-10-31&network=net-1&network=net-2&system=sys-1&securityDomain=NONE";
        const response = documentResponse(new Request("http://localhost" + source, { headers: { Accept: "text/html" } }), job);
        expect(response.status).toBe(303);
        const target = new URL(response.headers.get("location")!);
        expect(target.pathname).toBe("/documents/generate");
        expect(target.searchParams.get("source")).toBe(source);
        expect(target.searchParams.getAll("network")).toEqual(["net-1", "net-2"]);
        expect(target.searchParams.get("system")).toBe("sys-1");
        expect(target.searchParams.get("securityDomain")).toBe("NONE");
        expect(target.searchParams.get("dataDate")).toBe("2026-10-31");
        expect(target.searchParams.has("kind")).toBe(false);
    });
    it("rejects incomplete or unsupported response contracts and accepts chunked Unicode JSON", async () => {
        for (const invalid of [null, {}, { ...job, version: 2 }, { ...job, generatedAt: "invalid" }, { ...job, filename: "run.html" }, { ...job, data: null }])
            expect(() => parseDocumentEnvelope(invalid)).toThrow();
        const bytes = new TextEncoder().encode(JSON.stringify({ ...job, title: "Résumé – 日本語" }));
        const response = new Response(new ReadableStream({ start(controller) {
                for (let offset = 0; offset < bytes.length; offset += 3)
                    controller.enqueue(bytes.slice(offset, offset + 3));
                controller.close();
            } }), { headers: { "Content-Type": "application/json" } });
        expect((await readDocumentEnvelope(response)).title).toBe("Résumé – 日本語");
        await expect(readDocumentEnvelope(new Response("%PDF", { headers: { "Content-Type": "application/pdf" } }))).rejects.toThrow("did not return document data");
        await expect(readDocumentEnvelope(new Response("{}", { status: 409 }))).rejects.toThrow("Reload the page");
    });
    it("allows only audited document endpoints on the compatibility page", () => {
        for (const path of ["/api/discovery-coverage/endpoints/export?network=net-1", "/api/governance/end-point-insights/report?securityDomain=NONE"])
            expect(isDocumentSourcePath(path)).toBe(true);
        for (const path of ["https://evil.invalid/api/tasking-report", "//evil.invalid/api/tasking-report", "/api/settings/database", "/api/settings/personas", "/api/findings/export", "/api/tasking-report", "/api/tasking-report/extra"])
            expect(isDocumentSourcePath(path)).toBe(false);
    });
});
