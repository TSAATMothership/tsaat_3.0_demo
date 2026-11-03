import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/discovery-coverage/endpoints/export/route";
import { emptyEndpointFilters } from "@/lib/endpoint-explorer";
import { readXlsxEntries } from "@/lib/network-target-state-template-workbook";

const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data-loader", () => ({ loadEndpointExplorerData: load }));
const scope = { network: ["net-1"], system: [], dataDate: "2026-10-31" };
const request = (body: unknown) => new NextRequest("http://localhost/api/discovery-coverage/endpoints/export", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});

beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue({ snapshotDate: "2026-10-31", rows: Array.from({ length: 80 }, (_, index) => ({ securityDomain: "UNKNOWN",
    assetId: `a${index}`, name: `Device ${index}`, ciType: index < 75 ? "Server" : "Workstation", ipAddress: "10.0.0.1",
    macAddress: null, deviceModel: null, lastDiscoveredDate: null, discoveredBy: null, managedNetwork: "West"
  })) });
});

describe("endpoint export route", () => {
  it("exports all matching records under the applied scope with no pagination limit", async () => {
    const response = await POST(request({ scope, filters: { ...emptyEndpointFilters(), columns: { ciType: ["Server"] } } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(load).toHaveBeenCalledWith(scope);
    const sheet = readXlsxEntries(Buffer.from(await response.arrayBuffer())).get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet.match(/<row /g)).toHaveLength(76);
    expect(sheet).not.toContain("Workstation");
    expect(sheet.match(/<c r="J\d+" s="2"/g)).toHaveLength(75);
  });

  it.each([{ ...scope, network: [] }, { ...scope, system: ["sys-1"] }, { ...scope, network: [123] },
    { ...scope, dataDate: ["2026-10-31"] }, { ...scope, dataDate: "invalid" }])("rejects invalid or ambiguous scope %j", async (invalid) => {
    expect((await POST(request({ scope: invalid, filters: emptyEndpointFilters() }))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it("reports database failures without leaking connection details", async () => {
    load.mockRejectedValue(new Error("Private connection details"));
    const response = await POST(request({ scope, filters: emptyEndpointFilters() }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private");
  });
});
