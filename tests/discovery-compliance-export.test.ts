import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/discovery-coverage/compliance/export/route";
import { emptyDiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { readXlsxEntries } from "@/lib/network-target-state-template-workbook";
const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/app-data", () => ({ getCoreAppData: load }));
const scope = { network: "net-1", system: "sys-1", dataDate: "2026-10-31", environment: "Production", securityDomain: "Protected", assetType: "server", mission: "mission-1", service: "service-1" };
const request = (body: unknown) => new NextRequest("http://localhost/api/discovery-coverage/compliance/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  load.mockReset();
  const assets = Array.from({ length: 80 }, (_, index) => ({ id: `ci-${index}`, hostname: index === 0 ? '=1+1 <test>' : `CI ${index}`, name: `CI ${index}`, type: "server", networkId: "net-1", lastDiscoveredDate: index < 20 ? "2026-10-29T13:00:00Z" : null, discoveredBy: index < 20 ? "Tanium" : null, systemContext: { systemId: "sys-1", environmentType: "Production" } }));
  const settings = defaultDiscoveryToolsSettings(); settings.tools = settings.tools.slice(0, 1);
  load.mockResolvedValue({ discoveryToolsSettings: settings, analytics: { evaluations: assets.map((asset) => ({ assetId: asset.id })) }, dataset: {
    snapshotDate: "2026-10-31", assets, managedNetworks: [{ id: "net-1", name: "North" }], ictSystems: [{ id: "sys-1", name: "System A" }],
    discoveryCoverageEvaluations: assets.map((asset, index) => ({ assetId: asset.id, toolValues: { ucmdb: index < 75 ? 0 : 1 }, coverageCompliance: false, missingToolIds: [], missingToolNames: [] }))
  }});
});
describe("discovery compliance export", () => {
  it("exports every matching CI beyond the visible page using the same mappings, page filters and column filters", async () => {
    const response = await POST(request({ scope: { ...scope, criticality: "Critical", discoveryView: "compliance" }, filters: { search: "", columns: { missingTools: ["UCMDB"] } } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(load).toHaveBeenCalledWith({ ...scope, network: ["net-1"], system: ["sys-1"] }, { profile: "summary" });
    const sheet = readXlsxEntries(Buffer.from(await response.arrayBuffer())).get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet.match(/<row /g)).toHaveLength(76);
    expect(sheet).toContain('autoFilter ref="A1:K76"');
    expect(sheet).toContain("Export Timestamp (UTC)");
    expect(sheet).toContain("Last Discovered Date");
    expect(sheet).toContain("Discovered By");
    const dateValue = sheet.match(/<c r="D2" s="2"><v>([^<]+)<\/v>/)?.[1];
    expect(Number(dateValue)).toBeCloseTo(Date.parse("2026-10-29T13:00:00Z") / 86400000 + 25569, 8);
    expect(sheet).toContain('>Tanium</t>');
    expect(sheet).toContain('>Not recorded</t>');
    expect(sheet).toContain("=1+1 &lt;test&gt;");
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain(">Coverage gaps</t>");
    expect(sheet).toContain(">UCMDB</t>");
    expect(sheet).not.toContain(">CI 79</t>");
  });
  it("applies discovery date and source column selections to every exported row", async () => {
    const response = await POST(request({ scope, filters: { search: "", columns: { lastDiscoveredDate: ["2026-10-29"], discoveredBy: ["Tanium"] } } }));
    expect(response.status).toBe(200);
    const sheet = readXlsxEntries(Buffer.from(await response.arrayBuffer())).get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet.match(/<row /g)).toHaveLength(21);
    expect(sheet).toContain('autoFilter ref="A1:K21"');
    expect(sheet).not.toContain('>CI 20</t>');
  });
  it.each([{}, { network: [], system: [], dataDate: "2026-10-31" }, { ...scope, dataDate: "bad-date" }, { ...scope, network: [123] }])("rejects invalid scope %j", async (invalid) => {
    expect((await POST(request({ scope: invalid, filters: emptyDiscoveryComplianceFilters() }))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });
  it("returns a clear error without exposing database details", async () => {
    load.mockRejectedValue(new Error("Private connection details"));
    const response = await POST(request({ scope, filters: emptyDiscoveryComplianceFilters() }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private");
  });
});
