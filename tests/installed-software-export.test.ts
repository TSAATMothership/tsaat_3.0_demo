import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/discovery-coverage/installed-software/export/route";
import { emptySoftwareFilters, SOFTWARE_COLUMNS, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import { buildInstalledSoftwareWorkbook } from "@/lib/installed-software-workbook";
import { readXlsxEntries } from "@/lib/network-target-state-template-workbook";

const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data-loader", () => ({ loadInstalledSoftwareExplorerData: load }));
const scope = { network: ["net-1"], system: [], dataDate: "2026-10-31" };
const rows: InstalledSoftwareRecord[] = Array.from({ length: 80 }, (_, index) => ({
  assetId: `a${index}`, softwareOrdinal: 1, softwareName: index < 75 ? "Agent" : "Database", softwareVersion: "01.020",
  filePath: "C:\\Program Files\\Agent\\agent.exe", lastDiscoveredDate: "2026-10-30T12:30:00Z", discoveredBy: null,
  deviceName: "=1+1 <device> & peer", deviceModel: null, osName: "Windows", osVersion: "11.001", osPatchLevel: "KB123456"
}));
const request = (body: unknown) => new NextRequest("http://localhost/api/discovery-coverage/installed-software/export", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});
const sheet = (buffer: Buffer) => readXlsxEntries(buffer).get("xl/worksheets/sheet1.xml")!.toString("utf8");
beforeEach(() => { load.mockReset(); load.mockResolvedValue({ snapshotDate: "2026-10-31", rows }); });

describe("installed software Excel export", () => {
  it("has all ten fields plus a native UTC timestamp on every exported row", () => {
    const exportedAt = new Date("2026-10-31T06:07:08Z");
    const xml = sheet(buildInstalledSoftwareWorkbook(rows, exportedAt));
    for (const { label } of SOFTWARE_COLUMNS) expect(xml).toContain(`>${label}</t>`);
    expect(xml).toContain("Export Timestamp (UTC)");
    expect(xml).toContain('autoFilter ref="A1:K81"');
    expect(xml).toContain('state="frozen"');
    const times = [...xml.matchAll(/<c r="K\d+" s="2"><v>([^<]+)<\/v><\/c>/g)].map((match) => Number(match[1]));
    expect(times).toHaveLength(80);
    expect(new Set(times).size).toBe(1);
    expect(times[0]).toBeCloseTo(exportedAt.getTime() / 86400000 + 25569, 8);
    expect(xml).toContain('t="inlineStr"><is><t xml:space="preserve">01.020</t>');
    expect(xml).toContain('>=1+1 &lt;device&gt; &amp; peer</t>');
    expect(xml).toContain('>C:\\Program Files\\Agent\\agent.exe</t>');
    expect(xml).not.toContain("<f>");
    expect(xml).toContain('<c r="D2" s="2"><v>');
    expect(xml).toContain('<c r="G2" s="0" t="inlineStr"><is><t xml:space="preserve"></t>');
  });
  it("exports all matching installations beyond one UI page", async () => {
    const response = await POST(request({ scope, filters: { ...emptySoftwareFilters(), columns: { softwareName: ["Agent"] } } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(load).toHaveBeenCalledWith(scope);
    const xml = sheet(Buffer.from(await response.arrayBuffer()));
    expect(xml.match(/<row /g)).toHaveLength(76);
    expect(xml.match(/<c r="K\d+" s="2"/g)).toHaveLength(75);
    expect(xml).not.toContain("Database");
  });
  it.each([{ ...scope, network: [] }, { ...scope, system: ["sys-1"] }, { ...scope, network: [123] }, { ...scope, dataDate: ["2026-10-31"] }])("rejects invalid scope %j", async (invalid) => {
    expect((await POST(request({ scope: invalid, filters: emptySoftwareFilters() }))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });
  it("supports empty filtered results", async () => {
    const response = await POST(request({ scope, filters: { ...emptySoftwareFilters(), search: "no such product" } }));
    expect(sheet(Buffer.from(await response.arrayBuffer()))).toContain('dimension ref="A1:K1"');
  });
  it("does not leak connection details on database failure", async () => {
    load.mockRejectedValue(new Error("Private connection details"));
    const response = await POST(request({ scope, filters: emptySoftwareFilters() }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private");
  });
});
