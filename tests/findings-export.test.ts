import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/findings/export/route";
import { readXlsxTextEntries as readXlsxEntries, renderWorkbookResponse } from "./workbook-test-utils";
import { assetDetails, configuration, exportContext, finding } from "./fixtures/findings-export";

const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/findings-register-data", () => ({ loadFindingsRegisterData: load }));
const request = (body: unknown) => new NextRequest("http://localhost/api/findings/export", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});
const rows = Array.from({ length: 80 }, (_, index) => finding(`finding-${index}`, index < 75 ? "0001" : "other-ci"));
const data = () => ({ findings: rows, assetDetailsByAssetId: assetDetails, findingDisplayConfiguration: configuration,
  exportContext, selectedAsOf: exportContext.asOf });
beforeEach(() => { load.mockReset(); load.mockResolvedValue(data()); });

describe("findings export route", () => {
  it("exports only the matching selection beyond pagination, in requested order, with its affected CIs", async () => {
    const findingIds = rows.slice(0, 75).reverse().map((row) => row.id);
    const response = await POST(request({ ...exportContext, findingIds }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(load).toHaveBeenCalledWith({ ...exportContext.scope, asOf: exportContext.asOf, findingsTab: "open" });
    const zip = readXlsxEntries(await renderWorkbookResponse(response));
    const findings = zip.get("xl/worksheets/sheet1.xml")!;
    expect(findings.match(/<row /g)).toHaveLength(76);
    expect(findings.indexOf('>finding-74</t>')).toBeLessThan(findings.indexOf('>finding-0</t>'));
    expect(findings).not.toContain('>finding-75</t>');
    const cis = zip.get("xl/worksheets/sheet2.xml")!;
    expect(cis.match(/<row /g)).toHaveLength(2);
    expect(cis).not.toContain("other-ci");
  });
  it("passes ICT system scope, historical date and closed status to the same data loader as the page", async () => {
    const context = { ...exportContext, scope: { ...exportContext.scope, network: [], system: ["sys-1"] }, status: "closed" };
    load.mockResolvedValue({ ...data(), findings: [finding("closed", "0001", "closed")], exportContext: context });
    const response = await POST(request({ ...context, findingIds: ["closed"] }));
    expect(response.status).toBe(200);
    expect(load).toHaveBeenCalledWith({ ...context.scope, asOf: context.asOf, findingsTab: "closed" });
  });
  it.each([
    { scope: { ...exportContext.scope, network: [] } },
    { scope: { ...exportContext.scope, system: ["sys-1"] } },
    { scope: { ...exportContext.scope, dataDate: "2026-02-31" } },
    { findingIds: [] }, { findingIds: [123] }, { asOf: "invalid" }, { status: "other" }
  ])("rejects invalid input before loading data: %j", async (invalid) => {
    expect((await POST(request({ ...exportContext, findingIds: ["finding-1"], ...invalid }))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });
  it("rejects findings outside the selected scope/status/date instead of silently exporting fewer rows", async () => {
    expect((await POST(request({ ...exportContext, findingIds: ["finding-1", "out-of-scope"] }))).status).toBe(409);
  });
  it.each([
    { selectedAsOf: "2026-10-29" },
    { exportContext: { ...exportContext, scope: { ...exportContext.scope, dataDate: "2026-10-31" } } }
  ])("rejects an unavailable date or snapshot: %j", async (changed) => {
    load.mockResolvedValue({ ...data(), ...changed });
    expect((await POST(request({ ...exportContext, findingIds: ["finding-1"] }))).status).toBe(409);
  });
  it("reports failures without leaking database details", async () => {
    load.mockRejectedValue(new Error("Private database details"));
    const response = await POST(request({ ...exportContext, findingIds: ["finding-1"] }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private");
  });
});
