import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { POST } from "@/app/api/discovery-coverage/patch-management/export/route";
import { buildPatchManagementRows } from "@/lib/patch-management-explorer";
import { enrichPatchManagement } from "../scripts/enrich-patch-management.mjs";
import { buildPatchManagementWorkbook } from "@/lib/patch-management-workbook";
import { readXlsxEntries } from "@/lib/network-target-state-template-workbook";
import type { Dataset } from "@/lib/types";
const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data-loader", () => ({ loadPatchManagementExplorerData: load }));
const dataset: Dataset = enrichPatchManagement(JSON.parse(readFileSync("data/current.json", "utf8")));
const scope = { network: ["net-1"], system: [], dataDate: dataset.snapshotDate };
const rows = buildPatchManagementRows(dataset, { network: dataset.managedNetworks.map(network => network.id) });
const sheet = (bytes: Buffer) => readXlsxEntries(bytes).get("xl/worksheets/sheet1.xml")!.toString();
const request = (value: unknown) => new NextRequest("http://localhost/api/discovery-coverage/patch-management/export", { method: "POST", body: JSON.stringify(value) });
beforeEach(() => { load.mockReset(); load.mockResolvedValue({ snapshotDate: dataset.snapshotDate, rows }); });
describe("patch management export", () => {
  it("exports all view fields, numeric counts, native dates and formula-safe text", () => {
    const xml = sheet(buildPatchManagementWorkbook([{ ...rows[0], owner: "=1+1", missingUpdates: 7, installedPatchLevel: "01.002", lastRestartedDate: "2026-04-20T00:00:00Z" }]));
    expect(xml).toContain("Last Restarted (UTC)"); expect(xml).toContain("Assessment Valid Until"); expect(xml).toContain("Exception Reason");
    expect(xml).toContain(">=1+1</t>"); expect(xml).not.toContain("<f>"); expect(xml).toContain(">01.002</t>");
    expect(xml).toContain("<v>7</v>"); expect(xml).toContain('s="2"><v>'); expect(xml).toContain("Export Timestamp (UTC)");
  });
  it("reapplies numeric and facet filters beyond a page using the selected table view", async () => {
    const result = await POST(request({ scope, view: "posture", filters: { search: "", columns: { status: ["Not patched"] }, ranges: { missingUpdates: { min: 1 } } } }));
    expect(result.status).toBe(200); expect(load).toHaveBeenCalledWith(scope);
    const expected = rows.filter(row => row.status === "Not patched" && Number(row.missingUpdates) >= 1).length;
    expect(expected).toBeGreaterThan(25);
    expect(sheet(Buffer.from(await result.arrayBuffer())).match(/<row /g)).toHaveLength(expected + 1);
    const hiddenSearch = await POST(request({ scope, view: "posture", filters: { search: "Sample Server Operations", columns: {} } }));
    expect(sheet(Buffer.from(await hiddenSearch.arrayBuffer())).match(/<row /g)).toHaveLength(1);
  });
  it("rejects malformed or unscoped requests and hides backend errors", async () => {
    for (const body of [{ scope: { ...scope, network: [] }, view: "posture" }, { scope: { ...scope, system: ["sys-1"] }, view: "posture" }, { scope, view: "invalid" }])
      expect((await POST(request({ ...body, filters: { search: "", columns: {} } }))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
    load.mockRejectedValue(new Error("Private connection details"));
    const failed = await POST(request({ scope, view: "restarts", filters: { search: "", columns: {} } }));
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("Private");
  });
});
