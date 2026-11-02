import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/discovery-coverage/shadow-it/export/route";
import { emptyShadowFilters, SHADOW_COLUMNS, type ShadowItRecord } from "@/lib/shadow-it-explorer";
import { buildShadowItWorkbook } from "@/lib/shadow-it-workbook";
import { readXlsxEntries } from "@/lib/network-target-state-template-workbook";
const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data-loader", () => ({ loadShadowItExplorerData: load }));
const scope = { network: ["net-1"], system: [], dataDate: "2026-10-31" };
const base: ShadowItRecord = { assetId: "node-1", ownerAssetId: "owner-1", ipAddress: "10.88.0.1", discoveryApproach: "ARP Table", lastDiscoveredDate: "2026-10-30T10:00:00Z",
  discoveredBy: "Collector", endpointName: "=1+1 <switch>", endpointCiType: "Network Device", endpointIpAddress: "10.77.0.1", endpointMacAddress: "02:77:00:00:00:01",
  endpointDeviceModel: "Model", endpointLastDiscoveredDate: "2026-10-20T10:00:00Z", endpointDiscoveredBy: "Agent", endpointManagedNetwork: "East" };
const request = (body: unknown) => new NextRequest("http://localhost/api/discovery-coverage/shadow-it/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const sheet = (buffer: Buffer) => readXlsxEntries(buffer).get("xl/worksheets/sheet1.xml")!.toString("utf8");
beforeEach(() => { load.mockReset(); load.mockResolvedValue({ snapshotDate: "2026-10-31", rows: Array.from({ length: 80 }, (_, index) => ({ ...base, assetId: `node-${index}`, discoveryApproach: index < 75 ? "ARP Table" : "IP Scan" })) }); });
describe("Shadow IT Excel export", () => {
  it("exports 12 columns plus a UTC timestamp; scan owner columns are literal N/A", () => {
    const exportedAt = new Date("2026-10-31T10:00:00Z");
    const xml = sheet(buildShadowItWorkbook([base, { ...base, discoveryApproach: "IP Scan" }], exportedAt));
    for (const { label } of SHADOW_COLUMNS) expect(xml).toContain(`>${label}</t>`);
    expect(xml).toContain('autoFilter ref="A1:M3"');
    expect(xml).toContain('>Export Timestamp (UTC)</t>');
    expect(xml).toContain('>=1+1 &lt;switch&gt;</t>');
    expect(xml).not.toContain('<f>');
    expect(xml).toContain('<c r="C2" s="2"><v>');
    expect(xml).toContain('<c r="J2" s="2"><v>');
    for (const column of ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) expect(xml).toContain(`<c r="${column}3" s="0" t="inlineStr"><is><t xml:space="preserve">N/A</t>`);
    const times = [...xml.matchAll(/<c r="M\d+" s="2"><v>([^<]+)<\/v><\/c>/g)].map((match) => Number(match[1]));
    expect(times).toHaveLength(2); expect(new Set(times).size).toBe(1);
    expect(times[0]).toBeCloseTo(exportedAt.getTime() / 86400000 + 25569, 8);
  });
  it("exports all 75 matching rows across UI pages under the applied scope", async () => {
    const response = await POST(request({ scope, filters: { ...emptyShadowFilters(), columns: { discoveryApproach: ["ARP Table"] } } }));
    expect(response.status).toBe(200); expect(load).toHaveBeenCalledWith(scope);
    const xml = sheet(Buffer.from(await response.arrayBuffer()));
    expect(xml.match(/<row /g)).toHaveLength(76); expect(xml).not.toContain('IP Scan');
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
  });
  it.each([{ ...scope, network: [] }, { ...scope, system: ["sys-1"] }, { ...scope, network: [123] }])("rejects invalid scope %j", async (invalid) => {
    expect((await POST(request({ scope: invalid, filters: emptyShadowFilters() }))).status).toBe(400); expect(load).not.toHaveBeenCalled();
  });
  it("returns a controlled failure when SQL is unavailable", async () => {
    load.mockRejectedValue(new Error("Private connection details"));
    const response = await POST(request({ scope, filters: emptyShadowFilters() }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("Private");
  });
});
